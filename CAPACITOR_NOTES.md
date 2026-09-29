# Capacitor native wrapper — App Store / Play Store submission checklist

This is engineering documentation for wrapping the existing static PWA
(`index.html` / `app.html`, `webDir: "."` — see `capacitor.config.json`) in
native iOS/Android shells with [Capacitor](https://capacitorjs.com/). See
`package.json`'s `cap:*` scripts and `scripts/capacitor-init.js` for the
actual build steps, and `scripts/patch-ios-permissions.js` /
`scripts/patch-android-permissions.js` for how the camera/location usage
strings get written into the generated native projects.

**This checklist is NOT a certification of compliance.** It tracks the
technical measures this codebase actually implements today, so a developer
has a concrete starting point before a native submission. The final Data
Safety form answers (Google Play) and App Privacy details (Apple), and
whether this app satisfies either store's review policies at submission
time, remain the developer's own responsibility to determine in Play
Console / App Store Connect at that time. Checking every box below does
not mean the app is cleared for release — it means the groundwork this
codebase can control has been verified.

## Before you build the native shells

- [ ] Run `scripts/capacitor-init.js` (via the `cap:*` scripts in
      `package.json`) against a clean checkout, and confirm it exits
      without patch errors.
- [ ] Confirm `capacitor.config.json`'s `webDir` still points at `.` and
      that `index.html` / `app.html` are present at the repo root when the
      native projects are generated.

## Geolocation / camera abstraction

- [ ] Confirm `app.html`'s `isNativeCapacitorRuntime()` check
      (`window.Capacitor` present) correctly detects the native wrapper on
      a real device build, not just in a browser preview.
- [ ] Confirm `citixenGetCurrentPosition()` calls the native
      `Capacitor.Plugins.Geolocation` plugin inside the native wrapper, and
      falls back to plain-web `navigator.geolocation` otherwise.
- [ ] Confirm `citixenCapturePhoto()` calls the native
      `Capacitor.Plugins.Camera` plugin inside the native wrapper, and
      falls back to the existing `getUserMedia` + video-preview capture
      modal otherwise (it returns `null` as the fallback cue).
- [ ] Verify the web fallback path still works with neither
      `@capacitor/geolocation` nor `@capacitor/camera` installed — both
      branches are guarded behind `window.Capacitor` existing at all, the
      same guard style already used for the Leaflet CDN script
      (`typeof L === 'undefined'`).

## Native permission strings

- [ ] Run `scripts/patch-ios-permissions.js` and confirm
      `NSLocationWhenInUseUsageDescription` and `NSCameraUsageDescription`
      (and `NSPhotoLibraryUsageDescription`/`NSPhotoLibraryAddUsageDescription`
      if the camera plugin writes to the photo library) are present in the
      generated `Info.plist`, with human-readable, accurate copy.
- [ ] Run `scripts/patch-android-permissions.js` and confirm
      `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` and `CAMERA` are
      declared in the generated `AndroidManifest.xml`, matching what the
      app actually requests at runtime.
- [ ] Manually trigger the location prompt and the camera prompt on a real
      iOS device and a real Android device, and confirm the OS-level
      permission dialogs show the patched strings, not a placeholder.

## EXIF / GPS stripping

- [ ] Confirm the web `getUserMedia` + canvas-capture path still produces
      a decoded data URL with no EXIF block (canvas re-encoding drops EXIF
      by construction, not as an extra strippable step).
- [ ] Once the native Capacitor Camera plugin is wired in, confirm its
      `resultType: 'dataUrl'` output is verified — on a real device, not
      just in the simulator — to carry no EXIF metadata before it reaches
      `POST /api/report/submit`.
- [ ] Spot-check a handful of real submitted photos (from both the web
      fallback and the native path) with an EXIF viewer to confirm no
      GPS/device metadata survived.

## Coordinate fuzzing on public display

- [ ] Confirm the public dashboard (`index.html`) still rounds displayed
      coordinates to 3 decimal places (~110m of precision) rather than
      showing exact device GPS coordinates, on every code path that
      renders a public pin (map markers, the Live Public Ledger, the
      per-report `/report/:id` page).
- [ ] Confirm no debug/dev build accidentally logs or displays
      full-precision coordinates anywhere reachable from a shipped build.

## Offline submission queue

- [ ] Confirm a failed `POST /api/report/submit` (e.g. device offline) is
      queued in IndexedDB (`citixen_offline_queue` database) instead of
      being silently dropped or falsely marked as submitted.
- [ ] Confirm the citizen is told plainly ("Saved offline — will submit
      when you're back online.") and the report still renders locally in
      the dispatch feed right away.
- [ ] Confirm the `window.addEventListener('online', ...)` listener
      actually retries and drains the queue when connectivity returns —
      test this on a real device with airplane mode, not just devtools'
      offline throttle.
- [ ] Note for the record (do not silently "fix" this without deciding
      first): this does not use service-worker background sync (`sw.js`
      has none today, and none was added) — the queue only retries while
      the app is foregrounded and the `online` event fires.

## No user accounts / no reporter-identifying data

- [ ] Confirm there is still no sign-up, sign-in, or account system
      anywhere in the app (the "No account required" privacy note in
      `app.html`), so there's no user data tied to an account identity.
- [ ] Confirm `api/_lib/store.js` still has no "reported by" field on any
      shared/public record, and that "Reported by me" is still computed
      client-side, per-device, from a local `localStorage` ledger, never
      sent to or stored on the server.

## Play Store Data Safety form — draft answers to bring into Play Console

- [ ] Location: draft the "collected/shared" answer as **collected
      on-device to attach to a citizen's own report, not shared with third
      parties, not linked to an account** (there is none) — confirm this
      still matches the actual data flow before submitting.
- [ ] Photos: draft the "collected/shared" answer noting EXIF/GPS is
      stripped before the photo ever leaves the device — confirm against
      the EXIF-stripping checks above, not from memory.
- [ ] Confirm the "Data deletion" section can honestly say **no
      account-tied data exists to delete** — re-verify this is still true
      at submission time, since it depends on no account system having
      been added since this checklist was written.
- [ ] Re-check the whole app for any newly added analytics SDK, crash
      reporter, or ad SDK before finalizing the form — none exist as of
      this checklist, but if one is added later, this checklist and the
      Data Safety form both need to be revisited together.

## App Store (Apple) App Privacy — draft answers to bring into App Store Connect

- [ ] Confirm the "Data Used to Track You" section can honestly say none,
      given no analytics/ad SDK exists in this codebase as of this
      checklist.
- [ ] Confirm the "Data Linked to You" section can honestly say none,
      given there is no account system to link data to.
- [ ] Draft the "Data Not Linked to You" section to disclose Precise
      Location and Photos as collected for App Functionality only, per the
      geolocation/camera/EXIF checks above.

## Final review before submission

- [ ] Re-run every check above against the actual build artifact being
      submitted (the generated iOS/Android project), not just against this
      source tree — a stale native project can drift from what's checked
      in here.
- [ ] Have a second person independently confirm the EXIF-stripping and
      coordinate-fuzzing checks on a real device, since those are the two
      privacy claims this app makes most directly to reviewers and users.
- [ ] File Store review and Data Safety / App Privacy form submission as
      its own task, owned by whoever has Play Console / App Store Connect
      access — this document does not submit anything on its own.
