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
  // Plots this jurisdiction's own real report coordinates (d.nodes) inside
  // a neutral frame, scaled to their own bounding box. This is not a traced
  // city-limits boundary — the app has no ward/city boundary geometry on
  // file (see the "no live ward-boundary geofencing" note in both pages'
  // map setup) — so no border shape is drawn or invented; only the real,
  // relative positions of actual report locations.
  function localProject(nodes, vw, vh, pad) {
    if (!nodes.length) return [];
    var lats = nodes.map(function (n) { return n.lat; }), lngs = nodes.map(function (n) { return n.lng; });
    var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
    var k = Math.cos((minLat + maxLat) / 2 * Math.PI / 180) || 1;
    var dLat = (maxLat - minLat) || 0.01, dLng = (maxLng - minLng) || 0.01;
    var w = vw - 2 * pad, h = vh - 2 * pad;
    var s = Math.min(w / (dLng * k), h / dLat);
    var cx = (minLng + maxLng) / 2, cy = (minLat + maxLat) / 2;
    return nodes.map(function (n) {
      return { x: vw / 2 + (n.lng - cx) * k * s, y: vh / 2 - (n.lat - cy) * s, status: n.status };
    });
  }
  function nodeColor(status) {
    return (window.CitixenSeverity && window.CitixenSeverity.color(status)) ||
      (status === 'Critical' ? '#FF3B30' : status === 'Warning' ? '#F59E0B' : MINT);
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
            '<span style="color:#FFFFFF">Share CITIXEN </span>' +
            '<span>' +
              '<span style="color:#00E699">UX</span>' +
              '<sup style="color:#94A3B8;font-weight:400;font-size:.65em;margin-left:1px;line-height:0">™</sup>' +
            '</span>' +
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
        // Modal breakout header: FREE REPORT centered, city/state tag
        // beneath it (never a ward number), no timestamp here — the PDF
        // brief already renders its own.
        '<div class="cx-head">' + icon('shieldPlain') +
          '<div class="cx-head-text"><div class="cx-head-title" id="cxTitle">Free Report</div>' +
          '<div class="cx-head-sub" id="cxJuris">Loading jurisdiction…</div></div>' +
          '<button type="button" class="cx-close" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="cx-body">' +
          '<div class="cx-tiles" role="tablist" aria-label="Export format">' +
            tile('pdf', 'doc', 'Official PDF Brief ↓') +
            tile('graphic', 'nodes', 'Report Share Graphic ↓') +
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
    modal.querySelector('#cxJuris').textContent = cityStateLabel(data);
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
    return '<div class="cx-acard"><div class="cx-acard-lbl">' + esc(lbl) + '</div>' +
      '<div class="cx-acard-val"' + (color ? ' style="color:' + color + '"' : '') + '>' + esc(val) + '</div></div>';
  }
  // Hazard Index gauge: a 180°, 3-segment semicircular meter (green/amber/
  // red). The needle is centered within whichever segment matches the real
  // computed hazardIndex() reading for this jurisdiction — never a fixed or
  // fabricated angle. Needle/hub are rendered in white for contrast against
  // the dark anchor container.
  function hazardGaugeAngle(label) { return label === 'CRITICAL' ? 150 : label === 'MODERATE' ? 90 : 30; }
  function hazardGaugeSvg(hz, vw, vh) {
    var cx = vw / 2, cy = vh - 6, r = Math.min(vw / 2 - 6, vh - 16), sw = Math.max(10, Math.round(r * 0.24));
    function pt(a, rad) { var rad2 = a * Math.PI / 180; return { x: cx - rad * Math.cos(rad2), y: cy - rad * Math.sin(rad2) }; }
    var segs = [{ a0: 0, a1: 60, color: '#00E699' }, { a0: 60, a1: 120, color: '#F59E0B' }, { a0: 120, a1: 180, color: '#EF4444' }];
    var arcs = segs.map(function (s) {
      var p0 = pt(s.a0, r), p1 = pt(s.a1, r);
      return '<path d="M' + p0.x.toFixed(1) + ',' + p0.y.toFixed(1) + ' A' + r.toFixed(1) + ',' + r.toFixed(1) + ' 0 0 1 ' + p1.x.toFixed(1) + ',' + p1.y.toFixed(1) + '" stroke="' + s.color + '" stroke-width="' + sw + '" fill="none"/>';
    }).join('');
    var needleA = hazardGaugeAngle(hz.label), tip = pt(needleA, r - sw - 4);
    return '<svg viewBox="0 0 ' + vw + ' ' + vh + '" width="100%" role="img" aria-label="Hazard Index gauge: ' + esc(hz.label) + '">' +
      arcs +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + tip.x.toFixed(1) + '" y2="' + tip.y.toFixed(1) + '" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="#FFFFFF"/>' +
    '</svg>';
  }
  function hazardGaugeCardHtml(hz) {
    var riskColor = hz.label === 'CRITICAL' ? '#EF4444' : hz.label === 'MODERATE' ? '#F59E0B' : '#00E699';
    var riskText = hz.label === 'LOW RISK' ? 'LOW RISK' : hz.label + ' RISK';
    return '<div class="cx-acard cx-acard-gauge"><div class="cx-acard-lbl">Risk Gauge</div>' + hazardGaugeSvg(hz, 160, 92) +
      '<div class="cx-acard-risk-lbl" style="color:' + riskColor + '">' + esc(riskText) + '</div></div>';
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
        '<div class="cx-subrow">' +
          '<span class="cx-subrow-geo">' + esc(cityStateLabel(d)) + '</span>' +
          '<span class="cx-subrow-title">Free Report</span>' +
          '<span class="cx-subrow-time">Generated ' + esc(stamp(generatedAt)) + ' • citixenux.com</span>' +
        '</div>' +
        '<div class="cx-sec"><div class="cx-sec-title"><span>1</span>CIVIC PERFORMANCE METRICS</div>' +
          '<div class="cx-mcards">' +
            mcard(avgHoursText(d), 'Avg. Fix Speed') +
            mcard(resolutionRate(d), 'Resolution Rate') +
            mcard(stateRankValue(r), stateRankHeaderLabel(r)) +
          '</div></div>' +
        '<div class="cx-sec"><div class="cx-sec-title"><span>2</span>CAPITAL PROJECT TRACKER</div>' + cipThermHtml(d.cip) + '</div>' +
        '<div class="cx-sec"><div class="cx-sec-title"><span>3</span>COMMUNITY ACTION SNAPSHOT</div>' +
          '<div class="cx-acards-wrap"><div class="cx-acards">' +
            actionCard(d.total, 'Reports Filed') +
            hazardGaugeCardHtml(hz) +
            actionCard(d.counts.dispatched, 'Open Active Dispatches', d.counts.dispatched > 0 ? '#FF3B30' : null) +
          '</div></div></div>' +
        '<div class="cx-footer-single">CITIXEN UX™ • Civic Intelligence™</div>' +
        '</div>' +
      '</div>' +
      '<div class="cx-actions"><button type="button" class="cx-btn-primary" id="cxPdfBtn">' + icon('printer') + 'Download / Print Official PDF</button></div>' +
      '<p class="cx-hint" id="cxHint-pdf"></p>';
    el.querySelector('#cxPdfBtn').addEventListener('click', function (e) { downloadPdf(e.currentTarget); });
  }

  function hexRgb(hex) {
    hex = String(hex).replace('#', '');
    return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
  }
  async function downloadPdf(btn) {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('The PDF library did not load — check your connection and try again.'); return; }
    var d = data, hz = hazardIndex(d), label = btn.innerHTML;
    btn.disabled = true; btn.textContent = 'Generating…';
    try {
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
      // FREE REPORT / timestamp + citixenux.com.
      y = mastH + 30;
      doc.setTextColor(9, 13, 22); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(cityStateLabel(d), M, y);
      doc.text('FREE REPORT', W / 2, y, { align: 'center' });
      doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.text('Generated ' + stamp(generatedAt) + ' • citixenux.com', W - M, y, { align: 'right' });
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.75); doc.line(M, y + 12, W - M, y + 12);
      y += 34;

      function ensureRoom(h) { if (y + h > 740) { doc.addPage(); y = 60; } }
      function sectionTitle(n, title) {
        doc.setFillColor(9, 13, 22); doc.circle(M + 8, y - 4, 8, 'F');
        doc.setTextColor(0, 230, 153); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.text(String(n), M + 8, y - 1, { align: 'center' });
        doc.setTextColor(9, 13, 22); doc.setFontSize(10.5);
        doc.text(title, M + 24, y); y += 16;
      }

      // Metric cards: every card in a solid-black header bar + white body,
      // per this round's card-standardization rule.
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

      sectionTitle(1, 'CIVIC PERFORMANCE METRICS');
      cardGrid([
        { val: avgHoursText(d), lbl: 'Avg. Fix Speed' },
        { val: resolutionRate(d), lbl: 'Resolution Rate' },
        { val: stateRankValue(d.ranks), lbl: stateRankHeaderLabel(d.ranks) }
      ], 3);

      // Capital Project Tracker: a qualitative progress bar per status tier
      // — there is no measured percent-complete field in the CIP data, so
      // no specific completion number is printed, only the real name,
      // quarter and status alongside a relative fill.
      sectionTitle(2, 'CAPITAL PROJECT TRACKER');
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

      // Community Action Snapshot: all 3 cards share one unified black
      // anchor container — Reports Filed (real aggregate d.total, not the
      // 'submitted'-stage-only subset) and Open Active Dispatches flank the
      // Hazard Index gauge, matching the HTML pane's layout exactly.
      ensureRoom(140);
      sectionTitle(3, 'COMMUNITY ACTION SNAPSHOT');
      (function section3Cards() {
        var pad = 12, gap = 10, boxH = 108, by = y;
        doc.setFillColor(0, 0, 0); doc.roundedRect(M, by, W - 2 * M, boxH, 10, 10, 'F');
        var innerW = W - 2 * M - 2 * pad, bw = (innerW - 2 * gap) / 3;

        function headerLabel(text, cxCol) {
          var lines = doc.splitTextToSize(text.toUpperCase(), bw);
          doc.setTextColor(0, 230, 153); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
          lines.forEach(function (line, i) { doc.text(line, cxCol, by + pad + 4 + i * 7, { align: 'center' }); });
        }
        function bigValue(text, cxCol, color) {
          doc.setTextColor.apply(doc, color || [255, 255, 255]);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
          doc.text(text, cxCol, by + boxH / 2 + 10, { align: 'center' });
        }

        var lcx = M + pad + bw / 2;
        headerLabel('Reports Filed', lcx);
        bigValue(String(d.total), lcx, [255, 255, 255]);

        var ccx = M + pad + bw + gap + bw / 2;
        headerLabel('Risk Gauge', ccx);
        var gcy = by + boxH - 16, gr = Math.min(bw / 2 - 14, 38), gsw = 9;
        drawHazardGauge(ccx, gcy, gr, gsw, hz);
        var riskColor = hz.label === 'CRITICAL' ? [239, 68, 68] : hz.label === 'MODERATE' ? [245, 158, 11] : [0, 230, 153];
        doc.setTextColor(riskColor[0], riskColor[1], riskColor[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
        doc.text(hz.label === 'LOW RISK' ? 'LOW RISK' : hz.label + ' RISK', ccx, by + boxH - 6, { align: 'center' });

        var rcx = M + pad + 2 * (bw + gap) + bw / 2;
        headerLabel('Open Active Dispatches', rcx);
        bigValue(String(d.counts.dispatched), rcx, d.counts.dispatched > 0 ? [255, 59, 48] : [255, 255, 255]);

        y += boxH + 10;
      })();

      // Footer: a single centered line with just the two core marks — no
      // legal text, patent disclosure, or links (per this round's spec).
      // 11px in the on-screen CSS translates to ~8pt here (jsPDF's unit is
      // pt, not px), to keep the same visual size.
      ensureRoom(26);
      doc.setFillColor(248, 250, 252); doc.rect(0, y - 6, W, 28, 'F');
      doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text('CITIXEN UX™ • Civic Intelligence™', W / 2, y + 8, { align: 'center' });

      // Share as a real, named application/pdf File when the OS share sheet
      // is available (iOS Mail/Messages/Notes otherwise show a bare "blob:"
      // heading instead of the filename); fall back to a direct download
      // everywhere else, or if the user's device can't share a file at all.
      var fileName = 'citixen-ux-free-report.pdf';
      var shared = false;
      if (navigator.share && navigator.canShare) {
        try {
          var pdfFile = new File([doc.output('blob')], fileName, { type: 'application/pdf' });
          if (navigator.canShare({ files: [pdfFile] })) {
            await navigator.share({ title: 'CITIXEN UX™ Free Report', text: 'CITIXEN UX™ Civic Intelligence Report', files: [pdfFile] });
            shared = true;
          }
        } catch (shareErr) {
          if (shareErr && shareErr.name === 'AbortError') { shared = true; } // user dismissed the share sheet — not a failure
        }
      }
      if (!shared) { doc.save(fileName); toast('Official PDF brief downloaded.'); }
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
      '<div class="cx-card-wrap"><canvas id="cxCardCanvas" width="1080" height="1080" role="img" aria-label="CITIXEN UX™ Free Report card for ' + esc(cityStateLabel(data)) + '"></canvas></div>' +
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
  function hazardRadius(status) { return status === 'Critical' ? 92 : status === 'Warning' ? 70 : 54; }

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

  function drawHazardMap(ctx, d, phase, mx, my, mw, mh) {
    var raw = localProject(d.nodes || [], mw - 40, mh - 40, 0);
    var pts = raw.map(function (p) { return { x: mx + 20 + p.x, y: my + 20 + p.y, status: p.status }; });
    ctx.save(); rr(ctx, mx, my, mw, mh, 22); ctx.clip();
    ctx.fillStyle = '#060B16'; ctx.fillRect(mx, my, mw, mh);
    drawUrbanGrid(ctx, mx, my, mw, mh);
    if (pts.length) {
      var breathe = 0.85 + 0.3 * Math.sin(phase * Math.PI * 2);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      pts.forEach(function (p) {
        var rgb = hexRgb(nodeColor(p.status)), r = hazardRadius(p.status) * breathe;
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, 'rgba(' + rgb.join(',') + ',0.85)');
        g.addColorStop(0.55, 'rgba(' + rgb.join(',') + ',0.3)');
        g.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
      pts.forEach(function (p) { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fillStyle = nodeColor(p.status); ctx.fill(); });
    } else {
      ctx.textAlign = 'center'; ctx.font = font(600, 22); ctx.fillStyle = SLATE;
      ctx.fillText('No live hazard nodes yet', mx + mw / 2, my + mh / 2);
    }
    ctx.restore();
    rr(ctx, mx, my, mw, mh, 22); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,230,153,0.25)'; ctx.stroke();
    ctx.textAlign = 'left'; ctx.font = font(700, 16); ctx.fillStyle = SLATE;
    ctx.fillText(('LIVE HAZARD NODES · ' + cityStateLabel(d)).toUpperCase(), mx + 20, my + mh - 22);
  }

  function drawCard(phase) {
    var canvas = modal && modal.querySelector('#cxCardCanvas');
    if (!canvas || !data) return;
    var d = data, hz = hazardIndex(d), ctx = canvas.getContext('2d'), W = 1080, P = 84;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#0A0D12'; ctx.fillRect(0, 0, W, W);
    // UI frame
    rr(ctx, 30, 30, W - 60, W - 60, 36); ctx.fillStyle = '#0A0D12'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,230,153,0.55)'; ctx.stroke();

    // Solid-black header: Patents Pending badge, shield + wordmark, tagline,
    // FREE REPORT title, geotag (city + state, never a ward number).
    ctx.save(); rr(ctx, 30, 30, W - 60, 248, 36); ctx.clip();
    ctx.fillStyle = '#000000'; ctx.fillRect(30, 30, W - 60, 248);
    ctx.restore();

    ctx.textBaseline = 'middle';
    var badgeTxt = 'PATENTS PENDING';
    ctx.font = font(800, 16);
    var badgeW = ctx.measureText(badgeTxt).width + 28;
    ctx.textAlign = 'center';
    rr(ctx, W - P - badgeW, 56, badgeW, 32, 16); ctx.lineWidth = 1.5; ctx.strokeStyle = MINT; ctx.stroke();
    ctx.fillStyle = MINT; ctx.fillText(badgeTxt, W - P - badgeW / 2, 72);

    shieldPath(ctx, W / 2 - 18, 100, 2.6); ctx.lineWidth = 1; ctx.strokeStyle = MINT; ctx.stroke();
    ctx.font = font(800, 42);
    var t1 = 'CITIXEN ', t2 = 'UX';
    var w1 = ctx.measureText(t1).width, w2 = ctx.measureText(t2).width, bx = W / 2 - (w1 + w2) / 2;
    ctx.textAlign = 'left'; ctx.fillStyle = '#FFFFFF'; ctx.fillText(t1, bx, 150);
    ctx.fillStyle = MINT; ctx.fillText(t2, bx + w1, 150);
    ctx.font = font(700, 18); ctx.fillText('™', bx + w1 + w2 + 3, 134);

    ctx.textAlign = 'center';
    ctx.font = 'italic ' + font(600, 20); ctx.fillStyle = MINT;
    ctx.fillText('Upgrade your civic experience.', W / 2, 180);
    ctx.font = font(800, 26); ctx.fillStyle = '#FFFFFF';
    ctx.fillText('FREE REPORT', W / 2, 220);
    ctx.font = font(700, 18); ctx.fillStyle = SLATE;
    ctx.fillText(cityStateLabel(d) + '  •  CURRENT SNAPSHOT', W / 2, 252);
    ctx.textAlign = 'left';

    // Community Action Snapshot: a symmetrical 3-card row — Reports Filed
    // (real aggregate d.total) and Open Active Dispatches flank the Hazard
    // Index gauge, matching the PDF Brief's Section 3 layout.
    var trio = [
      { lbl: 'REPORTS FILED', kind: 'text', val: String(d.total), color: '#FFFFFF' },
      { lbl: 'HAZARD INDEX', kind: 'gauge' },
      { lbl: 'OPEN ACTIVE DISPATCHES', kind: 'text', val: String(d.counts.dispatched), color: d.counts.dispatched > 0 ? '#FF3B30' : MINT }
    ];
    var gap = 22, cw = (W - 2 * P - 2 * gap) / 3, cardY = 318, headH = 40, bodyH = 116;
    trio.forEach(function (c, i) {
      var x = P + i * (cw + gap);
      ctx.save(); rr(ctx, x, cardY, cw, headH + bodyH, 18); ctx.clip();
      ctx.fillStyle = '#000000'; ctx.fillRect(x, cardY, cw, headH);
      ctx.fillStyle = '#0B1120'; ctx.fillRect(x, cardY + headH, cw, bodyH);
      ctx.restore();
      rr(ctx, x, cardY, cw, headH + bodyH, 18); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,230,153,0.35)'; ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = font(800, 15); ctx.fillStyle = MINT; ctx.fillText(c.lbl, x + cw / 2, cardY + headH / 2 + 1);
      if (c.kind === 'gauge') {
        var gcx = x + cw / 2, gcy = cardY + headH + bodyH - 36, gr = Math.min(cw / 2 - 22, 56), gsw = 13;
        drawHazardGaugeCanvas(ctx, gcx, gcy, gr, gsw, hz);
        var lblColor = hz.label === 'CRITICAL' ? '#EF4444' : hz.label === 'MODERATE' ? '#F59E0B' : '#00E699';
        ctx.font = font(800, 16); ctx.fillStyle = lblColor;
        ctx.fillText(hz.label === 'LOW RISK' ? 'LOW RISK' : hz.label + ' RISK', gcx, cardY + headH + bodyH - 12);
      } else {
        ctx.font = font(900, 34); ctx.fillStyle = c.color;
        ctx.fillText(c.val, x + cw / 2, cardY + headH + bodyH / 2 + 2);
      }
    });
    ctx.textAlign = 'left';

    // Geospatial Map Snippet — this jurisdiction's own real nodes (see
    // drawHazardMap() above for why no boundary shape is drawn).
    drawHazardMap(ctx, d, phase, P, 500, W - 2 * P, 300);

    // Footer: brand + verification + IP disclosure (no #CrowdSaveAmerica
    // marks, per this round's spec)
    ctx.textAlign = 'center';
    var line1 = [['CITIXEN UX™ Engine', MINT], ['  •  Public Ledger Verified', SLATE]];
    ctx.font = font(700, 22);
    var w = line1.reduce(function (s, p) { return s + ctx.measureText(p[0]).width; }, 0), fx = W / 2 - w / 2;
    ctx.textAlign = 'left';
    line1.forEach(function (p) { ctx.fillStyle = p[1]; ctx.fillText(p[0], fx, 950); fx += ctx.measureText(p[0]).width; });
    ctx.textAlign = 'center'; ctx.font = font(600, 16); ctx.fillStyle = SLATE;
    ctx.fillText('Civic Intelligence™ • Civic Memory™ • Patents Pending • citixenux.com', W / 2, 980);
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
    var hz = hazardIndex(data);
    return '#CrowdSaveAmerica — ' + cityStateLabel(data) + ' hazard index: ' + hz.label +
      '. Free & anonymous civic reporting with CITIXEN UX™.';
  }

  function shareCard() {
    stopAnim(); drawCard(0.55);
    var canvas = modal.querySelector('#cxCardCanvas');
    canvas.toBlob(async function (blob) {
      if (current === 'graphic') startAnim();
      if (!blob) { toast('Could not render the card image.'); return; }
      var file = new File([blob], 'crowdsaveamerica-free-report.png', { type: 'image/png' });
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
