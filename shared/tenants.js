/* CITIXEN UX — tenant registry for /muni/{city_slug}.
 *
 * Static, client-side list of the city hubs that exist. This is NOT an
 * access-control list: /muni/{slug} is a public URL and there is no
 * authentication in this repo yet, so a hub must only ever show demo data
 * or data the public ledger API already exposes. Adding a city = adding an
 * entry here (and, when real auth exists, a server-side tenant record).
 *
 *  source:'demo'   hard-coded mock reports; status changes work in-memory
 *                  (and are written to a real, in-page SHA-256 audit chain).
 *  source:'ledger' reads the real ledger API (/api/coverage/tickets) filtered
 *                  to `cityKey`. Read-only: no unauthenticated writes.
 */
/* SLUG STANDARD: every tenant key / slug is {city}-{state}, lowercase, hyphenated
 * (holmen-wi, la-crosse-wi, austin-tx). Intake routes are {city}-{state}-{department}
 * (holmen-wi-public-works). cityKey below is the ledger API's own key and is unrelated.
 * vercel.json allow-lists the slugs; a test fails if a tenant breaks the standard. */
(function () {
  var MIN = 60 * 1000;
  window.NEXUS_TENANTS = {
    'holmen-wi': {
      slug: 'holmen-wi',
      name: 'Village of Holmen, WI',
      label: 'Holmen (sample data)',
      source: 'demo',
      center: [43.9647, -91.2585], zoom: 14,
      // SAMPLE DATA ONLY: invented reports so the command dashboard can be reviewed.
      // [id, category index, lat, lng, status, minutes ago reported, intake route slug]
      seed: [
        ['HW-0114',0,43.9661,-91.2571,'new',9,'holmen-wi-public-works'],        ['HW-0113',1,43.9632,-91.2610,'new',34,'holmen-wi-public-works'],
        ['HW-0112',2,43.9689,-91.2549,'new',51,'holmen-wi-parks'],               ['HW-0111',5,43.9618,-91.2597,'new',88,'holmen-wi-parks'],
        ['HW-0110',0,43.9644,-91.2533,'dispatched',150,'holmen-wi-public-works'],['HW-0109',3,43.9602,-91.2574,'dispatched',260,'holmen-wi-public-works'],
        ['HW-0108',6,43.9671,-91.2622,'dispatched',410,'holmen-wi-public-works'],['HW-0107',2,43.9655,-91.2588,'dispatched',620,'holmen-wi-parks'],
        ['HW-0106',4,43.9627,-91.2559,'resolved',1100,'holmen-wi-public-works'],['HW-0105',1,43.9640,-91.2606,'resolved',1600,'holmen-wi-public-works'],
        ['HW-0104',5,43.9678,-91.2540,'resolved',2300,'holmen-wi-parks'],        ['HW-0103',0,43.9609,-91.2582,'resolved',3000,'holmen-wi-public-works']
      ],
      portals: [
        { slug: 'holmen-wi-public-works', label: 'Public Works intake' },
        { slug: 'holmen-wi-parks', label: 'Parks intake' }
      ],
      // Grant status is configuration, not a payment feed. Update it by hand when it changes.
      grant: { program: 'LWMMI Loss Control Grant', amount: 9500, status: 'pending' },
      // Drives /muni/holmen-wi/gateway. Policy ID is a SAMPLE value until the real one is confirmed.
      onboarding: { entity: 'Village of Holmen', state: 'WI', policy: 'LWMMI-WI-42091-HOL', anchor: 1, platformValue: 9500, grantCredit: 9500 },
      zones: [], crews: []
    },
    'austin-tx': {
      slug: 'austin-tx',
      name: 'City of Austin — Public Works',
      label: 'Austin (demo tenant)',
      source: 'demo',
      center: [30.2672, -97.7431], zoom: 13,
      // [id, category index, lat, lng, status, minutes ago reported] — mock data
      seed: [
        ['NX-0412',0,30.2711,-97.7437,'new',14],   ['NX-0411',1,30.2649,-97.7502,'new',38],
        ['NX-0410',2,30.2802,-97.7391,'new',55],   ['NX-0409',3,30.2587,-97.7351,'new',72],
        ['NX-0408',0,30.2735,-97.7281,'dispatched',190], ['NX-0407',4,30.2690,-97.7612,'dispatched',240],
        ['NX-0406',6,30.2461,-97.7558,'dispatched',305], ['NX-0405',5,30.2899,-97.7456,'dispatched',410],
        ['NX-0404',1,30.2625,-97.7218,'resolved',900],  ['NX-0403',0,30.2768,-97.7529,'resolved',1280],
        ['NX-0402',2,30.2512,-97.7440,'resolved',1710], ['NX-0401',3,30.2834,-97.7322,'resolved',2200]
      ],
      zones: [
        { id: 'z1', name: 'Downtown core', sub: '1.2 km radius', lat: 30.2672, lng: -97.7431, r: 1200, on: true },
        { id: 'z2', name: 'East corridor', sub: '900 m radius', lat: 30.2650, lng: -97.7220, r: 900, on: true },
        { id: 'z3', name: 'South Congress', sub: '800 m radius', lat: 30.2500, lng: -97.7500, r: 800, on: false }
      ],
      crews: [
        { id: 'c1', name: 'Crew 1 — Roadway repair', sub: '4 members', on: true },
        { id: 'c2', name: 'Crew 2 — Electrical / lighting', sub: '3 members', on: true },
        { id: 'c3', name: 'Crew 3 — Water & drainage', sub: '3 members', on: false }
      ]
    },
    'la-crosse-wi': {
      slug: 'la-crosse-wi',
      name: 'City of La Crosse, WI',
      label: 'La Crosse (live ledger, read-only)',
      source: 'ledger',
      cityKey: 'la-crosse',             // matches `city` in api/_lib/store.js WARD_JURISDICTION
      center: [43.8014, -91.2396], zoom: 13,
      zones: [], crews: []              // none configured yet — the hub says so
    }
  };
  window.NEXUS_TENANT_MIN = MIN;
})();
