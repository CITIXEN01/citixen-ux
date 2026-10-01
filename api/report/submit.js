// POST /api/report/submit
//
// The actual network endpoint app.html's offline submission queue
// (finalizeSubmitReport()/attemptSubmitReport() in app.html) targets. Now
// backed by store.js's addTicket() — a real submission is appended to the
// same WARD_TICKETS array the seed ledger lives in, so it's picked up by
// every route that reads through allTickets()/bigThree()/bigThreeTrend()
// (the Big 3, the 3x3 Analytics Matrix, the Live Public Ledger) on their
// very next fetch. Like every other route in this API, that store is
// still just api/_lib/store.js's in-memory module — see that file's own
// note on what this is and isn't (Vercel serverless functions are
// stateless between cold starts and not shared across concurrent warm
// instances; a real deployment persists this to sql/supabase_civic_memory_schema.sql's
// schema instead). This endpoint does not pretend otherwise: it reports
// exactly what it did (appended to this instance's in-memory ledger),
// not a guarantee of durable, cross-instance persistence.
//
// PRIVACY: the request body is expected to carry only the same
// non-identifying fields the rest of this store models (category,
// location text, description, optional lat/lng, an optional matched CIP
// project id, and a client-supplied timestamp) — no reporter identity, by
// the same convention as everywhere else in this API. This route does not
// read, log, or store anything beyond what addTicket() itself models.
const { addTicket } = require('../_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  const body = req.body || {};
  const { reportId, ward, hazardCode } = addTicket({
    category: body.category,
    location: body.location,
    description: body.description,
    urgentOverride: body.urgentOverride,
    matchedProjectId: body.matchedProjectId,
    lat: body.lat,
    lng: body.lng,
    ward: body.ward
  });
  res.status(200).json({ ok: true, receivedAt: new Date().toISOString(), reportId, ward, hazardCode });
};
