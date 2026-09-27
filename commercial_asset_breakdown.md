# CITIXEN UX™ — Commercial Asset Breakdown & Modular Design Library

Source video: `CITUX.mp4` (1080×1920, 30fps, 59.35s, AI-generated B-roll commercial).
Extraction method: frames sampled at 2-second resolution + audio track pulled; no
speech-to-text tool was available in the extraction environment, so **no verbatim
dialogue/VO transcript exists for this asset** — treat any future transcript claim
about this video as unverified until it's actually transcribed.

This document is the permanent, honest record of what that footage actually
contains, plus the modular design assets that can legitimately be built from it —
combined with what's *already real and live* in `admin.html` and already-approved
in `marketing_assets.md`. Anything below marked **[UNVERIFIED / DO NOT USE]** is
flagged because the source footage does not actually support it.

---

## Part 1 — Honest Video Breakdown

### 1.1 The Four Core Setups

The video is not ten unique scenes — it is **four distinct physical setups**,
intercut with one recurring transition motif (see 1.2) used at least three times,
and it ends mid-motif with no logo card or CTA slate.

| # | Setup | Timestamp(s) | What's Actually Shown | Usable As |
|---|---|---|---|---|
| 1 | **Phone UI Insert** | 0:00–0:02 | Close-up of a hand holding a phone on the CITIZEN report form — "Lighting & Utilities" category selected, a ticket card, a "Publish Report" button, bottom nav (Report/Map/Analytics) | Product-in-hand B-roll for a slide needing a human holding the app. The only shot in the video with real, on-brand UI. |
| 2 | **Alley Walk / Photograph** | 0:06–0:16, repeated 0:18–0:59 | A man alone on a rainy night street: standing under a streetlamp, raising his phone to photograph something off-camera, walking away from camera | The emotional "citizen notices a hazard" beat. Reused 3+ times in the source edit — do not assume it represents 3 different moments; it's the same setup recut. |
| 3 | **Utility Truck Field Response** | ~0:14 | A municipal bucket truck at night, crew working on a streetlamp | The only genuine "field crew physically responding" shot. Pairs directly with the "Field Response" side of the +34%/−18% capital-shift story in `marketing_assets.md`. |
| 4 | **Ward 4 Dispatch Console** | 0:42–0:52 | A dark PostGIS-style desktop map UI: zigzag teal route lines labeled "Ward 4" (×2), a hand interacting near a pulsing radius marker labeled "New Route Request" (×2), a bottom stats strip including "Route Optimized" | The only other shot with legible, real-sounding copy. Good B-roll for an ops/dispatch-focused slide, but the surrounding numeric stats are not reliably legible and should not be quoted as data. |

**What the footage does NOT show**, despite being implied by earlier extraction
prompts — flagged explicitly so nobody builds a slide around it:

- **[UNVERIFIED / DO NOT USE]** No anonymity/zero-knowledge visual (no lock icons, no "no account" messaging on screen).
- **[UNVERIFIED / DO NOT USE]** No AR-inside-a-device-screen demo — the "AR grid" is a full-frame environmental VFX overlay, not a phone AR feature.
- **[UNVERIFIED / DO NOT USE]** No closing logo card, tagline card, or CTA/URL card — the edit simply ends on the alley-walk shot.
- **[UNVERIFIED / DO NOT USE]** No QR-scan shot, no gauge/dial UI shot, no install/PWA-add-to-home-screen shot.

### 1.2 The "Mint Glow" Infrastructure Activation Motif

This is the one motif genuinely worth extracting as a reusable visual language.

**What happens on screen:** a dark, near-black ("obsidian") rainy street with a
single warm practical streetlamp. As the man walks, the streetlamp and the
ground beneath him ignite into a **teal/mint wireframe grid** — vertical light
rays radiate up from the fixture, the pavement becomes a glowing grid of lines,
and (in the more elaborate cuts) floating HUD boxes connected by thin node-lines
appear to read data off the streetlamp.

