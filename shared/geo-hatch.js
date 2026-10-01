/* =====================================================================
   CITIXEN UX™ — GEO-HATCH COVERAGE ENGINE (shared by index.html and
   app.html's Dashboard tab)
   ---------------------------------------------------------------------
   One component, rendered into every [data-cx-geohatch] mount, so both
   Dashboards show the same engine directly under the Scorecard:
     - scope toggles: Ward (150m) | Municipal blocks | State / National
     - Citywide Asset Coverage %
     - block grid: Auditable (mint) / Pending (amber) / Uncharted (slate)
     - tapping an uncharted block opens a ground-truth audit prompt

   Data comes from the same API the app's local ward grid uses:
   {endpoint}/grid for the ward's blocks and /api/coverage/national for the
   wider tiers. When the API can't be reached (e.g. a static local server),
   it falls back to the same offline mock the app uses, so the component
   degrades instead of breaking. "Reported by you" is read only from this
   device's own localStorage receipt ledger (citixen_my_reports_v1) — the
   coverage API never carries a reporter identity.

   Page adapter (CitixenGeoHatch.init):
     getEndpoint()   -> '/api/coverage/{state}/{city}/{ward}' or null
     getCityLabel()  -> 'LA CROSSE, WI' or null
     getNational()   -> optional async; national rollup ({ municipalities })
     onAuditBlock(cellId) -> start a report for that block
   ===================================================================== */
