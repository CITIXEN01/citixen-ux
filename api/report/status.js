// PATCH /api/report/status
//
// Backs the Operator Live Triage Queue's Citizen Report status dropdown
// (operator.html) — a real stage change (submitted -> dispatched ->
// resolved) against the same WARD_TICKETS record every other ledger view
// reads, via api/_lib/store.js's updateTicketStage(). Same honest
// in-memory-only limitation as the rest of this API: this warm lambda
// instance only, not a durable cross-instance write.
const { updateTicketStage } = require('../_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    res.status(405).json({ error: 'PATCH only' });
    return;
  }
  const body = req.body || {};
  const reportId = body.reportId;
  const stage = body.stage;
  if (!reportId || !stage) {
    res.status(400).json({ error: 'reportId and stage are required' });
    return;
  }
  const ticket = updateTicketStage(String(reportId), String(stage));
  if (!ticket) {
    res.status(404).json({ error: 'No matching report found for reportId ' + reportId + ', or stage was not one of submitted/dispatched/resolved' });
    return;
  }
  res.status(200).json({ ok: true, ticket });
};
