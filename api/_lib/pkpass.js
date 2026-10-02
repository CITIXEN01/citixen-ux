// Shared Apple Wallet (.pkpass) bundle builder — produces the real pass.json,
// manifest.json (SHA1 of every bundle file), and a valid uncompressed ZIP
// container for all of it, using only Node's built-ins (crypto for SHA1,
// a small hand-rolled CRC32/ZIP writer below) since this sandbox has no
// network access to install a packaging library like `archiver` or
// `passkit-generator` (see README notes elsewhere in this repo about the
// egress proxy blocking npm/pip/apt installs of anything not already
// vendored). None of that is the real blocker, though:
//
// A .pkpass is only valid once it carries a `signature` file — a PKCS#7
// detached signature over manifest.json, produced with an Apple-issued
// "Pass Type ID" certificate + private key, chained to Apple's WWDR
// (Worldwide Developer Relations) intermediate certificate. Those three
// credentials can only come from an enrolled Apple Developer account —
// they cannot be generated, guessed, or substituted in this environment.
// iOS Wallet verifies that signature chain before it will even open a
// pass, so shipping this bundle without one would not produce a pass
// that silently "doesn't look quite right" — it produces a file Wallet
// refuses outright. See api/passbook.js (?mode=site for this site-wide
// pass, ?ticket=<id> for the earlier, identical per-ticket case) for how
// that's handled honestly. The two share this one function to stay inside
// Vercel Hobby's 10-function cap — see that file's own comment.
//
// Everything in this file is real and correct up to that line, so the
// only work left once real credentials exist is: fetch WWDR.pem +
// passTypeCert.pem + passTypeKey.pem (from env vars, not committed to
// this repo), compute the PKCS#7 signature over the manifest this module
// already builds, and add that one extra file to the zip this module
// already assembles.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ASSET_DIR = path.join(__dirname, 'pass-assets');
const ASSET_FILES = ['icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png', 'logo@3x.png'];

// ===== PASS SPECIFICATIONS (per the Oct 2026 wallet-pass task) =====
function buildPassJson(opts){
  opts = opts || {};
  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || 'pass.com.citixenux.wallet',
    teamIdentifier: process.env.APPLE_TEAM_ID || 'TEAMIDPLACEHOLDER',
    organizationName: 'CITIXEN UX',
    serialNumber: opts.serialNumber || crypto.randomUUID(),
    description: 'CITIXEN UX Public Ledger Access',
    backgroundColor: 'rgb(9,10,15)',    // #090A0F
    foregroundColor: 'rgb(255,255,255)', // #FFFFFF
    labelColor: 'rgb(0,255,135)',        // #00FF87
    generic: {
      headerFields: [
        { key: 'header', label: '', value: 'CITIXEN UX' }
      ],
      primaryFields: [
        { key: 'primary', label: '', value: 'Public Ledger Access' }
      ],
      secondaryFields: [
        { key: 'secondary', label: '', value: 'La Crosse, WI Ward Node' }
      ]
    },
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: 'https://citixenux.com',
        messageEncoding: 'iso-8859-1',
        altText: 'citixenux.com'
      }
    ]
  };
}

function sha1Hex(buf){
  return crypto.createHash('sha1').update(buf).digest('hex');
}

// Builds the in-memory file map (filename -> Buffer) for every file the
// bundle needs EXCEPT signature — pass.json + manifest.json + the icon/logo
// assets generated from icons/icon-512.png (see api/_lib/pass-assets/).
function buildBundleFiles(opts){
  const files = {};
  files['pass.json'] = Buffer.from(JSON.stringify(buildPassJson(opts), null, 2), 'utf8');
  ASSET_FILES.forEach(name => {
    files[name] = fs.readFileSync(path.join(ASSET_DIR, name));
  });
  const manifest = {};
  Object.keys(files).forEach(name => { manifest[name] = sha1Hex(files[name]); });
  files['manifest.json'] = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
  return files;
}

// ===== Minimal pure-Node ZIP writer (STORE method, i.e. uncompressed) =====
// A .pkpass is just a ZIP with its members at the archive root. Node has no
// built-in ZIP writer and this sandbox can't install `archiver`, so this is
// a small, standards-correct ZIP (local file headers + central directory +
// end-of-central-directory record) using the STORE method, which needs no
// compression library — only a CRC32, implemented below since Node's zlib
// doesn't expose one directly.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf){
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function dosDateTime(date){
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const d = (((date.getFullYear() - 1980) & 0x7F) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: d };
}
function buildZip(filesMap){
  const now = dosDateTime(new Date());
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  Object.keys(filesMap).forEach(name => {
    const data = filesMap[name];
    const crc = crc32(data);
    const nameBuf = Buffer.from(name, 'utf8');

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);        // version needed
    localHeader.writeUInt16LE(0, 6);         // flags
    localHeader.writeUInt16LE(0, 8);         // method: 0 = store
    localHeader.writeUInt16LE(now.time, 10);
    localHeader.writeUInt16LE(now.date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18); // compressed size
    localHeader.writeUInt32LE(data.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);        // extra field length
    localParts.push(localHeader, nameBuf, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);      // version made by
    centralHeader.writeUInt16LE(20, 6);      // version needed
    centralHeader.writeUInt16LE(0, 8);       // flags
    centralHeader.writeUInt16LE(0, 10);      // method
    centralHeader.writeUInt16LE(now.time, 12);
    centralHeader.writeUInt16LE(now.date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);      // extra length
    centralHeader.writeUInt16LE(0, 32);      // comment length
    centralHeader.writeUInt16LE(0, 34);      // disk number start
    centralHeader.writeUInt16LE(0, 36);      // internal attrs
    centralHeader.writeUInt32LE(0, 38);      // external attrs
    centralHeader.writeUInt32LE(offset, 42); // local header offset
    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + data.length;
  });

  const centralDir = Buffer.concat(centralParts);
  const localDir = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(filesMap).length, 8);
  end.writeUInt16LE(Object.keys(filesMap).length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(localDir.length, 16); // offset of central dir
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localDir, centralDir, end]);
}

// Whether real Apple signing credentials are configured. None are, in this
// environment — see the module header — but this is written against env
// vars so wiring up real credentials later is a config change, not a code
// change.
function hasSigningCredentials(){
  return !!(process.env.APPLE_PASS_CERT && process.env.APPLE_PASS_KEY && process.env.APPLE_WWDR_CERT);
}

module.exports = { buildPassJson, buildBundleFiles, buildZip, sha1Hex, hasSigningCredentials, ASSET_FILES };
