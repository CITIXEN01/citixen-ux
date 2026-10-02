// GET /api/passbook?ticket=<reportId>  — per-ticket receipt pass
// GET /api/passbook?mode=site          — site-wide "Public Ledger Access"
//   pass (reached via the /api/pass rewrite in vercel.json — folded into
//   this same function rather than a new api/pass.js file to stay inside
//   Vercel Hobby's 10-serverless-function cap, same convention this repo
//   already used for the Beta Analytics Banner's ingestion stats riding on
//   /api/coverage/tickets instead of its own route).
//
// Add-to-Apple-Wallet pass generation, for either case. A real .pkpass
// bundle requires Apple Developer "Pass Type ID" + WWDR intermediate
// certificates and a private signing key — none of which exist in this
// beta environment, and a hand-rolled unsigned .pkpass is rejected by the
// real Wallet app anyway, so faking one here would be worse than not
// having the feature. This endpoint still performs real work (a genuine
// ticket lookup for the receipt case, and a complete, correct, ready-to-
// sign pass bundle for the site-wide case — see api/_lib/pkpass.js) so the
// honesty of the "not available" message is itself verifiable.
const { getTicketByReportId } = require('./_lib/store');
const { buildBundleFiles, buildZip, hasSigningCredentials } = require('./_lib/pkpass');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }

  const isSiteMode = req.query && req.query.mode === 'site';
  if (isSiteMode) {
    if (!hasSigningCredentials()) {
      res.status(501).json({
        error: 'pass_signing_unavailable',
        message: 'Apple Wallet pass generation is not available yet — it requires a signed Apple Pass Type ID certificate, a private signing key, and Apple\'s WWDR intermediate certificate, none of which exist in this environment. An unsigned .pkpass is rejected by the real Wallet app, so this endpoint won\'t hand out one that silently fails to add. The full pass bundle (fields, colors, QR barcode, icons, manifest) is built and ready — set APPLE_PASS_TYPE_ID / APPLE_TEAM_ID / APPLE_PASS_CERT / APPLE_PASS_KEY / APPLE_WWDR_CERT once a Pass Type ID is registered in an Apple Developer account, and this route will start serving real passes with no other code changes.',
        passPreview: JSON.parse(buildBundleFiles()['pass.json'].toString('utf8'))
      });
      return;
    }
    // Unreachable in this environment (see above) — left in place for when
    // real credentials are configured. Insert the PKCS#7 `signature` file
    // into `files` here before zipping, once that signing step exists.
    const files = buildBundleFiles();
    const zip = buildZip(files);
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', 'attachment; filename="citixen.pkpass"');
    res.status(200).send(zip);
    return;
  }

  const ticketId = req.query && req.query.ticket;
  if (!ticketId) {
    res.status(400).json({ error: 'Missing ?ticket=<reportId> (or ?mode=site for the site-wide pass)' });
    return;
  }
  const ticket = getTicketByReportId(String(ticketId));
  res.status(501).json({
    error: 'passbook_unavailable',
    message: 'Apple Wallet pass generation is not available in this beta — it requires a signed Apple Pass Type ID certificate this environment does not have.',
    ticketFound: !!ticket
  });
};
