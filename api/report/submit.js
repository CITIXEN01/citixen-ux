// POST /api/report/submit
//
// The actual network endpoint app.html's offline submission queue
// (finalizeSubmitReport()/attemptSubmitReport() in app.html) targets. Like
// every other route in this API, it's backed by nothing more than the
// stateless demo store in api/_lib/store.js — see that file's own note on
// what this is and isn't (Vercel serverless functions are stateless
// between cold starts; a real deployment would persist this to a real
// datastore). This endpoint deliberately does NOT pretend to do that: it
// acknowledges receipt honestly and returns, rather than claiming a
// persisted ticket record that doesn't actually exist server-side yet.
//
// PRIVACY: the request body is expected to carry only the same
// non-identifying fields the rest of this store models (category,
// location text, description, optional lat/lng, an optional matched CIP
// project id, and a client-supplied timestamp) — no reporter identity, by
// the same convention as everywhere else in this API. This route does not
// read, log, or store anything beyond acknowledging the request.
module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  res.status(200).json({ ok: true, receivedAt: new Date().toISOString() });
};