(function () {
  'use strict';

  var MY_REPORTS_KEY = 'citixen_my_reports_v1';
  var TIERS = [
    { key: 'ward', label: 'Ward (150m)' },
    { key: 'municipal', label: 'Municipal blocks' },
    { key: 'national', label: 'State / National' }
  ];
  var cfg = {}, cells = [], live = false, tier = 'ward', nationalPct = null, mounts = [], loaded = false;

  function myCellIds() {
    try { return new Set(JSON.parse(localStorage.getItem(MY_REPORTS_KEY) || '[]').map(function (r) { return r.cellId; })); }
    catch (e) { return new Set(); }
  }

  // Offline fallback — identical shape and values to app.html's
  // mockCoverageCells(), used only when the coverage API is unreachable.
  function mockCells() {
    var covered = [1,2,3,4,10,11,12,13,14,20,21,22,30,31,32,33,40,41,42,43,44,50,51,52,60,61,62,63,70,71,72,73,74,75];
    var cats = ['Pothole', 'Streetlight', 'Signage', 'Sidewalk', 'Drainage'], out = [];
    for (var i = 0; i < 80; i++) {
      var c = covered.indexOf(i) !== -1;
      out.push({ id: i, covered: c, category: c ? cats[i % cats.length] : null, verifiedDate: c ? ('Sep ' + (10 + (i % 18))) : null });
    }
    return out;
  }
  // Same deterministic "pending" demo subset as app.html's markPendingCells()
  // — the API has no live in-flight flag yet.
  function markPending(list) { list.forEach(function (c) { if (!c.covered) c.pending = (c.id % 5 === 0); }); return list; }

  async function fetchCells() {
    var ep = cfg.getEndpoint && cfg.getEndpoint();
    if (ep) {
      try {
        var res = await fetch(ep + '/grid');
        if (!res.ok) throw new Error('grid ' + res.status);
        var data = await res.json();
        if (Array.isArray(data.cells)) { live = true; return markPending(data.cells); }
      } catch (e) { /* fall through to the offline mock */ }
    }
    live = false;
    return markPending(mockCells());
  }
  async function fetchNationalPct() {
    var data = null;
    try {
      if (cfg.getNational) data = await cfg.getNational();
      if (!data) {
        var res = await fetch('/api/coverage/national');
        if (!res.ok) throw new Error('national ' + res.status);
        data = await res.json();
      }
    } catch (e) { data = null; }
    var ms = data && data.municipalities;
    return ms && ms.length ? ms.reduce(function (s, m) { return s + (m.coveragePct || 0); }, 0) / ms.length : null;
  }

  function wardPct() {
    return cells.length ? cells.filter(function (c) { return c.covered; }).length / cells.length * 100 : 0;
  }
  function tierPct() { return tier === 'ward' ? wardPct() : (nationalPct != null ? nationalPct : wardPct()); }

  function hexIcon() {
    return '<svg class="cx-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3l3.5 2v4L8 11 4.5 9V5z"/><path d="M15.5 3L19 5v4l-3.5 2L12 9V5z"/><path d="M11.75 10.5l3.5 2v4l-3.5 2-3.5-2v-4z"/><path d="M4.5 14.5L8 12.5"/><path d="M19 14.5l-3.75-2"/><path d="M8.25 16.5L4.5 18.5M15.25 16.5l3.75 2"/></svg>';
  }

  function build(mount, n) {
    mount.innerHTML =
      '<section class="cx-geo" aria-labelledby="cxGeoTitle' + n + '">' +
        '<div class="cx-geo-head" id="cxGeoTitle' + n + '">' + hexIcon() + 'GEO-HATCH COVERAGE ENGINE</div>' +
        '<div class="cx-geo-tiers" role="group" aria-label="Coverage scope">' +
          TIERS.map(function (t) { return '<button type="button" class="cx-geo-tier" data-tier="' + t.key + '" aria-pressed="' + (t.key === tier) + '">' + t.label + '</button>'; }).join('') +
        '</div>' +
        '<div class="cx-geo-metric">' +
          '<div><div class="cx-geo-label">Citywide asset coverage</div><div class="cx-geo-pct" data-geo="pct">0.0%</div></div>' +
          '<div class="cx-geo-frac"><div class="cx-geo-sub" data-geo="sub">Blocks surveyed</div><div class="cx-geo-count" data-geo="count">— / —</div></div>' +
        '</div>' +
        '<div class="cx-geo-legend"><span><i class="cx-geo-dot is-audit"></i>Auditable</span><span><i class="cx-geo-dot is-pending"></i>Pending</span><span><i class="cx-geo-dot is-dark"></i>Uncharted</span></div>' +
        '<div class="cx-geo-grid" data-geo="grid" aria-label="Ward block grid"></div>' +
        '<canvas class="cx-geo-canvas" data-geo="canvas" width="600" height="240" hidden></canvas>' +
        '<div class="cx-geo-caption" data-geo="caption" hidden></div>' +
        '<div class="cx-geo-prompt" data-geo="prompt" role="status" hidden>' +
          '<span data-geo="promptText"></span>' +
          '<button type="button" class="cx-geo-cta" data-geo="promptCta">Start audit ↗</button>' +
        '</div>' +
        '<div class="cx-geo-note" data-geo="note"></div>' +
      '</section>';
    mount.querySelectorAll('.cx-geo-tier').forEach(function (b) {
      b.addEventListener('click', function () { setTier(b.dataset.tier); });
    });
  }

  function q(mount, key) { return mount.querySelector('[data-geo="' + key + '"]'); }

  function renderGrid(mount, animate) {
    var grid = q(mount, 'grid'), mine = myCellIds();
    grid.innerHTML = '';
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    cells.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cx-geo-cell' + (c.pending ? ' is-pending' : '') + (c.covered && (!animate || reduce) ? ' is-audit' : '') + (mine.has(c.id) ? ' is-mine' : '');
      b.dataset.id = c.id;
      b.setAttribute('aria-label', c.covered ? (c.category + ' — verified ' + c.verifiedDate) : (c.pending ? 'Pending dispatch review' : 'Uncharted block — tap to audit'));
      b.addEventListener('click', function () { onTap(mount, c.id); });
      grid.appendChild(b);
      if (c.covered && animate && !reduce) setTimeout(function () { b.classList.add('is-audit'); }, 30 + Math.random() * 1100);
    });
  }

  function drawCanvas(mount) {
    var canvas = q(mount, 'canvas'), ctx = canvas.getContext('2d');
    var conf = tier === 'municipal'
      ? { cols: 20, rows: 8, gap: 2, label: 'Municipal blocks — aggregated citywide coverage' }
      : { cols: 26, rows: 14, gap: 1.5, label: 'State / National grid — nationwide rollup' };
    var total = conf.cols * conf.rows, pct = tierPct(), coveredCount = Math.round(total * pct / 100);
    var step = coveredCount > 0 ? total / coveredCount : total, on = new Set();
    for (var k = 0; k < coveredCount; k++) on.add(Math.floor(k * step) % total);
    var w = canvas.width, h = canvas.height, cw = w / conf.cols, ch = h / conf.rows;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < total; i++) {
      var x = (i % conf.cols) * cw + conf.gap / 2, y = Math.floor(i / conf.cols) * ch + conf.gap / 2;
      ctx.fillStyle = on.has(i) ? 'rgba(0,230,153,0.85)' : 'rgba(30,41,59,0.55)';
      ctx.fillRect(x, y, cw - conf.gap, ch - conf.gap);
    }
    q(mount, 'caption').textContent = conf.label + ' — ' + pct.toFixed(1) + '% illustrative coverage (' + total + ' cells)';
  }

  function renderStats(mount) {
    var covered = cells.filter(function (c) { return c.covered; }).length;
    var city = cfg.getCityLabel && cfg.getCityLabel();
    q(mount, 'pct').textContent = tierPct().toFixed(1) + '%';
    if (tier === 'ward') {
      q(mount, 'sub').textContent = (city ? city + ' ' : '') + 'blocks surveyed';
      q(mount, 'count').textContent = covered + ' / ' + cells.length;
    } else {
      q(mount, 'sub').textContent = tier === 'municipal' ? 'Municipal rollup' : 'Nationwide rollup';
      q(mount, 'count').textContent = nationalPct != null ? 'Live directory' : 'Ward estimate';
    }
    q(mount, 'note').textContent = live ? '' : 'Offline preview — showing sample blocks until the coverage service responds.';
  }

  function renderTier(mount) {
    mount.querySelectorAll('.cx-geo-tier').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tier === tier)); });
    var isWard = tier === 'ward';
    q(mount, 'grid').hidden = !isWard;
    q(mount, 'canvas').hidden = isWard;
    q(mount, 'caption').hidden = isWard;
    if (!isWard) { q(mount, 'prompt').hidden = true; drawCanvas(mount); }
    renderStats(mount);
  }

  function setTier(t) { tier = t; mounts.forEach(renderTier); }

  function onTap(mount, id) {
    var c = cells.find(function (x) { return x.id === id; });
    if (!c) return;
    var box = q(mount, 'prompt'), text = q(mount, 'promptText'), cta = q(mount, 'promptCta');
    if (c.covered) {
      text.textContent = c.category + ' — verified ' + c.verifiedDate + (myCellIds().has(c.id) ? ' · reported by you' : '');
      cta.hidden = true;
    } else if (c.pending) {
      text.textContent = 'Pending dispatch review — a report for this block is already in the queue.';
      cta.hidden = true;
    } else {
      text.textContent = 'Uncharted block. Run a ground-truth audit: photograph what is there and file it in under a minute.';
      cta.hidden = false;
      cta.onclick = function () { box.hidden = true; if (cfg.onAuditBlock) cfg.onAuditBlock(id); };
    }
    box.hidden = false;
    clearTimeout(box._t);
    box._t = setTimeout(function () { box.hidden = true; }, 7000);
  }

  async function load() {
    if (loaded || !mounts.length) return; // init() must run first
    loaded = true;
    cells = await fetchCells();
    mounts.forEach(function (m) { renderGrid(m, true); renderTier(m); });
    nationalPct = await fetchNationalPct();
    mounts.forEach(renderStats);
  }

  window.CitixenGeoHatch = {
    init: function (options) {
      cfg = options || {};
      document.querySelectorAll('[data-cx-geohatch]').forEach(function (m, n) {
        if (m.dataset.cxBuilt) return;
        m.dataset.cxBuilt = '1';
        build(m, n);
        mounts.push(m);
      });
    },
    load: load,
    // Re-fetch after the page's jurisdiction changes.
    reload: async function () { loaded = false; await load(); },
    // Light up a block after this device files a report for it.
    markCovered: function (id, category) {
      var c = cells.find(function (x) { return x.id === id; });
      if (!c) return;
      c.covered = true; c.pending = false; c.category = category || c.category || 'Report';
      c.verifiedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      mounts.forEach(function (m) { renderGrid(m, false); renderStats(m); });
    }
  };
})();
