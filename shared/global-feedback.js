/* =====================================================================
   CITIXEN UX™ — GLOBAL FLOATING ALPHA FEEDBACK BADGE
   ---------------------------------------------------------------------
   Patch 4.7: one shared widget, injected into document.body by this file
   (same pattern as shared/instant-report.js's modal), so the identical
   "• Instant Feedback" pill + 1-tap drawer can run unmodified on every
   gated page that calls CitixenGlobalFeedback.init() — app.html,
   operator.html and dispatch.html today. Previously app.html carried its
   own bottom-right widget with a richer 4-tag/optional-snapshot flow; that
   is retired in favor of this single shared, simpler 3-tag drawer (Bug /
   UX Friction / Idea) per this round's spec, still posting real
   submissions to the same /api/operator/feedback endpoint the Live
   Feedback Ingestion Feed (operator-feedback.html) and the Operator Live
   Triage Queue (operator.html, Patch 4.6) already read from.

   A UI snapshot is still attempted automatically, best-effort, via
   html2canvas when that library happens to already be loaded on the host
   page (app.html loads it for the social-share graphic; operator.html and
   dispatch.html do not, so feedback submitted from those pages simply has
   no snapshot — an honest gap, never a faked one).
   ===================================================================== */
(function () {
  'use strict';

  var cfg = { toast: null };
  var badge = null, drawer = null, selectedTag = 'Bug';
  var TAGS = ['Bug', 'UX Friction', 'Idea'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg) {
    if (typeof cfg.toast === 'function') { cfg.toast(msg); return; }
    var el = document.getElementById('cgfToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cgfToast'; el.className = 'cgf-toast'; el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('show'); }, 3400);
  }

  // A short, friendly device label from the real UA string — never a guess
  // at exact model, just enough for an operator triaging feedback to know
  // "this was an iPhone in Safari" vs "desktop Chrome".
  function shortDeviceLabel() {
    var ua = navigator.userAgent || '';
    var platform = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
      : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Unknown Device';
    var browser = /CriOS|Chrome/.test(ua) ? 'Chrome' : (/Safari/.test(ua) && !/Chrome/.test(ua)) ? 'Safari'
      : /Firefox/.test(ua) ? 'Firefox' : /Edg/.test(ua) ? 'Edge' : '';
    return browser ? (platform + ' · ' + browser) : platform;
  }

  // Real route context: whichever path + hash the browser is actually on
  // right now (app.html's tabs/modals set location.hash-free state via
  // classes rather than the URL, so this stays accurate as "pathname" on
  // that page and still captures a real hash on pages that do use one).
  function captureRoute() {
    return location.pathname + (location.hash || '');
  }

  function buildWidget() {
    badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'cgf-badge';
    badge.id = 'cgfBadge';
    badge.innerHTML = '<span class="cgf-pulse-dot" aria-hidden="true"></span><span>Instant Feedback</span>';
    document.body.appendChild(badge);

    drawer = document.createElement('div');
    drawer.className = 'cgf-drawer';
    drawer.id = 'cgfDrawer';
    drawer.innerHTML =
      '<div class="cgf-card" role="dialog" aria-modal="true" aria-labelledby="cgfTitle">' +
        '<div class="cgf-title" id="cgfTitle">Instant Alpha Feedback</div>' +
        '<div class="cgf-route-chip" id="cgfRouteChip"></div>' +
        '<div class="cgf-tag-row" id="cgfTagRow">' +
          TAGS.map(function (t, i) { return '<button type="button" class="cgf-tag-chip' + (i === 0 ? ' active' : '') + '" data-tag="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') +
        '</div>' +
        '<textarea class="cgf-note" id="cgfNote" rows="2" placeholder="One line, optional — what happened?"></textarea>' +
        '<div class="cgf-actions">' +
          '<button type="button" class="cgf-btn-submit" id="cgfSubmit">Submit Feedback</button>' +
          '<button type="button" class="cgf-btn-cancel" id="cgfCancel">Cancel</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(drawer);

    badge.addEventListener('click', open);
    drawer.querySelector('#cgfCancel').addEventListener('click', close);
    drawer.addEventListener('click', function (e) { if (e.target === drawer) close(); });
    drawer.querySelectorAll('.cgf-tag-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        selectedTag = chip.dataset.tag;
        drawer.querySelectorAll('.cgf-tag-chip').forEach(function (c) { c.classList.toggle('active', c === chip); });
      });
    });
    drawer.querySelector('#cgfSubmit').addEventListener('click', submit);
  }

  function open() {
    selectedTag = 'Bug';
    drawer.querySelector('#cgfRouteChip').textContent = captureRoute();
    drawer.querySelector('#cgfNote').value = '';
    drawer.querySelectorAll('.cgf-tag-chip').forEach(function (c) { c.classList.toggle('active', c.dataset.tag === 'Bug'); });
    drawer.classList.add('open');
  }
  function close() {
    drawer.classList.remove('open');
  }

  async function submit() {
    var btn = drawer.querySelector('#cgfSubmit');
    var note = drawer.querySelector('#cgfNote').value.trim();
    btn.disabled = true;
    var prevLabel = btn.textContent;
    btn.textContent = 'Submitting…';
    var snapshot = null;
    // Best-effort only — see the file header note on why this quietly does
    // nothing (rather than erroring) on a page that never loaded html2canvas.
    if (typeof window.html2canvas === 'function') {
      try {
        var canvas = await window.html2canvas(document.body, { backgroundColor: '#030712', scale: 0.4, logging: false });
        snapshot = canvas.toDataURL('image/png');
      } catch (e) { /* snapshot best-effort only */ }
    }
    try {
      var res = await fetch('/api/operator/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: captureRoute(), device: shortDeviceLabel(), tag: selectedTag, note: note, snapshot: snapshot })
      });
      if (!res.ok) throw new Error('bad status ' + res.status);
      close();
      toast('Feedback submitted — thank you!');
    } catch (e) {
      toast('Could not submit feedback — try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = prevLabel;
    }
  }

  window.CitixenGlobalFeedback = {
    init: function (options) {
      cfg = Object.assign({}, cfg, options || {});
      if (document.getElementById('cgfBadge')) return; // already initialized on this page
      buildWidget();
    }
  };
})();
