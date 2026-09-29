// GET /api/report/:id
//
// Looks up a single ledger ticket by its shareable reportId (e.g.
// "W4-8092") for report.html's deep-link view. Backed by the same
// seeded ticket records as /api/coverage/tickets — see
// api/_lib/store.js's getTicketByReportId/allTickets for the shape and
// the honesty note on what this is and isn't.
const { getTicketByReportId } = require('../_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const id = req.query && req.query.id;
  const ticket = id ? getTicketByReportId(String(id)) : null;
  if (!ticket) {
    res.status(404).json({ error: 'No seeded report found for id ' + id });
    return;
  }
  res.status(200).json({ ticket });
};
