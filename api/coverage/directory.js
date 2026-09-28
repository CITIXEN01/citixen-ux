// GET /api/coverage/directory
//
// The "Craigslist" layer: every onboarded state, city and ward, so a picker
// UI (the Analytics tab's State/City/Ward selector) and the National
// Network tab's municipality card grid both know what exists without
// hardcoding it client-side.
const { DB, summarize } = require('../_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const states = Object.entries(DB).map(([slug, state]) => ({
    slug,
    name: state.name,
    cities: Object.entries(state.cities).map(([citySlug, city]) => ({
      slug: citySlug,
      name: city.name,
      wards: Object.entries(city.wards).map(([wardSlug, ward]) => {
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
      })
    }))
  }));
  res.status(200).json({ states });
};
