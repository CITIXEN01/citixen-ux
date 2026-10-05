/* CITIXEN UX — universal shield transition.
 *
 * One glowing-shield screen ("CITIXEN UX — Upgrade Your Civic Experience")
 * that every major portal entry goes through. Two ways in:
 *
 *  1. ENTRY PAGES opt in with <html data-shield-entry>. The overlay is
 *     inserted synchronously from <head> (before first paint), holds for
 *     HOLD_MS, then fades out. It plays on every load of that page, except
 *     when the visitor just came through a data-shield link (see 2), which
 *     already showed it.
 *  2. LINKS with data-shield (same-origin only) show the overlay first and
 *     then navigate. This is how destinations that don't load this script
 *     (e.g. /app, whose own boot flow is deliberately untouched) still get
 *     the transition.
 *
 * The overlay can be skipped by click/tap or Escape. With
 * prefers-reduced-motion it is static (no pulse/draw) and shorter.
 * Exposes window.NexusTransition = { show(), hide(), go(url) }.
 */
(function () {
  'use strict';
  var TITLE = 'CITIXEN UX';
  var TAGLINE = 'Upgrade Your Civic Experience';
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var HOLD_MS = reduce ? 500 : 1300;
  var FADE_MS = reduce ? 0 : 320;
  var FLAG = 'nx_shield_shown';

  var css =
    '#nxShield{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;' +
    'background:radial-gradient(700px 420px at 50% 42%,rgba(0,255,135,.14),transparent 70%),#0A0D14;color:#fff;text-align:center;padding:24px;' +
    'opacity:1;transition:opacity ' + FADE_MS + 'ms ease;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;cursor:pointer}' +
    '#nxShield[hidden]{display:none}#nxShield.nx-out{opacity:0;pointer-events:none}' +
    '#nxShield svg{width:112px;height:112px;overflow:visible;filter:drop-shadow(0 0 18px rgba(0,255,135,.55))}' +
    '#nxShield .nx-shield-path{fill:rgba(0,255,135,.06);stroke:#00FF87;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;' +
    (reduce ? '' : 'stroke-dasharray:140;stroke-dashoffset:140;animation:nxDraw .9s ease-out forwards,nxGlow 1.6s ease-in-out .9s infinite;') + '}' +
    '#nxShield .nx-check{fill:none;stroke:#00FF87;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;' +
    (reduce ? '' : 'stroke-dasharray:24;stroke-dashoffset:24;animation:nxDraw .5s ease-out .65s forwards;') + '}' +
    '#nxShield .nx-title{margin:0;font-size:clamp(1.5rem,5vw,2.4rem);font-weight:900;letter-spacing:.04em}' +
    '#nxShield .nx-title b{color:#00FF87}' +
    '#nxShield .nx-tag{margin:0;font-size:clamp(.85rem,2.6vw,1.05rem);font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8e9fa8}' +
    '#nxShield .nx-skip{position:absolute;bottom:22px;font-size:.72rem;color:#8e9fa8;opacity:.8}' +
    '@keyframes nxDraw{to{stroke-dashoffset:0}}' +
    '@keyframes nxGlow{0%,100%{filter:drop-shadow(0 0 4px rgba(0,255,135,.4))}50%{filter:drop-shadow(0 0 16px rgba(0,255,135,.95))}}';

  var overlay = null, timer = null;

  function ensure() {
    if (overlay) return overlay;
    var st = document.createElement('style');
    st.id = 'nxShieldStyle';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
    overlay = document.createElement('div');
    overlay.id = 'nxShield';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-label', TITLE + ' — ' + TAGLINE);
    overlay.hidden = true;
    overlay.innerHTML =
      '<svg viewBox="0 0 44 48" aria-hidden="true" focusable="false">' +
      '<path class="nx-shield-path" d="M22 44s16-8 16-20V10L22 4 6 10v14c0 12 16 20 16 20z"/>' +
      '<path class="nx-check" d="M15 24l5 5 9-10"/></svg>' +
      '<p class="nx-title">CITIXEN <b>UX</b></p>' +
      '<p class="nx-tag">' + TAGLINE + '</p>' +
      '<span class="nx-skip">Tap to skip</span>';
    overlay.addEventListener('click', function () { hide(); });
    // Mount on <html> so it exists before <body> is parsed (no flash of content).
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function show() {
    ensure();
    clearTimeout(timer);
    overlay.hidden = false;
    overlay.classList.remove('nx-out');
    // Restart the CSS animations if shown a second time.
    var svg = overlay.querySelector('svg'); var p = svg.parentNode; p.replaceChild(svg.cloneNode(true), svg);
    return overlay;
  }

  function hide() {
    if (!overlay || overlay.hidden) return;
    clearTimeout(timer);
    overlay.classList.add('nx-out');
    setTimeout(function () { if (overlay) overlay.hidden = true; }, FADE_MS);
  }

  function go(url) {
    show();
    try { sessionStorage.setItem(FLAG, String(Date.now())); } catch (e) {}
    timer = setTimeout(function () { window.location.assign(url); }, HOLD_MS);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay && !overlay.hidden) hide();
  });

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[data-shield]') : null;
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin) return;
    // Same-page hash links are not entries.
    if (u.pathname === location.pathname && u.search === location.search) return;
    e.preventDefault();
    go(u.href);
  });

  // Back/forward cache restore must not leave the overlay stuck on screen.
  window.addEventListener('pageshow', function (e) { if (e.persisted && overlay) { overlay.hidden = true; } });

  window.NexusTransition = { show: show, hide: hide, go: go };

  // Entry-page intro.
  if (document.documentElement.hasAttribute('data-shield-entry')) {
    var already = false;
    try { var t = parseInt(sessionStorage.getItem(FLAG) || '0', 10); already = t > 0 && (Date.now() - t) < 8000; sessionStorage.removeItem(FLAG); } catch (e) {}
    if (!already) {
      show();
      timer = setTimeout(hide, HOLD_MS);
    }
  }
})();
