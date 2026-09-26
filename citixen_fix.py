#!/usr/bin/env python3
"""
CITIXEN UX — main-branch fix pack
Run from the root of CITIXEN01/citixen-ux:   python3 citixen_fix.py
Then review `git diff` and commit (commands printed at the end).

 1. index.html  — fix "Unexpected identifier 's'" (\\' inside single-quoted JS strings)
 2. index.html  — dynamic QR code pointing to https://citixenux.com/app
 3. app.html    — real WebRTC camera (getUserMedia) + aligned controls + keyless OSM tiles
 4. admin.html  — access-code gateway modal + Alderman briefing filters
Every edit is anchored and idempotent; the script aborts without writing if an anchor is missing.
"""
import re, sys, pathlib, shutil, subprocess, tempfile

ROOT = pathlib.Path('.')
APP_URL = 'https://citixenux.com/app'
MARK = 'CITIXEN-FIXPACK'
report = []

def load(name):
    p = ROOT / name
    if not p.exists():
        sys.exit(f'✗ {name} not found — run this from the repo root.')
    return p, p.read_text(encoding='utf-8')

def must_sub(pattern, repl, text, label, flags=re.S):
    new, n = re.subn(pattern, lambda m: repl, text, count=1, flags=flags)
    if n == 0:
        sys.exit(f'✗ Anchor not found: {label}. Nothing written.')
    report.append(f'  ✓ {label}')
    return new

def must_replace(old, new, text, label):
    if old not in text:
        sys.exit(f'✗ Anchor not found: {label}. Nothing written.')
    report.append(f'  ✓ {label}')
    return text.replace(old, new, 1)

# ─────────────────────────────── index.html ───────────────────────────────
ip, index = load('index.html')
if f'{MARK}:qr' in index:
    report.append('index.html already patched — skipped')
else:
    report.append('index.html')
    # 1. `\\'` inside '...' ends the string after the backslash, leaving `s published…`
    #    as a bare identifier → SyntaxError that kills the whole <script> block.
    #    Use a typographic apostrophe so no escaping is needed at all.
    bad = "\\\\'"
    n = index.count(bad)
    if n == 0:
        sys.exit('✗ Expected \\\\\' sequences in index.html not found. Nothing written.')
    index = index.replace(bad, '\u2019')
    report.append(f'  ✓ Fixed {n} broken escape(s) (ward’s, reporter’s, quarter’s, citizen’s, city’s)')

    # 2a. Static QR src → /app (works with JS disabled too)
    index = must_sub(r'data=https://citixenux\.com/app\.html',
                     'data=https%3A%2F%2Fcitixenux.com%2Fapp', index, 'QR <img> src → https://citixenux.com/app')
    index = must_sub(r'href="/app\.html" style="color:var\(--mint2\)">open /app\.html</a>',
                     f'href="{APP_URL}" style="color:var(--mint2)">open citixenux.com/app</a>',
                     index, 'QR fallback link → https://citixenux.com/app')
    # 2b. Dynamic QR renderer, run on load
    qr_js = f'''/* {MARK}:qr — dynamic QR, always encodes the canonical mobile URL */
const MOBILE_APP_URL='{APP_URL}';
function renderQR(){{
  const img=document.getElementById('qrImg'); if(!img) return;
  const size=Math.round(140*Math.min(window.devicePixelRatio||1,3));
  img.src='https://api.qrserver.com/v1/create-qr-code/?size='+size+'x'+size+
    '&margin=0&color=10b981&bgcolor=0d1518&data='+encodeURIComponent(MOBILE_APP_URL);
  img.title=MOBILE_APP_URL;
}}

window.addEventListener('DOMContentLoaded',()=>{{
  renderFeed();
  initMap();
  renderQR();
}});'''
    index = must_sub(r"window\.addEventListener\('DOMContentLoaded',\(\)=>\{\s*renderFeed\(\);\s*initMap\(\);\s*\}\);",
                     qr_js, index, 'renderQR() wired into DOMContentLoaded')
    ip.write_text(index, encoding='utf-8')

# ──────────────────────────────── app.html ────────────────────────────────
ap, app = load('app.html')
if f'{MARK}:cam' in app:
    report.append('app.html already patched — skipped')
