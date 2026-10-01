/* =====================================================================
   CITIXEN UX™ — INSTANT REPORT (shared by index.html and app.html)
   ---------------------------------------------------------------------
   Renders the Dashboard's "REPORTS & EASY SHARE" hero card and the
   3-branch Instant Report modal from one file, so the web Dashboard and
   the app's Dashboard tab stay 1:1:
     A. OFFICIAL PDF BRIEF        — branded preview + jsPDF download
     B. #CrowdSaveAmerica GRAPHIC — 1:1 card drawn on <canvas>, shared as
                                    an image through navigator.share()
     C. DIRECT LINK PAYLOAD       — copy/share-ready text + link

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
     nodes: [{ lat, lng }]                     // optional; not drawn by the
                                                // #CrowdSaveAmerica graphic
                                                // (see drawMapArea() — it
                                                // always shows the national
                                                // map), kept for callers that
                                                // may still want the raw pins
   }
   ===================================================================== */
(function () {
  'use strict';

  var MINT = '#00E699', NAVY = '#090D16', OBSIDIAN = '#030712', SLATE = '#94A3B8';

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
    hexgrid: '<path d="M8 3l3.5 2v4L8 11 4.5 9V5z"/><path d="M15.5 3L19 5v4l-3.5 2L12 9V5z"/><path d="M11.75 10.5l3.5 2v4l-3.5 2-3.5-2v-4z"/><path d="M4.5 14.5L8 12.5"/><path d="M19 14.5l-3.75-2"/><path d="M8.25 16.5L4.5 18.5M15.25 16.5l3.75 2"/>'
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
  function cipLabel(status) { return status === 'on-time' ? 'On-Time' : status === 'delayed' ? 'Delayed' : 'In Progress'; }
  function cipClass(status) { return status === 'on-time' ? 'cx-pill-ontime' : status === 'delayed' ? 'cx-pill-delayed' : 'cx-pill-progress'; }
  // Ward health score: share of this jurisdiction's tickets that are
  // resolved, on a 10-point scale (7 of 10 resolved -> 7 / 10).
  function healthScore(d) { return d.total ? Math.round((d.resolved / d.total) * 10) : null; }
  function daysText(d) { return d.avgDays != null ? d.avgDays.toFixed(1) : '—'; }
  function pctText(v) { return v != null ? v + '%' : 'N/A'; }
  function resolutionRate(d) { return d.total ? Math.round((d.resolved / d.total) * 100) + '%' : 'N/A'; }
  function delayedCount(d) { return d.cip.filter(function (p) { return p.status === 'delayed'; }).length; }
  function siteUrl() { return location.origin + '/'; }

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
      subject: (me.m.cityName || h.cityName) + ' ' + (me.m.wardName || h.wardName || '')
    };
  }
  function natRankText(r) { return r ? '#' + r.national : 'N/A'; }
  function stateRankText(r) { return r ? '#' + r.state + ' IN ' + String(r.stateName).toUpperCase() : 'N/A'; }
  function rankNote(r) {
    if (!r) return 'National and state ranks need the live coverage service.';
    return r.subject.trim() + ' currently ranks #' + r.national + ' nationally and #' + r.state + ' in ' + r.stateName +
      ' among ' + r.nationalOf + ' mapped wards (' + r.stateOf + ' in-state), based on resolution speed and block coverage. ' +
      'Quarter-over-quarter movement will show once a prior quarter is on file.';
  }

  // ---------- state ----------
  var cfg = { getData: null, toast: null, onLedger: null };
  var data = null, generatedAt = null, current = 'pdf', modal = null, rafId = 0, lastFocus = null;

  function toast(msg) {
    var hint = modal && modal.classList.contains('open') && modal.querySelector('#cxHint-' + current);
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

  // ---------- Export & Share hero module ----------
  function renderModule(mount) {
    mount.innerHTML =
      '<section class="cx-export" aria-labelledby="cxExportTitle">' +
        '<h3 class="cx-export-title" id="cxExportTitle">Reports &amp; Easy Share</h3>' +
        '<div class="cx-btn-stack">' +
          '<button type="button" class="cx-btn-primary" data-cx-open="pdf">Generate Free Report</button>' +
          '<button type="button" class="cx-btn-dashed" data-cx-share-platform>' +
            '<span style="color:#FFFFFF">Share CITIXEN</span>' +
            '<span style="color:#00E699">UX</span>' +
            '<span style="color:#94A3B8;font-weight:400;font-size:.75em;vertical-align:super">™</span>' +
          '</button>' +
          (cfg.onLedger
            ? '<button type="button" class="cx-btn-ledger" data-cx-ledger>' +
                '<span class="cx-ledger-pulse-dot" aria-hidden="true"></span>' +
                '<span>View Live Public Ledger</span>' +
              '</button>'
            : '') +
        '</div>' +
      '</section>';
    mount.querySelector('[data-cx-open]').addEventListener('click', function (e) { open('pdf', e.currentTarget); });
    mount.querySelector('[data-cx-share-platform]').addEventListener('click', sharePlatform);
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
    modal.innerHTML =
      '<div class="cx-panel">' +
        '<div class="cx-head">' + icon('shieldPlain') +
          '<div class="cx-head-text"><div class="cx-head-title" id="cxTitle">Free Report</div>' +
          '<div class="cx-head-sub" id="cxJuris">Loading jurisdiction…</div></div>' +
          '<button type="button" class="cx-close" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="cx-body">' +
          '<div class="cx-tiles" role="tablist" aria-label="Export format">' +
            tile('pdf', 'doc', 'Official PDF Brief ↓') +
            tile('graphic', 'nodes', '#CrowdSave<wbr>America Graphic ↓') +
            tile('link', 'link', 'Public Link & Summary ↓') +
          '</div>' +
          '<div id="cxPane-pdf" role="tabpanel" aria-labelledby="cxTab-pdf"></div>' +
          '<div id="cxPane-graphic" role="tabpanel" aria-labelledby="cxTab-graphic" hidden></div>' +
          '<div id="cxPane-link" role="tabpanel" aria-labelledby="cxTab-link" hidden></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('.cx-close').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) close(); });
    modal.querySelectorAll('.cx-tile').forEach(function (b) {
      b.addEventListener('click', function () { select(b.dataset.tab); });
    });
  }
  function tile(key, ic, label) {
    return '<button type="button" class="cx-tile" role="tab" id="cxTab-' + key + '" data-tab="' + key + '" aria-controls="cxPane-' + key + '" aria-selected="false">' +
      icon(ic) + '<span class="cx-tile-label">' + label + '</span></button>';
  }

  async function open(tab, trigger) {
    if (!cfg.getData) return;
    if (!modal) buildModal();
    lastFocus = trigger || document.activeElement;
    modal.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    select(tab || 'pdf');
    modal.querySelector('#cxJuris').textContent = 'Loading jurisdiction…';
    ['pdf', 'graphic', 'link'].forEach(function (k) {
      modal.querySelector('#cxPane-' + k).innerHTML = '<p class="cx-hint">Compiling the current ward snapshot…</p>';
    });
    try {
      data = await cfg.getData();
      data.ranks = computeRanks(data);
      generatedAt = new Date();
    } catch (err) {
      console.warn('Instant Report data failed to load', err);
      modal.querySelector('#cxPane-' + current).innerHTML = '<p class="cx-hint">Could not load the ward snapshot. Check your connection and try again.</p>';
      return;
    }
    modal.querySelector('#cxJuris').textContent = data.jurisdiction + ' · ' + stamp(generatedAt);
    renderPdfPane(); renderGraphicPane(); renderLinkPane();
    select(current);
    modal.querySelector('.cx-close').focus();
  }

  function close() {
    if (!modal) return;
    modal.classList.remove('open');
    document.documentElement.style.overflow = '';
    stopAnim();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function select(tab) {
    current = tab;
    modal.querySelectorAll('.cx-tile').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    ['pdf', 'graphic', 'link'].forEach(function (k) { modal.querySelector('#cxPane-' + k).hidden = k !== tab; });
    if (tab === 'graphic' && data) startAnim(); else stopAnim();
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
  function metric(val, lbl) {
    return '<div class="cx-metric"><div class="cx-metric-val">' + esc(val) + '</div><div class="cx-metric-lbl">' + esc(lbl) + '</div></div>';
  }
  function renderPdfPane() {
    var d = data;
    var el = modal.querySelector('#cxPane-pdf');
    el.innerHTML =
      '<div class="cx-paper">' +
        '<div class="cx-mast">' + icon('shieldPlain') +
          '<div><div class="cx-mast-brand">CITIXEN <b>UX</b>™</div><div class="cx-mast-label">Official Ward Health Brief</div></div>' +
          '<div class="cx-mast-time">Generated<br>' + esc(stamp(generatedAt)) + '</div>' +
        '</div>' +
        '<div class="cx-paper-juris">' + esc(d.jurisdiction) + '</div>' +
        '<div class="cx-sec"><div class="cx-sec-title"><span>1</span>CIVIC PERFORMANCE METRICS</div>' +
          '<div class="cx-metrics cx-metrics-4">' + metric(daysText(d) + (d.avgDays != null ? ' days' : ''), 'Fix Speed') + metric(resolutionRate(d), 'Resolution Rate') + metric(pctText(d.coveragePct), 'Ward Coverage') + metric(natRankText(d.ranks), "Nat'l Rank") + '</div>' +
          '<p class="cx-bench"><b>State rank:</b> ' + esc(stateRankText(d.ranks)) + '. ' + esc(rankNote(d.ranks)) + '</p></div>' +
        '<div class="cx-sec"><div class="cx-sec-title"><span>2</span>CAPITAL INFRASTRUCTURE INVESTMENTS</div>' + cipListHtml(d.cip, false) + '</div>' +
        '<div class="cx-sec"><div class="cx-sec-title"><span>3</span>COMMUNITY ACTION SNAPSHOT</div>' +
          '<div class="cx-metrics">' + metric(d.counts.dispatched, 'Active Dispatches') + metric(d.counts.submitted, 'Pending Review') + metric(d.counts.resolved, 'Resolved Items') + '</div></div>' +
        '<div class="cx-note">Current snapshot of CITIXEN UX ledger and capital-project records for this jurisdiction. No reporter-identifying information is included.</div>' +
      '</div>' +
      '<div class="cx-actions"><button type="button" class="cx-btn-primary" id="cxPdfBtn">' + icon('printer') + 'Download / Print Official PDF</button></div>' +
      '<p class="cx-hint" id="cxHint-pdf"></p>';
    el.querySelector('#cxPdfBtn').addEventListener('click', function (e) { downloadPdf(e.currentTarget); });
  }

  function downloadPdf(btn) {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('The PDF library did not load — check your connection and try again.'); return; }
    var d = data, label = btn.innerHTML;
    btn.disabled = true; btn.textContent = 'Generating…';
    try {
      var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
      var W = 612, M = 40, y;
      // Masthead
      doc.setFillColor(9, 13, 22); doc.rect(0, 0, W, 86, 'F');
      doc.setFillColor(0, 230, 153); doc.rect(0, 86, W, 3, 'F');
      doc.setDrawColor(0, 230, 153); doc.setLineWidth(1.2);
      var s = 1.7, ox = M, oy = 22; // brand shield outline
      var pts = [[12, 2], [20, 5], [20, 12], [17.5, 17], [12, 22], [6.5, 17], [4, 12], [4, 5]];
      var segs = []; for (var i = 1; i < pts.length; i++) segs.push([(pts[i][0] - pts[i - 1][0]) * s, (pts[i][1] - pts[i - 1][1]) * s]);
      doc.lines(segs, ox + pts[0][0] * s, oy + pts[0][1] * s, [1, 1], 'S', true);
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
      doc.text('CITIXEN', M + 52, 44);
      doc.setTextColor(0, 230, 153); doc.text('UX™', M + 52 + doc.getTextWidth('CITIXEN '), 44);
      doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text('OFFICIAL WARD HEALTH BRIEF', M + 52, 60);
      doc.text('Generated ' + stamp(generatedAt), W - M, 44, { align: 'right' });
      doc.text('Privacy Engine: Verified', W - M, 60, { align: 'right' });
      y = 122;
      doc.setTextColor(9, 13, 22); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      doc.text(d.jurisdiction, M, y); y += 30;

      function sectionTitle(n, title) {
        doc.setFillColor(9, 13, 22); doc.circle(M + 8, y - 4, 8, 'F');
        doc.setTextColor(0, 230, 153); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text(String(n), M + 8, y - 1, { align: 'center' });
        doc.setTextColor(9, 13, 22); doc.setFontSize(10.5);
        doc.text(title, M + 24, y); y += 16;
      }
      function boxes(items) {
        var bw = (W - 2 * M - (items.length - 1) * 12) / items.length;
        items.forEach(function (it, k) {
          var x = M + k * (bw + 12);
          doc.setDrawColor(226, 232, 240); doc.setLineWidth(1); doc.roundedRect(x, y, bw, 56, 8, 8, 'S');
          doc.setTextColor(4, 120, 87); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
          doc.text(String(it[0]), x + bw / 2, y + 26, { align: 'center' });
          doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
          doc.text(it[1].toUpperCase(), x + bw / 2, y + 44, { align: 'center' });
        });
        y += 56 + 28;
      }
      function ensureRoom(h) { if (y + h > 740) { doc.addPage(); y = 60; } }

      sectionTitle(1, 'CIVIC PERFORMANCE METRICS');
      boxes([[d.avgDays != null ? daysText(d) + ' days' : 'N/A', 'Fix Speed'], [resolutionRate(d), 'Resolution Rate'], [pctText(d.coveragePct), 'Ward Coverage'], [natRankText(d.ranks), "Nat'l Rank"]]);
      y -= 14;
      doc.setTextColor(9, 13, 22); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text('State rank: ' + stateRankText(d.ranks), M, y); y += 13;
      doc.setTextColor(71, 85, 105); doc.setFont('helvetica', 'normal');
      var benchLines = doc.splitTextToSize(rankNote(d.ranks), W - 2 * M);
      doc.text(benchLines, M, y); y += benchLines.length * 11 + 22;

      sectionTitle(2, 'CAPITAL INFRASTRUCTURE INVESTMENTS');
      if (!d.cip.length) {
        doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        doc.text('No capital projects are on file for this jurisdiction yet.', M, y + 4); y += 22;
      }
      d.cip.forEach(function (p) {
        ensureRoom(24);
        doc.setTextColor(9, 13, 22); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        doc.text(doc.splitTextToSize(p.name || 'Capital project', 300)[0], M, y + 4);
        doc.setTextColor(100, 116, 139); doc.setFontSize(9);
        if (p.scheduled) doc.text(p.scheduled, W - M - 96, y + 4, { align: 'right' });
        var lbl = cipLabel(p.status), fill = p.status === 'on-time' ? [209, 250, 229] : p.status === 'delayed' ? [254, 243, 199] : [224, 242, 254];
        var ink = p.status === 'on-time' ? [6, 95, 70] : p.status === 'delayed' ? [146, 64, 14] : [7, 89, 133];
        doc.setFillColor(fill[0], fill[1], fill[2]); doc.roundedRect(W - M - 80, y - 7, 80, 16, 8, 8, 'F');
        doc.setTextColor(ink[0], ink[1], ink[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
        doc.text(lbl, W - M - 40, y + 4, { align: 'center' });
        doc.setDrawColor(226, 232, 240); doc.line(M, y + 13, W - M, y + 13);
        y += 24;
      });
      y += 16;

      ensureRoom(110);
      sectionTitle(3, 'COMMUNITY ACTION SNAPSHOT');
      boxes([[d.counts.dispatched, 'Active Dispatches'], [d.counts.submitted, 'Pending Review'], [d.counts.resolved, 'Resolved Items']]);

      ensureRoom(60);
      doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
      doc.text(doc.splitTextToSize('Current snapshot of CITIXEN UX ledger and capital-project records for this jurisdiction, computed from the same records the dashboard displays. It is not a historical time series. No reporter-identifying information is included in this brief or in the underlying data model.', W - 2 * M), M, y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(9, 13, 22);
      doc.text('CITIXEN UX™ — Privacy Engine: Verified', W / 2, 770, { align: 'center' });
      doc.save('citixen-official-ward-health-brief.pdf');
      toast('Official PDF brief downloaded.');
    } catch (err) {
      console.error('Official brief PDF failed', err);
      toast('Could not generate the PDF — please try again.');
    } finally {
      btn.disabled = false; btn.innerHTML = label;
    }
  }

  // ---------- Branch B: #CrowdSaveAmerica graphic ----------
  function renderGraphicPane() {
    var el = modal.querySelector('#cxPane-graphic');
    el.innerHTML =
      '<div class="cx-card-wrap"><canvas id="cxCardCanvas" width="1080" height="1080" role="img" aria-label="#CrowdSaveAmerica ward health card for ' + esc(data.jurisdiction) + '"></canvas></div>' +
      '<div class="cx-actions"><button type="button" class="cx-btn-primary" id="cxShareCardBtn">' + icon('phoneShare') + 'Share #CrowdSaveAmerica Card</button></div>' +
      '<p class="cx-hint" id="cxHint-graphic"></p>';
    el.querySelector('#cxShareCardBtn').addEventListener('click', shareCard);
    drawCard(0.55);
  }

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
  // Per this round's "replace the share card's old graphic with the real US
  // map" fix: the card's centerpiece is now ALWAYS the CROWD SAVE AMERICA™
  // US Vector Map (the same national outline + one glowing node per mapped
  // city the popup Aggregation Hub draws at its Country tier) — never the
  // old abstract "LIVE REPORT NODES" line-grid placeholder, and never a
  // live OpenFreeMap/MapLibre tile fetch (that network+WebGL dependency,
  // and its line-grid fallback for when it fails, are both removed outright
  // rather than left as dead code). This also makes the card fully
  // self-contained: no external tile request, so it renders identically
  // offline or on a blocked network.
  // Public geographic centers for mapped cities (used to place the
  // nationwide nodes). Unknown places are skipped.
  var CITY_CENTERS = { 'wi/la-crosse': [43.8138, -91.2519], 'wi/milwaukee': [43.0389, -87.9065], 'il/chicago': [41.8781, -87.6298] };
  // Stylized contiguous-U.S. outline, [lng, lat].
  var US_OUTLINE = [[-124.7,48.4],[-122.8,49.0],[-95.2,49.0],[-94.8,49.4],[-89.6,48.0],[-84.8,46.5],[-83.5,46.1],[-82.5,43.0],[-82.9,42.0],[-79.0,42.8],[-79.2,43.5],[-76.2,44.2],[-74.7,45.0],[-71.5,45.0],[-70.0,46.7],[-69.2,47.4],[-67.8,47.1],[-67.0,44.8],[-70.7,43.1],[-70.0,41.8],[-71.9,41.3],[-73.9,40.6],[-74.2,39.6],[-75.0,38.8],[-75.9,37.2],[-76.3,36.9],[-75.5,35.2],[-77.0,34.6],[-79.0,33.4],[-81.4,30.7],[-80.0,26.8],[-80.4,25.2],[-81.3,25.4],[-82.7,27.5],[-83.0,29.1],[-84.3,30.0],[-86.5,30.4],[-88.9,30.4],[-89.6,29.3],[-90.8,29.1],[-93.8,29.7],[-94.7,29.3],[-97.2,27.7],[-97.4,25.9],[-99.1,26.4],[-100.3,28.0],[-101.4,29.8],[-103.1,29.0],[-104.5,29.6],[-106.5,31.8],[-108.2,31.3],[-111.1,31.3],[-114.8,32.5],[-117.1,32.5],[-118.5,34.0],[-120.6,34.6],[-121.9,36.6],[-122.5,37.8],[-123.8,39.6],[-124.2,41.0],[-124.5,42.8],[-124.0,46.2],[-124.7,48.4]];

  // One glowing node per mapped city nationwide, sized by its surveyed
  // blocks — the same real Geo-Hatch ward data the popup Aggregation Hub's
  // own Country tier uses (window.CitixenGeoHatch.wardSummaries()), not a
  // second/fabricated node set.
  function nationwideNodes() {
    var list = window.CitixenGeoHatch && window.CitixenGeoHatch.wardSummaries ? window.CitixenGeoHatch.wardSummaries() : [];
    var byCity = {};
    list.forEach(function (w) {
      var k = w.state + '/' + w.city, c = CITY_CENTERS[k];
      if (!c) return;
      byCity[k] = byCity[k] || { lat: c[0], lng: c[1], surveyed: 0 };
      byCity[k].surveyed += w.surveyed;
    });
    var arr = Object.keys(byCity).map(function (k) { return byCity[k]; });
    var max = Math.max.apply(null, arr.map(function (n) { return n.surveyed; }).concat([1]));
    return arr.map(function (n) { return { lat: n.lat, lng: n.lng, color: MINT, r: 0.75 + 0.6 * n.surveyed / max }; });
  }

  function drawNodes(ctx, pts, phase) {
    pts.forEach(function (n, k) {
      var t = (phase + k * 0.33) % 1, r = n.r || 1, rgb = n.color === '#FF3B30' ? '255,59,48' : n.color === '#F59E0B' ? '245,158,11' : '0,230,153';
      ctx.beginPath(); ctx.arc(n.x, n.y, (14 + t * 34) * r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.55 * (1 - t)).toFixed(3) + ')'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(n.x, n.y, 26 * r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(' + rgb + ',0.16)'; ctx.fill();
      ctx.beginPath(); ctx.arc(n.x, n.y, 12 * r, 0, Math.PI * 2); ctx.fillStyle = n.color; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = NAVY; ctx.stroke();
    });
  }

  function drawUsOutline(ctx, x, y, w, h, nodes, phase) {
    var minLng = -125, maxLng = -66, minLat = 24, maxLat = 50, k = Math.cos(37 * Math.PI / 180);
    var gw = (maxLng - minLng) * k, gh = maxLat - minLat, s = Math.min((w - 60) / gw, (h - 50) / gh);
    var ox = x + (w - gw * s) / 2, oy = y + (h - gh * s) / 2;
    function proj(lng, lat) { return [ox + (lng - minLng) * k * s, oy + (maxLat - lat) * s]; }
    ctx.beginPath();
    US_OUTLINE.forEach(function (pt, i) { var q = proj(pt[0], pt[1]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    ctx.closePath(); ctx.fillStyle = '#0A1424'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,230,153,0.45)'; ctx.stroke();
    drawNodes(ctx, nodes.map(function (n) { var q = proj(n.lng, n.lat); return Object.assign({}, n, { x: q[0], y: q[1] }); }), phase);
  }

  function drawMapArea(ctx, d, phase, mx, my, mw, mh) {
    var nodes = nationwideNodes();
    ctx.save(); rr(ctx, mx, my, mw, mh, 22); ctx.clip();
    ctx.fillStyle = '#060B16'; ctx.fillRect(mx, my, mw, mh);
    drawUsOutline(ctx, mx, my, mw, mh, nodes, phase);
    if (!nodes.length) {
      ctx.textAlign = 'center'; ctx.font = font(600, 22); ctx.fillStyle = SLATE;
      ctx.fillText('No live report nodes yet', mx + mw / 2, my + mh / 2);
    }
    ctx.restore();
    rr(ctx, mx, my, mw, mh, 22); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,230,153,0.25)'; ctx.stroke();
    ctx.textAlign = 'left'; ctx.font = font(700, 16); ctx.fillStyle = SLATE;
    ctx.fillText('AUDIT NODES · UNITED STATES', mx + 20, my + mh - 22);
  }

  function drawCard(phase) {
    var canvas = modal && modal.querySelector('#cxCardCanvas');
    if (!canvas || !data) return;
    var d = data, ctx = canvas.getContext('2d'), W = 1080, P = 84;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = OBSIDIAN; ctx.fillRect(0, 0, W, W);
    // UI frame
    rr(ctx, 30, 30, W - 60, W - 60, 36); ctx.fillStyle = NAVY; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,230,153,0.55)'; ctx.stroke();

    // Header: shield + wordmark (the top-right "CITY, ST · WARD" jurisdiction
    // pill is removed per this round's "Share Card Header Refactor" spec)
    shieldPath(ctx, P - 6, 78, 3); ctx.lineWidth = 0.8; ctx.strokeStyle = MINT; ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = font(800, 40); ctx.fillStyle = '#FFFFFF'; ctx.fillText('CITIXEN', P + 74, 114);
    var wx = P + 74 + ctx.measureText('CITIXEN ').width;
    ctx.fillStyle = MINT; ctx.fillText('UX', wx, 114);
    var uxw = ctx.measureText('UX').width;
    ctx.font = font(700, 18); ctx.fillText('™', wx + uxw + 3, 100);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(P, 172, W - 2 * P, 2);

    // Title marquee — replaces the old "#CrowdSaveAmerica" hashtag pill with
    // a centered "CROWD SAVE AMERICA" title (no hashtag symbol) + tagline,
    // per this round's spec. The campaign hashtag still appears once, in
    // the footer below.
    ctx.textAlign = 'center';
    ctx.font = font(800, 40); ctx.fillStyle = MINT;
    ctx.fillText('CROWD SAVE AMERICA', W / 2, 232);
    ctx.font = 'italic ' + font(600, 24); ctx.fillStyle = SLATE;
    ctx.fillText('Restoring civic trust, one snap at a time.', W / 2, 270);
    ctx.textAlign = 'left';

    ctx.font = font(700, 24); ctx.fillStyle = SLATE; ctx.fillText('WARD HEALTH SCORE', P, 318);
    var score = healthScore(d);
    ctx.font = font(900, 132); ctx.fillStyle = '#FFFFFF';
    var sTxt = score != null ? String(score) : '—';
    ctx.fillText(sTxt, P - 4, 408);
    var sw = ctx.measureText(sTxt).width;
    ctx.font = font(800, 64); ctx.fillStyle = MINT; ctx.fillText(' / 10', P + sw, 424);
    // Civic Health Ranking indicators
    ctx.textAlign = 'right';
    ctx.font = font(700, 20); ctx.fillStyle = SLATE; ctx.fillText("NAT'L RANK", W - P, 318);
    ctx.font = font(900, 56); ctx.fillStyle = '#FFFFFF'; ctx.fillText(natRankText(d.ranks), W - P, 366);
    if (d.ranks) { ctx.font = font(700, 18); ctx.fillStyle = SLATE; ctx.fillText('of ' + d.ranks.nationalOf + ' mapped wards', W - P, 404); }
    ctx.font = font(800, 20); ctx.fillStyle = MINT; ctx.fillText('STATE RANK ' + stateRankText(d.ranks), W - P, 440);
    ctx.textAlign = 'left';

    // Metric badges
    var cols = [
      [daysText(d) + (d.avgDays != null ? ' DAYS' : ''), 'AVG FIX'],
      [pctText(d.coveragePct), 'WARD COVERED'],
      [String(delayedCount(d)), 'DELAYED PROJECTS']
    ];
    var gap = 22, cw = (W - 2 * P - 2 * gap) / 3;
    cols.forEach(function (c, i) {
      var x = P + i * (cw + gap);
      rr(ctx, x, 488, cw, 108, 20); ctx.fillStyle = '#0B1120'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,230,153,0.35)'; ctx.stroke();
      ctx.textAlign = 'center'; ctx.font = font(800, 38); ctx.fillStyle = MINT; ctx.fillText(c[0], x + cw / 2, 528);
      ctx.font = font(700, 18); ctx.fillStyle = SLATE; ctx.fillText(c[1], x + cw / 2, 570);
    });

    // CROWD SAVE AMERICA™ US Vector Map — always the national outline with
    // pulsing per-city nodes (see drawMapArea() above), the same graphic
    // the popup Aggregation Hub's Country tier draws.
    drawMapArea(ctx, d, phase, P, 626, W - 2 * P, 300);

    // Footer
    var parts = [['#CrowdSaveAmerica', MINT], ['  •  Privacy Engine: Verified  •  ', SLATE], ['citixenux.com', '#FFFFFF']];
    ctx.font = font(700, 24);
    var total = parts.reduce(function (s, p) { return s + ctx.measureText(p[0]).width; }, 0);
    var fx = (W - total) / 2;
    ctx.textAlign = 'left';
    parts.forEach(function (p) { ctx.fillStyle = p[1]; ctx.fillText(p[0], fx, 990); fx += ctx.measureText(p[0]).width; });
  }

  function startAnim() {
    stopAnim();
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { drawCard(0.55); return; }
    var t0 = performance.now();
    (function loop(now) {
      drawCard(((now - t0) / 1800) % 1);
      rafId = requestAnimationFrame(loop);
    })(t0);
  }
  function stopAnim() { if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  function shareText() {
    var score = healthScore(data);
    return '#CrowdSaveAmerica — ' + data.jurisdiction + ' ward health score: ' + (score != null ? score + ' / 10' : 'not yet rated') +
      '. Free & anonymous civic reporting with CITIXEN UX™.';
  }

  function shareCard() {
    stopAnim(); drawCard(0.55);
    var canvas = modal.querySelector('#cxCardCanvas');
    canvas.toBlob(async function (blob) {
      if (current === 'graphic') startAnim();
      if (!blob) { toast('Could not render the card image.'); return; }
      var file = new File([blob], 'crowdsaveamerica-ward-health.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: '#CrowdSaveAmerica', text: shareText() }); }
        catch (err) { if (err && err.name !== 'AbortError') toast('Sharing failed — please try again.'); }
        return;
      }
      // No image sharing here (most desktop browsers): save the PNG instead.
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast('This browser cannot share images directly, so the card was saved as a PNG.');
    }, 'image/png');
  }

  // ---------- Branch C: direct link payload ----------
  function payloadText() {
    var d = data, score = healthScore(d);
    return [
      d.jurisdiction + ' — Ward Health Brief (' + stamp(generatedAt) + ')',
      'Ward health score: ' + (score != null ? score + ' / 10' : 'N/A') + ' · Resolved: ' + (d.total ? d.resolved + ' / ' + d.total : 'N/A'),
      'Avg fix: ' + (d.avgDays != null ? daysText(d) + ' days' : 'N/A') + ' · Ward coverage: ' + pctText(d.coveragePct) + ' · Delayed capital projects: ' + delayedCount(d),
      "Nat'l rank: " + natRankText(d.ranks) + (d.ranks ? ' of ' + d.ranks.nationalOf + ' mapped wards' : '') + ' · State rank: ' + stateRankText(d.ranks),
      '#CrowdSaveAmerica — free & anonymous civic reporting',
      siteUrl()
    ].join('\n');
  }
  function renderLinkPane() {
    var el = modal.querySelector('#cxPane-link');
    el.innerHTML =
      '<label for="cxPayload" class="cx-hint" style="display:block;text-align:left;margin:0 0 6px">Ready to paste into email, text or a council comment form</label>' +
      '<textarea id="cxPayload" class="cx-payload" readonly></textarea>' +
      '<span class="cx-payload-url">' + esc(siteUrl()) + '</span>' +
      '<div class="cx-actions"><button type="button" class="cx-btn-primary" id="cxCopyPayloadBtn">' + icon('copy') + 'Copy Summary & Link</button>' +
      '<button type="button" class="cx-btn-dashed" id="cxSharePayloadBtn">' + icon('shareUp') + 'Share Link</button></div>' +
      '<p class="cx-hint" id="cxHint-link"></p>';
    var ta = el.querySelector('#cxPayload');
    ta.value = payloadText();
    el.querySelector('#cxCopyPayloadBtn').addEventListener('click', async function () {
      if (await copyText(ta.value)) toast('Summary & link copied.');
      else { ta.focus(); ta.select(); toast('Press and hold to copy the selected text.'); }
    });
    el.querySelector('#cxSharePayloadBtn').addEventListener('click', async function () {
      if (!navigator.share) {
        if (await copyText(ta.value)) toast('Sharing is not available here, so the summary & link were copied instead.');
        else { ta.focus(); ta.select(); toast('Sharing is not available here — copy the selected text instead.'); }
        return;
      }
      try { await navigator.share({ title: 'CITIXEN UX™ Ward Health Brief', text: ta.value.replace(/\n[^\n]*$/, ''), url: siteUrl() }); } catch (err) { /* dismissed */ }
    });
  }

  // ---------- public API ----------
  window.CitixenInstantReport = {
    init: function (options) {
      cfg.getData = options.getData;
      cfg.toast = options.toast || null;
      cfg.onLedger = options.onLedger || null;
      document.querySelectorAll('[data-cx-export-module]').forEach(renderModule);
    },
    open: open,
    sharePlatform: sharePlatform,
    icon: icon,
    renderCipList: function (el, projects) { if (el) el.innerHTML = cipListHtml(projects || [], true); }
  };
})();
