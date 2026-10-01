// GET  /api/coverage/:state/:city/:ward/grid
// GET  /api/coverage/:state/:city/:ward/jurisdiction
// GET  /api/coverage/:state/:city/:ward/summary
// POST /api/coverage/:state/:city/:ward/verify
//
// VERCEL HOBBY PLAN SERVERLESS FUNCTION LIMIT — this single dynamic
// catch-all file replaces what used to be four separate files (grid.js,
// jurisdiction.js, summary.js, verify.js) in this same directory. The
// Hobby plan caps a deployment at 12 Serverless Functions; this project's
// /api directory was over that cap with four near-identical per-action
// files that only ever differed by their last URL segment. Consolidating
// them under one [action].js (dispatching on req.query.action) is a pure
// routing change — every URL shape above is byte-for-byte unchanged, so
// no caller (app.html's COVERAGE_ENDPOINT + '/grid' / '/verify', rep.html's
// '.../summary' fetch, shared/geo-hatch.js's '.../grid' fetch) needed any
// update. Each action's actual logic below is copied verbatim from its
// original standalone file — nothing about what any of them does changed,
// only how many separate function files Vercel has to provision.
const { getWard, summarize, CATEGORIES } = require('../../../../_lib/store');
const { getJurisdictionStack } = require('../../../../_lib/jurisdictions');

function handleGrid(req, res, w, state, city, ward) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  res.status(200).json({ state, city, ward, wardName: w.name, cells: w.cells });
}

function handleJurisdiction(req, res, w, state, city, ward) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  // Resolve human-readable state/city names the same way directory.js does.
  const { DB } = require('../../../../_lib/store');
  const stateName = (DB[state] && DB[state].name) || state;
  const cityName = (DB[state] && DB[state].cities[city] && DB[state].cities[city].name) || city;

  const stack = getJurisdictionStack(stateName, cityName, w.name, w.alderman);
  res.status(200).json({ state, city, ward, wardName: w.name, alderman: w.alderman, stack });
}

function handleSummary(req, res, w, state, city, ward) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const stats = summarize(w.cells);
  res.status(200).json({
    state,
    city,
    ward,
    wardName: w.name,
    alderman: w.alderman,
    healthIndex: w.healthIndex,
    slaPct: w.slaPct,
    roadPct: w.roadPct,
    lightingPct: w.lightingPct,
    capExScopedUSD: w.capExScopedUSD,
    coveragePct: stats.coveragePct,
    coveredCount: stats.coveredCount,
    totalCells: stats.total
  });
}

function handleVerify(req, res, w) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const cellId = Number(body.cellId);
  const cell = w.cells.find(c => c.id === cellId);
  if (!cell) {
    res.status(404).json({ error: 'Unknown cellId', cellId });
    return;
  }

  cell.covered = true;
  cell.category = CATEGORIES.includes(body.category) ? body.category : CATEGORIES[cellId % CATEGORIES.length];
  cell.verifiedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const stats = summarize(w.cells);
  res.status(200).json({
    cell,
    coveragePct: stats.coveragePct,
    coveredCount: stats.coveredCount,
    totalCells: stats.total
  });
}

module.exports = (req, res) => {
  const { state, city, ward, action } = req.query;
  const w = getWard(state, city, ward);
  if (!w) {
    res.status(404).json({ error: 'Not found', state, city, ward });
    return;
  }
  switch (action) {
    case 'grid': return handleGrid(req, res, w, state, city, ward);
    case 'jurisdiction': return handleJurisdiction(req, res, w, state, city, ward);
    case 'summary': return handleSummary(req, res, w, state, city, ward);
    case 'verify': return handleVerify(req, res, w);
    default:
      res.status(404).json({ error: 'Unknown coverage action', action });
  }
};
