// GET /api/coverage/big3
//
// "The Big 3" public health metrics, computed for real from the seed
// ticket/CapEx records in api/_lib/store.js (never hardcoded headline
// numbers): Speed of Resolution (avg hours, snap to photo closeout),
// Resolution Verification Rate (% of closed tickets with a verified
// on-site proof photo vs. a desk closure), and Capital Project Timeline
// Adherence (% of decided CapEx projects that landed on schedule).
const { bigThree, CAPEX_PROJECTS, WARD_NAMES } = require('../_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const national = bigThree(null);
  const perWard = {};
  Object.keys(WARD_NAMES).forEach(wardSlug => { perWard[wardSlug] = bigThree(wardSlug); });
  res.status(200).json({ national, perWard, capExProjects: CAPEX_PROJECTS });
};
