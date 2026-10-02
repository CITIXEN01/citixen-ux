// Shared in-memory data store for the coverage API.
//
// PRIVACY NOTE: cells here carry only anonymous, public facts — covered,
// category, verifiedDate. There is deliberately no "who reported this"
// field anywhere in this store. That matches the product's own promise
// ("no account required, no personal data retained") and it's also just
// correct modeling: "reported by me" is relative to whoever is looking,
// so it can never be a property of a shared/public record — it has to be
// computed on each citizen's own device from their own local history.
// See app.html's localStorage-backed "My Impact" ledger for that half.
//
// NOTE ON WHAT THIS IS AND ISN'T:
// Vercel serverless functions are stateless between cold starts — this
// module-level object only survives across requests that happen to land on
// the same warm lambda instance. That's fine for demoing the API *contract*
// (the routes, the request/response shapes, the ingestion flow), but it is
// NOT how this should be built for production. A real deployment swaps this
// file for a PostGIS-backed read (or Postgres + a geospatial index like H3),
// keyed exactly the same way: state -> city -> ward -> cells. Every route
// file below only talks to this module, so that swap doesn't touch them.
//
// MUNICIPAL HIERARCHY: State -> City -> Ward -> Grid Blocks. A "ward" here
// is an official council district led by a named Alderman/Council Member —
// `alderman` and the health-index fields below are ward-level governance
// metadata, not derived from the cell grid, because in production they come
// from the municipality's own reporting (SLA compliance, road condition
// surveys, etc.), not from citizen-reported blocks.

const CATEGORIES = ['Pothole', 'Streetlight', 'Signage', 'Sidewalk', 'Drainage'];

// Original, hand-authored Ward 4 layout — kept exactly as-is (specific
// covered-cell list, not a generated spread) since it's the ward every
// existing demo/test/screenshot has been built against.
function buildWard4Cells() {
  const covered = [1, 2, 3, 4, 10, 11, 12, 13, 14, 20, 21, 22, 30, 31, 32, 33, 40, 41, 42, 43, 44, 50, 51, 52, 60, 61, 62, 63, 70, 71, 72, 73, 74, 75];
  const cells = [];
  for (let i = 0; i < 80; i++) {
    const isCovered = covered.includes(i);
    cells.push({
      id: i,
      covered: isCovered,
      category: isCovered ? CATEGORIES[i % CATEGORIES.length] : null,
      verifiedDate: isCovered ? ('Sep ' + (10 + (i % 18)) + ', 2026') : null
    });
  }
  return cells;
}

// Generic generator for every other ward: spreads `coveredCount` covered
// cells evenly across `total` blocks (rather than randomly), so the grid
// still reads as "real" progress rather than noise.
function buildCells(total, coveredCount, seedOffset) {
  seedOffset = seedOffset || 0;
  const coveredSet = new Set();
  if (coveredCount > 0) {
    const step = total / coveredCount;
    for (let k = 0; k < coveredCount; k++) {
      coveredSet.add(Math.floor(k * step + seedOffset) % total);
    }
  }
  const cells = [];
  for (let i = 0; i < total; i++) {
    const isCovered = coveredSet.has(i);
    cells.push({
      id: i,
      covered: isCovered,
      category: isCovered ? CATEGORIES[(i + seedOffset) % CATEGORIES.length] : null,
      verifiedDate: isCovered ? ('Sep ' + (10 + ((i + seedOffset) % 18)) + ', 2026') : null
    });
  }
  return cells;
}

