# CITIXEN UX™ — Native App Store Build: What's In This Zip and What's Still Needed

This archive is the complete web/Capacitor source project as of commit `a419060`
on `main`. It is the correct starting point for building native iOS and
Android app-store submissions, but **it is not a submittable binary** — no
sandbox can produce one, because that requires your own developer accounts,
signing identities, and native build tools. This file is the honest gap list.

## What's included and ready
- `index.html`, `app.html`, `dispatch.html`, `deck.html`, `report.html`
  — the full web app.
- `api/` — Vercel serverless functions (only relevant if you keep the hosted
  backend; the native wrapper loads the live site, see below).
- `capacitor.config.json` — `appId: com.citixenux.app`, `appName: CITIXEN UX`,
  configured to load `https://citixenux.com/app` as the native launch URL
  (see the `_notes` field inside it for why, and swap this once/if a real
  bundler produces a dedicated native web-output folder).
- `package.json` — declares `@capacitor/core`, `@capacitor/android`,
  `@capacitor/geolocation`, `@capacitor/camera`, `@capacitor/cli`,
  `@capacitor/ios` as dependencies. **These were declared but never
  installed in this environment** (npm registry access is blocked in this
  sandbox) — run `npm install` yourself first.
- `CAPACITOR_NOTES.md` — a checklist of the real technical privacy/permission
  measures already in the code (EXIF/GPS stripping, coordinate fuzzing,
  zero-account data model, offline queue). It explicitly does NOT certify
  App Store/Play Store compliance — that determination is made by Apple/Google
  during review, and by you when you fill out their forms.
- `icons/` — PWA-sized icons only (192px, 512px, maskable 512px, Apple touch
  icon, favicon). **These are NOT the full icon sets either store requires.**

## What you still need to do, in order

1. **Install dependencies**: `npm install` (requires real npm registry access,
   which this sandbox didn't have).
2. **Generate native projects**: `npx cap add ios` and `npx cap add android` —
   this needs Xcode (macOS only) and Android Studio installed locally; neither
   exists in this sandbox.
3. **Master app icon**: produce a real 1024×1024 master icon (no transparency
   for iOS) and run it through `@capacitor/assets` or a tool like
   `capacitor-resources` to generate every required iOS/Android icon size —
   the existing `icons/*.png` files are web/PWA-sized only and won't satisfy
   either store's icon requirements on their own.
4. **Screenshots**: both stores require device screenshots per supported
   screen size — none exist in this repo; you'll capture these from the real
   built app.
5. **Signing**:
   - iOS: an active Apple Developer Program membership ($99/yr), a
     Distribution certificate, and a provisioning profile, all configured in
     Xcode.
   - Android: a signing keystore (`keytool`-generated) and Play App Signing
     enrollment in Google Play Console.
6. **Store listings**: privacy policy URL (publicly hosted — `citixenux.com`
   should host one; it isn't in this repo yet), Apple's Privacy Nutrition
   Label answers, and Google Play's Data Safety form — `CAPACITOR_NOTES.md`
   gives you the real technical facts to answer both honestly, but you (or
   your counsel) need to actually fill them out; I haven't and can't submit
   those on your behalf.
7. **Accounts**: an Apple Developer account and a Google Play Console
   developer account (one-time $25 fee), both under your organization's name,
   not mine.
8. **Build and submit**: `npx cap sync`, then build/archive in Xcode
   (Product → Archive → Distribute App) and Android Studio (Build → Generate
   Signed App Bundle), then upload through App Store Connect and the Play
   Console respectively.

Nothing above is unusual for a Capacitor-wrapped PWA — this project's code
side is genuinely ready for step 1; steps 3–8 are account/tooling/asset work
that has to happen outside this environment.
