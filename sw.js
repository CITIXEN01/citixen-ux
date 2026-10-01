/* CITIXEN UX service worker
   - Precaches the app shell so the reporter opens offline / on flaky networks.
   - Pages: network-first (always fresh when online), cached copy as fallback.
   - Same-origin static files: stale-while-revalidate.
   - Cross-origin requests (map tiles, Leaflet CDN, QR images) pass straight through:
     they are not cached here, so no third-party responses are stored on the device.
   Bump VERSION to roll out a new shell; old caches are deleted on activate. */
const VERSION = 'citixen-v6-beta-lockdown';
const SHELL = [
  '/app',
  '/',
  '/manifest.json',
  '/shared/instant-report.css',
  '/shared/instant-report.js',
  '/shared/geo-hatch.js',
  '/shared/severity.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Cache entries one by one so a single missing file can't abort the install.
    await Promise.all(SHELL.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // tiles, CDNs, QR: network only
  if (url.pathname.startsWith('/admin')) return;      // legacy alias — never cached on device
  if (url.pathname.startsWith('/dispatch')) return;   // staff console is never cached on device
  if (url.pathname.startsWith('/rep')) return;        // rep tools gate is never cached on device

  // Pages and the shared Dashboard modules (/shared/*.js, *.css) are
  // network-first, so a new deploy shows up on the very next load; the
  // cached copy is only the offline fallback.
  if (req.mode === 'navigate' || url.pathname.startsWith('/shared/')) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true }))
            || (req.mode === 'navigate' ? await cache.match('/app') : null)
            || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  })());
});
