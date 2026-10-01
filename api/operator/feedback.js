// GET/POST /api/operator/feedback
//
// Backs the Floating Alpha Feedback Widget (app.html POSTs here on submit)
// and the Live Feedback Ingestion Feed (operator-feedback.html GETs here to
// render it). See api/_lib/store.js's addFeedbackSubmission/
// allFeedbackSubmissions for the shape and the same honest in-memory-only
// limitation the rest of this module already documents.
// PATCH also lives here (body: {id, status}) to move a submission through
// its real queued -> in-review -> resolved lifecycle — see
// api/_lib/store.js's updateFeedbackStatus() — backing the Operator Live
// Triage Queue's Alpha Bug status dropdown (operator.html).
const { addFeedbackSubmission, allFeedbackSubmissions, updateFeedbackStatus } = require('../_lib/store');

module.exports = (req, res) => {
  if (req.method === 'POST') {
    const body = req.body || {};
    const item = addFeedbackSubmission(body);
    res.status(201).json({ item });
    return;
  }
  if (req.method === 'GET') {
    res.status(200).json({ items: allFeedbackSubmissions() });
    return;
  }
  if (req.method === 'PATCH') {
    const body = req.body || {};
    if (!body.id || !body.status) {
      res.status(400).json({ error: 'id and status are required' });
      return;
    }
    const item = updateFeedbackStatus(String(body.id), String(body.status));
    if (!item) {
      res.status(404).json({ error: 'No matching feedback item found for id ' + body.id + ', or status was not one of queued/in-review/resolved' });
      return;
    }
    res.status(200).json({ ok: true, item });
    return;
  }
  res.status(405).json({ error: 'GET, POST or PATCH only' });
};
