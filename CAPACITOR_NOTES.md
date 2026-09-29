# Capacitor native wrapper — notes

This is engineering documentation for wrapping the existing static PWA
(`index.html` / `app.html`, `webDir: "."` — see `capacitor.config.json`) in
native iOS/Android shells with [Capacitor](https://capacitorjs.com/). See
`package.json`'s `cap:*` scripts and `scripts/capacitor-init.js` for the
actual build steps, and `scripts/patch-ios-permissions.js` /
`scripts/patch-android-permissions.js` for how the camera/location usage
strings get written into the generated native projects.

## Geolocation / camera abstraction

`app.html` wraps every geolocation and camera call behind a small runtime
check (`isNativeCapacitorRuntime()`, i.e. `window.Capacitor` present):

- `citixenGetCurrentPosition()` calls the native `Capacitor.Plugins.Geolocation`
  plugin when running inside the native wrapper, and falls back to the
  existing plain-web `navigator.geolocation` path otherwise.
- `citixenCapturePhoto()` calls the native `Capacitor.Plugins.Camera` plugin
  when running inside the native wrapper, and returns `null` otherwise as
  the cue to fall back to the existing `getUserMedia` + video-preview
  capture modal.

Neither path requires the actual `@capacitor/geolocation` or
`@capacitor/camera` npm packages to be installed for the web fallback to
keep working — both branches are guarded behind `window.Capacitor` existing
at all, the same guard style this file already uses for the Leaflet CDN
script (`typeof L === 'undefined'`).

## Offline submission queue

If a report's actual submission request (`POST /api/report/submit`) fails —
most commonly because the device is offline — it is queued in IndexedDB
(`citixen_offline_queue` database) instead of being silently dropped or
claimed as submitted. The citizen is told plainly ("Saved offline — will
submit when you're back online."), the report still renders locally in the
dispatch feed right away, and a single `window.addEventListener('online', ...)`
listener retries the queue when connectivity returns. This does not use
service-worker background sync (`sw.js` has none today, and none was added).

## Play Store Data Safety — technical measures on file

This section lists the **technical measures already implemented in this
codebase** that are relevant to filling out Google Play's Data Safety
form for an account-free app. **It does not certify compliance** — the
actual Data Safety form answers, and whether this app satisfies Google
Play's policies at submission time, are the developer's responsibility to
determine in Play Console at that time. Nothing below is a substitute for
that review.

Measures relevant to that form, as implemented in this codebase today:

- **No user accounts exist.** There is no sign-up, sign-in, or account
  system anywhere in this app (see the "No account required" privacy note
  in `app.html`), so there is no user data tied to an account identity, and
  no account-deletion flow is needed in the sense Play's policy means it —
  there is no account to delete.
- **EXIF/GPS stripping before upload.** Photos captured through this app
  (both the web `getUserMedia` + canvas-capture path and, once wired, the
  native Capacitor Camera plugin's `resultType: 'dataUrl'` path) never
  carry the original file's EXIF metadata — a canvas re-encode and a
  decoded data URL both drop it by construction, not as an extra
  stripping step that could be skipped.
- **Coordinate fuzzing on public display.** The public dashboard
  (`index.html`) rounds displayed coordinates to 3 decimal places (roughly
  ~110m of precision) rather than showing exact device GPS coordinates.
- **No reporter-identifying field in the data model.** `api/_lib/store.js`
  deliberately has no "reported by" field on any shared/public record —
  see that file's own privacy note. "Reported by me" is computed
  client-side, per-device, from a local `localStorage` ledger, never sent
  to or stored on the server.

Anything not listed above (analytics SDKs, crash reporting, ad SDKs, etc.)
is out of scope for this note because this codebase does not currently
include any — if one is added later, this note should be updated
alongside it, and the Data Safety form re-reviewed.
