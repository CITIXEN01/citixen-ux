// GET /api/coverage/:state/:city/:ward/jurisdiction
//
// The data source for the "Citizen Paperwork File": the 4-layer
// jurisdictional stack (Federal / State / Municipal / District-Ward) for
// whichever ward is currently selected. See api/_lib/jurisdictions.js for
// what's real text vs. a labeled placeholder, and why.
const { getWard } = require('../../../../_lib/store');
const { getJurisdictionStack } = require('../../../../_lib/jurisdictions');

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

  // Resolve human-readable state/city names the same way directory.js does.
  const { DB } = require('../../../../_lib/store');
  const stateName = (DB[state] && DB[state].name) || state;
  const cityName = (DB[state] && DB[state].cities[city] && DB[state].cities[city].name) || city;

  const stack = getJurisdictionStack(stateName, cityName, w.name, w.alderman);
  res.status(200).json({ state, city, ward, wardName: w.name, alderman: w.alderman, stack });
};
