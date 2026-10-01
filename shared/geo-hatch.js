/* =====================================================================
   CITIXEN UX™ — #CrowdSaveAmerica COVERAGE GRID (shared by index.html and
   app.html's Dashboard tab)
   ---------------------------------------------------------------------
   One component, rendered into every [data-cx-geohatch] mount:
     - centered #CrowdSaveAmerica header
     - scope tabs: City (default) | State | Country
     - "{SCOPE} BLOCKS SURVEYED  surveyed / total" and
       Coverage % = surveyed blocks / total blocks in scope × 100
     - block grid: Auditable (mint) / Pending (amber) / Uncharted (slate);
       tapping an uncharted block opens a ground-truth audit prompt

   Real data only. Every scope is built from actual per-ward block grids
   ({state}/{city}/{ward}/grid), using /api/coverage/national as the list
   of mapped wards:
     City    = every mapped ward in the viewer's city
     State   = every mapped ward in the viewer's state
     Country = every mapped ward nationwide (the national 11M-cell H3
               matrix is the roadmap; the note under the grid says how
               many blocks are mapped so far)
   If the API can't be reached (e.g. a static local server), City falls
   back to the same offline sample ward the app uses and State / Country
   say their data is unavailable offline — nothing is extrapolated.

   "Reported by you" comes only from this device's localStorage receipt
   ledger (citixen_my_reports_v1); the API never carries reporter identity.

   Page adapter (CitixenGeoHatch.init):
     getScope()    -> { state, stateName, city, cityName, ward } or null
     getNational() -> optional async national rollup ({ municipalities })
     onAuditBlock(cellId, ward) -> start a report for that block, where
                      ward = { state, city, ward } the block belongs to
   ===================================================================== */