else:
    report.append('app.html')
    cam_css = f'''/* {MARK}:cam */
.cam-view{{flex:1;position:relative;margin:14px 0;border-radius:14px;overflow:hidden;background:#000;
  border:2px solid var(--mint2);min-height:0}}
.cam-view video{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.cam-msg{{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:10px;padding:20px;text-align:center;font-size:.78rem;color:var(--muted)}}
.cam-actions{{display:grid;grid-template-columns:52px 1fr 52px;align-items:center;gap:12px;
  padding-bottom:env(safe-area-inset-bottom,0px)}}
.cam-actions .btn-submit{{margin:0}}
.cam-round{{width:52px;height:52px;border-radius:50%;border:1px solid var(--border);background:var(--card);
  color:var(--text);display:flex;align-items:center;justify-content:center;cursor:pointer}}
.cam-round:disabled{{opacity:.35;cursor:default}}
.cam-round:focus-visible,.btn-submit:focus-visible{{outline:2px solid var(--mint2);outline-offset:2px}}
#photoPreview{{display:block;width:100%;max-height:220px;object-fit:cover;border-radius:10px;border:1px solid var(--mint2)}}
'''
    app = must_sub(r'</style>', cam_css + '</style>', app, 'Camera + alignment CSS')

    viewfinder = '''<div class="cam-view">
      <video id="camVideo" playsinline muted autoplay></video>
      <div class="cam-msg" id="camMsg">Starting camera…</div>
    </div>'''
    app = must_sub(r'<div style="flex:1;border:2px dashed var\(--mint2\);[^"]*">.*?</div>',
                   viewfinder, app, 'Viewfinder simulation → live <video>')

    actions = '''<div class="cam-actions">
      <button class="cam-round" id="btnUploadPhoto" aria-label="Choose photo from library" title="Choose from library">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
      </button>
      <button class="btn-submit" id="btnCapture" disabled>
        <svg viewBox="0 0 24 24" width="17" height="17" stroke="#051311" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.2"/></svg>
        Capture proof
      </button>
      <button class="cam-round" id="btnFlipCam" aria-label="Switch camera" title="Switch camera" disabled>
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>
      </button>
    </div>
    <input type="file" id="photoFile" accept="image/*" capture="environment" hidden>'''
    app = must_sub(r'<button class="btn-submit" id="btnCapture">.*?</button>',
                   actions, app, 'Capture row: library · capture · flip (aligned grid)')

    cam_js = '''/* CITIXEN-FIXPACK:cam — WebRTC camera. Frames are re-encoded through <canvas>,
   which writes a fresh JPEG with no EXIF block, so GPS/device tags never leave the phone. */
let camStream=null, camFacing='environment', capturedBlob=null, previewURL=null;

function camMsg(text){
  const m=document.getElementById('camMsg');
  m.style.display=text?'flex':'none'; m.textContent=text||'';
}
function stopStream(){
  if(camStream){ camStream.getTracks().forEach(t=>t.stop()); camStream=null; }
  document.getElementById('camVideo').srcObject=null;
}
async function startStream(){
  stopStream();
  document.getElementById('btnCapture').disabled=true;
  if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || !window.isSecureContext){
    camMsg('Live camera needs HTTPS and a supported browser. Use the library button to attach a photo.');
    return;
  }
  camMsg('Starting camera…');
  try{
    camStream=await navigator.mediaDevices.getUserMedia({
      audio:false,
      video:{facingMode:{ideal:camFacing},width:{ideal:1920},height:{ideal:1080}}
    });
    const v=document.getElementById('camVideo');
    v.srcObject=camStream;
    await v.play().catch(()=>{});
    camMsg('');
    document.getElementById('btnCapture').disabled=false;
    const cams=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
    document.getElementById('btnFlipCam').disabled=cams.length<2;
  }catch(err){
    const name=err && err.name;
    camMsg(name==='NotAllowedError' ? 'Camera access was blocked. Allow it in your browser settings, or use the library button.'
         : name==='NotFoundError'   ? 'No camera found on this device. Use the library button to attach a photo.'
         : name==='NotReadableError'? 'The camera is in use by another app. Close it and reopen the camera.'
         : 'Camera could not start. Use the library button to attach a photo.');
  }
}
function openCamera(){
  document.getElementById('camModal').classList.add('open');
  startStream();
}
function closeCamera(){
  stopStream();
  document.getElementById('camModal').classList.remove('open');
}
function flipCamera(){
  camFacing = camFacing==='environment' ? 'user' : 'environment';
  startStream();
}
function showPhoto(blob){
  capturedBlob=blob;
  if(previewURL) URL.revokeObjectURL(previewURL);
  previewURL=URL.createObjectURL(blob);
  const box=document.getElementById('photoBox');
  let img=document.getElementById('photoPreview');
  if(!img){
    img=document.createElement('img'); img.id='photoPreview'; img.alt='Captured hazard photo';
    box.insertBefore(img, box.firstChild);
    const placeholder=img.nextElementSibling; if(placeholder && placeholder.tagName==='DIV') placeholder.style.display='none';
  }
  img.src=previewURL;
  box.style.display='block';
}
function clearPhoto(){
  capturedBlob=null;
  if(previewURL){ URL.revokeObjectURL(previewURL); previewURL=null; }
  document.getElementById('photoBox').style.display='none';
}
function capturePhoto(){
  const v=document.getElementById('camVideo');
  if(!v.videoWidth){ toast('Camera is not ready yet.'); return; }
  const c=document.createElement('canvas');
  c.width=v.videoWidth; c.height=v.videoHeight;
  c.getContext('2d').drawImage(v,0,0);
  c.toBlob(b=>{ if(b){ showPhoto(b); closeCamera(); } },'image/jpeg',0.85);
}
async function importPhoto(file){
  if(!file) return;
  try{
    // Decode then redraw: strips EXIF (incl. GPS) while honouring orientation.
    const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});
    const scale=Math.min(1,2048/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas');
    c.width=Math.round(bmp.width*scale); c.height=Math.round(bmp.height*scale);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    c.toBlob(b=>{ if(b){ showPhoto(b); closeCamera(); } },'image/jpeg',0.85);
  }catch(e){ toast('That file could not be read as an image.'); }
}
document.addEventListener('visibilitychange',()=>{ if(document.hidden) stopStream(); });

'''
    app = must_sub(r'function openCamera\(\)\{.*?(?=function submitReport)', cam_js, app,
                   'openCamera/closeCamera/capturePhoto → getUserMedia implementation')

    # submitReport: release the captured blob too
    m = re.search(r"function submitReport\(\)\{.*?\n\}", app, re.S)
    if not m: sys.exit('✗ submitReport() not found. Nothing written.')
    body = m.group(0).replace("document.getElementById('photoBox').style.display='none';", 'clearPhoto();', 1)
    app = app[:m.start()] + body + app[m.end():]
    report.append('  ✓ submitReport() clears captured photo')

    # Keyless OpenStreetMap tiles (+ required attribution, origin-only referrer)
    app = must_sub(r"map=L\.map\('map',\{attributionControl:false\}\)",
                   "map=L.map('map',{attributionControl:true})", app, 'Map attribution enabled (OSM licence)')
    osm = '''L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    // Page is no-referrer; OSM's tile policy needs a Referer, so send origin only (no path).
    referrerPolicy:'strict-origin-when-cross-origin'
  })'''
    app = must_sub(r"L\.tileLayer\('https://\{s\}\.basemaps\.cartocdn\.com/dark_all/\{z\}/\{x\}/\{y\}\{r\}\.png',\{.*?\}\)",
                   osm, app, 'CARTO tiles → keyless OpenStreetMap tile layer')

    wiring = '''document.getElementById('btnCapture').addEventListener('click',capturePhoto);
  document.getElementById('btnFlipCam').addEventListener('click',flipCamera);
  document.getElementById('btnUploadPhoto').addEventListener('click',()=>document.getElementById('photoFile').click());
  document.getElementById('photoFile').addEventListener('change',e=>{ importPhoto(e.target.files[0]); e.target.value=''; });'''
    app = must_replace("document.getElementById('btnCapture').addEventListener('click',capturePhoto);",
                       wiring, app, 'Flip / library buttons wired (no inline handlers)')
    ap.write_text(app, encoding='utf-8')

