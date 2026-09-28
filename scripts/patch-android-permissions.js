#!/usr/bin/env node
/**
 * Adds the Android manifest permissions CITIXEN UX's camera capture and
 * ward-jurisdiction lookup need, after `npx cap add android` has generated
 * android/app/src/main/AndroidManifest.xml. Idempotent, and exits quietly
 * (never throws) if `cap add android` hasn't been run yet.
 */
const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

const PERMISSIONS = [
  'android.permission.CAMERA',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION'
];

function main(){
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.log('[capacitor] android/app/src/main/AndroidManifest.xml not found yet — run `npx cap add android` first, then re-run `npm run cap:add:android` or this script directly.');
    return;
  }

  let manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
  if (!manifest.includes('</manifest>')) {
    console.log('[capacitor] AndroidManifest.xml did not have the expected </manifest> closing tag — skipping to avoid corrupting the file.');
    return;
  }

  const toAdd = PERMISSIONS.filter(perm => !manifest.includes(perm));
  if (!toAdd.length) {
    console.log('[capacitor] All required permissions already present — leaving AndroidManifest.xml as-is.');
    return;
  }

  const tags = toAdd.map(perm => '\t<uses-permission android:name="' + perm + '" />').join('\n') + '\n';
  manifest = manifest.replace('</manifest>', tags + '</manifest>');
  fs.writeFileSync(MANIFEST_PATH, manifest);
  toAdd.forEach(perm => console.log('[capacitor] Added ' + perm + ' to AndroidManifest.xml.'));
}

main();