**Color-match flag:** the glow in the raw footage reads as a **cyan-leaning
teal/spring-green**, not a clean match to the app's `#00ff88` Electric Lime
token. Side-by-side, the two don't sit identically — if this footage is cut next
to real product screenshots (which are `#00ff88`), either re-grade the footage
toward `#00ff88` or accept the mismatch consciously. Do not assume they match
without checking.

**Modular takeaway:** the reusable idea is *"dark obsidian street → single
Electric Lime grid line ignites"* — not the literal footage. As a slide asset,
this is far more useful recreated as a clean vector/CSS treatment at `#00ff88`
(see Part 2.2) than as a re-encoded video crop, since the in-video HUD text is
illegible at any resolution actually needed for a slide.

### 1.3 Genuine Copy vs. AI-Generated Noise

| Status | Text | Where |
|---|---|---|
| ✅ **Genuine, usable** | "CITIXEN UX" | Aerial title card, phone UI insert |
| ✅ **Genuine, usable** | "Lighting & Utilities," "Publish Report" | Phone UI insert |
| ✅ **Genuine, usable** | "Ward 4" | Dispatch console (appears twice) |
| ✅ **Genuine, usable** | "New Route Request" | Dispatch console (appears twice) |
| ✅ **Genuine, usable** | "Route Optimized" | Dispatch console stats strip |
| ⚠️ **Incomplete, unverifiable** | "UPGRADE YOUR CIVIC..." | Aerial title card — cut off at frame edge, rest of the line unknown |
| 🚫 **AI-generation noise — do not use** | "Leedin Yeaser Freafity," "Uporo-Stary Frajfsdary," "Frezet Route," ticket IDs, secondary dashboard labels | Phone UI insert, dispatch console margins | 

**Rule for this repo going forward:** only the ✅ rows above may be quoted as
"copy extracted from the commercial." Anything else needs to be written fresh —
pull from `marketing_assets.md`'s approved copy blocks or `admin.html`'s live
DOM labels instead of the video.

---

## Part 2 — Modular "LEGO" Asset Library

Everything in this section is grounded in either (a) the honest video findings
above, (b) the live DOM in `admin.html`, or (c) the approved copy in
`marketing_assets.md`. Nothing here is invented to fill a gap.

### 2.1 UI Primitives (from live `admin.html`)

These are real, currently-rendered elements — safe to screenshot, safe to quote
verbatim, safe to rebuild as slide components because they're pulled from
running code, not from the video:

| Primitive | Live source | Exact label / id |
|---|---|---|
| Numeric metric card | `admin.html` `.overview .metric` | "Ward Health Index" → `#wardHealthValue` (e.g. 88%) |
| Numeric metric card | `admin.html` `.overview .metric` | "Active Dispatch Capacity" → `#capValue` |
| Fraction readout | `admin.html` `.overview .metric` | "Weekly Resolve Rate" → `#resolveFraction` (e.g. 84/91) |
| Dense table cell | `admin.html` `.analytics-dense .dense-cell` | "Dispatch Severity Queues" (Critical/High/Standard table) |
| Dense table cell | `admin.html` `.analytics-dense .dense-cell` | "CapEx Scoping Ledger — Track 2" → `#capexTotal` ($482,600) |
| Dense table cell | `admin.html` `.analytics-dense .dense-cell` | "Crew / Vendor Routing" → `#woActive` |
| Action button | `admin.html` `#printWardReport` | "Print My Ward Report" (triggers `window.print()`) |
| Severity tokens | `admin.html` `:root` | Critical `#ff4444` · Warning `#ffbb00` · Resolved/On-Track `#00ff88` |
| Brand tokens | `admin.html` / `index.html` / `app.html` `:root` | `--brand-mint:#00ff88`, `--bg-obsidian:#080c0a`, `--bg-card:#0f1713`, `--border-muted:rgba(255,255,255,0.08)` |

### 2.2 Backgrounds & Motion Primitives (from the video, re-specified for slide use)

