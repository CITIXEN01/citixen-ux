// GET /api/coverage/directory
//
// The "Craigslist" layer: every onboarded state and city, so a picker UI
// (or the national map) knows what exists without hardcoding it client-side.
const { DB } = require('../_lib/store');

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
      wards: Object.keys(city.wards)
    }))
  }));
  res.status(200).json({ states });
};
