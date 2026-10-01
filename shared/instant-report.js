/* =====================================================================
   CITIXEN UX™ — INSTANT REPORT (shared by index.html and app.html)
   ---------------------------------------------------------------------
   Renders the Dashboard's "REPORTS & EASY SHARE" hero card and the
   digital-first Civic Intelligence™ Brief modal from one file, so the web
   Dashboard and the app's Dashboard tab stay 1:1. Tapping "Generate Free
   Report" goes straight to the dark-mode on-screen Brief — no format-picker
   tabs or other upfront prompts — and the Civic Health needle runs a short
   live calibration sweep before settling on the real reading.
   "Share & Export Brief" first asks whether to append the Living Ledger™
   Audit Summary (summary + public audit trail), then slides up an export
   sheet with 3 tabs:
     • Official PDF        — live PDF.js preview of the jsPDF brief +
                             Download / Email Printable PDF
     • 1:1 Social Graphic  — 1080x1080 canvas (FREE CIVIC REPORT, Snapshot,
                             3 metrics, scannable QR) + Share to Social Apps
                             (navigator.share; desktop copies link & image)
     • Copy Text & Link    — plain-text preview + one-tap copy

   Each page supplies its own data adapter (getData) because the two pages
   keep their jurisdiction state differently (currentWardMeta in app.html,
   activeJurisdiction() in index.html). Every figure comes from that
   adapter — the same ledger tickets, ward directory and CAPEX_PROJECTS
   records the page already renders. Nothing here invents a number.

   getData() must resolve to:
   {
     jurisdiction: 'La Crosse, WI — Ward 4',  // full label
     cityLabel:    'LA CROSSE, WI',
     wardLabel:    'WARD 4' | null,            // null when no ward is confirmed
     resolved: 7, total: 10,                   // city ticket counts
     coveragePct: 100 | null,                  // logged wards / known wards
     avgDays: 0.8 | null,                      // avg resolution, days
     counts: { submitted, dispatched, resolved },
     cip: [{ name, status: 'on-time'|'on-track'|'delayed', scheduled }],
     nodes: [{ lat, lng }]                     // optional; unused by this
                                                // file today (the share
                                                // graphic is truncated to
                                                // header/gauge+metric/footer
                                                // only — see drawCard()),
                                                // kept for callers that may
                                                // still want the raw pins
   }
   ===================================================================== */