(function () {
  'use strict';

  var MY_REPORTS_KEY = 'citixen_my_reports_v1';
  var NATIONAL_MATRIX_CELLS = 11000000; // roadmap: U.S. H3 resolution-9 matrix
  var SCOPES = [
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'country', label: 'Country' }
  ];
  var cfg = {}, scope = 'city', mounts = [], loaded = false;
  // wardKey 'state/city/ward' -> { state, stateName, city, cityName, ward, cells, live }
  var wards = {}, nationalOk = false, homeKey = null;

  function key(w) { return w.state + '/' + w.city + '/' + w.ward; }
  function myCellIds() {
    try { return new Set(JSON.parse(localStorage.getItem(MY_REPORTS_KEY) || '[]').map(function (r) { return r.cellId; })); }
    catch (e) { return new Set(); }
  }

  // Offline fallback — identical shape and values to app.html's
  // mockCoverageCells(); used only when the coverage API is unreachable.
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

  async function fetchGrid(w) {
    var res = await fetch('/api/coverage/' + w.state + '/' + w.city + '/' + w.ward + '/grid');
    if (!res.ok) throw new Error('grid ' + res.status);
    var data = await res.json();
    if (!Array.isArray(data.cells)) throw new Error('grid: no cells');
    return markPending(data.cells);
  }
  async function fetchNational() {
    try {
      var data = cfg.getNational ? await cfg.getNational() : null;
      if (data && data.municipalities && data.municipalities.length) return data;
      var res = await fetch('/api/coverage/national');
      if (!res.ok) throw new Error('national ' + res.status);
      return await res.json();
    } catch (e) { return null; }
  }

  async function loadData() {
    wards = {}; nationalOk = false;
    var home = cfg.getScope ? cfg.getScope() : null;
    homeKey = home ? key(home) : null;
    var national = await fetchNational();
    var list = national && Array.isArray(national.municipalities) ? national.municipalities : [];
    if (list.length) {
      var results = await Promise.all(list.map(function (m) {
        var w = { state: m.state, stateName: m.stateName, city: m.city, cityName: m.cityName, ward: m.ward };
        return fetchGrid(w).then(function (cells) { w.cells = cells; w.live = true; return w; }, function () { return null; });
      }));
      results.forEach(function (w) { if (w) wards[key(w)] = w; });
      nationalOk = Object.keys(wards).length > 0;
    }
    if (home && !wards[homeKey]) {
      // Ward not in the national list (or the list failed): fetch it alone.
      try { wards[homeKey] = Object.assign({}, home, { cells: await fetchGrid(home), live: true }); }
      catch (e) { /* offline — handled below */ }
    }
    if (!Object.keys(wards).length) {
      var fallback = home || { state: 'wi', stateName: 'Wisconsin', city: 'la-crosse', cityName: 'La Crosse', ward: 'ward-4' };
      homeKey = key(fallback);
      wards[homeKey] = Object.assign({}, fallback, { cells: markPending(mockCells()), live: false });
    }
  }

  function homeWard() { return wards[homeKey] || null; }

  // The wards (and so the blocks) that make up the active scope.
  function scopeWards() {
    var h = homeWard(), all = Object.keys(wards).map(function (k) { return wards[k]; });
    if (!h) return all;
    if (scope === 'city') return all.filter(function (w) { return w.state === h.state && w.city === h.city; });
    if (scope === 'state') return all.filter(function (w) { return w.state === h.state; });
    return all;
  }
  function scopeCells() {
    var out = [];
    scopeWards().forEach(function (w) { w.cells.forEach(function (c) { out.push({ cell: c, ward: w }); }); });
    return out;
  }
  function scopeName() {
    var h = homeWard();
    if (scope === 'country') return 'UNITED STATES';
    if (!h) return scope === 'city' ? 'CITYWIDE' : 'STATEWIDE';
    if (scope === 'state') return String(h.stateName || h.state).toUpperCase();
    return (h.cityName + ', ' + h.state).toUpperCase();
  }

  function build(mount, n) {
    mount.innerHTML =
      '<section class="cx-geo" aria-labelledby="cxGeoTitle' + n + '">' +
        '<h3 class="cx-geo-title" id="cxGeoTitle' + n + '">#CrowdSaveAmerica</h3>' +
        '<div class="cx-geo-tiers" role="tablist" aria-label="Coverage scope">' +
          SCOPES.map(function (t) { return '<button type="button" class="cx-geo-tier" role="tab" data-scope="' + t.key + '" aria-selected="' + (t.key === scope) + '">' + t.label + '</button>'; }).join('') +
        '</div>' +
        '<div class="cx-geo-metric">' +
          '<div><div class="cx-geo-label" data-geo="label">Citywide asset coverage</div><div class="cx-geo-pct" data-geo="pct">—</div></div>' +
          '<div class="cx-geo-frac"><div class="cx-geo-sub" data-geo="sub">Blocks surveyed</div><div class="cx-geo-count" data-geo="count">— / —</div></div>' +
        '</div>' +
        '<div class="cx-geo-legend"><span><i class="cx-geo-dot is-audit"></i>Auditable</span><span><i class="cx-geo-dot is-pending"></i>Pending</span><span><i class="cx-geo-dot is-dark"></i>Uncharted</span></div>' +
        '<div class="cx-geo-grid" data-geo="grid" aria-label="Block grid"></div>' +
        '<canvas class="cx-geo-canvas" data-geo="canvas" hidden aria-label="Block grid"></canvas>' +
        '<div class="cx-geo-prompt" data-geo="prompt" role="status" hidden>' +
          '<span data-geo="promptText"></span>' +
          '<button type="button" class="cx-geo-cta" data-geo="promptCta">Start audit ↗</button>' +
        '</div>' +
        '<div class="cx-geo-note" data-geo="note"></div>' +
      '</section>';
    mount.querySelectorAll('.cx-geo-tier').forEach(function (b) {
      b.addEventListener('click', function () { setScope(b.dataset.scope); });
    });
    q(mount, 'canvas').addEventListener('click', function (e) { onCanvasTap(mount, e); });
  }
  function q(mount, k) { return mount.querySelector('[data-geo="' + k + '"]'); }

  // Up to 120 blocks render as tappable buttons; larger scopes draw on a
  // canvas (one square per real block) with tap hit-testing.
  var DOM_LIMIT = 120;

  function renderGrid(mount, animate) {
    var items = scopeCells(), grid = q(mount, 'grid'), canvas = q(mount, 'canvas'), mine = myCellIds();
    q(mount, 'prompt').hidden = true;
    if (items.length <= DOM_LIMIT) {
      canvas.hidden = true; grid.hidden = false; grid.innerHTML = '';
      grid.style.gridTemplateColumns = 'repeat(10, 1fr)';
      var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      items.forEach(function (it) {
        var c = it.cell, b = document.createElement('button');
        b.type = 'button';
        b.className = 'cx-geo-cell' + (c.pending ? ' is-pending' : '') + (c.covered && (!animate || reduce) ? ' is-audit' : '') +
          (key(it.ward) === homeKey && mine.has(c.id) ? ' is-mine' : '');
        b.setAttribute('aria-label', c.covered ? (c.category + ' — verified ' + c.verifiedDate) : (c.pending ? 'Pending dispatch review' : 'Uncharted block — tap to audit'));
        b.addEventListener('click', function () { onTap(mount, it); });
        grid.appendChild(b);
        if (c.covered && animate && !reduce) setTimeout(function () { b.classList.add('is-audit'); }, 30 + Math.random() * 1100);
      });
    } else {
      grid.hidden = true; canvas.hidden = false;
      drawCanvas(mount, items);
    }
  }

  function canvasLayout(n, width) {
    var cols = Math.max(10, Math.ceil(Math.sqrt(n * 2.2)));
    var size = width / cols, rows = Math.ceil(n / cols);
    return { cols: cols, rows: rows, size: size, gap: Math.max(1, size * 0.14) };
  }
  function drawCanvas(mount, items) {
    var canvas = q(mount, 'canvas'), dpr = window.devicePixelRatio || 1;
    var cssW = Math.max(canvas.parentNode.clientWidth - 32, 0) || 320;
    var L = canvasLayout(items.length, cssW), cssH = L.rows * L.size;
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    var ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cssW, cssH);
    items.forEach(function (it, i) {
      var x = (i % L.cols) * L.size, y = Math.floor(i / L.cols) * L.size;
      ctx.fillStyle = it.cell.covered ? '#00E699' : it.cell.pending ? '#F59E0B' : 'rgba(30,41,59,0.75)';
      ctx.fillRect(x + L.gap / 2, y + L.gap / 2, L.size - L.gap, L.size - L.gap);
    });
    canvas._layout = L; canvas._items = items;
  }
  function onCanvasTap(mount, e) {
    var canvas = q(mount, 'canvas'), L = canvas._layout;
    if (!L) return;
    var r = canvas.getBoundingClientRect();
    var col = Math.floor((e.clientX - r.left) / L.size), row = Math.floor((e.clientY - r.top) / L.size);
    var it = canvas._items[row * L.cols + col];
    if (it && col < L.cols) onTap(mount, it);
  }

  function renderStats(mount) {
    var items = scopeCells();
    var surveyed = items.filter(function (it) { return it.cell.covered; }).length, total = items.length;
    var label = { city: 'Citywide', state: 'Statewide', country: 'Nationwide' }[scope] + ' asset coverage';
    var unavailable = scope !== 'city' && !nationalOk;
    q(mount, 'label').textContent = label;
    q(mount, 'sub').textContent = scopeName() + ' blocks surveyed';
    q(mount, 'pct').textContent = unavailable ? '—' : (total ? (surveyed / total * 100).toFixed(1) : '0.0') + '%';
    q(mount, 'count').textContent = unavailable ? '— / —' : surveyed.toLocaleString('en-US') + ' / ' + total.toLocaleString('en-US');
    var home = homeWard(), note = '';
    if (home && !home.live) note = 'Offline preview — showing sample blocks until the coverage service responds.';
    if (unavailable) note = 'Statewide and nationwide totals need the live coverage service — showing your city until it responds.';
    else if (scope === 'country') note = total.toLocaleString('en-US') + ' blocks mapped so far toward the ' + (NATIONAL_MATRIX_CELLS / 1e6) + 'M-cell U.S. H3 matrix.';
    q(mount, 'note').textContent = note;
  }

  function render(mount, animate) {
    mount.querySelectorAll('.cx-geo-tier').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.scope === scope)); });
    renderGrid(mount, animate);
    renderStats(mount);
  }
  function setScope(s) { scope = s; mounts.forEach(function (m) { render(m, false); }); }

  function onTap(mount, it) {
    var c = it.cell, box = q(mount, 'prompt'), text = q(mount, 'promptText'), cta = q(mount, 'promptCta');
    var where = it.ward.cityName ? ' · ' + it.ward.cityName : '';
    if (c.covered) {
      text.textContent = c.category + ' — verified ' + c.verifiedDate + where + (key(it.ward) === homeKey && myCellIds().has(c.id) ? ' · reported by you' : '');
      cta.hidden = true;
    } else if (c.pending) {
      text.textContent = 'Pending dispatch review — a report for this block is already in the queue.';
      cta.hidden = true;
    } else {
      text.textContent = 'Uncharted block' + where + '. Run a ground-truth audit: photograph what is there and file it in under a minute.';
      cta.hidden = false;
      cta.onclick = function () {
        box.hidden = true;
        if (cfg.onAuditBlock) cfg.onAuditBlock(c.id, { state: it.ward.state, city: it.ward.city, ward: it.ward.ward });
      };
    }
    box.hidden = false;
    clearTimeout(box._t);
    box._t = setTimeout(function () { box.hidden = true; }, 7000);
  }

  async function load() {
    if (loaded || !mounts.length) return; // init() must run first
    loaded = true;
    await loadData();
    mounts.forEach(function (m) { render(m, true); });
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
      window.addEventListener('resize', function () {
        mounts.forEach(function (m) { if (!q(m, 'canvas').hidden) drawCanvas(m, scopeCells()); });
      });
    },
    load: load,
    // Active scope ('city' | 'state' | 'country') — the share card's map follows it.
    getScope: function () { return scope; },
    // Per-ward block totals for every mapped ward loaded (live data only).
    wardSummaries: function () {
      return Object.keys(wards).map(function (k) {
        var w = wards[k];
        return { state: w.state, stateName: w.stateName, city: w.city, cityName: w.cityName, ward: w.ward,
          surveyed: w.cells.filter(function (c) { return c.covered; }).length, total: w.cells.length, live: w.live };
      }).filter(function (w) { return w.live; });
    },
    // Re-fetch after the page's jurisdiction changes.
    reload: async function () { loaded = false; await load(); },
    // Light up one of the viewer's home-ward blocks after this device files a report for it.
    markCovered: function (id, category) {
      var w = homeWard(), c = w && w.cells.find(function (x) { return x.id === id; });
      if (!c) return;
      c.covered = true; c.pending = false; c.category = category || c.category || 'Report';
      c.verifiedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      mounts.forEach(function (m) { render(m, false); });
    }
  };
})();
