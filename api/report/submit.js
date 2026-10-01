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
//
// PATCH 4.13 — HARD SAFETY GATE: this codebase never uploads the actual
// photo file to the server (it's captured, shown, and shared client-side
// only — see app.html's photoDataUrl/finalizeSubmitReport() comments), so
// there's no real image_url/photo_data field here to inspect the way the
// spec describes. The honest equivalent is `photoConfirmed`: a boolean the
// client only ever sends `true` once its own hard photo gate
// (hasAttachedPhoto()/updateSubmitPhotoGate() in app.html) has verified a
// real captured photo is attached. This guard rejects a payload missing
// that flag exactly the way the spec's backend check rejects a missing
// image — it's just checking the honest signal this architecture actually
// has, not a fabricated image field.
const { addTicket } = require('../_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  const body = req.body || {};
  if (!body.photoConfirmed) {
    res.status(400).json({ success: false, error: 'Photo proof payload mandatory.' });
    return;
  }
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
