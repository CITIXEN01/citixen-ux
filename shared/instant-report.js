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
     nodes: [{ lat, lng }]                     // live report pins for the card's map
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
  function badgeText(d) { return d.cityLabel + (d.wardLabel ? ' · ' + d.wardLabel : ''); }
  function siteUrl() { return location.origin + '/'; }

  // ---------- state ----------
  var cfg = { getData: null, toast: null };
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
        '<button type="button" class="cx-btn-primary" data-cx-open="pdf">Generate Free Report ↗</button>' +
        '<button type="button" class="cx-btn-dashed" data-cx-share-platform>Share CITIXEN UX™</button>' +
      '</section>';
    mount.querySelector('[data-cx-open]').addEventListener('click', function (e) { open('pdf', e.currentTarget); });
    mount.querySelector('[data-cx-share-platform]').addEventListener('click', sharePlatform);
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
          '<div class="cx-head-text"><div class="cx-head-title" id="cxTitle">Instant Report</div>' +
          '<div class="cx-head-sub" id="cxJuris">Loading jurisdiction…</div></div>' +
          '<button type="button" class="cx-close" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="cx-body">' +
          '<div class="cx-tiles" role="tablist" aria-label="Export format">' +
            tile('pdf', 'doc', 'Official PDF Brief ↓') +
            tile('graphic', 'nodes', '#CrowdSave<wbr>America Graphic ↓') +
            tile('link', 'link', 'Direct Link Payload ↓') +
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
          '<div class="cx-metrics">' + metric(daysText(d) + (d.avgDays != null ? ' days' : ''), 'Fix Speed') + metric(resolutionRate(d), 'Resolution Rate') + metric(pctText(d.coveragePct), 'Ward Coverage') + '</div></div>' +
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
        var bw = (W - 2 * M - 2 * 12) / 3;
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
      boxes([[d.avgDays != null ? daysText(d) + ' days' : 'N/A', 'Fix Speed'], [resolutionRate(d), 'Resolution Rate'], [pctText(d.coveragePct), 'Ward Coverage']]);

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

  function drawCard(phase) {
    var canvas = modal && modal.querySelector('#cxCardCanvas');
    if (!canvas || !data) return;
    var d = data, ctx = canvas.getContext('2d'), W = 1080, P = 84;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = OBSIDIAN; ctx.fillRect(0, 0, W, W);
    // UI frame
    rr(ctx, 30, 30, W - 60, W - 60, 36); ctx.fillStyle = NAVY; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,230,153,0.55)'; ctx.stroke();

    // Header: shield + wordmark, jurisdiction badge
    shieldPath(ctx, P - 6, 78, 3); ctx.lineWidth = 0.8; ctx.strokeStyle = MINT; ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = font(800, 40); ctx.fillStyle = '#FFFFFF'; ctx.fillText('CITIXEN', P + 74, 114);
    var wx = P + 74 + ctx.measureText('CITIXEN ').width;
    ctx.fillStyle = MINT; ctx.fillText('UX', wx, 114);
    var uxw = ctx.measureText('UX').width;
    ctx.font = font(700, 18); ctx.fillText('™', wx + uxw + 3, 100);
    ctx.font = font(800, 22);
    var badge = badgeText(d), bw = ctx.measureText(badge).width + 40;
    rr(ctx, W - P - bw, 92, bw, 46, 23); ctx.lineWidth = 2; ctx.strokeStyle = MINT; ctx.stroke();
    ctx.fillStyle = MINT; ctx.textAlign = 'center'; ctx.fillText(badge, W - P - bw / 2, 116);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(P, 172, W - 2 * P, 2);

    // Campaign badge + score
    ctx.textAlign = 'left'; ctx.font = font(800, 30);
    var tag = '#CrowdSaveAmerica', tw = ctx.measureText(tag).width + 44;
    rr(ctx, P, 206, tw, 58, 29); ctx.fillStyle = MINT; ctx.fill();
    ctx.fillStyle = NAVY; ctx.fillText(tag, P + 22, 236);
    ctx.font = font(700, 24); ctx.fillStyle = SLATE; ctx.fillText('WARD HEALTH SCORE', P, 318);
    var score = healthScore(d);
    ctx.font = font(900, 132); ctx.fillStyle = '#FFFFFF';
    var sTxt = score != null ? String(score) : '—';
    ctx.fillText(sTxt, P - 4, 408);
    var sw = ctx.measureText(sTxt).width;
    ctx.font = font(800, 64); ctx.fillStyle = MINT; ctx.fillText(' / 10', P + sw, 424);

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

    // Dark vector map snippet with pulsing report nodes
    var mx = P, my = 626, mw = W - 2 * P, mh = 300;
    ctx.save(); rr(ctx, mx, my, mw, mh, 22); ctx.clip();
    ctx.fillStyle = '#060B16'; ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#0A1726'; // river band
    ctx.beginPath(); ctx.moveTo(mx, my + mh * 0.15); ctx.bezierCurveTo(mx + 120, my + mh * 0.35, mx + 60, my + mh * 0.7, mx + 150, my + mh);
    ctx.lineTo(mx, my + mh); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(148,163,184,0.09)'; ctx.lineWidth = 2;
    for (var gx = mx + 190; gx < mx + mw; gx += 46) { ctx.beginPath(); ctx.moveTo(gx, my); ctx.lineTo(gx, my + mh); ctx.stroke(); }
    for (var gy = my + 20; gy < my + mh; gy += 40) { ctx.beginPath(); ctx.moveTo(mx + 170, gy); ctx.lineTo(mx + mw, gy); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(148,163,184,0.2)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(mx + 200, my + mh); ctx.lineTo(mx + 420, my); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx + 170, my + mh * 0.62); ctx.lineTo(mx + mw, my + mh * 0.62); ctx.stroke();
    var nodes = (d.nodes || []).filter(function (n) { return typeof n.lat === 'number' && typeof n.lng === 'number'; });
    if (nodes.length) {
      var lats = nodes.map(function (n) { return n.lat; }), lngs = nodes.map(function (n) { return n.lng; });
      var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
      var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
      var spanLat = Math.max(maxLat - minLat, 0.004), spanLng = Math.max(maxLng - minLng, 0.004);
      var ix = mx + 250, iy = my + 46, iw = mw - 320, ih = mh - 120; // keeps pins clear of the caption
      nodes.forEach(function (n, k) {
        var px = ix + ((n.lng - minLng) / spanLng) * iw;
        var py = iy + (1 - (n.lat - minLat) / spanLat) * ih;
        var t = (phase + k * 0.33) % 1;
        ctx.beginPath(); ctx.arc(px, py, 14 + t * 34, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,230,153,' + (0.55 * (1 - t)).toFixed(3) + ')'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 26, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,230,153,0.16)'; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.fillStyle = MINT; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = NAVY; ctx.stroke();
      });
    } else {
      ctx.textAlign = 'center'; ctx.font = font(600, 22); ctx.fillStyle = SLATE;
      ctx.fillText('No live report nodes yet', mx + mw / 2 + 80, my + mh / 2);
    }
    ctx.restore();
    rr(ctx, mx, my, mw, mh, 22); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,230,153,0.25)'; ctx.stroke();
    ctx.textAlign = 'left'; ctx.font = font(700, 16); ctx.fillStyle = SLATE;
    ctx.fillText('LIVE REPORT NODES · ' + d.cityLabel, mx + 20, my + mh - 22);

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
      '<div class="cx-actions"><button type="button" class="cx-btn-primary" id="cxCopyPayloadBtn">' + icon('copy') + 'Copy Link Payload</button>' +
      '<button type="button" class="cx-btn-dashed" id="cxSharePayloadBtn">' + icon('shareUp') + 'Share Link</button></div>' +
      '<p class="cx-hint" id="cxHint-link"></p>';
    var ta = el.querySelector('#cxPayload');
    ta.value = payloadText();
    el.querySelector('#cxCopyPayloadBtn').addEventListener('click', async function () {
      if (await copyText(ta.value)) toast('Link payload copied.');
      else { ta.focus(); ta.select(); toast('Press and hold to copy the selected text.'); }
    });
    el.querySelector('#cxSharePayloadBtn').addEventListener('click', async function () {
      if (!navigator.share) {
        if (await copyText(ta.value)) toast('Sharing is not available here, so the payload was copied instead.');
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
      document.querySelectorAll('[data-cx-export-module]').forEach(renderModule);
    },
    open: open,
    sharePlatform: sharePlatform,
    icon: icon,
    renderCipList: function (el, projects) { if (el) el.innerHTML = cipListHtml(projects || [], true); }
  };
})();
