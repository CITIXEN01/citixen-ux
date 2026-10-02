// GET /api/coverage/tickets
//
// Backs the Live Public Ledger (index.html/app.html) — every seeded
// ward's ticket records flattened, each with its deterministic
// shareable reportId (see api/_lib/store.js's makeReportId/allTickets).
// Same "illustrative seed data" convention as the rest of this store:
// this is not a live database, it's the same static demo dataset every
// other coverage endpoint reads from.
//
// FINAL ALPHA LAUNCH ADDITIONS — also carries `ingestion` (Photo Upload
// Attempts vs. Successfully Committed Ledger Entries, see
// api/_lib/store.js's getIngestionStats()) for the Command Center's "BETA
// TESTING ANALYTICS (LIVE)" banner. Riding on this existing route rather
// than adding a new one keeps this deployment at its Vercel Hobby plan
// serverless-function cap (see the API consolidation round's own notes).
const { allTickets, getIngestionStats } = require('../_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  res.status(200).json({ tickets: allTickets(), ingestion: getIngestionStats() });
};