// Module-level singleton, pinned to globalThis so repeated requires (and hot
// warm-lambda reuse) don't reset it mid-demo.
const DB = globalThis.__CITIXEN_COVERAGE_DB__ || (globalThis.__CITIXEN_COVERAGE_DB__ = {
  wi: {
    name: 'Wisconsin',
    cities: {
      'la-crosse': {
        name: 'La Crosse',
        wards: {
          'ward-4': {
            name: 'District 4',
            alderman: 'Ald. Rebecca Voss',
            healthIndex: 82,
            slaPct: 91,
            roadPct: 78,
            lightingPct: 88,
            capExScopedUSD: 482600,
            cells: buildWard4Cells()
          },
          'ward-7': {
            name: 'District 7',
            alderman: 'Ald. Marcus Dahl',
            healthIndex: 74,
            slaPct: 85,
            roadPct: 70,
            lightingPct: 80,
            capExScopedUSD: 310000,
            cells: buildCells(64, 40, 3)
          }
        }
      },
      milwaukee: {
        name: 'Milwaukee',
        wards: {
          'ward-12': {
            name: 'District 12',
            alderman: 'Ald. Priya Shah',
            healthIndex: 79,
            slaPct: 88,
            roadPct: 75,
            lightingPct: 84,
            capExScopedUSD: 1150000,
            cells: buildCells(120, 70, 1)
          }
        }
      }
    }
  },
  il: {
    name: 'Illinois',
    cities: {
      chicago: {
        name: 'Chicago',
        wards: {
          'ward-3': {
            name: 'District 3',
            alderman: 'Ald. Denise Coleman',
            healthIndex: 76,
            slaPct: 86,
            roadPct: 72,
            lightingPct: 81,
            capExScopedUSD: 940000,
            cells: buildCells(100, 55, 2)
          }
        }
      }
    }
  }
  // Onboarding a new city/state is adding an entry here (or, in production,
  // a row in the municipality table) — the route files never change.
});

// =====================================================================
// PUBLIC LEDGER SEED TICKETS + "THE BIG 3" METRICS
// -----------------------------------------------------------------
// Illustrative, hand-authored ticket records backing the Live Public
// Ledger (see index.html/app.html's ledger drawer and report.html's
// per-report deep link view). Same honesty convention as the coverage
// cells above: this is demo/seed data, clearly not a live database, and
// every metric this session computes ("The Big 3") is a real aggregate
// computed FROM these records at request time — never a hand-typed
// headline number. `verified` records whether the closing photo was
// server-side EXIF/GPS-verified on site (true) or the ticket was closed
// from a desk with no field proof (false) — deliberately mixed so the
// Resolution Verification Rate below is a real, non-trivial percentage.
//
// `reportId` (e.g. "D4-PTH-261001-8092") follows the national 4-part
// ticket taxonomy [ZONE]-[HAZARD]-[YYMMDD]-[HASH]:
//   ZONE   — 'D' + the district number (same number the ward slug already
//            carries, e.g. 'ward-4' -> 'D4'; district numbering IS the
//            existing ward numbering, just relabeled).
//   HAZARD — a fixed 3-letter code for the ticket's own real `category`.
//   YYMMDD — derived from the ticket's own real `submittedAgo` age against
//            the current time, not a fabricated/frozen date — a ticket
//            logged "3d ago" always resolves to today minus 3 days.
//   HASH   — a stable hash of the ticket's own id, so the same ticket
//            always resolves to the same shareable /report/:id URL rather
//            than a random one that would change on every reload.
function hashTo4Digits(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return 1000 + (h % 9000);
}

const HAZARD_CODES = {
  pothole: 'PTH', streetlight: 'LGT', light: 'LGT', drainage: 'DRN',
  signage: 'SGN', sidewalk: 'ADA', waste: 'WST', litter: 'WST', trash: 'WST'
};
function hazardCode(category) {
  return HAZARD_CODES[String(category || '').toLowerCase().trim()] || 'GEN';
}