# ─────────────────────────────── admin.html ───────────────────────────────
dp, admin = load('admin.html')
if f'{MARK}:gate' in admin:
    report.append('admin.html already patched — skipped')
else:
    report.append('admin.html')
    admin_css = f'''/* {MARK}:gate */
html.locked body>*:not(#accessGate){{visibility:hidden}}
#accessGate{{position:fixed;inset:0;z-index:5000;background:rgba(3,6,7,.96);display:flex;align-items:center;justify-content:center;padding:20px}}
html:not(.locked) #accessGate{{display:none}}
.gate-box{{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:26px;width:100%;max-width:380px}}
.gate-box h2{{font-size:1.05rem;color:var(--warn);margin-bottom:6px}}
.gate-box p{{font-size:.76rem;color:var(--muted);line-height:1.5;margin-bottom:16px}}
.gate-box input{{width:100%;padding:11px 13px;background:rgba(7,12,14,.8);border:1px solid var(--border);color:var(--text);
  border-radius:10px;font-size:.9rem;letter-spacing:.08em;outline:none;margin-bottom:10px}}
.gate-box input:focus{{border-color:var(--warn)}}
.gate-box button{{width:100%;background:var(--warn);color:#1a1203;border:none;padding:12px;border-radius:10px;font-weight:800;cursor:pointer}}
#gateErr{{font-size:.72rem;color:#fca5a5;min-height:1.1em;margin-top:8px}}
/* Alderman briefing */
.briefing{{border-bottom:1px solid var(--border);padding:12px 24px;display:flex;flex-wrap:wrap;align-items:center;gap:10px}}
.briefing h3{{font-size:.8rem;color:var(--warn);margin-right:6px}}
.briefing label{{font-size:.68rem;color:var(--muted);display:flex;align-items:center;gap:6px}}
.briefing .grid-select{{padding:6px 9px}}
#briefSummary{{flex-basis:100%;font-size:.74rem;color:var(--text);line-height:1.55}}
'''
    admin = must_sub(r'</style>', admin_css + '</style>', admin, 'Gate + briefing CSS')

    gate_html = f'''<body>
  <script>
document.documentElement.classList.add('locked');
/* Alderman briefing filters */
function briefingFilter(list){{
  if(!document.getElementById('fWard')) return list;
  const ward=document.getElementById('fWard').value,
        status=document.getElementById('fStatus').value,
        stage=document.getElementById('fStage').value,
        risk=document.getElementById('fSlaRisk').checked;
  return list.filter(t=>(ward==='All' || (t.ward||'Ward 4')===ward)
    && (status==='All' || t.status===status)
    && (stage==='All' || t.stage===stage)
    && (!risk || (!t.slaOk && t.stage!=='RESOLVED & AUDITED' && t.stage!=='Resolved')));
}}
function briefingText(list){{
  const ward=document.getElementById('fWard').value;
  const count=s=>list.filter(t=>t.status===s).length;
  const atRisk=list.filter(t=>!t.slaOk && t.stage!=='Resolved' && t.stage!=='RESOLVED & AUDITED');
  let txt=`${{ward==='All'?'All wards':ward}}: ${{list.length}} ticket(s) — ${{count('Critical')}} critical, ${{count('Warning')}} warning, ${{count('Resolved')}} resolved. `;
  txt+= atRisk.length ? `SLA at risk: ${{atRisk.map(t=>t.title+' ('+t.sla+')').join('; ')}}.` : 'No tickets at SLA risk.';
  return txt;
}}
function renderBriefing(list){{
  const el=document.getElementById('briefSummary'); if(el) el.textContent=briefingText(list);
}}
</script>
  <!-- {MARK}: staff access gateway -->
  <div id="accessGate" role="dialog" aria-modal="true" aria-labelledby="gateTitle">
    <form class="gate-box" id="gateForm" autocomplete="off">
      <h2 id="gateTitle">Staff access</h2>
      <p>Enter your console access code to open the Municipal Dispatch Console.</p>
      <input id="gateCode" type="password" inputmode="text" autocapitalize="characters" aria-label="Access code" required>
      <button type="submit">Unlock console</button>
      <div id="gateErr" aria-live="polite"></div>
    </form>
  </div>'''
    admin = must_sub(r'<body>', gate_html, admin, 'Access gateway modal markup')

    brief_html = '''<section class="briefing" id="briefing" aria-label="Alderman briefing">
    <h3>Alderman briefing</h3>
    <label>Ward
      <select class="grid-select" id="fWard"><option value="All">All wards</option><option>Ward 4</option></select></label>
    <label>Severity
      <select class="grid-select" id="fStatus"><option>All</option><option>Critical</option><option>Warning</option><option>Resolved</option></select></label>
    <label>Stage
      <select class="grid-select" id="fStage"><option>All</option><option>Critical</option><option>Assigned to Public Works</option><option>In Progress</option><option>Resolved</option><option>RESOLVED &amp; AUDITED</option></select></label>
    <label><input type="checkbox" id="fSlaRisk"> SLA at risk only</label>
    <button class="btn btn-ghost" id="briefCopy" type="button">Copy briefing</button>
    <div id="briefSummary"></div>
  </section>

  <div class="overview">'''
    admin = must_sub(r'<div class="overview">', brief_html, admin, 'Alderman briefing filter bar')

    admin = must_replace(
        "const visible = activeDept==='All' ? tickets : tickets.filter(t=>deptLabel(t.category)===activeDept);",
        "const visible = briefingFilter(activeDept==='All' ? tickets : tickets.filter(t=>deptLabel(t.category)===activeDept));\n  renderBriefing(visible);",
        admin, 'renderTickets() respects briefing filters')

    gate_js = '''<script>
/* CITIXEN-FIXPACK:gate
   Codes are stored as SHA-256 hashes, not plaintext. This is a UI curtain, NOT access control:
   anything shipped to the browser can be read. Put real auth in front of /admin (see README note). */
const ACCESS={
  'c5ee0bdccf0ab935906ddf15f2b426b2804f157ebd2613b1a3ef0d6d2bb5cb50':{role:'Administrator',ward:'All'},
  'a5304d3c74298671ba095d176789b75acff86e25512a28348c41706f8e77d97c':{role:'Dispatcher',ward:'All'},
  'ed9ee0096baf6747c061d312f0ae532cd91d35cb8063931a1f9a1b90cb07ef4e':{role:'Alderman — Ward 4',ward:'Ward 4'}
};
async function sha256(s){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function unlock(session){
  document.documentElement.classList.remove('locked');
  const op=document.querySelector('.operator');
  if(op && op.lastChild) op.lastChild.textContent=' Signed in: '+session.role;
  const w=document.getElementById('fWard'); if(w){ w.value=session.ward; }
  if(typeof renderTickets==='function') renderTickets();
  if(typeof map!=='undefined' && map) setTimeout(()=>map.invalidateSize(),60);
}
(function(){
  try{ const s=JSON.parse(sessionStorage.getItem('citixen_staff')||'null'); if(s && s.role){ unlock(s); return; } }catch(e){}
  document.getElementById('gateCode').focus();
})();
document.getElementById('gateForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const input=document.getElementById('gateCode'), err=document.getElementById('gateErr');
  if(!(window.crypto && crypto.subtle)){ err.textContent='This console must be opened over HTTPS.'; return; }
  const hit=ACCESS[await sha256(input.value.trim().toUpperCase())];
  if(!hit){ err.textContent='That code is not recognised.'; input.select(); return; }
  try{ sessionStorage.setItem('citixen_staff',JSON.stringify(hit)); }catch(_){}
  input.value=''; err.textContent='';
  unlock(hit);
});

['fWard','fStatus','fStage','fSlaRisk'].forEach(id=>document.getElementById(id).addEventListener('change',()=>renderTickets()));
document.getElementById('briefCopy').addEventListener('click',async()=>{
  const txt=document.getElementById('briefSummary').textContent;
  try{ await navigator.clipboard.writeText(txt); toast('Briefing copied'); }catch(e){ toast('Copy failed — select the text manually'); }
});
</script>
</body>'''
    idx = admin.rfind('</body>')
    if idx < 0: sys.exit('✗ </body> not found in admin.html. Nothing written.')
    admin = admin[:idx] + gate_js + admin[idx+len('</body>'):]
    report.append('  ✓ Gate (hashed codes: CITIXEN2026 / DISPATCH2026 / WARD42026) + briefing logic')
    dp.write_text(admin, encoding='utf-8')

# ───────────────────────────── syntax check ──────────────────────────────
report.append('\nSyntax check (inline <script> blocks via node --check):')
node = shutil.which('node')
for name in ('index.html', 'app.html', 'admin.html'):
    html = (ROOT / name).read_text(encoding='utf-8')
    blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S)
    if not node:
        report.append(f'  – {name}: node not installed, skipped ({len(blocks)} blocks)'); continue
    ok = True
    for i, b in enumerate(blocks):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
            f.write(b)
        r = subprocess.run([node, '--check', f.name], capture_output=True, text=True)
        if r.returncode:
            ok = False
            report.append(f'  ✗ {name} block {i}: ' + r.stderr.strip().splitlines()[-1])
    if ok: report.append(f'  ✓ {name}: {len(blocks)} block(s) parse cleanly')

print('\n'.join(report))
print('''
Next:
  git diff --stat
  git add index.html app.html admin.html
  git commit -m "Fix index.html JS syntax error; QR → /app; WebRTC camera + OSM tiles; admin access gate + Alderman briefing"
  git push origin main''')
