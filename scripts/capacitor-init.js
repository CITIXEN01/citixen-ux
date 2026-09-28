#!/usr/bin/env node
/**
 * CITIXEN UX — Capacitor native wrapper bootstrap
 * ------------------------------------------------
 * Wraps the existing static PWA (deck.html/app.html/index.html, webDir ".")
 * in native iOS and Android shells for App Store / Google Play packaging,
 * using the already-committed capacitor.config.json (appId
 * com.citixenux.app). This script only prints the exact commands to run —
 * it does not install anything itself, so it's safe to run in CI or a
 * teammate's shell without surprising side effects.
 *
 * One-time setup:
 *   1. npm install                        # pulls in @capacitor/core + cli from package.json
 *   2. npx cap init "CITIXEN UX" com.citixenux.app --web-dir .
 *      (capacitor.config.json already exists and is checked in — `cap init`
 *      will detect it and can be skipped if it does not need to change)
 *   3. npm run cap:add:ios                # npx cap add ios      + patches Info.plist permissions
 *   4. npm run cap:add:android            # npx cap add android  + patches AndroidManifest.xml permissions
 *   5. npm run cap:sync                   # copies web assets + config into both native projects
 *
 * Ongoing (after any change to deck.html/app.html/manifest.json/icons):
 *   npm run cap:sync
 *
 * Opening the native IDEs for signing, icons, and App Store / Play Console
 * submission:
 *   npm run cap:open:ios       # opens ios/App/App.xcworkspace in Xcode
 *   npm run cap:open:android   # opens android/ in Android Studio
 *
 * NOTE on iOS permission strings: capacitor.config.json's ios.infoPlist
 * block documents the two required usage-description strings
 * (NSCameraUsageDescription, NSLocationWhenInUseUsageDescription), but
 * Capacitor does not merge that block into Info.plist automatically at
 * `cap add`/`cap sync` time. scripts/patch-ios-permissions.js writes them
 * into ios/App/App/Info.plist for real, right after `cap add ios` creates
 * that file, so App Store review sees genuine usage-description strings
 * instead of a config value that never reached the native project.
 */
console.log(`
CITIXEN UX — Capacitor setup
=============================
1) npm install
2) npx cap init "CITIXEN UX" com.citixenux.app --web-dir .
3) npm run cap:add:ios       (adds the iOS project + writes camera/location permission strings)
4) npm run cap:add:android   (adds the Android project + writes camera/location permissions)
5) npm run cap:sync          (re-run this after any web asset change)

Then:
  npm run cap:open:ios        # Xcode — set your signing team, then Archive for App Store Connect
  npm run cap:open:android    # Android Studio — Build > Generate Signed Bundle/APK for Google Play
`);
