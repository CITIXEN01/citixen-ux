// GET /api/coverage/:state/:city/summary
//
// City-level rollup — what a state page or a city's landing card shows
// before drilling into a specific ward's block grid.
const { getWard, summarize } = require('../../../_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const { state, city } = req.query;

  // This demo only has one ward seeded per city; a real rollup would sum
  // every ward under this city rather than reading a single one directly.
  const wardSlug = 'ward-4';
  const ward = getWard(state, city, wardSlug);
  if (!ward) {
    res.status(404).json({ error: 'City/ward not found', state, city });
    return;
  }

  const stats = summarize(ward.cells);
  res.status(200).json({
    state,
    city,
    ward: wardSlug,
    wardName: ward.name,
    coveragePct: stats.coveragePct,
    coveredCount: stats.coveredCount,
    totalCells: stats.total
  });
};
