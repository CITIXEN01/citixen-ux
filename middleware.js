/*
 * Server-level access control for the internal Nexus Sales Workspace (/nexuslive).
 * Runs on Vercel before any file is served, so the page and its assets are never sent without credentials.
 *
 * Setup (Vercel project -> Settings -> Environment Variables, Production + Preview):
 *   NEXUSLIVE_USER   shared username, e.g. "team"
 *   NEXUSLIVE_PASS   long random password (rotate it when someone leaves)
 * No credentials live in the repo. If either variable is missing the route fails CLOSED (503).
 *
 * Only the paths in config.matcher are touched. Every other route behaves exactly as before.
 * See NEXUSLIVE.md for verification steps and the Cloudflare Access alternative.
 */
export const config = {
  matcher: ["/nexuslive", "/nexuslive.html", "/nexuslive/:path*", "/nexuslive-assets/:path*"],
};

function safeEqual(a, b) {
  // Constant-time comparison so response time does not leak how much of a value matched.
  const x = String(a), y = String(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

function deny(status, body, extra) {
  return new Response(body, {
    status,
    headers: Object.assign({
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    }, extra || {}),
  });
}

export default function middleware(request) {
  const user = typeof process !== "undefined" && process.env ? process.env.NEXUSLIVE_USER : "";
  const pass = typeof process !== "undefined" && process.env ? process.env.NEXUSLIVE_PASS : "";
  if (!user || !pass) return deny(503, "Nexus Live is not configured.");

  const header = request.headers.get("authorization") || "";
  if (header.slice(0, 6).toLowerCase() === "basic ") {
    let decoded = "";
    try { decoded = atob(header.slice(6).trim()); } catch (e) { decoded = ""; }
    const i = decoded.indexOf(":");
    if (i >= 0) {
      const okUser = safeEqual(decoded.slice(0, i), user);
      const okPass = safeEqual(decoded.slice(i + 1), pass);
      if (okUser && okPass) {
        // Continue to the static file / route, and keep it out of caches and search indexes.
        return new Response(null, { headers: { "x-middleware-next": "1" } });
      }
    }
  }
  return deny(401, "Authentication required.", { "WWW-Authenticate": 'Basic realm="Nexus Live", charset="UTF-8"' });
}
