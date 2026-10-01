// GET /api/passbook?ticket=<reportId>
//
// Add-to-Apple-Wallet pass generation for a ticket receipt. A real .pkpass
// bundle requires Apple Developer "Pass Type ID" + WWDR intermediate
// certificates and a private signing key — none of which exist in this
// beta environment, and a hand-rolled unsigned .pkpass is rejected by the
// real Wallet app anyway, so faking one here would be worse than not
// having the feature. This endpoint still performs a real ticket lookup
// (so the honesty of the "not available" message is itself verifiable) but
// is transparent that pass issuance itself isn't available in this beta.
const { getTicketByReportId } = require('./_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const ticketId = req.query && req.query.ticket;
  if (!ticketId) {
    res.status(400).json({ error: 'Missing ?ticket=<reportId>' });
    return;
  }
  const ticket = getTicketByReportId(String(ticketId));
  res.status(501).json({
    error: 'passbook_unavailable',
    message: 'Apple Wallet pass generation is not available in this beta — it requires a signed Apple Pass Type ID certificate this environment does not have.',
    ticketFound: !!ticket
  });
};
