// GET/POST /api/operator/feedback
//
// Backs the Floating Alpha Feedback Widget (app.html POSTs here on submit)
// and the Live Feedback Ingestion Feed (operator-feedback.html GETs here to
// render it). See api/_lib/store.js's addFeedbackSubmission/
// allFeedbackSubmissions for the shape and the same honest in-memory-only
// limitation the rest of this module already documents.
const { addFeedbackSubmission, allFeedbackSubmissions } = require('../_lib/store');

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
  res.status(405).json({ error: 'GET or POST only' });
};
