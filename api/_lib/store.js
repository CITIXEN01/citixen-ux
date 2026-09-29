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
            name: 'Ward 4',
            alderman: 'Ald. Rebecca Voss',
            healthIndex: 82,
            slaPct: 91,
            roadPct: 78,
            lightingPct: 88,
            capExScopedUSD: 482600,
            cells: buildWard4Cells()
          },
          'ward-7': {
            name: 'Ward 7',
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
            name: 'Ward 12',
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
            name: 'Ward 3',
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
// `reportId` (e.g. "W4-8092") is generated deterministically from the
// ward number + a stable hash of the ticket's own id, so the same
// ticket always resolves to the same shareable /report/:id URL rather
// than a random one that would change on every reload.
function hashTo4Digits(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return 1000 + (h % 9000);
}

function makeReportId(wardSlug, ticketId) {
  const wardNum = (String(wardSlug).match(/\d+/) || ['0'])[0];
  return 'W' + wardNum + '-' + hashTo4Digits(String(ticketId));
}

// stage: 'submitted' (filed, not yet dispatched) -> 'dispatched' (crew
// assigned/en route) -> 'resolved' (closed, with or without a verified
// proof photo — see `verified`). This mirrors the same 3-step lifecycle
// app.html's Triage gauge already groups cases into (Open / Tagged to
// Project / Resolved), just named for the public-facing timeline.
const WARD_TICKETS = {
  'ward-4': [
    { id: 'w4t1', category: 'Pothole', title: 'Deep pothole, right lane', loc: 'Main St & 4th Ave', stage: 'resolved', verified: true, resolutionHours: 14, submittedAgo: '3d ago' },
    { id: 'w4t2', category: 'Streetlight', title: 'Streetlight outage', loc: 'Grand Ave & 7th St', stage: 'dispatched', verified: null, resolutionHours: null, submittedAgo: '45m ago' },
    { id: 'w4t3', category: 'Drainage', title: 'Storm drain backing up', loc: 'Pine St Alley', stage: 'resolved', verified: true, resolutionHours: 22, submittedAgo: '5d ago' },
    { id: 'w4t4', category: 'Sidewalk', title: 'Cracked ADA ramp', loc: 'Cass St & 6th', stage: 'resolved', verified: false, resolutionHours: 9, submittedAgo: '6d ago' },
    { id: 'w4t5', category: 'Signage', title: 'Stop sign knocked down', loc: 'Cameron Ave', stage: 'submitted', verified: null, resolutionHours: null, submittedAgo: '12m ago' },
    { id: 'w4t6', category: 'Pothole', title: 'Pavement gap, bike lane', loc: '6th St & Cass', stage: 'resolved', verified: true, resolutionHours: 31, submittedAgo: '8d ago' }
  ],
  'ward-7': [
    { id: 'w7t1', category: 'Streetlight', title: 'Dark corner, no lighting', loc: 'Ward 7 & Copeland', stage: 'resolved', verified: true, resolutionHours: 18, submittedAgo: '4d ago' },
    { id: 'w7t2', category: 'Pothole', title: 'Large pothole cluster', loc: 'La Crosse St', stage: 'resolved', verified: false, resolutionHours: 27, submittedAgo: '9d ago' },
    { id: 'w7t3', category: 'Sidewalk', title: 'Sidewalk heave, trip hazard', loc: 'Losey Blvd', stage: 'dispatched', verified: null, resolutionHours: null, submittedAgo: '2h ago' },
    { id: 'w7t4', category: 'Drainage', title: 'Clogged culvert', loc: 'George St', stage: 'resolved', verified: true, resolutionHours: 12, submittedAgo: '2d ago' }
  ],
  'ward-12': [
    { id: 'w12t1', category: 'Signage', title: 'Faded crosswalk signage', loc: 'National Ave', stage: 'resolved', verified: true, resolutionHours: 20, submittedAgo: '5d ago' },
    { id: 'w12t2', category: 'Streetlight', title: 'Flickering streetlight', loc: 'Layton Blvd', stage: 'resolved', verified: true, resolutionHours: 16, submittedAgo: '3d ago' },
    { id: 'w12t3', category: 'Pothole', title: 'Pothole near crosswalk', loc: 'Mitchell St', stage: 'submitted', verified: null, resolutionHours: null, submittedAgo: '30m ago' },
    { id: 'w12t4', category: 'Sidewalk', title: 'Missing curb ramp', loc: '16th & Greenfield', stage: 'dispatched', verified: null, resolutionHours: null, submittedAgo: '1h ago' }
  ],
  'ward-3': [
    { id: 'w3t1', category: 'Drainage', title: 'Street flooding after rain', loc: 'Halsted St', stage: 'resolved', verified: true, resolutionHours: 25, submittedAgo: '6d ago' },
    { id: 'w3t2', category: 'Pothole', title: 'Deep pothole, arterial road', loc: 'Ashland Ave', stage: 'resolved', verified: false, resolutionHours: 19, submittedAgo: '4d ago' },
    { id: 'w3t3', category: 'Streetlight', title: 'Streetlight pole down', loc: 'Milwaukee Ave', stage: 'resolved', verified: true, resolutionHours: 10, submittedAgo: '2d ago' }
  ]
};

const WARD_NAMES = { 'ward-4': 'Ward 4', 'ward-7': 'Ward 7', 'ward-12': 'Ward 12', 'ward-3': 'Ward 3' };
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
        reportId: makeReportId(wardSlug, t.id),
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
const CAPEX_PROJECTS = [
  { id: 'cip-1', name: 'Ward 4 Storm Sewer Relining', ward: 'ward-4', scheduled: 'Q3 2026', status: 'on-time' },
  { id: 'cip-2', name: 'Main St Resurfacing Phase II', ward: 'ward-4', scheduled: 'Q4 2026', status: 'on-track' },
  { id: 'cip-3', name: 'Ward 7 Streetlight LED Retrofit', ward: 'ward-7', scheduled: 'Q2 2026', status: 'delayed' },
  { id: 'cip-4', name: 'Losey Blvd Sidewalk/ADA Upgrade', ward: 'ward-7', scheduled: 'Q3 2026', status: 'on-track' },
  { id: 'cip-5', name: 'Ward 12 Culvert Replacement', ward: 'ward-12', scheduled: 'Q1 2026', status: 'on-time' },
  { id: 'cip-6', name: 'National Ave Signage Modernization', ward: 'ward-12', scheduled: 'Q4 2026', status: 'on-track' },
  { id: 'cip-7', name: 'Ashland Ave Arterial Rebuild', ward: 'ward-3', scheduled: 'Q2 2026', status: 'delayed' }
];

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
  const tickets = wardSlug ? (WARD_TICKETS[wardSlug] || []).map(t => Object.assign({}, t, { reportId: makeReportId(wardSlug, t.id) })) : allTickets();
  const resolved = tickets.filter(t => t.stage === 'resolved');
  const withResolutionTime = resolved.filter(t => typeof t.resolutionHours === 'number');
  const avgResolutionHours = withResolutionTime.length
    ? +(withResolutionTime.reduce((sum, t) => sum + t.resolutionHours, 0) / withResolutionTime.length).toFixed(1)
    : null;
  const verifiedCount = resolved.filter(t => t.verified === true).length;
  const verificationRatePct = resolved.length ? +(verifiedCount / resolved.length * 100).toFixed(1) : null;
  const projects = wardSlug ? CAPEX_PROJECTS.filter(p => p.ward === wardSlug) : CAPEX_PROJECTS;
  return {
    avgResolutionHours,
    verificationRatePct,
    capExAdherencePct: capExAdherencePct(projects),
    resolvedCount: resolved.length,
    verifiedCount,
    totalTickets: tickets.length
  };
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

module.exports = {
  DB, getWard, getCity, summarize, allWards, CATEGORIES,
  allTickets, getTicketByReportId, makeReportId,
  CAPEX_PROJECTS, capExAdherencePct, bigThree, WARD_NAMES, WARD_JURISDICTION
};
