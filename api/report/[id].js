// GET          /api/report/:id
// PATCH/POST   /api/report/status
//
// VERCEL HOBBY PLAN SERVERLESS FUNCTION LIMIT — this file now also covers
// what used to be the separate api/report/status.js. "status" was always
// just a literal URL segment at this same path depth as a real :id value
// (the same way the coverage ward directory's grid/jurisdiction/summary/
// verify were each their own file); dispatching on `id === 'status'` here
// collapses two functions into one with the URL shapes themselves
// completely unchanged, so operator.html's POST to '/api/report/status'
// and report.html's GET to '/api/report/' + id both keep working exactly
// as before.
//
// GET lookup: finds a single ledger ticket by its shareable reportId (e.g.
// "W4-8092") for report.html's deep-link view. Backed by the same seeded
// ticket records as /api/coverage/tickets — see api/_lib/store.js's
// getTicketByReportId/allTickets for the shape and the honesty note on
// what this is and isn't.
//
// PATCH/POST status: backs the Operator Live Triage Queue's Citizen Report
// status dropdown (operator.html) — a real stage change (submitted ->
// dispatched -> resolved) against the same WARD_TICKETS record every other
// ledger view reads, via api/_lib/store.js's updateTicketStage(). Same
// honest in-memory-only limitation as the rest of this API: this warm
// lambda instance only, not a durable cross-instance write.
const { getTicketByReportId, updateTicketStage } = require('../_lib/store');

function handleStatusUpdate(req, res) {
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
}

function handleLookup(req, res, id) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }
  const ticket = id ? getTicketByReportId(String(id)) : null;
  if (!ticket) {
    res.status(404).json({ error: 'No seeded report found for id ' + id });
    return;
  }
  res.status(200).json({ ticket });
}

module.exports = (req, res) => {
  const id = req.query && req.query.id;
  if (id === 'status') {
    handleStatusUpdate(req, res);
    return;
  }
  handleLookup(req, res, id);
};
