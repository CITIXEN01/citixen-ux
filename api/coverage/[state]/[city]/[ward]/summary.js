// GET /api/coverage/:state/:city/:ward/summary
//
// Ward-level governance rollup: the Ward Health Index card at the top of
// the Analytics tab's "Local" view reads entirely from this shape. These
// health fields (healthIndex/slaPct/roadPct/lightingPct) are ward-level
// metadata in the store, not derived from the cell grid — in production
// they come from the municipality's own reporting, the same way a real
// alderman's name would.
const { getWard, summarize } = require('../../../../_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const { state, city, ward } = req.query;
  const w = getWard(state, city, ward);
  if (!w) {
    res.status(404).json({ error: 'Not found', state, city, ward });
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
};
