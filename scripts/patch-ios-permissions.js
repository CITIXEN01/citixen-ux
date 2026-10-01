#!/usr/bin/env node
/**
 * Writes CITIXEN UX's two required iOS usage-description strings into
 * ios/App/App/Info.plist after `npx cap add ios` has generated it.
 * Capacitor does not read these from capacitor.config.json automatically,
 * so this is the step that actually makes them show up for App Store
 * review and the OS permission prompts. Safe to re-run (idempotent) and
 * exits quietly (never throws) if `cap add ios` hasn't been run yet.
 */
const fs = require('fs');
const path = require('path');

const PLIST_PATH = path.join(__dirname, '..', 'ios', 'App', 'App', 'Info.plist');

const PERMISSIONS = {
  NSCameraUsageDescription:
    'CITIXEN UX uses your camera to document infrastructure issues anonymously. Photos are stripped of EXIF data.',
  NSLocationWhenInUseUsageDescription:
    'CITIXEN UX uses your precise GPS location to identify district jurisdiction and map report coordinates.'
};

function main(){
  if (!fs.existsSync(PLIST_PATH)) {
    console.log('[capacitor] ios/App/App/Info.plist not found yet — run `npx cap add ios` first, then re-run `npm run cap:add:ios` or this script directly.');
    return;
  }

  let plist = fs.readFileSync(PLIST_PATH, 'utf8');

  Object.entries(PERMISSIONS).forEach(([key, description]) => {
    if (plist.includes('<key>' + key + '</key>')) {
      console.log('[capacitor] ' + key + ' already present — leaving as-is.');
      return;
    }
    const entry = '\t<key>' + key + '</key>\n\t<string>' + description + '</string>\n';
    plist = plist.replace('</dict>\n</plist>', entry + '</dict>\n</plist>');
    console.log('[capacitor] Added ' + key + ' to Info.plist.');
  });

  fs.writeFileSync(PLIST_PATH, plist);
}

main();
