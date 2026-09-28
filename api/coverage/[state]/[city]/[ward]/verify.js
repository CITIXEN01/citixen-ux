// POST /api/coverage/:state/:city/:ward/verify
// Body: { cellId: number, category?: string }
//
// This is the ingestion step from the coverage architecture: a resolved,
// EXIF/GPS-verified citizen report flips one cell from unsurveyed to
// covered. In production this is called by the ticket-resolution pipeline
// (Mechanical/Staffing pathway close-out), not directly by the client —
// the client-side call here stands in for that event so the demo's
// "tap a dark block -> report it -> watch it light up" loop is real,
// not simulated with a local array mutation.
//
// Deliberately does NOT record who reported this cell — this store is
// public/shared data, and "reported by me" only means something relative
// to one citizen. That half lives entirely on the reporting citizen's own
// device (see app.html's local "My Impact" ledger), never here.
const { getWard, summarize, CATEGORIES } = require('../../../../_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  const { state, city, ward } = req.query;
  const w = getWard(state, city, ward);
  if (!w) {
    res.status(404).json({ error: 'Not found', state, city, ward });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const cellId = Number(body.cellId);
  const cell = w.cells.find(c => c.id === cellId);
  if (!cell) {
    res.status(404).json({ error: 'Unknown cellId', cellId });
    return;
  }

  cell.covered = true;
  cell.category = CATEGORIES.includes(body.category) ? body.category : CATEGORIES[cellId % CATEGORIES.length];
  cell.verifiedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const stats = summarize(w.cells);
  res.status(200).json({
    cell,
    coveragePct: stats.coveragePct,
    coveredCount: stats.coveredCount,
    totalCells: stats.total
  });
};
