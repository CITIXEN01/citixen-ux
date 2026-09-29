// GET /api/coverage/big3
//
// "The Big 3" public health metrics, computed for real from the seed
// ticket/CapEx records in api/_lib/store.js (never hardcoded headline
// numbers): Active Hazards (open, not-yet-resolved tickets), Fix Speed
// (avg hours, snap to photo closeout), and Completion Rate (% of closed
// tickets with a verified on-site proof photo vs. a desk closure).
// `trend` is a small, real, day-bucketed series derived from the same
// tickets (see bigThreeTrend()) for the Analytics "Timeline Pulse" view —
// illustrative/small-N, not a production time series.
const { bigThree, bigThreeTrend, CAPEX_PROJECTS, WARD_NAMES } = require('../_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const national = bigThree(null);
  national.trend = bigThreeTrend(null);
  const perWard = {};
  Object.keys(WARD_NAMES).forEach(wardSlug => {
    perWard[wardSlug] = bigThree(wardSlug);
    perWard[wardSlug].trend = bigThreeTrend(wardSlug);
  });
  res.status(200).json({ national, perWard, capExProjects: CAPEX_PROJECTS });
};
