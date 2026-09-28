// Shared in-memory data store for the coverage API.
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

const CATEGORIES = ['Pothole', 'Streetlight', 'Signage', 'Sidewalk', 'Drainage'];

function buildWard4Cells() {
  const covered = [1, 2, 3, 4, 10, 11, 12, 13, 14, 20, 21, 22, 30, 31, 32, 33, 40, 41, 42, 43, 44, 50, 51, 52, 60, 61, 62, 63, 70, 71, 72, 73, 74, 75];
  const youReported = [3, 13, 32, 52, 63, 74];
  const cells = [];
  for (let i = 0; i < 80; i++) {
    const isCovered = covered.includes(i);
    cells.push({
      id: i,
      covered: isCovered,
      reportedByYou: isCovered && youReported.includes(i),
      category: isCovered ? CATEGORIES[i % CATEGORIES.length] : null,
      verifiedDate: isCovered ? ('Sep ' + (10 + (i % 18)) + ', 2026') : null
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
          'ward-4': { name: 'Ward 4', cells: buildWard4Cells() }
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

function summarize(cells) {
  const total = cells.length;
  const coveredCount = cells.filter(c => c.covered).length;
  return {
    total,
    coveredCount,
    coveragePct: total ? +(coveredCount / total * 100).toFixed(1) : 0
  };
}

module.exports = { DB, getWard, summarize, CATEGORIES };