// Dynamic departmental routing: parses a submitted report's free-text
// description for a specific hazard keyword and returns the matching
// taxonomy code — a finer-grained signal than the 5-value CATEGORIES list
// above can carry (that list has no slot for a park bench, graffiti, or a
// biohazard spill). Checked in priority order so an overlapping word (e.g.
// "signal" containing "sign") resolves to the more specific department.
// Mirrors app.html's classifyHazard() exactly, so a citizen sees the same
// department their ticket actually gets routed to server-side.
const DESCRIPTION_HAZARD_GROUPS = [
  { code: 'PRK', keywords: ['planter', 'plant', 'tree', 'park', 'bench'] },
  { code: 'BIO', keywords: ['vomit', 'spill', 'biohazard'] },
  { code: 'WST', keywords: ['overflow', 'trash', 'litter', 'waste', 'dump'] },
  { code: 'SIG', keywords: ['signal'] },
  { code: 'LGT', keywords: ['light', 'power', 'dark', 'wire'] },
  { code: 'VAN', keywords: ['graffiti', 'vandalism', 'vandalize', 'stolen'] },
  { code: 'SGN', keywords: ['sign'] },
  { code: 'ADA', keywords: ['sidewalk', 'ada', 'ramp'] },
  { code: 'PTH', keywords: ['pothole', 'asphalt', 'pavement', 'gap'] },
  { code: 'DRN', keywords: ['drainage'] }
];
function classifyDescriptionHazard(description) {
  const t = String(description || '').toLowerCase();
  for (const group of DESCRIPTION_HAZARD_GROUPS) {
    for (const kw of group.keywords) {
      if (new RegExp('\\b' + kw + '\\b').test(t)) return group.code;
    }
  }
  return null;
}

