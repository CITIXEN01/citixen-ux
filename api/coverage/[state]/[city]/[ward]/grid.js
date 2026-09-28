// GET /api/coverage/:state/:city/:ward/grid
//
// The exact payload the citizen dashboard's coverage widget renders.
// This is the contract app.html's fetchCoverageGrid() calls — the widget's
// render/animate/tap logic is written against this shape either way.
const { getWard } = require('../../../../_lib/store');

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
  res.status(200).json({ state, city, ward, wardName: w.name, cells: w.cells });
};
