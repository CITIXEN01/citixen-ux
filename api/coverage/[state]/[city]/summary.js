// GET /api/coverage/:state/:city/summary
//
// City-level rollup — sums every ward under this city, for a state page or
// a city's landing card before drilling into a specific ward's block grid.
const { getCity, summarize } = require('../../../_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const { state, city } = req.query;

  const c = getCity(state, city);
  if (!c) {
    res.status(404).json({ error: 'City not found', state, city });
    return;
  }

  const wards = Object.entries(c.wards).map(([wardSlug, ward]) => {
    const stats = summarize(ward.cells);
    return {
      slug: wardSlug,
      name: ward.name,
      alderman: ward.alderman,
      coveragePct: stats.coveragePct,
      coveredCount: stats.coveredCount,
      totalCells: stats.total,
      capExScopedUSD: ward.capExScopedUSD
    };
  });

  const totalCells = wards.reduce((sum, w) => sum + w.totalCells, 0);
  const coveredCount = wards.reduce((sum, w) => sum + w.coveredCount, 0);
  const capExScopedUSD = wards.reduce((sum, w) => sum + (w.capExScopedUSD || 0), 0);

  res.status(200).json({
    state,
    city,
    cityName: c.name,
    coveragePct: totalCells ? +(coveredCount / totalCells * 100).toFixed(1) : 0,
    coveredCount,
    totalCells,
    capExScopedUSD,
    wards
  });
};