Since the raw footage's HUD text is unusable, these are specified as **build
instructions**, not as video crops:

- **"Grid Ignition" background** — full-bleed obsidian (`#080c0a`) panel, a single
  thin `#00ff88` grid-line pattern fading in from one anchor point (bottom-third
  of frame), opacity ramp 0% → 40% over ~600ms. Use as a section-break slide
  background, never with text overlapping the grid's densest area.
- **"Node Pulse" accent** — a single `#00ff88` dot with a soft radial glow and a
  thin connecting line to a label chip; matches the map's "New Route Request"
  pulsing-radius marker. Use as a map/route callout, not as decorative clutter.
- **Aerial ward-grid still** — a static, non-animated version of the aerial city
  shot (dusk skyline + glowing street grid) works as a cover-slide background
  *without* relying on the (partially cut-off) title text baked into the video.

### 2.3 Slide Storyboards (cross-referenced against `marketing_assets.md`)

These three storyboards only use assets confirmed real in Part 1 and Part 2.1/2.2
— they intentionally do not restate the full 10-slide deck, 60-second script, or
executive memo already finalized in `marketing_assets.md`; they show where the
video assets slot into that existing package.

**A. Executive / Municipal Pitch (supplements `marketing_assets.md` Slides 5–7)**
1. Cover — Aerial ward-grid still + `logo.svg`
2. Field Response — Utility Truck Field Response still, paired with the
   +34% Field / −18% Admin capital-shift stat (Slide 6 of `marketing_assets.md`)
3. Dispatch in Action — Ward 4 Dispatch Console still ("Ward 4," "Route
   Optimized" copy is genuine) next to a live screenshot of `admin.html`'s
   Dispatch Severity Queues table

**B. Citizen Trust / Product Deep-Dive (supplements Slide 8 of `marketing_assets.md`)**
1. Phone UI Insert still — the one shot that's actually real product UI
2. Live `index.html` gateway screenshot (Ward Health Index gauge, resolve
   fraction) — *not* the video, since the video has no privacy/anonymity visual
3. Text-only "Zero-Data Retention" callout, copied verbatim from
   `marketing_assets.md` Slide 8 — no video asset supports this beat, so none is used

**C. Field / Staff Dispatch Guide (net-new, not in `marketing_assets.md`)**
1. Utility Truck Field Response still — cold open
2. Ward 4 Dispatch Console still — "Route Optimized" as the section header
3. Live `admin.html` screenshot: Crew / Vendor Routing dense-cell +
   "Print My Ward Report" button, since that's the console feature staff
   actually touch after a route is approved

### 2.4 Cross-Reference: Visual Assets vs. Patent-Covered Functionality

The two motifs this document treats as reusable design assets happen to map
directly onto the two provisional patents recorded in `marketing_assets.md`
Part 4 — worth knowing so a future deck doesn't pair the wrong visual with
the wrong claim:

| Visual asset (this document) | Maps to | Patent |
|---|---|---|
| Phone UI Insert (1.1 #1), "Grid Ignition" background (2.2) | Location-verified capture, moderation, district switchboard | **Patent 1** — Citizen UX & Resident Switchboard Layer, App. No. 64/160,168 |
| Ward 4 Dispatch Console still (1.1 #4), "Node Pulse" route accent (2.2), CapEx Scoping Ledger primitive (2.1) | Spatial stream processing, material cataloging, structural degradation evaluation, CapEx scoping | **Patent 2** — Municipal Data Engine & CapEx Scoping Layer, App. No. 64/163,426 |

Filing details as provided by applicant.

---

## Notes for Future Extraction Work

- If a cleaner transcript or higher-resolution re-extraction of `CITUX.mp4` is
  ever done, update Part 1.1's table and Part 1.3's noise list before reusing
  any "new" text found — don't append it straight to Part 2 without the same
  genuine/noise triage this document applied.
- If the source video is re-graded to match `#00ff88` exactly, note that here
  before treating the footage as color-matched brand asset.
