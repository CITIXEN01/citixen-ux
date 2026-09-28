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

module.exports = { DB, getWard, getCity, summarize, allWards, CATEGORIES };