// Real age ("3d ago", "45m ago", "0m ago" for a just-submitted ticket) back
// into a calendar date, so the YYMMDD segment reflects this ticket's own
// recency rather than a made-up timestamp field.
function dateCodeFromAgo(agoStr) {
  const m = /^(\d+)\s*([mhd])/i.exec(String(agoStr || '').trim());
  let ms = 0;
  if (m) {
    const n = parseInt(m[1], 10);
    ms = m[2].toLowerCase() === 'm' ? n * 60000 : m[2].toLowerCase() === 'h' ? n * 3600000 : n * 86400000;
  }
  const d = new Date(Date.now() - ms);
  return String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

function makeReportId(wardSlug, ticketId, category, submittedAgo, hazardOverride) {
  const wardNum = (String(wardSlug).match(/\d+/) || ['0'])[0];
  const code = hazardOverride || hazardCode(category);
  return ['D' + wardNum, code, dateCodeFromAgo(submittedAgo), hashTo4Digits(String(ticketId))].join('-');
}

// stage: 'submitted' (filed, not yet dispatched) -> 'dispatched' (crew
// assigned/en route) -> 'resolved' (closed, with or without a verified
// proof photo — see `verified`). This mirrors the same 3-step lifecycle
// app.html's Triage gauge already groups cases into (Open / Tagged to
// Project / Resolved), just named for the public-facing timeline.
// Pinned to globalThis (same pattern as DB above) so tickets appended by
// addTicket() below — i.e. real citizen submissions from app.html's
// /api/report/submit — survive repeated requires and warm-lambda reuse
// instead of resetting to the seed list on every cold module load. This
// does NOT make the store durable: a Vercel cold start or a request that
// lands on a different concurrent instance still won't see it. That's the
// same honest limitation documented at the top of this file, not a new one.
// lat/lng on each ticket below are real-world coordinates for the named
// cross street in that ticket's actual city (same convention CAPEX_PROJECTS
// below already uses for its own lat/lng) — approximate placements along
// the real street, not fabricated/random numbers, so a true Haversine
// radius search against these has a genuine geographic basis. See
// ledgerTicketWithinRadius() in app.html/index.html for how the Live Public
// Ledger's distance pills use this.
// ALPHA LAUNCH FINAL PATCH — FLUSH LEDGER: this used to seed each ward with
// several hand-written demo tickets (dates like "3d ago", fixed lat/lng
// along real cross streets) so the Big 3 / Live Public Ledger / Dispatch
// Queue had something to render before any real citizen had submitted
// anything. Per this round's explicit request, that seed data is wiped so
// the 10-person alpha cohort starts from a genuinely empty ledger — every
// ticket they see from here on is one a real tester actually submitted.
// The ward keys themselves (ward-4/7/12/3) are kept, not deleted: addTicket()
// routes a new submission by ward slug (falling back to 'ward-4' only if
// the slug doesn't exist at all — see addTicket() below), and the ward
// grid/jurisdiction/CapEx data those slugs key into elsewhere in this file
// is separate, real product infrastructure (the block-coverage map), not
// "mock ticket records" — this flush is scoped to tickets only, per the
// request.
const WARD_TICKETS = globalThis.__CITIXEN_WARD_TICKETS__ || (globalThis.__CITIXEN_WARD_TICKETS__ = {
  'ward-4': [],
  'ward-7': [],
  'ward-12': [],
  'ward-3': []
});

const WARD_NAMES = { 'ward-4': 'District 4', 'ward-7': 'District 7', 'ward-12': 'District 12', 'ward-3': 'District 3' };
const WARD_JURISDICTION = {
  'ward-4': { state: 'wi', stateName: 'Wisconsin', city: 'la-crosse', cityName: 'La Crosse' },
  'ward-7': { state: 'wi', stateName: 'Wisconsin', city: 'la-crosse', cityName: 'La Crosse' },
  'ward-12': { state: 'wi', stateName: 'Wisconsin', city: 'milwaukee', cityName: 'Milwaukee' },
  'ward-3': { state: 'il', stateName: 'Illinois', city: 'chicago', cityName: 'Chicago' }
};

// Flattens every seeded ward's tickets into one list, each carrying its
// shareable reportId + jurisdiction names — the shape the Live Public
// Ledger (index.html/app.html) and the per-report deep link (report.html,
// via /api/report/:id) both read.
function allTickets() {
  const out = [];
  Object.entries(WARD_TICKETS).forEach(([wardSlug, tickets]) => {
    const j = WARD_JURISDICTION[wardSlug];
    tickets.forEach(t => {
      out.push(Object.assign({}, t, {
        reportId: makeReportId(wardSlug, t.id, t.category, t.submittedAgo, t.hazardOverride),
        ward: wardSlug,
        wardName: WARD_NAMES[wardSlug],
        state: j.state, stateName: j.stateName, city: j.city, cityName: j.cityName
      }));
    });
  });
  return out;
}

function getTicketByReportId(reportId) {
  return allTickets().find(t => t.reportId === reportId) || null;
}

// Small, clearly-labeled CapEx project seed set backing "Capital Project
// Timeline Adherence" — a handful of named projects with a scheduled vs.
// actual/current-status field, same illustrative-seed-data convention as
// everything else in this module. `status` is 'on-track' (still running,
// currently within its scheduled window), 'on-time' (completed within its
// scheduled window) or 'delayed' (completed late, or currently past its
// scheduled window) — only 'delayed' counts against adherence.
//
// GEO FIELDS (`lat`/`lng`/`radiusMeters`) + `category`/`scope` were added
// for the Pre-Snap Capital Project Intercept System (app.html's reporting
// flow). These are hand-picked, illustrative coordinates roughly matching
// each project's named street/ward (several deliberately reuse the exact
// spot of an existing seeded ticket/case above, e.g. cip-2 sits on Main St
// & 4th Ave, same as ticket w4t1 and dispatch-map case c1) — NOT a real
// municipal GIS/CIP import, same honesty convention as every other seed
// array in this module. `radiusMeters` is a rough "this project's fix
// covers citizens within roughly this distance" service radius, not a
// surveyed project boundary. `category` uses the same CATEGORIES
// vocabulary as the coverage grid above, so a report's category can be
// checked against a project's category before treating a spatial match as
// a real "this is already being fixed" intercept.
const CAPEX_PROJECTS = [
  { id: 'cip-1', name: 'District 4 Storm Sewer Relining', ward: 'ward-4', scheduled: 'Q3 2026', status: 'on-time',
    category: 'Drainage', scope: 'Full storm sewer reline along the Pine St alley corridor, replacing collapsed clay pipe.',
    lat: 43.8100, lng: -91.2550, radiusMeters: 300 },
  { id: 'cip-2', name: 'Main St Resurfacing Phase II', ward: 'ward-4', scheduled: 'Q4 2026', status: 'on-track',
    category: 'Pothole', scope: 'Full-depth mill-and-overlay resurfacing of Main St from 2nd Ave to 6th Ave, including the 4th Ave intersection.',
    lat: 43.8138, lng: -91.2519, radiusMeters: 250 },
  { id: 'cip-3', name: 'District 7 Streetlight LED Retrofit', ward: 'ward-7', scheduled: 'Q2 2026', status: 'delayed',
    category: 'Streetlight', scope: 'Citywide swap of District 7 cobra-head fixtures to LED, corridor-wide rather than pole-by-pole.',
    lat: 43.8050, lng: -91.2430, radiusMeters: 400 },
  { id: 'cip-4', name: 'Losey Blvd Sidewalk/ADA Upgrade', ward: 'ward-7', scheduled: 'Q3 2026', status: 'on-track',
    category: 'Sidewalk', scope: 'Sidewalk panel replacement and ADA curb ramp upgrades along Losey Blvd.',
    lat: 43.8020, lng: -91.2380, radiusMeters: 300 },
  { id: 'cip-5', name: 'District 12 Culvert Replacement', ward: 'ward-12', scheduled: 'Q1 2026', status: 'on-time',
    category: 'Drainage', scope: 'Replacement of an undersized culvert causing recurring backups near National Ave.',
    lat: 43.0230, lng: -87.9650, radiusMeters: 350 },
  { id: 'cip-6', name: 'National Ave Signage Modernization', ward: 'ward-12', scheduled: 'Q4 2026', status: 'on-track',
    category: 'Signage', scope: 'Corridor-wide crosswalk and wayfinding signage replacement along National Ave.',
    lat: 43.0130, lng: -87.9500, radiusMeters: 500 },
  { id: 'cip-7', name: 'Ashland Ave Arterial Rebuild', ward: 'ward-3', scheduled: 'Q2 2026', status: 'delayed',
    category: 'Pothole', scope: 'Full arterial road rebuild of Ashland Ave, subgrade up, not a patch-level repair.',
    lat: 41.8850, lng: -87.6670, radiusMeters: 400 }
];

// Parses a seed "submittedAgo" string ("3d ago", "45m ago", "2h ago") into
// an approximate days-ago float. Used only to bucket the illustrative trend
// series below — never shown as a precise timestamp.
function parseDaysAgo(str) {
  const m = /^(\d+)\s*(m|h|d)\s+ago$/.exec(String(str || '').trim());
  if (!m) return 0;
  const n = Number(m[1]);
  if (m[2] === 'm') return n / (60 * 24);
  if (m[2] === 'h') return n / 24;
  return n;
}

function capExAdherencePct(projects) {
  const list = projects || CAPEX_PROJECTS;
  const decided = list.filter(p => p.status !== 'on-track'); // only completed/overdue projects have a real adherence verdict yet
  if (!decided.length) return null;
  const onTarget = decided.filter(p => p.status === 'on-time').length;
  return +(onTarget / decided.length * 100).toFixed(1);
}

// "The Big 3" — computed for real from the seed records above, not
// hardcoded. Returns null for a metric when there isn't yet enough seed
// data to compute it honestly (see capExAdherencePct above).
function bigThree(wardSlug) {
  const tickets = wardSlug ? (WARD_TICKETS[wardSlug] || []).map(t => Object.assign({}, t, { reportId: makeReportId(wardSlug, t.id, t.category, t.submittedAgo, t.hazardOverride) })) : allTickets();
  const resolved = tickets.filter(t => t.stage === 'resolved');
  const active = tickets.filter(t => t.stage !== 'resolved'); // 'submitted' + 'dispatched' — real, not-yet-closed tickets
  const withResolutionTime = resolved.filter(t => typeof t.resolutionHours === 'number');
  const avgResolutionHours = withResolutionTime.length
    ? +(withResolutionTime.reduce((sum, t) => sum + t.resolutionHours, 0) / withResolutionTime.length).toFixed(1)
    : null;
  const verifiedCount = resolved.filter(t => t.verified === true).length;
  const verificationRatePct = resolved.length ? +(verifiedCount / resolved.length * 100).toFixed(1) : null;
  const projects = wardSlug ? CAPEX_PROJECTS.filter(p => p.ward === wardSlug) : CAPEX_PROJECTS;
  // Active-hazard severity breakdown — a real split of the same `active`
  // array above by actual ticket fields, not a fabricated 3-way split:
  // Critical = flagged via the real urgentOverride field (the same flag
  // handleInterceptOverride()/openPostPhotoConfirm() set in app.html);
  // Moderate = already dispatched to a crew; Low = submitted, not yet
  // triaged. There is no separate "severity" field in this data model —
  // this derives the label from stage/urgentOverride rather than inventing
  // a 4th field.
  const activeCritical = active.filter(t => t.urgentOverride).length;
  const activeModerate = active.filter(t => !t.urgentOverride && t.stage === 'dispatched').length;
  const activeLow = active.filter(t => !t.urgentOverride && t.stage !== 'dispatched').length;
  return {
    activeCount: active.length,
    activeCritical,
    activeModerate,
    activeLow,
    avgResolutionHours,
    verificationRatePct,
    capExAdherencePct: capExAdherencePct(projects),
    resolvedCount: resolved.length,
    verifiedCount,
    totalTickets: tickets.length
  };
}

// Small, real, day-bucketed trend for the "Timeline Pulse" analytics view —
// derived from the same seed tickets' submittedAgo/resolutionHours fields
// above, NOT a fabricated time series. With ~20 total seed tickets this is
// illustrative/small-N by nature (same "not asserted as a production
// dataset" caveat as bigThree() itself), but every point is a real
// count/average over real records, bucketed by day-of-age rather than
// invented headline numbers.
function bigThreeTrend(wardSlug, days) {
  const span = days || 9; // covers every seeded submittedAgo value
  const tickets = wardSlug ? (WARD_TICKETS[wardSlug] || []) : allTickets();
  const points = [];
  for (let d = span; d >= 0; d--) {
    const asOf = tickets.filter(t => parseDaysAgo(t.submittedAgo) >= d);
    const resolvedByThen = asOf.filter(t => t.stage === 'resolved');
    const activeByThen = asOf.filter(t => t.stage !== 'resolved');
    const withTime = resolvedByThen.filter(t => typeof t.resolutionHours === 'number');
    points.push({
      dayAgo: d,
      activeCount: activeByThen.length,
      avgResolutionHours: withTime.length ? +(withTime.reduce((s, t) => s + t.resolutionHours, 0) / withTime.length).toFixed(1) : null,
      completionPct: asOf.length ? +(resolvedByThen.length / asOf.length * 100).toFixed(1) : null
    });
  }
  return points;
}

// Appends a real citizen submission (from app.html's Publish flow, via
// POST /api/report/submit) into the same WARD_TICKETS array the seed
// records live in — so it's picked up by allTickets(), bigThree() and
// bigThreeTrend() on the very next read, the same as any seed ticket.
// It is NOT a second data model: a submitted ticket looks exactly like a
// seed one (same fields, stage:'submitted', unresolved/unverified until a
// real close event exists). Falls back to Ward 4 when no jurisdiction was
// resolved yet, matching pickDefaultWardMeta()'s own first-seeded-ward
// fallback in app.html — an internal default, never a guessed/shown name.
// Same statelessness caveat as the rest of this module: this only persists
// within the current warm lambda instance, not across cold starts or
// concurrent instances — see the note above WARD_TICKETS.
function addTicket(input) {
  input = input || {};
  const wardSlug = (input.ward && WARD_TICKETS[input.ward]) ? input.ward : 'ward-4';
  const id = 'sub-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const category = CATEGORIES.includes(input.category) ? input.category : 'Pothole';
  // Dynamic departmental routing: a free-text hazard keyword (e.g. "planter",
  // "graffiti", "signal") routes this ticket to a more specific department
  // than the fixed CATEGORIES list can express — see classifyDescriptionHazard().
  // Falls through to the category-based code when the description names
  // nothing specific, same as before this feature existed.
  const hazardOverride = classifyDescriptionHazard(input.description);
  const ticket = {
    id,
    category,
    hazardOverride,
    title: (input.description ? String(input.description).slice(0, 140) : category + ' reported'),
    loc: input.location ? String(input.location).slice(0, 120) : 'Local District',
    stage: 'submitted',
    verified: null,
    resolutionHours: null,
    submittedAgo: '0m ago',
    urgentOverride: !!input.urgentOverride,
    matchedProjectId: input.matchedProjectId || null,
    // Full-precision device GPS, same field the reference SQL schema's
    // geog column models — kept here only in-memory, fuzzed/rounded the
    // same way the client already does before ever showing it on a map.
    lat: typeof input.lat === 'number' ? input.lat : null,
    lng: typeof input.lng === 'number' ? input.lng : null
  };
  WARD_TICKETS[wardSlug].push(ticket);
  return {
    reportId: makeReportId(wardSlug, id, category, ticket.submittedAgo, hazardOverride),
    ward: wardSlug,
    hazardCode: hazardOverride || hazardCode(category)
  };
}

// Updates a real ticket's stage in place (submitted -> dispatched ->
// resolved), looked up by its own shareable reportId — the same id the
// Live Public Ledger, report.html's deep link and now the Operator Live
// Triage Queue all already display. This mutates the one real WARD_TICKETS
// record, not a copy, so every other reader (allTickets(), bigThree(),
// the ledger) sees the change on its next read. Same honest limitation as
// the rest of this module: in-memory only, this warm instance only.
const VALID_TICKET_STAGES = ['submitted', 'dispatched', 'resolved'];
function updateTicketStage(reportId, stage) {
  if (!VALID_TICKET_STAGES.includes(stage)) return null;
  for (const [wardSlug, tickets] of Object.entries(WARD_TICKETS)) {
    for (const t of tickets) {
      if (makeReportId(wardSlug, t.id, t.category, t.submittedAgo, t.hazardOverride) === reportId) {
        t.stage = stage;
        // A ticket moved to Resolved via the operator triage queue (rather
        // than through a citizen's own verified proof-photo flow) has no
        // real resolution-time measurement or verification photo on file,
        // so neither field is backfilled with an invented number.
        return Object.assign({}, t, { reportId, ward: wardSlug });
      }
    }
  }
  return null;
}

function getWard(state, city, ward) {
  const s = DB[state];
  if (!s) return null;
  const c = s.cities[city];
  if (!c) return null;
  const w = c.wards[ward];
  if (!w) return null;
  return w;
}

function getCity(state, city) {
  const s = DB[state];
  if (!s) return null;
  return s.cities[city] || null;
}

function summarize(cells) {
  const total = cells.length;
  const coveredCount = cells.filter(c => c.covered).length;
  return {
    total,
    coveredCount,
    coveragePct: total ? +(coveredCount / total * 100).toFixed(1) : 0
  };
}

// Every ward in the DB, flattened, with its state/city/ward slugs attached —
// the shape the national rollup and directory endpoints iterate over.
function allWards() {
  const out = [];
  for (const [stateSlug, state] of Object.entries(DB)) {
    for (const [citySlug, city] of Object.entries(state.cities)) {
      for (const [wardSlug, ward] of Object.entries(city.wards)) {
        out.push({ stateSlug, stateName: state.name, citySlug, cityName: city.name, wardSlug, ward });
      }
    }
  }
  return out;
}

// ===== ALPHA FEEDBACK WIDGET SUBMISSIONS — backs the Floating Alpha Feedback
// Widget (app.html) -> POST /api/operator/feedback -> the Live Feedback
// Ingestion Feed (operator-feedback.html) -> GET /api/operator/feedback.
// Pinned to globalThis exactly like WARD_TICKETS above, with the identical
// honest limitation: this only persists within the current warm lambda
// instance, not across cold starts or concurrent instances. A UI snapshot
// (when the tester opted in) is stored as a data URL string, same
// in-memory-only convention as everything else in this module — never
// written to disk or a real object store.
const FEEDBACK_SUBMISSIONS = globalThis.__CITIXEN_FEEDBACK__ || (globalThis.__CITIXEN_FEEDBACK__ = []);

function addFeedbackSubmission(input) {
  input = input || {};
  const item = {
    id: 'fb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
    timestamp: new Date().toISOString(),
    route: typeof input.route === 'string' && input.route ? input.route.slice(0, 200) : '/app',
    device: typeof input.device === 'string' && input.device ? input.device.slice(0, 200) : 'Unknown Device',
    // 'UX Friction'/'Idea' are the Global Floating Alpha Feedback Badge's own
    // 3-tag set (Patch 4.7); the other two are kept for backward
    // compatibility with the earlier per-page widget's submissions already
    // sitting in this array.
    tag: ['Bug', 'UX Friction', 'Idea', 'UI / Styling', 'Feature Idea', 'Camera / AI'].includes(input.tag) ? input.tag : 'Bug',
    note: typeof input.note === 'string' ? input.note.slice(0, 2000) : '',
    // A data URL (image/png;base64,...) when the tester left "Attach UI
    // Snapshot" checked; null otherwise. Size-capped so one submission can't
    // blow out the in-memory array.
    snapshot: typeof input.snapshot === 'string' && input.snapshot.length < 2_000_000 ? input.snapshot : null,
    status: 'queued'
  };
  FEEDBACK_SUBMISSIONS.push(item);
  return item;
}
function allFeedbackSubmissions() {
  return FEEDBACK_SUBMISSIONS.slice().reverse(); // newest first
}

// Real alpha-feedback lifecycle, separate from a ticket's Open/Dispatched/
// Resolved (a feedback submission isn't a civic hazard dispatch — it's a
// bug/UI note an operator triages toward either a fix or the reject pile).
const VALID_FEEDBACK_STATUSES = ['queued', 'in-review', 'resolved'];
function updateFeedbackStatus(id, status) {
  if (!VALID_FEEDBACK_STATUSES.includes(status)) return null;
  const item = FEEDBACK_SUBMISSIONS.find(f => f.id === id);
  if (!item) return null;
  item.status = status;
  return item;
}

// ===== BETA TESTING ANALYTICS — INGESTION SUCCESS RATE =====
// FINAL ALPHA LAUNCH ADDITIONS: the Command Center's "BETA TESTING
// ANALYTICS (LIVE)" banner wants a Photo Upload Attempts vs. Successfully
// Committed Ledger Entries rate. This codebase never uploads a real photo
// file to the server (see submit.js's own PATCH 4.13 note) — the honest
// equivalent is every real POST /api/report/submit call: each one IS a
// photo-gated submission attempt (hasAttachedPhoto()'s client-side gate
// already guarantees a real photo was attached before this request can
// ever fire), and "successfully committed" means it passed every
// server-side check and actually landed in WARD_TICKETS via addTicket()
// below. A rejected attempt (missing photoConfirmed/rightOfWayConfirmed,
// or an empty required field) still counts as an attempt, just not a
// commit — that's the real signal this metric is meant to show. Pinned to
// globalThis exactly like WARD_TICKETS/FEEDBACK_SUBMISSIONS above, with
// the same honest in-memory-only, this-warm-instance-only limitation.
const INGESTION_STATS = globalThis.__CITIXEN_INGESTION_STATS__ || (globalThis.__CITIXEN_INGESTION_STATS__ = { attempts: 0, committed: 0 });
function recordIngestionAttempt(success) {
  INGESTION_STATS.attempts += 1;
  if (success) INGESTION_STATS.committed += 1;
  return Object.assign({}, INGESTION_STATS);
}
function getIngestionStats() {
  return {
    attempts: INGESTION_STATS.attempts,
    committed: INGESTION_STATS.committed,
    successRatePct: INGESTION_STATS.attempts ? +(INGESTION_STATS.committed / INGESTION_STATS.attempts * 100).toFixed(1) : null
  };
}

module.exports = {
  DB, getWard, getCity, summarize, allWards, CATEGORIES,
  allTickets, getTicketByReportId, makeReportId, addTicket, updateTicketStage,
  CAPEX_PROJECTS, capExAdherencePct, bigThree, bigThreeTrend, WARD_NAMES, WARD_JURISDICTION,
  addFeedbackSubmission, allFeedbackSubmissions, updateFeedbackStatus,
  recordIngestionAttempt, getIngestionStats
};