(function () {
  'use strict';

  var MINT = '#00E699', NAVY = '#090D16', SLATE = '#94A3B8';

  // Custom 1px line-art icon set (Laser Mint via .cx-icon). No emoji or
  // system glyphs anywhere in the module, modal or drawer.
  var ICONS = {
    doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.5 12h6M9.5 15h6M9.5 18h4"/>',
    nodes: '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
    printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    phoneShare: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M12 15V8M9 10.5l3-3 3 3"/><path d="M10.5 19h3"/>',
    shareUp: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    capital: '<path d="M4 20h16"/><path d="M6 20v-5h3v5M10.5 20v-9h3v9M15 20v-7h3v7"/><path d="M5 10l5-4 4 3 5-5"/><path d="M16 4h3v3"/>',
    truck: '<path d="M2 6h11v10H2z"/><path d="M13 9h4l4 4v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    archive: '<path d="M3 9l9-5 9 5"/><path d="M4 9h16"/><path d="M6 9v8M10 9v8M14 9v8M18 9v8"/><path d="M4 17h16M3 20h18"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    shieldPlain: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    hexgrid: '<path d="M8 3l3.5 2v4L8 11 4.5 9V5z"/><path d="M15.5 3L19 5v4l-3.5 2L12 9V5z"/><path d="M11.75 10.5l3.5 2v4l-3.5 2-3.5-2v-4z"/><path d="M4.5 14.5L8 12.5"/><path d="M19 14.5l-3.75-2"/><path d="M8.25 16.5L4.5 18.5M15.25 16.5l3.75 2"/>',
    pin: '<path d="M12 21s7-5.33 7-11a7 7 0 0 0-14 0c0 5.67 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>'
  };
  function icon(name, extraClass) {
    return '<svg class="cx-icon' + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- formatting ----------
  function stamp(now) {
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var yy = String(now.getFullYear()).slice(-2);
    var h = now.getHours(), ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    var mins = String(now.getMinutes()).padStart(2, '0');
    var tz = '';
    try {
      var part = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(now).find(function (p) { return p.type === 'timeZoneName'; });
      tz = part ? ' ' + part.value : '';
    } catch (e) { tz = ''; }
    return mm + '/' + dd + '/' + yy + ' • ' + h + ':' + mins + ' ' + ampm + tz;
  }
  function shortDate(now) {
    return String(now.getMonth() + 1).padStart(2, '0') + '/' + String(now.getDate()).padStart(2, '0') + '/' + String(now.getFullYear()).slice(-2);
  }
  function cipLabel(status) { return status === 'on-time' ? 'On-Time' : status === 'delayed' ? 'Delayed' : 'In Progress'; }
  function cipClass(status) { return status === 'on-time' ? 'cx-pill-ontime' : status === 'delayed' ? 'cx-pill-delayed' : 'cx-pill-progress'; }
  // Ward health score: share of this jurisdiction's tickets that are
  // resolved, on a 10-point scale (7 of 10 resolved -> 7 / 10).
  function healthScore(d) { return d.total ? Math.round((d.resolved / d.total) * 10) : null; }
  function daysText(d) { return d.avgDays != null ? d.avgDays.toFixed(1) : '—'; }
  // Direct unit conversion of the same real avgDays figure — not a
  // different or invented measurement.
  function avgHoursText(d) { return d.avgDays != null ? Math.round(d.avgDays * 24) + ' hrs' : 'N/A'; }
  function pctText(v) { return v != null ? v + '%' : 'N/A'; }
  function resolutionRate(d) { return d.total ? Math.round((d.resolved / d.total) * 100) + '%' : 'N/A'; }
  function delayedCount(d) { return d.cip.filter(function (p) { return p.status === 'delayed'; }).length; }
  function siteUrl() { return location.origin + '/'; }
  // City + state only, never a ward number — the home jurisdiction both
  // pages already resolve via GPS/search (home.cityName / home.stateName),
  // falling back to parsing the " — Ward N" suffix off the full label.
  function cityStateLabel(d) {
    if (d.home && d.home.cityName && d.home.stateName) return d.home.cityName + ', ' + d.home.stateName;
    return String(d.jurisdiction || '').replace(/\s*—\s*.*$/, '').replace(/\s*\(citywide\)\s*$/i, '');
  }
  // Hazard Index: a live read of this jurisdiction's own report nodes
  // (the same severity classification CitixenSeverity already assigns to
  // every pin on the dashboard map) — never a fabricated score. Any open
  // Critical hazard makes the whole jurisdiction CRITICAL; otherwise a
  // meaningful share of open Warning items makes it MODERATE.
  function hazardIndex(d) {
    var nodes = (d.nodes || []).filter(function (n) { return n.status !== 'Resolved'; });
    if (!nodes.length) return { label: 'LOW RISK', color: MINT };
    var crit = nodes.filter(function (n) { return n.status === 'Critical'; }).length;
    if (crit > 0) return { label: 'CRITICAL', color: '#FF3B30' };
    var warn = nodes.filter(function (n) { return n.status === 'Warning'; }).length;
    if (warn / nodes.length >= 0.34) return { label: 'MODERATE', color: '#F59E0B' };
    return { label: 'LOW RISK', color: MINT };
  }
  // ---------- Civic Health Ranking ----------
  // Ranks every mapped ward (from /api/coverage/national) on an even blend
  // of block coverage and resolution speed:
  //   score = 0.5 × coverage% + 0.5 × speed, speed = 100 × fastest avg / own avg
  // computed from the same ledger tickets the dashboard shows. Ranks are
  // among wards actually mapped today. There is no quarter-over-quarter
  // history in this data yet, so no movement arrow is invented.
  function computeRanks(d) {
    var ms = d.national || [], tickets = d.tickets || [], h = d.home;
    if (!ms.length || !h) return null;
    var rows = ms.map(function (m) {
      var t = tickets.filter(function (x) { return x.state === m.state && x.city === m.city && x.ward === m.ward; });
      var timed = t.filter(function (x) { return x.stage === 'resolved' && typeof x.resolutionHours === 'number'; });
      var avg = timed.length ? timed.reduce(function (s, x) { return s + x.resolutionHours; }, 0) / timed.length : null;
      return { m: m, cov: m.coveragePct || 0, avg: avg };
    });
    var timedAvgs = rows.filter(function (r) { return r.avg != null; }).map(function (r) { return r.avg; });
    var fastest = timedAvgs.length ? Math.min.apply(null, timedAvgs) : null;
    rows.forEach(function (r) { r.score = 0.5 * r.cov + 0.5 * (r.avg != null && fastest ? 100 * fastest / r.avg : 0); });
    rows.sort(function (a, b) { return b.score - a.score; });
    var me = rows.filter(function (r) { return r.m.state === h.state && r.m.city === h.city && r.m.ward === h.ward; })[0];
    if (!me) return null;
    var inState = rows.filter(function (r) { return r.m.state === h.state; });
    return {
      national: rows.indexOf(me) + 1, nationalOf: rows.length,
      state: inState.indexOf(me) + 1, stateOf: inState.length,
      stateName: me.m.stateName || h.stateName || String(h.state).toUpperCase(),
      stateAbbr: String(me.m.state || h.state || '').toUpperCase(),
      subject: (me.m.cityName || h.cityName) + ' ' + (me.m.wardName || h.wardName || '')
    };
  }
  function natRankText(r) { return r ? '#' + r.national : 'N/A'; }
  function stateRankText(r) { return r ? '#' + r.state + ' IN ' + String(r.stateName).toUpperCase() : 'N/A'; }
  function stateRankValue(r) { return r ? '#' + r.state : 'N/A'; }
  function stateRankSubtext(r) { return r ? r.stateAbbr : ''; }
  // Card 3 header bar: the state postal code moves into the label itself
  // (e.g. "WI STATE RANK") so the body can show just the rank, with no
  // repeated abbreviation.
  function stateRankHeaderLabel(r) { return (stateRankSubtext(r) ? stateRankSubtext(r) + ' ' : '') + 'State Rank'; }

  // ---------- state ----------
  var cfg = { getData: null, toast: null, onLedger: null, onStack: null, ledgerAsSecondary: false, trackEvent: null };
  var data = null, generatedAt = null, modal = null, lastFocus = null;
  // Whether the "+ Append Living Ledger™ Audit Summary" checkbox in the
  // Share & Export drawer is checked. Reset to false each time the Brief
  // is (re)opened so a stale choice never silently carries into a
  // different jurisdiction's PDF.
  var appendLedgerSummary = false;

  function toast(msg) {
    var hint = modal && modal.classList.contains('open') && modal.querySelector('#cxHint-pdf');
    if (hint) hint.textContent = msg;
    if (typeof cfg.toast === 'function') { cfg.toast(msg); return; }
    if (hint) return;
    // Page has no toast of its own (index.html): a small transient notice.
    var el = document.getElementById('cxToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cxToast'; el.className = 'cx-toast'; el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('show'); }, 4000);
  }

  // Beta telemetry hook for export actions (PDF download, share graphic,
  // copy text & link) — a no-op unless the host page passes a real
  // trackEvent() in init() (app.html does; index.html currently doesn't,
  // so this stays a harmless no-op there rather than fabricating a sink
  // that doesn't exist on that page).
  function trackEvent(name, detail) {
    if (typeof cfg.trackEvent === 'function') cfg.trackEvent(name, detail || {});
  }

  // ---------- Export & Share hero module ----------
  function renderModule(mount) {
    mount.innerHTML =
      '<section class="cx-export" aria-labelledby="cxExportTitle">' +
        '<h3 class="cx-export-title" id="cxExportTitle">Reports &amp; Easy Share</h3>' +
        '<div class="cx-btn-stack">' +
          '<button type="button" class="cx-btn-primary" data-cx-open="pdf">Generate Free Report</button>' +
          // Button 2 (secondary slot): "View Living Public Ledger ↗" when a
          // page opts in via ledgerAsSecondary (app.html — the Ledger moved
          // here because Button 3 below no longer opens it, see onStack);
          // otherwise the original "Share CITIXEN UX™" action (index.html,
          // unchanged). The "live monitor" look (dark fill + dashed green
          // border + pulse dot) lives in .cx-btn-dark-dashed, a dedicated
          // modifier so the plain .cx-btn-dashed used elsewhere (Share,
          // the Civic Memory info-panel CTA) keeps its transparent look.
          (cfg.ledgerAsSecondary && cfg.onLedger
            ? '<button type="button" class="cx-btn-ledger" data-cx-ledger-secondary>' +
                '<span class="cx-ledger-pulse-dot" aria-hidden="true"></span>' +
                '<span>View Living Public Ledger</span>' +
              '</button>'
            : '<button type="button" class="cx-btn-dashed" data-cx-share-platform>' +
                '<span style="color:#FFFFFF">Share CITIXEN </span>' +
                '<span>' +
                  '<span style="color:#00E699">UX</span>' +
                  '<sup style="color:#94A3B8;font-weight:400;font-size:.65em;margin-left:1px;line-height:0">™</sup>' +
                '</span>' +
              '</button>') +
          (cfg.onStack
            ? '<button type="button" class="cx-btn-tertiary" data-cx-stack>' +
                '<span>Civic Intelligence<sup class="cx-tm">™</sup> Stack</span>' +
              '</button>'
            : (!cfg.ledgerAsSecondary && cfg.onLedger)
              ? '<button type="button" class="cx-btn-tertiary" data-cx-ledger>' +
                  '<span class="cx-ledger-pulse-dot" aria-hidden="true"></span>' +
                  '<span>View Live Public Ledger</span>' +
                '</button>'
              : '') +
        '</div>' +
      '</section>';
    mount.querySelector('[data-cx-open]').addEventListener('click', function (e) { open('pdf', e.currentTarget); });
    var sharePlatformBtn = mount.querySelector('[data-cx-share-platform]');
    if (sharePlatformBtn) sharePlatformBtn.addEventListener('click', sharePlatform);
    var ledgerSecondaryBtn = mount.querySelector('[data-cx-ledger-secondary]');
    if (ledgerSecondaryBtn) ledgerSecondaryBtn.addEventListener('click', function () { cfg.onLedger(); });
    var stackBtn = mount.querySelector('[data-cx-stack]');
    if (stackBtn) stackBtn.addEventListener('click', function () { cfg.onStack(); });
    var ledgerBtn = mount.querySelector('[data-cx-ledger]');
    if (ledgerBtn) ledgerBtn.addEventListener('click', function () { cfg.onLedger(); });
  }

  async function sharePlatform() {
    var payload = { title: 'CITIXEN UX™', text: 'Free & anonymous civic reporting — see what is broken on your block and how fast it gets fixed.', url: siteUrl() };
    if (navigator.share) {
      try { await navigator.share(payload); } catch (err) { /* share sheet dismissed */ }
      return;
    }
    if (await copyText(payload.url)) toast('Link copied — paste it anywhere to share CITIXEN UX™.');
    else toast('Sharing is not available in this browser. The address is ' + payload.url);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  }

  // ---------- modal ----------
  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'cx-modal';
    modal.id = 'cxInstantReport';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'cxTitle');
    // Digital-first flow (per the "Report Flow, Visual DNA & Narrative
    // Funnel" round): tapping "Generate Free Civic Report" goes straight to
    // the dark-mode Digital Brief below — no upfront format-picker tiles,
    // no intermediate prompts. The brief is the only pane; "Official PDF
    // Brief ↓" / "Report Share Graphic ↓" / "Public Link & Summary ↓" are no
    // longer separate tabs the person must choose between first — the PDF
    // download and the share graphic are both reachable from the single
    // "Share & Export Brief" drawer at the bottom of this same view (see
    // renderPdfPane()). The old link-payload tab's content (ward score,
    // resolution, ranks — the same figures as payloadText()) still exists,
    // folded into that drawer as the optional "+ Append Living Ledger™
    // Audit Summary" checkbox rather than a tab of its own.
    modal.innerHTML =
      '<div class="cx-panel">' +
        // ALPHA LAUNCH FINAL PATCH — the 3-button Export & Share toolbar
        // that used to sit here (Export & Share Brief / Download PDF /
        // Copy Link, added above the header in Patch 4.5) is removed: this
        // round asked for a single Export/Action button at the bottom of
        // the report view instead of a top cluster. That single button is
        // '#cxShareExportBtn', already built at the bottom of the body by
        // renderPdfPane() ("Share & Export Brief") — it opens the same
        // openPreExport() flow the old toolbar's primary button did, so no
        // export capability was lost, just the duplicate top-of-view entry
        // points. A light scroll-continues indicator (#cxScrollIndicator,
        // see below) takes the toolbar's old spot at the top of the body
        // instead, since removing those 3 buttons also removed the visual
        // cue that this panel has more content below the fold.
        '<div class="cx-head">' + icon('shieldPlain') +
          '<div class="cx-head-text"><div class="cx-head-title" id="cxTitle">Civic Intelligence<sup class="cx-tm">™</sup> Brief</div>' +
          '<div class="cx-head-sub" id="cxJuris">Loading jurisdiction…</div></div>' +
          '<button type="button" class="cx-close" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="cx-body" id="cxBody">' +
          '<div id="cxPane-pdf"></div>' +
        '</div>' +
        '<div class="cx-scroll-indicator" id="cxScrollIndicator" aria-hidden="true">' + icon('chevronDown') + '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('.cx-close').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !modal.classList.contains('open')) return;
      // Escape closes the top-most export sheet first, then the Brief.
      var openSheet = modal.querySelector('.cx-sheet-overlay.open');
      if (openSheet) { hideSheet(openSheet); return; }
      close();
    });
    // Scroll-continues indicator: a light chevron near the top of the body,
    // fades out once the citizen actually scrolls (and back in if they
    // scroll back to the very top) — purely a visual affordance, never
    // blocks taps underneath it (pointer-events:none, see CSS).
    var scrollIndicatorEl = modal.querySelector('#cxScrollIndicator');
    var bodyEl = modal.querySelector('#cxBody');
    bodyEl.addEventListener('scroll', function () {
      scrollIndicatorEl.classList.toggle('cx-scroll-indicator-hidden', bodyEl.scrollTop > 24);
    });
  }

  async function open(tab, trigger) {
    if (!cfg.getData) return;
    if (!modal) buildModal();
    lastFocus = trigger || document.activeElement;
    modal.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    appendLedgerSummary = false;
    modal.querySelector('#cxJuris').textContent = 'Loading jurisdiction…';
    modal.querySelector('#cxPane-pdf').innerHTML = '<p class="cx-hint">Compiling the current district snapshot…</p>';
    try {
      data = await cfg.getData();
      data.ranks = computeRanks(data);
      generatedAt = new Date();
    } catch (err) {
      console.warn('Instant Report data failed to load', err);
      modal.querySelector('#cxPane-pdf').innerHTML = '<p class="cx-hint">Could not load the district snapshot. Check your connection and try again.</p>';
      return;
    }
    modal.querySelector('#cxJuris').textContent = cityStateLabel(data);
    renderPdfPane();
    modal.querySelector('.cx-close').focus();
  }

  function close() {
    if (!modal) return;
    modal.querySelectorAll('.cx-sheet-overlay').forEach(function (ov) { ov.classList.remove('open'); ov.hidden = true; });
    modal.classList.remove('open');
    document.documentElement.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // ---------- Branch A: Official PDF brief ----------
  function cipListHtml(projects, dark) {
    if (!projects.length) return '<p class="cx-empty">No capital projects are on file for this jurisdiction yet.</p>';
    return '<ul class="cx-cip' + (dark ? ' cx-cip-dark' : '') + '">' + projects.map(function (p) {
      return '<li><span class="cx-cip-name">' + esc(p.name || 'Capital project') + '</span>' +
        (p.scheduled ? '<span class="cx-cip-when">' + esc(p.scheduled) + '</span>' : '') +
        '<span class="cx-pill ' + cipClass(p.status) + '">' + cipLabel(p.status) + '</span></li>';
    }).join('') + '</ul>';
  }
  function mcard(val, lbl, color, subText) {
    return '<div class="cx-mcard"><div class="cx-mcard-head">' + esc(lbl) + '</div><div class="cx-mcard-body">' +
      '<div class="cx-mcard-val"' + (color ? ' style="color:' + color + '"' : '') + '>' + esc(val) + '</div>' +
      (subText ? '<div class="cx-mcard-sub">' + esc(subText) + '</div>' : '') +
    '</div></div>';
  }
  // Community Action Snapshot: all 3 cards share one black/charcoal anchor
  // container (.cx-acards-wrap) — Reports Filed and Open Active Dispatches
  // flank the Hazard Index gauge. Header labels are Brand Green/bold/
  // uppercase, values Crisp White (color overridden only for the open-
  // dispatches crimson callout).
  function actionCard(val, lbl, color) {
    return '<div class="cx-acard"><div class="cx-acard-lbl"><span class="cx-led" aria-hidden="true"></span>' + esc(lbl) + '</div>' +
      '<div class="cx-acard-val"' + (color ? ' style="color:' + color + '"' : '') + '>' + esc(val) + '</div></div>';
  }
  // Hazard Index gauge: a 180°, 3-segment semicircular meter (green/amber/
  // red). The needle is centered within whichever segment matches the real
  // computed hazardIndex() reading for this jurisdiction — never a fixed or
  // fabricated angle. Needle/hub are rendered in white for contrast against
  // the dark anchor container.
  function hazardGaugeAngle(label) { return label === 'CRITICAL' ? 150 : label === 'MODERATE' ? 90 : 30; }
  // Display text for the gauge's 3 zones, distinct from Section 2's
  // On-Time/Delayed capital-project vocabulary: real-time dispatch-load
  // reading, not a project-timeline status.
  function civicHealthZoneLabel(label) { return label === 'CRITICAL' ? 'HIGH LOAD' : label === 'MODERATE' ? 'MODERATE' : 'OPTIMAL'; }
  function hazardGaugeSvg(hz, vw, vh) {
    var cx = vw / 2, cy = vh - 6, r = Math.min(vw / 2 - 6, vh - 16), sw = Math.max(10, Math.round(r * 0.24));
    function pt(a, rad) { var rad2 = a * Math.PI / 180; return { x: cx - rad * Math.cos(rad2), y: cy - rad * Math.sin(rad2) }; }
    var segs = [{ a0: 0, a1: 60, color: '#00E699' }, { a0: 60, a1: 120, color: '#F59E0B' }, { a0: 120, a1: 180, color: '#EF4444' }];
    var arcs = segs.map(function (s) {
      var p0 = pt(s.a0, r), p1 = pt(s.a1, r);
      return '<path d="M' + p0.x.toFixed(1) + ',' + p0.y.toFixed(1) + ' A' + r.toFixed(1) + ',' + r.toFixed(1) + ' 0 0 1 ' + p1.x.toFixed(1) + ',' + p1.y.toFixed(1) + '" stroke="' + s.color + '" stroke-width="' + sw + '" fill="none"/>';
    }).join('');
    // The needle is drawn pointing at 0° (far left) and rotated into place
    // with an SVG rotate() about the hub, so calibrateGaugeNeedle() can
    // animate it. Its initial rotation is the real target angle, so the
    // gauge still reads correctly if the animation never runs (reduced
    // motion, or a renderer without JS).
    var needleA = hazardGaugeAngle(hz.label), tip = pt(0, r - sw - 4);
    return '<svg viewBox="0 0 ' + vw + ' ' + vh + '" width="100%" role="img" aria-label="Civic Health gauge: ' + esc(civicHealthZoneLabel(hz.label)) + '">' +
      arcs +
      '<line class="cx-gauge-needle" data-cx-target="' + needleA + '" data-cx-cx="' + cx + '" data-cx-cy="' + cy + '" transform="rotate(' + needleA + ' ' + cx + ' ' + cy + ')" x1="' + cx + '" y1="' + cy + '" x2="' + tip.x.toFixed(1) + '" y2="' + tip.y.toFixed(1) + '" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="#FFFFFF"/>' +
    '</svg>';
  }
  function hazardGaugeCardHtml(hz) {
    var riskColor = hz.label === 'CRITICAL' ? '#EF4444' : hz.label === 'MODERATE' ? '#F59E0B' : '#00E699';
    return '<div class="cx-acard cx-acard-gauge"><div class="cx-acard-lbl"><span class="cx-led" aria-hidden="true"></span>Civic Health</div>' + hazardGaugeSvg(hz, 160, 92) +
      '<div class="cx-acard-risk-lbl" data-cx-risk-lbl data-cx-final="' + esc(civicHealthZoneLabel(hz.label)) + '" style="color:' + riskColor + '">' + esc(civicHealthZoneLabel(hz.label)) + '</div></div>';
  }
  // Live calibration sweep for the Civic Health needle: starts at 0°,
  // swings across the full spectrum, then settles with a damped shake onto
  // the real computed angle (hazardGaugeAngle(), never a fixed reading).
  // The zone label reads "CALIBRATING…" until the needle lands.
  // prefers-reduced-motion skips straight to the settled reading.
  function calibrateGaugeNeedle(root) {
    var needle = root && root.querySelector('.cx-gauge-needle');
    if (!needle) return;
    var target = +needle.getAttribute('data-cx-target');
    var cx = needle.getAttribute('data-cx-cx'), cy = needle.getAttribute('data-cx-cy');
    var lbl = root.querySelector('[data-cx-risk-lbl]');
    function setA(a) { needle.setAttribute('transform', 'rotate(' + a.toFixed(2) + ' ' + cx + ' ' + cy + ')'); }
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { setA(target); return; }
    function clamp(a) { return Math.max(0, Math.min(180, a)); }
    // Keyframes (angle, duration ms): full sweep, swing back, then a
    // damped oscillation around the target.
    var keys = [[0, 0], [176, 620], [18, 520], [clamp(target + 34), 360], [clamp(target - 20), 260],
      [clamp(target + 11), 200], [clamp(target - 5), 160], [clamp(target + 2), 130], [target, 120]];
    var finalTxt = lbl ? lbl.getAttribute('data-cx-final') : '', finalColor = lbl ? lbl.style.color : '';
    if (lbl) { lbl.textContent = 'CALIBRATING…'; lbl.style.color = '#94A3B8'; }
    setA(0);
    var seg = 1, segStart = null;
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function step(ts) {
      if (!needle.isConnected) return;
      if (segStart === null) segStart = ts;
      var from = keys[seg - 1][0], to = keys[seg][0], dur = keys[seg][1];
      var t = Math.min((ts - segStart) / dur, 1);
      // A hair of needle jitter while it is still moving fast, for a live
      // instrument feel; zero by the final settle.
      var jitter = seg < keys.length - 2 ? (Math.random() - 0.5) * 1.6 : 0;
      setA(clamp(from + (to - from) * ease(t) + jitter));
      if (t < 1) { requestAnimationFrame(step); return; }
      seg++; segStart = ts;
      if (seg < keys.length) { requestAnimationFrame(step); return; }
      setA(target);
      if (lbl) { lbl.textContent = finalTxt; lbl.style.color = finalColor; }
    }
    // Small delay so the sweep starts after the modal has painted.
    setTimeout(function () { requestAnimationFrame(step); }, 180);
  }
  // Capital Project Tracker: a qualitative progress bar per status tier —
  // On-Time (green) / In Progress or a stale field update (amber) /
  // Delayed (red). There is no measured percent-complete field in the CIP
  // data model, so no specific completion number is ever shown — only a
  // relative fill alongside the real name/quarter/status.
  function cipThermHtml(projects) {
    if (!projects.length) return '<p class="cx-empty">No capital projects are on file for this jurisdiction yet.</p>';
    return '<div class="cx-therm-list">' + projects.map(function (p) {
      var fill = p.status === 'on-time' ? 92 : p.status === 'delayed' ? 28 : 56;
      var color = p.status === 'on-time' ? MINT : p.status === 'delayed' ? '#FF3B30' : '#F59E0B';
      return '<div class="cx-therm">' +
        '<div class="cx-therm-fill" style="width:' + fill + '%;background:' + color + '"></div>' +
        '<span class="cx-therm-name">' + esc(p.name || 'Capital project') + '</span>' +
        '<span class="cx-therm-end">' + esc(p.scheduled || '—') + ' · ' + cipLabel(p.status) + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }
  function renderPdfPane() {
    var d = data, r = d.ranks, hz = hazardIndex(d);
    var el = modal.querySelector('#cxPane-pdf');
    el.innerHTML =
      '<div class="cx-paper">' +
        '<div class="cx-mast-lg">' +
          '<span class="cx-patents-badge">Patents Pending</span>' +
          icon('shieldPlain', 'cx-mast-lg-icon') +
          '<div class="cx-mast-lg-text">' +
            '<div class="cx-mast-lg-brand">CITIXEN <b>UX</b><sup class="cx-mast-lg-tm">™</sup></div>' +
            '<div class="cx-mast-lg-tagline">Upgrade your civic experience.</div>' +
          '</div>' +
        '</div>' +
        // Inner marketing header. The jurisdiction and "Civic Intelligence™
        // Brief" title are shown once, in the modal top bar (single source
        // of truth), so the card body doesn't repeat them.
        '<div class="cx-brief-hdr">' +
          '<span class="cx-brief-headline">Free Civic Report</span>' +
          '<span class="cx-brief-stamp">Generated ' + esc(shortDate(generatedAt)) + ' • citixenux.com</span>' +
        '</div>' +
        '<div class="cx-sec">' +
          '<div class="cx-acards-wrap"><div class="cx-acards-head">Living Ledger™ Snapshot</div><div class="cx-acards">' +
            actionCard(d.total, 'Reports Filed') +
            hazardGaugeCardHtml(hz) +
            actionCard(d.counts.dispatched, 'Open Active Dispatches', d.counts.dispatched > 0 ? '#FF3B30' : null) +
          '</div></div></div>' +
        '<div class="cx-sec"><div class="cx-sec-title">Civic Performance Metrics</div>' +
          '<div class="cx-mcards">' +
            mcard(avgHoursText(d), 'Avg. Fix Speed') +
            mcard(resolutionRate(d), 'Resolution Rate') +
            mcard(stateRankValue(r), stateRankHeaderLabel(r)) +
          '</div></div>' +
        '<div class="cx-sec"><div class="cx-sec-title">Capital Project Tracker</div>' + cipThermHtml(d.cip) + '</div>' +
        '<div class="cx-footer-single">CITIXEN UX™ • Civic Intelligence™<div class="cx-verify-line">Verified via CITIXEN UX™ Protocol | Living Ledger™ Output</div></div>' +
        '</div>' +
      '</div>' +
      // "Share & Export Brief" → pre-export audit prompt → upward-sliding
      // export sheet with 3 tabs (Official PDF / 1:1 Social Graphic / Copy
      // Text & Link). Both overlays are built by buildExportSheets().
      '<div class="cx-actions"><button type="button" class="cx-btn-primary" id="cxShareExportBtn" aria-haspopup="dialog">' + icon('shareUp') + 'Share &amp; Export Brief</button></div>' +
      '<p class="cx-hint" id="cxHint-pdf"></p>';
    buildExportSheets();
    el.querySelector('#cxShareExportBtn').addEventListener('click', openPreExport);
    calibrateGaugeNeedle(el);
  }

  // ---------- Pre-export prompt + 3-tab export sheet ----------
  var exportTab = 'pdf', pdfPreviewKey = null;
  function buildExportSheets() {
    modal.querySelectorAll('.cx-sheet-overlay').forEach(function (n) { n.remove(); });
    var shareLbl = canShareImageFiles() ? 'Share to Social Apps' : 'Copy Link &amp; Image to Clipboard';
    var wrap = document.createElement('div');
    wrap.innerHTML =
      // Step 1 — upfront audit toggle
      '<div class="cx-sheet-overlay" id="cxPreExport" hidden>' +
        '<div class="cx-sheet cx-sheet-sm" role="dialog" aria-modal="true" aria-labelledby="cxPreTitle">' +
          '<div class="cx-sheet-grip" aria-hidden="true"></div>' +
          '<div class="cx-pre-title" id="cxPreTitle">Append Living Ledger<sup class="cx-tm">™</sup> Audit Summary?</div>' +
          '<label class="cx-export-check cx-pre-check"><input type="checkbox" id="cxAuditToggle" checked>' +
            '<span>Include public audit trail &amp; verified dispatch timestamps in export.</span></label>' +
          '<button type="button" class="cx-btn-primary" id="cxPreContinue">Continue to Export Options</button>' +
          '<button type="button" class="cx-sheet-cancel" id="cxPreCancel">Cancel</button>' +
        '</div>' +
      '</div>' +
      // Step 2 — export sheet
      '<div class="cx-sheet-overlay" id="cxExportSheet" hidden>' +
        '<div class="cx-sheet cx-sheet-lg" role="dialog" aria-modal="true" aria-labelledby="cxExpTitle">' +
          '<div class="cx-sheet-grip" aria-hidden="true"></div>' +
          '<div class="cx-sheet-head"><span class="cx-sheet-title" id="cxExpTitle">Export Brief</span>' +
            '<button type="button" class="cx-close" id="cxExportClose" aria-label="Close export options">✕</button></div>' +
          '<div class="cx-audit-status" id="cxAuditStatus"></div>' +
          '<div class="cx-seg" role="tablist" aria-label="Export format">' +
            '<button type="button" role="tab" class="cx-seg-btn" data-tab="pdf" id="cxTab-pdf" aria-controls="cxTabPane-pdf"><b>Official PDF</b><small>Print &amp; Email Ready</small></button>' +
            '<button type="button" role="tab" class="cx-seg-btn" data-tab="graphic" id="cxTab-graphic" aria-controls="cxTabPane-graphic"><b>1:1 Social Graphic</b><small>Social Media Ready</small></button>' +
            '<button type="button" role="tab" class="cx-seg-btn" data-tab="text" id="cxTab-text" aria-controls="cxTabPane-text"><b>Copy Text &amp; Link</b><small>Direct Messaging</small></button>' +
          '</div>' +
          '<div class="cx-sheet-body">' +
            '<div class="cx-tabpane" role="tabpanel" id="cxTabPane-pdf" aria-labelledby="cxTab-pdf">' +
              '<div class="cx-pdf-preview" id="cxPdfPreview"><p class="cx-hint">Rendering preview…</p></div>' +
              '<button type="button" class="cx-btn-primary" id="cxPdfBtn">' + icon('doc') + 'Download / Email Printable PDF</button>' +
            '</div>' +
            '<div class="cx-tabpane" role="tabpanel" id="cxTabPane-graphic" aria-labelledby="cxTab-graphic" hidden>' +
              '<div class="cx-graphic-preview"><canvas id="cxCardCanvas" width="1080" height="1080" aria-label="1:1 social graphic preview"></canvas></div>' +
              '<button type="button" class="cx-btn-primary" id="cxShareCardBtn">' + icon(canShareImageFiles() ? 'phoneShare' : 'copy') + shareLbl + '</button>' +
            '</div>' +
            '<div class="cx-tabpane" role="tabpanel" id="cxTabPane-text" aria-labelledby="cxTab-text" hidden>' +
              '<textarea class="cx-text-preview" id="cxTextPreview" readonly rows="12" aria-label="Plain text preview"></textarea>' +
              '<button type="button" class="cx-btn-primary" id="cxCopyTextBtn">' + icon('copy') + 'Copy Text &amp; Direct Link to Clipboard</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    while (wrap.firstChild) modal.appendChild(wrap.firstChild);

    var pre = modal.querySelector('#cxPreExport'), sheet = modal.querySelector('#cxExportSheet');
    modal.querySelector('#cxPreCancel').addEventListener('click', function () { hideSheet(pre); });
    pre.addEventListener('click', function (e) { if (e.target === pre) hideSheet(pre); });
    modal.querySelector('#cxPreContinue').addEventListener('click', function () {
      appendLedgerSummary = modal.querySelector('#cxAuditToggle').checked;
      hideSheet(pre);
      openExportSheet();
    });
    modal.querySelector('#cxExportClose').addEventListener('click', function () { hideSheet(sheet); });
    sheet.addEventListener('click', function (e) { if (e.target === sheet) hideSheet(sheet); });
    modal.querySelectorAll('.cx-seg-btn').forEach(function (b) {
      b.addEventListener('click', function () { selectExportTab(b.getAttribute('data-tab')); });
    });
    modal.querySelector('#cxPdfBtn').addEventListener('click', function (e) { downloadPdf(e.currentTarget); });
    modal.querySelector('#cxShareCardBtn').addEventListener('click', function (e) { drawCard(); shareCard(e.currentTarget); });
    modal.querySelector('#cxCopyTextBtn').addEventListener('click', async function () {
      var ok = await copyText(modal.querySelector('#cxTextPreview').value);
      if (ok) mintToast('Text & direct link copied to clipboard');
      else { var ta = modal.querySelector('#cxTextPreview'); ta.focus(); ta.select(); toast('Copy is blocked here — the text is selected, copy it manually.'); }
      trackEvent('export_copy_link', { ok: ok });
    });
  }
  function showSheet(ov) {
    ov.hidden = false;
    requestAnimationFrame(function () { requestAnimationFrame(function () { ov.classList.add('open'); }); });
  }
  function hideSheet(ov) {
    ov.classList.remove('open');
    setTimeout(function () { ov.hidden = true; }, 260);
  }
  function openPreExport() {
    var pre = modal.querySelector('#cxPreExport');
    modal.querySelector('#cxAuditToggle').checked = true;
    showSheet(pre);
    modal.querySelector('#cxPreContinue').focus();
  }
  function openExportSheet() {
    var sheet = modal.querySelector('#cxExportSheet');
    modal.querySelector('#cxAuditStatus').innerHTML = appendLedgerSummary
      ? '<span class="cx-led" aria-hidden="true"></span>Living Ledger™ audit summary included'
      : 'Living Ledger™ audit summary not included';
    modal.querySelector('#cxTextPreview').value = plainTextExport();
    pdfPreviewKey = null;
    showSheet(sheet);
    selectExportTab(exportTab);
  }
  function selectExportTab(tab) {
    exportTab = tab;
    modal.querySelectorAll('.cx-seg-btn').forEach(function (b) {
      var on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    });
    ['pdf', 'graphic', 'text'].forEach(function (t) { modal.querySelector('#cxTabPane-' + t).hidden = t !== tab; });
    if (tab === 'pdf') renderPdfPreview();
    if (tab === 'graphic') drawCard();
  }

  // Tab 3 text: a short, scannable brief for pasting into a text message or
  // DM. Condensed to 2 metric lines (dropping the per-record "Audit trail"
  // list that used to print here — still available in the full PDF) plus,
  // when the audit toggle is on, a 1-line Living Ledger summary. Every
  // figure is still the same live adapter read as the rest of this file —
  // shortening the copy never means freezing the numbers; see the file
  // header note ("Nothing here invents a number").
  function plainTextExport() {
    var d = data, hz = hazardIndex(d), score = healthScore(d);
    var lines = [
      'FREE CIVIC REPORT',
      '• Reports Filed: ' + d.total + ' | Civic Health: ' + civicHealthZoneLabel(hz.label) + ' | Open Dispatches: ' + d.counts.dispatched,
      '• Avg Fix Speed: ' + avgHoursText(d) + ' | Resolution Rate: ' + resolutionRate(d) + ' | ' + stateRankHeaderLabel(d.ranks) + ': ' + stateRankValue(d.ranks),
      ''
    ];
    if (appendLedgerSummary) {
      lines.push(
        'LIVING LEDGER™ AUDIT SUMMARY — ' + cityStateLabel(d),
        '• Zone Health Score: ' + (score != null ? score + '/10' : 'N/A') + ' | Resolved: ' + (d.total ? d.resolved + '/' + d.total : 'N/A') + ' | Coverage: ' + pctText(d.coveragePct),
        ''
      );
    }
    lines.push('View full live public ledger and active dispatches:', auditUrl());
    return lines.join('\n');
  }

  // Tab 1 preview: the real jsPDF output rendered page by page with PDF.js
  // (lazy-loaded from cdnjs the first time). If PDF.js can't load, the
  // download still works — only the preview is skipped.
  var PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var pdfjsPromise = null;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = new Promise(function (res, rej) {
      var sc = document.createElement('script'); sc.src = PDFJS_URL; sc.async = true;
      sc.onload = function () {
        if (!window.pdfjsLib) { rej(new Error('pdfjsLib missing')); return; }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        res(window.pdfjsLib);
      };
      sc.onerror = function () { pdfjsPromise = null; rej(new Error('PDF.js failed to load')); };
      document.head.appendChild(sc);
    });
    return pdfjsPromise;
  }
  async function renderPdfPreview() {
    var box = modal.querySelector('#cxPdfPreview');
    var key = String(appendLedgerSummary) + '|' + generatedAt;
    if (pdfPreviewKey === key) return;
    pdfPreviewKey = key;
    box.innerHTML = '<p class="cx-hint">Rendering preview…</p>';
    if (!window.jspdf || !window.jspdf.jsPDF) { box.innerHTML = '<p class="cx-hint">The PDF library did not load — check your connection.</p>'; return; }
    var doc;
    try { doc = buildPdfDoc(); } catch (e) { console.error(e); box.innerHTML = '<p class="cx-hint">Could not build the PDF.</p>'; return; }
    var pages = doc.getNumberOfPages();
    try {
      var lib = await loadPdfJs();
      var pdf = await lib.getDocument({ data: doc.output('arraybuffer') }).promise;
      if (pdfPreviewKey !== key) return;
      box.innerHTML = '<div class="cx-pdf-meta">' + pages + ' page' + (pages === 1 ? '' : 's') + ' · US Letter · ' + PDF_NAME + '</div>';
      var cssW = Math.max(200, box.clientWidth - 2), dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (var i = 1; i <= pdf.numPages; i++) {
        var page = await pdf.getPage(i);
        var vp1 = page.getViewport({ scale: 1 }), scale = (cssW / vp1.width) * dpr, vp = page.getViewport({ scale: scale });
        var c = document.createElement('canvas'); c.className = 'cx-pdf-page'; c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
        c.setAttribute('aria-label', 'PDF page ' + i + ' of ' + pdf.numPages);
        box.appendChild(c);
        await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        if (pdfPreviewKey !== key) return;
      }
    } catch (e) {
      console.warn('PDF preview unavailable', e);
      if (pdfPreviewKey === key) box.innerHTML = '<div class="cx-pdf-meta">' + pages + ' page' + (pages === 1 ? '' : 's') + ' · US Letter</div><p class="cx-hint">Preview unavailable on this connection — the PDF itself is ready to download.</p>';
    }
  }

  function hexRgb(hex) {
    hex = String(hex).replace('#', '');
    return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
  }
  // Builds the Official PDF Brief (jsPDF doc) — shared by the Tab 1 preview
  // and the Download / Email action, so both always show the same file.
  function buildPdfDoc() {
    var d = data, hz = hazardIndex(d);
    {
      // Letter, portrait, 612x792pt = 8.5"x11" — explicit here (jsPDF
      // already defaults to portrait) since this is what actually
      // determines the generated PDF's page size and orientation; this
      // file has no @media print / browser-print path to control it.
      var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
      var W = 612, M = 40, y;

      // Top branding masthead: sleek horizontal compact banner, minimized
      // vertical padding, shield + wordmark inline, tagline directly below
      // the wordmark inside the banner, and the Patents Pending badge.
      var mastH = 84;
      doc.setFillColor(0, 0, 0); doc.rect(0, 0, W, mastH, 'F');
      var badgeTxt = 'PATENTS PENDING', badgeW = doc.getTextWidth(badgeTxt) + 16;
      doc.setDrawColor(0, 230, 153); doc.setLineWidth(0.7);
      doc.roundedRect(W - M - badgeW, 14, badgeW, 15, 7, 7, 'S');
      doc.setTextColor(0, 230, 153); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
      doc.text(badgeTxt, W - M - badgeW / 2, 24, { align: 'center' });

      var s = 1.3, ox = M, oy = 22; // inline brand shield outline, left-aligned
      var shieldPts = [[12, 2], [20, 5], [20, 12], [17.5, 17], [12, 22], [6.5, 17], [4, 12], [4, 5]];
      var segs = []; for (var i = 1; i < shieldPts.length; i++) segs.push([(shieldPts[i][0] - shieldPts[i - 1][0]) * s, (shieldPts[i][1] - shieldPts[i - 1][1]) * s]);
      doc.setDrawColor(0, 230, 153); doc.setLineWidth(1.1);
      doc.lines(segs, ox + shieldPts[0][0] * s, oy + shieldPts[0][1] * s, [1, 1], 'S', true);

      var tx = M + 42;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
      var t1 = 'CITIXEN ', t2 = 'UX', w1 = doc.getTextWidth(t1), w2 = doc.getTextWidth(t2);
      doc.setTextColor(255, 255, 255); doc.text(t1, tx, 42);
      doc.setTextColor(0, 230, 153); doc.text(t2, tx + w1, 42);
      // Trademark mark: muted gray, slight letter-spacing, superscript position
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); doc.text(' ™', tx + w1 + w2 + 1, 36);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(0, 230, 153);
      doc.text('Upgrade your civic experience.', tx, 56);

      // Document sub-header row: geotag (city + state, never a ward number) /
      // CIVIC INTELLIGENCE™ BRIEF / timestamp + citixenux.com.
      y = mastH + 30;
      doc.setTextColor(9, 13, 22); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(cityStateLabel(d), M, y);
      doc.text('CIVIC INTELLIGENCE™ BRIEF', W / 2, y, { align: 'center' });
      doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text('Generated ' + stamp(generatedAt) + ' • citixenux.com', W - M, y, { align: 'right' });
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.75); doc.line(M, y + 12, W - M, y + 12);
      y += 34;

      function ensureRoom(h) { if (y + h > 740) { doc.addPage(); y = 60; } }
      // Clean centered header, no number badge or pill background — used
      // for Sections 1 and 2. Section 3's title is drawn inside its own
      // unified black container instead (see section3Cards() below).
      function sectionTitle(title) {
        doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        doc.text(title.toUpperCase(), W / 2, y, { align: 'center' });
        y += 16;
      }

      // Hazard Index gauge: 180°, 3-segment semicircular meter. The needle
      // is centered within whichever segment matches the real computed
      // hazardIndex() reading for this jurisdiction — never a fixed or
      // fabricated angle — matching hazardGaugeSvg()'s HTML-pane version.
      function drawHazardGauge(cx, cy, r, sw, hz) {
        function pt(a, rad) { var rd = a * Math.PI / 180; return { x: cx - rad * Math.cos(rd), y: cy - rad * Math.sin(rd) }; }
        var segs = [[0, 60, [0, 230, 153]], [60, 120, [245, 158, 11]], [120, 180, [239, 68, 68]]];
        doc.setLineWidth(sw);
        segs.forEach(function (s) {
          var steps = 16, prev = pt(s[0], r), i, a, p;
          doc.setDrawColor(s[2][0], s[2][1], s[2][2]);
          for (i = 1; i <= steps; i++) { a = s[0] + (s[1] - s[0]) * i / steps; p = pt(a, r); doc.line(prev.x, prev.y, p.x, p.y); prev = p; }
        });
        var tip = pt(hazardGaugeAngle(hz.label), r - sw - 4);
        doc.setDrawColor(255, 255, 255); doc.setLineWidth(2.2); doc.line(cx, cy, tip.x, tip.y);
        doc.setFillColor(255, 255, 255); doc.circle(cx, cy, 4, 'F');
      }

      // Section order (per this round's spec): Community Action Snapshot
      // (top), Civic Performance Metrics (middle), Capital Project Tracker
      // (bottom, directly above the footer).

      // 1. Community Action Snapshot: one unified black anchor container
      // holds its own title (no separate pill banner above it) plus all 3
      // cards — Reports Filed (real aggregate d.total, not the
      // 'submitted'-stage-only subset) and Open Active Dispatches flank the
      // Civic Health gauge, matching the HTML pane's layout exactly.
      ensureRoom(170);
      (function section3Cards() {
        var padX = 12, gap = 10, titleBandH = 20, cardAreaH = 108, boxH = titleBandH + cardAreaH, by = y, cardTop = by + titleBandH;
        doc.setFillColor(0, 0, 0); doc.roundedRect(M, by, W - 2 * M, boxH, 10, 10, 'F');
        doc.setTextColor(0, 230, 153); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text('LIVING LEDGER™ SNAPSHOT', W / 2, by + 14, { align: 'center' });

        var innerW = W - 2 * M - 2 * padX, bw = (innerW - 2 * gap) / 3;

        function headerLabel(text, cxCol) {
          var lines = doc.splitTextToSize(text.toUpperCase(), bw);
          doc.setTextColor(0, 230, 153); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
          lines.forEach(function (line, i) { doc.text(line, cxCol, cardTop + 10 + i * 7, { align: 'center' }); });
        }
        function bigValue(text, cxCol, color) {
          doc.setTextColor.apply(doc, color || [255, 255, 255]);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
          doc.text(text, cxCol, cardTop + cardAreaH / 2 + 10, { align: 'center' });
        }

        var lcx = M + padX + bw / 2;
        headerLabel('Reports Filed', lcx);
        bigValue(String(d.total), lcx, [255, 255, 255]);

        var ccx = M + padX + bw + gap + bw / 2;
        headerLabel('Civic Health', ccx);
        var gcy = cardTop + cardAreaH - 16, gr = Math.min(bw / 2 - 14, 36), gsw = 9;
        drawHazardGauge(ccx, gcy, gr, gsw, hz);
        var riskColor = hz.label === 'CRITICAL' ? [239, 68, 68] : hz.label === 'MODERATE' ? [245, 158, 11] : [0, 230, 153];
        doc.setTextColor(riskColor[0], riskColor[1], riskColor[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
        doc.text(civicHealthZoneLabel(hz.label), ccx, cardTop + cardAreaH - 6, { align: 'center' });

        var rcx = M + padX + 2 * (bw + gap) + bw / 2;
        headerLabel('Open Active Dispatches', rcx);
        bigValue(String(d.counts.dispatched), rcx, d.counts.dispatched > 0 ? [255, 59, 48] : [255, 255, 255]);

        y += boxH + 10;
      })();

      // 2. Civic Performance Metrics: every card in a solid-black header
      // bar + white body, per the card-standardization rule.
      function cardGrid(items, cols) {
        var gap = 10, bw = (W - 2 * M - (cols - 1) * gap) / cols, headH = 16, bodyH = 46;
        items.forEach(function (it, k) {
          var col = k % cols, row = Math.floor(k / cols);
          var x = M + col * (bw + gap), by = y + row * (headH + bodyH + 10);
          doc.setFillColor(0, 0, 0); doc.roundedRect(x, by, bw, headH, 3, 3, 'F');
          doc.setFillColor(0, 0, 0); doc.rect(x, by + headH - 4, bw, 4, 'F');
          doc.setTextColor(0, 230, 153); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
          doc.text(it.lbl.toUpperCase(), x + bw / 2, by + headH / 2 + 2.5, { align: 'center' });
          doc.setDrawColor(226, 232, 240); doc.setLineWidth(1);
          doc.roundedRect(x, by + headH, bw, bodyH, 3, 3, 'S');
          var cy = by + headH + bodyH / 2;
          if (it.pill) {
            var rgb = hexRgb(it.pill), pw2 = doc.getTextWidth(it.val) + 16;
            doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.roundedRect(x + bw / 2 - pw2 / 2, cy - 8, pw2, 16, 8, 8, 'F');
            doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
            doc.text(it.val, x + bw / 2, cy + 3, { align: 'center' });
          } else {
            doc.setTextColor.apply(doc, it.color || [4, 120, 87]);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
            doc.text(String(it.val), x + bw / 2, cy + (it.sub ? -2 : 4), { align: 'center' });
            if (it.sub) {
              doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
              doc.text(String(it.sub), x + bw / 2, cy + 10, { align: 'center' });
            }
          }
        });
        y += Math.ceil(items.length / cols) * (headH + bodyH + 10);
      }

      ensureRoom(80);
      sectionTitle('CIVIC PERFORMANCE METRICS');
      cardGrid([
        { val: avgHoursText(d), lbl: 'Avg. Fix Speed' },
        { val: resolutionRate(d), lbl: 'Resolution Rate' },
        { val: stateRankValue(d.ranks), lbl: stateRankHeaderLabel(d.ranks) }
      ], 3);

      // 3. Capital Project Tracker (bottom block, directly above the
      // footer): a qualitative progress bar per status tier — there is no
      // measured percent-complete field in the CIP data, so no specific
      // completion number is printed, only the real name, quarter and
      // status alongside a relative fill.
      ensureRoom(50);
      sectionTitle('CAPITAL PROJECT TRACKER');
      if (!d.cip.length) {
        doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        doc.text('No capital projects are on file for this jurisdiction yet.', M, y + 4); y += 22;
      }
      d.cip.forEach(function (p) {
        ensureRoom(30);
        var barH = 20, fullW = W - 2 * M;
        var rgb = p.status === 'on-time' ? [0, 230, 153] : p.status === 'delayed' ? [255, 59, 48] : [245, 158, 11];
        var fillPct = p.status === 'on-time' ? 0.92 : p.status === 'delayed' ? 0.28 : 0.56;
        doc.setFillColor(244, 245, 247); doc.roundedRect(M, y, fullW, barH, 10, 10, 'F');
        doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.roundedRect(M, y, Math.max(fullW * fillPct, barH), barH, 10, 10, 'F');
        doc.setTextColor(9, 13, 22); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
        doc.text(doc.splitTextToSize(p.name || 'Capital project', fullW * 0.55)[0], M + 12, y + barH / 2 + 3);
        doc.setTextColor(51, 65, 85); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
        doc.text((p.scheduled || '—') + ' · ' + cipLabel(p.status), W - M - 10, y + barH / 2 + 3, { align: 'right' });
        y += barH + 9;
      });
      y += 10;

      // Footer: a single centered line with just the two core marks — no
      // legal text, patent disclosure, or links (per this round's spec).
      // 11px in the on-screen CSS translates to ~8pt here (jsPDF's unit is
      // pt, not px), to keep the same visual size.
      ensureRoom(40);
      doc.setFillColor(248, 250, 252); doc.rect(0, y - 6, W, 40, 'F');
      doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text('CITIXEN UX™ • Civic Intelligence™', W / 2, y + 8, { align: 'center' });
      doc.setTextColor(107, 114, 128); doc.setFontSize(7);
      doc.text('VERIFIED VIA CITIXEN UX™ PROTOCOL | LIVING LEDGER™ OUTPUT', W / 2, y + 21, { align: 'center' });

      // Optional appendix: Living Ledger™ Audit Summary (chosen in the
      // pre-export prompt). The real ward-score/rank summary (payloadText())
      // plus the public audit trail — every ledger ticket in this
      // jurisdiction with its report ID, stage, verification and recorded
      // dispatch/resolution timing (auditRows()). Nothing invented.
      if (appendLedgerSummary) {
        doc.addPage();
        y = 64;
        doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
        doc.text('LIVING LEDGER™ AUDIT SUMMARY', W / 2, y, { align: 'center' });
        y += 10;
        doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.75); doc.line(M, y, W - M, y);
        y += 24;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(51, 65, 85);
        payloadText().split('\n').forEach(function (line) {
          doc.splitTextToSize(line, W - 2 * M).forEach(function (wline) { ensureRoom(15); doc.text(wline, M, y); y += 14; });
          y += 4;
        });
        y += 12;
        var rows = auditRows();
        ensureRoom(60);
        doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        doc.text('PUBLIC AUDIT TRAIL — ' + rows.length + ' LEDGER RECORD' + (rows.length === 1 ? '' : 'S'), M, y);
        y += 14;
        var cols = [{ k: 'id', t: 'REPORT ID', w: 92 }, { k: 'what', t: 'HAZARD / LOCATION', w: 196 }, { k: 'stage', t: 'STAGE', w: 62 },
          { k: 'submitted', t: 'SUBMITTED', w: 58 }, { k: 'fix', t: 'FIX TIME', w: 50 }, { k: 'verified', t: 'VERIFIED', w: 74 }];
        function headerRow() {
          doc.setFillColor(0, 0, 0); doc.rect(M, y - 9, W - 2 * M, 14, 'F');
          doc.setTextColor(0, 230, 153); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
          var x = M + 4; cols.forEach(function (c) { doc.text(c.t, x, y); x += c.w; });
          y += 14;
        }
        headerRow();
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
        if (!rows.length) { doc.setTextColor(100, 116, 139); doc.text('No ledger records on file for this jurisdiction yet.', M + 4, y); y += 14; }
        rows.forEach(function (r, i) {
          if (y + 14 > 740) { doc.addPage(); y = 60; headerRow(); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); }
          if (i % 2) { doc.setFillColor(248, 250, 252); doc.rect(M, y - 9, W - 2 * M, 13, 'F'); }
          doc.setTextColor(30, 41, 59);
          var x = M + 4;
          cols.forEach(function (c) { doc.text(doc.splitTextToSize(String(r[c.k]), c.w - 6)[0], x, y); x += c.w; });
          y += 13;
        });
        y += 10;
        ensureRoom(30);
        doc.setTextColor(107, 114, 128); doc.setFontSize(6.5);
        doc.text('Timing is as recorded in the public ledger (relative submit time; fix time = hours from submission to resolution).', M, y);
        y += 14;
        doc.text('VERIFIED VIA CITIXEN UX™ PROTOCOL | LIVING LEDGER™ OUTPUT', W / 2, y, { align: 'center' });
      }

      return doc;
    }
  }
  var PDF_NAME = 'citixen-ux-civic-intelligence-brief.pdf';
  // Download / Email Printable PDF: the OS share sheet (Mail, Messages,
  // Files…) where it accepts a named PDF file, a direct download elsewhere.
  async function downloadPdf(btn) {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('The PDF library did not load — check your connection and try again.'); return; }
    var label = btn.innerHTML;
    btn.disabled = true; btn.textContent = 'Generating…';
    try {
      var doc = buildPdfDoc();
      var shared = false;
      if (navigator.share && navigator.canShare) {
        try {
          var pdfFile = new File([doc.output('blob')], PDF_NAME, { type: 'application/pdf' });
          if (navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({ title: 'CITIXEN UX™ Civic Intelligence™ Brief', text: 'CITIXEN UX™ Civic Intelligence Report', files: [pdfFile] });
            shared = true;
          }
        } catch (shareErr) {
          if (shareErr && shareErr.name === 'AbortError') { shared = true; } // share sheet dismissed — not a failure
        }
      }
      if (!shared) { doc.save(PDF_NAME); mintToast('Official PDF brief downloaded'); }
      trackEvent('export_pdf', { shared: shared, appendedLedgerSummary: appendLedgerSummary });
    } catch (err) {
      console.error('Official brief PDF failed', err);
      toast('Could not generate the PDF — please try again.');
    } finally {
      btn.disabled = false; btn.innerHTML = label;
    }
  }

  // Ledger records for this jurisdiction, as audit-trail rows.
  function auditRows() {
    var d = data, h = d.home, t = d.tickets || [];
    var mine = h ? t.filter(function (x) { return x.state === h.state && x.city === h.city; }) : t;
    var order = { submitted: 0, dispatched: 1, resolved: 2 };
    return mine.slice().sort(function (a, b) { return (order[a.stage] || 0) - (order[b.stage] || 0); }).map(function (x) {
      return {
        id: x.reportId || x.id || '—',
        what: (x.title || x.category || 'Report') + (x.loc ? ' — ' + x.loc : ''),
        stage: x.stage ? x.stage.charAt(0).toUpperCase() + x.stage.slice(1) : '—',
        submitted: x.submittedAgo || '—',
        fix: typeof x.resolutionHours === 'number' ? x.resolutionHours + ' hrs' : '—',
        verified: x.verified === true ? 'Verified' : x.verified === false ? 'Not verified' : 'Pending'
      };
    });
  }

  // ---------- Branch B: #CrowdSaveAmerica share graphic ----------
  // The canvas itself now lives inline in renderPdfPane()'s markup (hidden
  // off-screen — this truncated graphic is drawn to be shared/saved, not
  // previewed in its own tab; see drawCard() below for the "Visual DNA
  // Alignment" truncation to header/gauge+metric/footer only).
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function font(weight, size) { return weight + ' ' + size + 'px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'; }
  function shieldPath(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(12, 22);
    ctx.bezierCurveTo(12, 22, 20, 18, 20, 12); ctx.lineTo(20, 5); ctx.lineTo(12, 2); ctx.lineTo(4, 5); ctx.lineTo(4, 12);
    ctx.bezierCurveTo(4, 18, 12, 22, 12, 22); ctx.closePath(); ctx.restore();
  }

  // ---------- Dark vector map for the share card ----------
  // Per this round's "complete refactor" spec, the Geospatial Hazard Risk
  // Heat Map plots this jurisdiction's own real report coordinates (d.nodes)
  // as additive radial-gradient glows — colored and sized by each node's
  // real CitixenSeverity classification, never fabricated density data —
  // inside a neutral frame over a decorative block-grid texture. The app
  // has no ward/city/municipal boundary geometry on file, so no boundary
  // outline is drawn or invented; the grid is purely decorative, not a
  // real street layout.
  function drawUrbanGrid(ctx, mx, my, mw, mh) {
    ctx.save(); ctx.strokeStyle = 'rgba(0,230,153,0.07)'; ctx.lineWidth = 1;
    var cols = 8, rows = 5, i, x, j, y;
    for (i = 1; i < cols; i++) { x = mx + (mw / cols) * i; ctx.beginPath(); ctx.moveTo(x, my); ctx.lineTo(x, my + mh); ctx.stroke(); }
    for (j = 1; j < rows; j++) { y = my + (mh / rows) * j; ctx.beginPath(); ctx.moveTo(mx, y); ctx.lineTo(mx + mw, y); ctx.stroke(); }
    ctx.restore();
  }
  // Hazard Index gauge (canvas): same 180°, 3-segment meter as the HTML/
  // jsPDF versions — see hazardGaugeSvg()'s comment for why the needle
  // angle is always derived from the real hazardIndex() reading.
  function drawHazardGaugeCanvas(ctx, cx, cy, r, sw, hz) {
    function canvasAngle(a) { return Math.PI + a * Math.PI / 180; }
    var segs = [[0, 60, '#00E699'], [60, 120, '#F59E0B'], [120, 180, '#EF4444']];
    segs.forEach(function (s) {
      ctx.beginPath(); ctx.arc(cx, cy, r, canvasAngle(s[0]), canvasAngle(s[1]), false);
      ctx.lineWidth = sw; ctx.strokeStyle = s[2]; ctx.lineCap = 'butt'; ctx.stroke();
    });
    // White needle/hub for contrast against this card's dark body.
    var ca = canvasAngle(hazardGaugeAngle(hz.label)), tipR = r - sw - 6;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + tipR * Math.cos(ca), cy + tipR * Math.sin(ca));
    ctx.lineWidth = 5; ctx.strokeStyle = '#FFFFFF'; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  }

  // 1:1 share graphic (1080x1080): ONLY the top Living Ledger™ Snapshot
  // (Reports Filed / Civic Health gauge / Open Active Dispatches), the 3
  // Civic Performance Metrics (Avg. Fix Speed / Resolution Rate / State
  // Rank) and a real, scannable QR code in the corner pointing at the
  // reporting app ("Scan to Audit Your Block | Anonymous & Sovereign").
  // Every figure is the same hazardIndex()/avgHoursText()/resolutionRate()/
  // stateRankValue() reading the Digital Brief and PDF show. The Capital
  // Project Tracker is intentionally left off the graphic.
  //
  // The QR is encoded with the qrcode-generator library (loaded from cdnjs
  // by the page as window.qrcode). If it failed to load, no QR-shaped
  // placeholder is drawn — a QR that doesn't decode would be misleading —
  // and the corner shows the readable URL instead.
  function auditUrl() { return location.origin + '/app'; }
  function drawQr(ctx, text, x, y, size) {
    if (typeof window.qrcode !== 'function') return false;
    try {
      var qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
      var n = qr.getModuleCount(), quiet = 3, cell = Math.floor(size / (n + 2 * quiet));
      var full = cell * (n + 2 * quiet), ox = x + (size - full) / 2, oy = y + (size - full) / 2;
      rr(ctx, ox - 6, oy - 6, full + 12, full + 12, 14); ctx.fillStyle = '#FFFFFF'; ctx.fill();
      ctx.fillStyle = '#090D16';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(ox + (c + quiet) * cell, oy + (r + quiet) * cell, cell, cell);
      }
      return true;
    } catch (e) { console.warn('QR encode failed', e); return false; }
  }
  function drawCard() {
    var canvas = modal && modal.querySelector('#cxCardCanvas');
    if (!canvas || !data) return;
    var d = data, hz = hazardIndex(d), ctx = canvas.getContext('2d'), W = 1080;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#0A0D12'; ctx.fillRect(0, 0, W, W);
    drawUrbanGrid(ctx, 30, 30, W - 60, W - 60);
    rr(ctx, 30, 30, W - 60, W - 60, 36); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,230,153,0.55)'; ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';

    // ---- Header, restructured into a top meta row + centered title block
    // (un-crunched from the previous 3-line-stack layout, which left only
    // ~7px between the frame edge and the first line of text). Top row:
    // brand mark left, jurisdiction + date right. Then the glowing
    // headline + protocol subtitle, centered, with real breathing room
    // from the outer frame above it. ----
    var hdrPad = 70; // left/right inset, matches the Living Ledger panel below for alignment
    ctx.textAlign = 'left';
    ctx.font = font(800, 22); ctx.fillStyle = MINT;
    ctx.fillText('CITIXEN UX™', hdrPad, 62);
    ctx.textAlign = 'right';
    ctx.font = font(600, 20); ctx.fillStyle = SLATE;
    ctx.fillText(cityStateLabel(d).toUpperCase() + ' · ' + shortDate(generatedAt), W - hdrPad, 62);

    ctx.textAlign = 'center';
    ctx.save();
    ctx.font = font(900, 46); ctx.fillStyle = MINT;
    ctx.shadowColor = 'rgba(0,230,153,0.65)'; ctx.shadowBlur = 20;
    ctx.fillText('FREE CIVIC REPORT', W / 2, 116);
    ctx.shadowColor = 'rgba(0,230,153,0.3)'; ctx.shadowBlur = 40;
    ctx.fillText('FREE CIVIC REPORT', W / 2, 116);
    ctx.restore();
    ctx.font = font(700, 18); ctx.fillStyle = SLATE;
    ctx.fillText('CIVIC INTELLIGENCE PROTOCOL', W / 2, 154);

    // ---- Living Ledger™ Snapshot panel ----
    var px = 70, pw = W - 140, py = 184, ph = 352;
    rr(ctx, px, py, pw, ph, 26); ctx.fillStyle = '#000000'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,230,153,0.35)'; ctx.stroke();
    ctx.font = font(800, 24); ctx.fillStyle = MINT;
    ctx.fillText('LIVING LEDGER™ SNAPSHOT', W / 2, py + 40);
    var colW = pw / 3, c1 = px + colW / 2, c2 = px + colW * 1.5, c3 = px + colW * 2.5, lblY = py + 100;
    ctx.font = font(800, 20); ctx.fillStyle = MINT;
    ctx.fillText('REPORTS FILED', c1, lblY);
    ctx.fillText('CIVIC HEALTH', c2, lblY);
    ctx.fillText('OPEN DISPATCHES', c3, lblY);
    ctx.font = font(900, 104); ctx.fillStyle = '#FFFFFF';
    ctx.fillText(String(d.total), c1, py + 225);
    ctx.fillStyle = d.counts.dispatched > 0 ? '#FF3B30' : '#FFFFFF';
    ctx.fillText(String(d.counts.dispatched), c3, py + 225);
    drawHazardGaugeCanvas(ctx, c2, py + 275, 118, 30, hz);
    var lblColor = hz.label === 'CRITICAL' ? '#EF4444' : hz.label === 'MODERATE' ? '#F59E0B' : '#00E699';
    ctx.font = font(800, 24); ctx.fillStyle = lblColor;
    ctx.fillText(civicHealthZoneLabel(hz.label), c2, py + 320);

    // ---- Civic Performance Metrics (3 cards) ----
    var my = 590, mh = 180, gap = 22, mw = (pw - 2 * gap) / 3;
    [[avgHoursText(d), 'AVG. FIX SPEED'], [resolutionRate(d), 'RESOLUTION RATE'], [stateRankValue(d.ranks), stateRankHeaderLabel(d.ranks).toUpperCase()]]
      .forEach(function (m, i) {
        var mx = px + i * (mw + gap);
        rr(ctx, mx, my, mw, mh, 20); ctx.fillStyle = '#0F141C'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(148,163,184,0.25)'; ctx.stroke();
        ctx.font = font(800, 19); ctx.fillStyle = MINT; ctx.fillText(m[1], mx + mw / 2, my + 42);
        ctx.font = font(900, 64); ctx.fillStyle = '#FFFFFF'; ctx.fillText(String(m[0]), mx + mw / 2, my + 112);
      });

    // ---- Footer: QR corner + call to action ----
    var qs = 200, qx = px + pw - qs, qy = 810;
    var hasQr = drawQr(ctx, auditUrl(), qx, qy, qs);
    ctx.textAlign = 'left';
    ctx.font = font(900, 40); ctx.fillStyle = MINT;
    ctx.fillText('Scan to Audit Your Block', px, 850);
    ctx.font = font(700, 26); ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Anonymous & Sovereign', px, 900);
    ctx.font = font(700, 24); ctx.fillStyle = SLATE;
    ctx.fillText(auditUrl().replace(/^https?:\/\//, ''), px, 950);
    ctx.font = font(600, 16); ctx.fillStyle = '#6B7280';
    ctx.fillText('VERIFIED VIA CITIXEN UX™ PROTOCOL | LIVING LEDGER™ OUTPUT', px, 995);
    if (!hasQr) {
      ctx.textAlign = 'center'; ctx.font = font(700, 20); ctx.fillStyle = MINT;
      ctx.fillText('#CrowdSaveAmerica', qx + qs / 2, qy + qs / 2);
    }
    ctx.textAlign = 'center';
  }

  function shareText() {
    var hz = hazardIndex(data);
    return 'CITIXEN UX™ Civic Intelligence™ Brief — ' + cityStateLabel(data) + ' civic health: ' + civicHealthZoneLabel(hz.label) +
      ' · Avg fix ' + avgHoursText(data) + ' · ' + resolutionRate(data) + ' resolved. Audit your block — anonymous & sovereign. #CrowdSaveAmerica';
  }

  // Whether this device's share sheet accepts image files (phones and some
  // desktop Safari/Edge builds). Decides the Tier 2 button's label too.
  function canShareImageFiles() {
    try {
      return !!(navigator.share && navigator.canShare &&
        navigator.canShare({ files: [new File([''], 'probe.png', { type: 'image/png' })] }));
    } catch (e) { return false; }
  }

  // Neon green confirmation toast, always rendered above the Brief modal
  // (the page's own toast may sit underneath it).
  function mintToast(msg) {
    var el = document.getElementById('cxMintToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cxMintToast'; el.className = 'cx-toast cx-toast-mint'; el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  function shareCard(btn) {
    var canvas = modal.querySelector('#cxCardCanvas');
    var label = btn && btn.innerHTML;
    var text = shareText(), url = auditUrl();
    var blobPromise = new Promise(function (res) { canvas.toBlob(res, 'image/png'); });
    function done() { if (btn) { btn.disabled = false; btn.innerHTML = label; } }
    if (btn) { btn.disabled = true; btn.textContent = 'Rendering…'; }
    trackEvent('export_graphic', { nativeShare: canShareImageFiles() });

    // Tier 2a — native share sheet with the graphic + pre-populated text/link.
    if (canShareImageFiles()) {
      blobPromise.then(async function (blob) {
        done();
        if (!blob) { toast('Could not render the share graphic.'); return; }
        var file = new File([blob], 'citixen-ux-living-ledger-snapshot.png', { type: 'image/png' });
        try { await navigator.share({ files: [file], title: 'CITIXEN UX™ Living Ledger™ Snapshot', text: text + '\n' + url, url: url }); }
        catch (err) { if (err && err.name !== 'AbortError') toast('Sharing failed — please try again.'); }
      });
      return;
    }

    // Tier 2b — desktop fallback: copy the image AND the link to the
    // clipboard in one item. The ClipboardItem is built synchronously
    // (with a promised blob) so the click's user activation still counts.
    (async function () {
      var copied = false;
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        var textBlob = new Blob([text + '\n' + url], { type: 'text/plain' });
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise, 'text/plain': textBlob })]);
          copied = true;
        } catch (e) {
          try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]); copied = 'image'; } catch (e2) { /* fall through */ }
        }
      }
      done();
      if (copied === true) { mintToast('Link & image copied to clipboard'); return; }
      if (copied === 'image') {
        var linkOk = await copyText(url);
        mintToast(linkOk ? 'Image copied — link copied after it' : 'Image copied to clipboard');
        return;
      }
      // No clipboard image support at all: save the PNG and copy the link.
      var blob = await blobPromise;
      if (!blob) { toast('Could not render the share graphic.'); return; }
      var a = document.createElement('a'), href = URL.createObjectURL(blob);
      a.href = href; a.download = 'citixen-ux-living-ledger-snapshot.png'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(href); }, 4000);
      mintToast((await copyText(url)) ? 'Link copied · graphic saved as PNG' : 'Graphic saved as PNG');
    })();
  }

  // ---------- Living Ledger™ Audit Summary (optional PDF append) ----------
  // Same figures as the old "Public Link & Summary" tab, now folded into
  // the Share & Export drawer's checkbox rather than kept as its own tab.
  function payloadText() {
    var d = data, score = healthScore(d);
    return [
      d.jurisdiction + ' — District Health Brief (' + stamp(generatedAt) + ')',
      'District health score: ' + (score != null ? score + ' / 10' : 'N/A') + ' · Resolved: ' + (d.total ? d.resolved + ' / ' + d.total : 'N/A'),
      'Avg fix: ' + (d.avgDays != null ? daysText(d) + ' days' : 'N/A') + ' · District coverage: ' + pctText(d.coveragePct) + ' · Delayed capital projects: ' + delayedCount(d),
      "Nat'l rank: " + natRankText(d.ranks) + (d.ranks ? ' of ' + d.ranks.nationalOf + ' mapped districts' : '') + ' · State rank: ' + stateRankText(d.ranks),
      '#CrowdSaveAmerica — free & anonymous civic reporting',
      siteUrl()
    ].join('\n');
  }
  // ---------- public API ----------
  window.CitixenInstantReport = {
    init: function (options) {
      cfg.getData = options.getData;
      cfg.toast = options.toast || null;
      cfg.onLedger = options.onLedger || null;
      cfg.onStack = options.onStack || null;
      cfg.ledgerAsSecondary = !!options.ledgerAsSecondary;
      cfg.trackEvent = options.trackEvent || null;
      document.querySelectorAll('[data-cx-export-module]').forEach(renderModule);
    },
    open: open,
    sharePlatform: sharePlatform,
    icon: icon,
    renderCipList: function (el, projects) { if (el) el.innerHTML = cipListHtml(projects || [], true); },
    // Exposes the exact Avg Fix Speed / Resolution Rate / State Rank figures
    // the Civic Brief's "Civic Performance Metrics" row shows, for any other
    // live-metrics display (e.g. app.html's dashboard ticker) to mirror
    // without re-deriving the formulas a second time.
    metricsFor: function (d) {
      return {
        avgFixSpeed: avgHoursText(d),
        resolutionRate: resolutionRate(d),
        stateRankValue: stateRankValue(d.ranks),
        stateRankLabel: stateRankHeaderLabel(d.ranks).toUpperCase()
      };
    }
  };
})();
