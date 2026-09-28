const pptxgen = require("pptxgenjs");

// ===== CITIXEN UX brand tokens (pulled from deck.html :root) =====
const BG      = "080C0A"; // obsidian
const CARD    = "0F1713"; // card bg
const BORDER  = "263029"; // approximation of rgba(255,255,255,.08) over obsidian
const MINT    = "00FF88";
const MINT_BG = "0E2119"; // approximation of rgba(0,255,136,.08) over obsidian
const TEXT    = "F8FAFC";
const MUTED   = "8E9FA8";
const FONT    = "Arial"; // matches brand's system-sans stack, safe-list font

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5 in
const W = 13.33, H = 7.5;

pres.defineSlideMaster({
  title: "CITIXEN_MASTER",
  background: { color: BG },
});

function newSlide() {
  const s = pres.addSlide({ masterName: "CITIXEN_MASTER" });
  return s;
}

function shield(slide, x, y, size, color) {
  // simple shield-like shape using FREEFORM approximation via ROUNDED rect + triangle is complex;
  // use a pentagon-ish "shield" via CHEVRON substitute is inaccurate, so use a simple circle badge instead
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w: size, h: size, rectRadius: size * 0.18,
    fill: { color: BG },
    line: { color, width: 1.5 },
  });
}

function eyebrowAndNumber(slide, label, num) {
  slide.addText(label, {
    x: 0.6, y: 0.45, w: 8, h: 0.35,
    fontFace: "Courier New", fontSize: 11, bold: true, color: MINT,
    charSpacing: 2, isTextBox: true, margin: 0,
  });
  slide.addText(num, {
    x: W - 2.6, y: 0.45, w: 2.0, h: 0.35,
    fontFace: "Courier New", fontSize: 10, color: MUTED, align: "right",
    isTextBox: true, margin: 0,
  });
}

function title(slide, runs, y = 0.85, size = 30) {
  // runs: array of {text, color}
  slide.addText(
    runs.map(r => ({ text: r.text, options: { color: r.color || TEXT, bold: true } })),
    { x: 0.6, y, w: W - 1.2, h: 1.0, fontFace: FONT, fontSize: size, isTextBox: true, margin: 0, valign: "top" }
  );
}

function lede(slide, text, y, w = 9.5) {
  slide.addText(text, {
    x: 0.6, y, w, h: 0.9,
    fontFace: FONT, fontSize: 14, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.35,
  });
}

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.12,
    fill: { color: opts.fill || CARD },
    line: { color: opts.lineColor || BORDER, width: opts.lineWidth || 1 },
  });
}

function tagPill(slide, x, y, text) {
  const w = 0.22 + text.length * 0.075;
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h: 0.28, rectRadius: 0.14,
    fill: { type: "none" }, line: { color: MINT, width: 1, transparency: 30 },
  });
  slide.addText(text, {
    x, y, w, h: 0.28, fontFace: "Courier New", fontSize: 9, bold: true, color: MINT,
    align: "center", valign: "middle", isTextBox: true, margin: 0, charSpacing: 1,
  });
  return w;
}

// ================= SLIDE 1 — TITLE =================
{
  const s = newSlide();
  // faint grid decoration lines (subtle, brand mint, low opacity)
  for (let i = 0; i < 6; i++) {
    s.addShape(pres.ShapeType.line, {
      x: 0.5 + i * 2.2, y: 5.0, w: 0, h: 2.5,
      line: { color: MINT, width: 1, transparency: 80 },
    });
  }
  shield(s, W / 2 - 0.35, 1.15, 0.7, MINT);
  s.addText("CIVIC INTELLIGENCE PLATFORM", {
    x: 0, y: 2.05, w: W, h: 0.3, align: "center",
    fontFace: "Courier New", fontSize: 11, bold: true, color: MINT, charSpacing: 2,
    isTextBox: true, margin: 0,
  });
  s.addText(
    [
      { text: "CITIXEN UX", options: { color: TEXT } },
      { text: "™", options: { color: MINT, fontSize: 20 } },
    ],
    { x: 0, y: 2.45, w: W, h: 0.9, align: "center", fontFace: FONT, fontSize: 44, bold: true, isTextBox: true, margin: 0 }
  );
  s.addText("Upgrade Your Civic Experience", {
    x: 0, y: 3.35, w: W, h: 0.45, align: "center",
    fontFace: FONT, fontSize: 18, bold: true, color: TEXT, isTextBox: true, margin: 0,
  });
  s.addText("ANONYMOUS · REAL-TIME RESOLUTION", {
    x: 0, y: 3.78, w: W, h: 0.3, align: "center",
    fontFace: "Courier New", fontSize: 10, bold: true, color: MINT, charSpacing: 1.5, isTextBox: true, margin: 0,
  });
  s.addText(
    "Turning citizen reports into resolved infrastructure — anonymously, in real time, and with the capital-planning data to prove it.",
    { x: W / 2 - 4.5, y: 4.15, w: 9, h: 0.6, align: "center", fontFace: FONT, fontSize: 13, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.3 }
  );
  const pillW = 1.9;
  s.addShape(pres.ShapeType.roundRect, {
    x: W / 2 - pillW / 2, y: 4.95, w: pillW, h: 0.42, rectRadius: 0.21,
    fill: { color: MINT_BG }, line: { color: MINT, width: 1, transparency: 40 },
  });
  s.addText("citixenux.com", {
    x: W / 2 - pillW / 2, y: 4.95, w: pillW, h: 0.42, align: "center", valign: "middle",
    fontFace: "Courier New", fontSize: 11, bold: true, color: MINT, isTextBox: true, margin: 0,
  });
}

// ================= SLIDE 2 — THE ADMINISTRATIVE CLOSURE GAP =================
{
  const s = newSlide();
  eyebrowAndNumber(s, "THE PROBLEM", "02 / 10");
  title(s, [{ text: "The " }, { text: "Administrative Closure Gap", color: MINT }]);
  card(s, 0.6, 2.0, W - 1.2, 2.1, { lineColor: MINT, lineWidth: 1.25 });
  s.addText(
    [
      { text: "Legacy 311 and municipal ERP systems suffer from a high ", options: {} },
      { text: '"Administrative Closure Gap"', options: { bold: true } },
      { text: " — where service tickets are marked ", options: {} },
      { text: '"Closed"', options: { italic: true } },
      { text: " or ", options: {} },
      { text: '"Resolved"', options: { italic: true } },
      { text: " in back-office software upon administrative intake, despite zero physical dispatch or field verification taking place.", options: {} },
    ],
    { x: 0.95, y: 2.25, w: W - 1.9, h: 1.6, fontFace: FONT, fontSize: 15, color: TEXT, isTextBox: true, margin: 0, lineSpacingMultiple: 1.4, valign: "middle" }
  );
  card(s, 0.6, 4.35, W - 1.2, 1.35);
  s.addText("KEY TAKEAWAY", {
    x: 0.95, y: 4.55, w: 6, h: 0.3, fontFace: "Courier New", fontSize: 10, bold: true, color: MINT, isTextBox: true, margin: 0, charSpacing: 1,
  });
  s.addText("Legacy systems prioritize administrative throughput over physical field execution.", {
    x: 0.95, y: 4.9, w: W - 1.9, h: 0.7, fontFace: FONT, fontSize: 14, color: TEXT, isTextBox: true, margin: 0,
  });
}

// ================= SLIDE 3 — THREE-MODULE PLATFORM ARCHITECTURE =================
{
  const s = newSlide();
  eyebrowAndNumber(s, "THE PLATFORM", "03 / 10");
  title(s, [{ text: "One Pipeline. " }, { text: "Three Modules.", color: MINT }]);
  const mods = [
    { tag: "MODULE 1 · GATEWAY", h: "Gateway", p: "The public civic web dashboard — jurisdiction auto-detection, live ward-health telemetry, the immutable public ledger, a QR install card, and the Civic Tools drawer. No login required." },
    { tag: "MODULE 2 · PWA REPORTER", h: "PWA Reporter", p: "The zero-account mobile hazard-reporting app — the 4-tier legal stack, fog-of-war spatial grid, live map, and feed. EXIF and GPS are stripped from every photo before it leaves the device." },
    { tag: "MODULE 3 · CONSOLE", h: "Municipal Console", p: "The staff-facing dispatch console — severity-tiered ticket queues, a live GIS dispatch map, SLA tracking, the CapEx scoping ledger, AI-assisted quick-resolve, and printable Ward Reports for council packets." },
  ];
  const colW = (W - 1.2 - 0.4) / 3;
  mods.forEach((m, i) => {
    const x = 0.6 + i * (colW + 0.2);
    card(s, x, 2.15, colW, 3.6);
    tagPill(s, x + 0.25, 2.4, m.tag);
    s.addText(m.h, { x: x + 0.25, y: 2.85, w: colW - 0.5, h: 0.5, fontFace: FONT, fontSize: 15, bold: true, color: TEXT, isTextBox: true, margin: 0 });
    s.addText(m.p, { x: x + 0.25, y: 3.35, w: colW - 0.5, h: 2.2, fontFace: FONT, fontSize: 11.5, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.35 });
  });
}

// ================= SLIDE 4 — DUAL-ENGINE IP ARCHITECTURE =================
{
  const s = newSlide();
  eyebrowAndNumber(s, "CORE TECHNOLOGY · IP ARCHITECTURE", "04 / 10");
  title(s, [{ text: "Dual-Engine " }, { text: "IP Architecture", color: MINT }], 0.85, 26);
  lede(s, "Two provisional filings cover the platform end to end — one governing the citizen-facing capture and moderation layer, one governing the back-end spatial data and capital-scoping engine.", 1.75, W - 1.2);
  const colW = (W - 1.2 - 0.3) / 2;
  const cardY = 2.65, cardH = 4.35;
  // Card 1
  let x = 0.6;
  card(s, x, cardY, colW, cardH, { lineColor: MINT, lineWidth: 1.25 });
  tagPill(s, x + 0.25, cardY + 0.22, "CITIZEN UX LAYER");
  s.addText("Resident Switchboard Layer", { x: x + 0.25, y: cardY + 0.6, w: colW - 0.5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: TEXT, isTextBox: true, margin: 0 });
  s.addText('"System and Method for Location-Verified Civic Intelligence Capture, Moderation, and Real-Time District Management Ledger"', {
    x: x + 0.25, y: cardY + 1.0, w: colW - 0.5, h: 0.8, fontFace: "Courier New", fontSize: 9, color: MUTED, italic: true, isTextBox: true, margin: 0, lineSpacingMultiple: 1.3,
  });
  s.addText("Powers the front-end Citizen UX: location verification, moderation, and the real-time district management switchboard.", {
    x: x + 0.25, y: cardY + 1.9, w: colW - 0.5, h: 0.85, fontFace: FONT, fontSize: 11, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.3,
  });
  s.addText([{ text: "U.S. Provisional Patent Application No. ", options: {} }, { text: "64/160,168", options: { bold: true } }], {
    x: x + 0.25, y: cardY + 2.85, w: colW - 0.5, h: 0.35, fontFace: FONT, fontSize: 12, color: TEXT, isTextBox: true, margin: 0,
  });
  s.addText("Filed September 22, 2026", { x: x + 0.25, y: cardY + 3.25, w: colW - 0.5, h: 0.3, fontFace: "Courier New", fontSize: 9, color: MUTED, isTextBox: true, margin: 0 });
  // Card 2
  x = 0.6 + colW + 0.3;
  card(s, x, cardY, colW, cardH, { lineColor: MINT, lineWidth: 1.25 });
  tagPill(s, x + 0.25, cardY + 0.22, "MUNICIPAL SPATIAL TELEMETRY");
  s.addText("Municipal Data Engine & CapEx Scoping", { x: x + 0.25, y: cardY + 0.6, w: colW - 0.5, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: TEXT, isTextBox: true, margin: 0 });
  s.addText('"Hardware-Agnostic Spatial Stream Processing Engine for Automated Material Cataloging, Structural Degradation Evaluation, and Dynamic Cost-Linked Infrastructure Scoping"', {
    x: x + 0.25, y: cardY + 1.0, w: colW - 0.5, h: 0.9, fontFace: "Courier New", fontSize: 9, color: MUTED, italic: true, isTextBox: true, margin: 0, lineSpacingMultiple: 1.3,
  });
  s.addText("Powers back-end data stripping, material cataloging, structural degradation evaluation, and automated CapEx scoping.", {
    x: x + 0.25, y: cardY + 2.0, w: colW - 0.5, h: 0.85, fontFace: FONT, fontSize: 11, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.3,
  });
  s.addText([{ text: "U.S. Provisional Patent Application No. ", options: {} }, { text: "64/163,426", options: { bold: true } }], {
    x: x + 0.25, y: cardY + 2.95, w: colW - 0.5, h: 0.35, fontFace: FONT, fontSize: 12, color: TEXT, isTextBox: true, margin: 0,
  });
  s.addText("Filed September 27, 2026", { x: x + 0.25, y: cardY + 3.35, w: colW - 0.5, h: 0.3, fontFace: "Courier New", fontSize: 9, color: MUTED, isTextBox: true, margin: 0 });
  s.addText("Filing details as provided by applicant.", { x: 0.6, y: 7.1, w: W - 1.2, h: 0.3, fontFace: "Courier New", fontSize: 8, color: MUTED, isTextBox: true, margin: 0 });
}

// ================= SLIDE 5 — FIELD VERIFICATION =================
{
  const s = newSlide();
  eyebrowAndNumber(s, "ACCOUNTABILITY", "05 / 10");
  title(s, [{ text: "Field Verification, " }, { text: "Not Ghost Closures", color: MINT }], 0.85, 26);
  lede(s, "A ticket cannot close on paperwork alone. Every resolution requires a timestamped, EXIF-verified proof photo from the crew on site — pushed automatically to the public feed.", 1.85, W - 1.2);
  const colW = (W - 1.2 - 0.3) / 2;
  let x = 0.6;
  card(s, x, 2.85, colW, 2.6);
  s.addText("BEFORE", { x: x + 0.3, y: 3.1, w: colW - 0.6, h: 0.3, fontFace: "Courier New", fontSize: 10, bold: true, color: MINT, isTextBox: true, margin: 0, charSpacing: 1 });
  s.addText("Dispatcher marks a ticket “Resolved” from a desk. No photo, no timestamp, no way to confirm a crew was ever on site.", {
    x: x + 0.3, y: 3.5, w: colW - 0.6, h: 1.7, fontFace: FONT, fontSize: 13, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.4,
  });
  x = 0.6 + colW + 0.3;
  card(s, x, 2.85, colW, 2.6, { lineColor: MINT, lineWidth: 1.25 });
  s.addText("WITH CITIXEN UX", { x: x + 0.3, y: 3.1, w: colW - 0.6, h: 0.3, fontFace: "Courier New", fontSize: 10, bold: true, color: MINT, isTextBox: true, margin: 0, charSpacing: 1 });
  s.addText("Closure requires a proof photo. EXIF timestamp + location are verified server-side, then the resolution posts to the resident's public feed automatically.", {
    x: x + 0.3, y: 3.5, w: colW - 0.6, h: 1.7, fontFace: FONT, fontSize: 13, color: TEXT, isTextBox: true, margin: 0, lineSpacingMultiple: 1.4,
  });
}

// ================= SLIDE 6 — CAPITAL PLANNING: THE IMMUTABLE PUBLIC LEDGER =================
{
  const s = newSlide();
  eyebrowAndNumber(s, "CAPITAL PLANNING", "06 / 10");
  title(s, [{ text: "The " }, { text: "Immutable Public Ledger", color: MINT }], 0.85, 26);
  lede(s, "Every field-verified report feeds a live CapEx-scoping ledger — converting report density and condition data into concrete dollar figures the city can plan a capital budget around.", 1.85, W - 1.2);
  const colW = (W - 1.2 - 0.4) / 3;
  const rows = [
    { label: "SCOPED CAPITAL SPEND", value: "$482,600", sub: "CapEx Scoping Ledger · Track 2, current cycle", accent: true },
    { label: "GRID COVERAGE", value: "55%", sub: "Blocks field-verified across active wards" },
    { label: "POPULATION COVERED", value: "52k", sub: "Residents represented in live ledger inputs" },
  ];
  rows.forEach((r, i) => {
    const x = 0.6 + i * (colW + 0.2);
    card(s, x, 2.6, colW, 2.1, r.accent ? { lineColor: MINT, lineWidth: 1.25 } : {});
    s.addText(r.label, { x: x + 0.2, y: 2.85, w: colW - 0.4, h: 0.3, align: "center", fontFace: "Courier New", fontSize: 8.5, color: MUTED, isTextBox: true, margin: 0, charSpacing: 1 });
    s.addText(r.value, { x: x + 0.2, y: 3.2, w: colW - 0.4, h: 0.6, align: "center", fontFace: FONT, fontSize: r.value.length > 5 ? 24 : 30, bold: true, color: MINT, isTextBox: true, margin: 0 });
    s.addText(r.sub, { x: x + 0.2, y: 3.95, w: colW - 0.4, h: 0.6, align: "center", fontFace: FONT, fontSize: 10, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.3 });
  });
  s.addText("Priced as one flat $1.00 / resident / year municipal contract — no per-ticket fee, no seat licenses, no dispatch surcharge.", {
    x: 0.6, y: 5.1, w: W - 1.2, h: 0.4, align: "center", fontFace: "Courier New", fontSize: 9, color: MUTED, isTextBox: true, margin: 0,
  });
}

// ================= SLIDE 7 — ROI IMPACT =================
{
  const s = newSlide();
  eyebrowAndNumber(s, "ROI", "07 / 10");
  title(s, [{ text: "Same Budget. " }, { text: "Different Split.", color: MINT }]);
  lede(s, "Same headcount, same dollars — reallocated once triage, routing, and reporting stop consuming staff hours. These are independent before/after deltas measured against the same budget cycle, not a fixed-sum split.", 1.85, W - 1.2);
  // Two independent stat callouts (not a 100%-stacked bar): these are separate
  // before/after deltas, not complementary shares of a fixed total.
  const colW = 4.6, cardY = 3.1, cardH = 2.4, gap = 0.5;
  const totalW = colW * 2 + gap;
  let x = W / 2 - totalW / 2;
  card(s, x, cardY, colW, cardH, { lineColor: MINT, lineWidth: 1.25 });
  s.addText("FIELD EXECUTION CAPACITY", { x: x + 0.2, y: cardY + 0.3, w: colW - 0.4, h: 0.3, align: "center", fontFace: "Courier New", fontSize: 9.5, color: MUTED, isTextBox: true, margin: 0, charSpacing: 1 });
  s.addText("+34%", { x: x + 0.2, y: cardY + 0.75, w: colW - 0.4, h: 1.0, align: "center", fontFace: FONT, fontSize: 46, bold: true, color: MINT, isTextBox: true, margin: 0 });
  s.addText("Capital reallocated to field repair crews", { x: x + 0.3, y: cardY + 1.75, w: colW - 0.6, h: 0.5, align: "center", fontFace: FONT, fontSize: 11, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.3 });
  x += colW + gap;
  card(s, x, cardY, colW, cardH);
  s.addText("ADMINISTRATIVE OVERHEAD", { x: x + 0.2, y: cardY + 0.3, w: colW - 0.4, h: 0.3, align: "center", fontFace: "Courier New", fontSize: 9.5, color: MUTED, isTextBox: true, margin: 0, charSpacing: 1 });
  s.addText("−18%", { x: x + 0.2, y: cardY + 0.75, w: colW - 0.4, h: 1.0, align: "center", fontFace: FONT, fontSize: 46, bold: true, color: MINT, isTextBox: true, margin: 0 });
  s.addText("Reduction in desk triage & routing burden", { x: x + 0.3, y: cardY + 1.75, w: colW - 0.6, h: 0.5, align: "center", fontFace: FONT, fontSize: 11, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.3 });
}

// ================= SLIDE 8 — INTEGRATION =================
{
  const s = newSlide();
  eyebrowAndNumber(s, "INTEGRATION", "08 / 10");
  title(s, [{ text: "Built to Plug Into " }, { text: "What You Already Run", color: MINT }], 0.85, 26);
  lede(s, "CITIXEN UX is designed as an integration layer, not a replacement — council-facing records and back-office systems stay where they are.", 1.85, W - 1.2);
  const colW = (W - 1.2 - 0.3) / 2;
  let x = 0.6;
  card(s, x, 2.75, colW, 2.9);
  tagPill(s, x + 0.3, 3.0, "AGENDA / RECORDS");
  s.addText("Legistar-Compatible Export", { x: x + 0.3, y: 3.4, w: colW - 0.6, h: 0.45, fontFace: FONT, fontSize: 15, bold: true, color: TEXT, isTextBox: true, margin: 0 });
  s.addText("Ward reports and capital-ledger summaries export in a format built to attach directly to council agenda packets.", {
    x: x + 0.3, y: 3.9, w: colW - 0.6, h: 1.6, fontFace: FONT, fontSize: 12, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.35,
  });
  x = 0.6 + colW + 0.3;
  card(s, x, 2.75, colW, 2.9);
  tagPill(s, x + 0.3, 3.0, "BACK OFFICE");
  s.addText("Municipal ERP Integration Layer", { x: x + 0.3, y: 3.4, w: colW - 0.6, h: 0.45, fontFace: FONT, fontSize: 15, bold: true, color: TEXT, isTextBox: true, margin: 0 });
  s.addText("Work-order and capital data sync outward via API — designed to complement existing asset-management and ERP systems, not replace them.", {
    x: x + 0.3, y: 3.9, w: colW - 0.6, h: 1.6, fontFace: FONT, fontSize: 12, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.35,
  });
  s.addText("Integration availability varies by municipal ERP vendor and Legistar deployment — confirm specific compatibility during technical scoping, not at contract signature.", {
    x: 0.6, y: 5.85, w: W - 1.2, h: 0.5, fontFace: "Courier New", fontSize: 9, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.3,
  });
}

// ================= SLIDE 9 — GOVERNANCE: DATA SOVEREIGNTY & 2-TIER RETENTION =================
{
  const s = newSlide();
  eyebrowAndNumber(s, "GOVERNANCE", "09 / 10");
  title(s, [{ text: "Data Sovereignty & " }, { text: "2-Tier Retention", color: MINT }], 0.85, 26);
  lede(s, "The city owns its own tenant data outright. CITIXEN retains only anonymized, network-wide benchmarks — never a name, a device ID, or a precise location.", 1.85, W - 1.2);
  const colW = (W - 1.2 - 0.3) / 2;
  let x = 0.6;
  card(s, x, 2.75, colW, 2.9, { lineColor: MINT, lineWidth: 1.25 });
  tagPill(s, x + 0.3, 3.0, "TIER 1 · MUNICIPAL TENANT DATA");
  s.addText("Sovereign City Data", { x: x + 0.3, y: 3.4, w: colW - 0.6, h: 0.45, fontFace: FONT, fontSize: 15, bold: true, color: TEXT, isTextBox: true, margin: 0 });
  s.addText(
    [
      { text: "Raw ticket, location, and dispatch records stay inside that city's own instance", options: { bullet: true, breakLine: true } },
      { text: "Never sold or shared outside the municipal services agreement", options: { bullet: true, breakLine: true } },
      { text: "No resident accounts, logins, or device fingerprinting to begin with", options: { bullet: true } },
    ],
    { x: x + 0.3, y: 3.9, w: colW - 0.6, h: 1.6, fontFace: FONT, fontSize: 11.5, color: MUTED, isTextBox: true, margin: 0, paraSpaceAfter: 6 }
  );
  x = 0.6 + colW + 0.3;
  card(s, x, 2.75, colW, 2.9);
  tagPill(s, x + 0.3, 3.0, "TIER 2 · ANON. MACRO BENCHMARKS");
  s.addText("Cross-City Benchmarking", { x: x + 0.3, y: 3.4, w: colW - 0.6, h: 0.45, fontFace: FONT, fontSize: 15, bold: true, color: TEXT, isTextBox: true, margin: 0 });
  s.addText(
    [
      { text: "Only aggregate, de-identified network-wide stats — resolution SLA, grid coverage, capital-split ratios", options: { bullet: true, breakLine: true } },
      { text: "Public ledger pins are coordinate-fuzzed to ~110m before anything is ever displayed", options: { bullet: true, breakLine: true } },
      { text: "EXIF/GPS and device identifiers are stripped from every photo before it leaves the reporter's device", options: { bullet: true } },
    ],
    { x: x + 0.3, y: 3.9, w: colW - 0.6, h: 1.6, fontFace: FONT, fontSize: 11.5, color: MUTED, isTextBox: true, margin: 0, paraSpaceAfter: 6 }
  );
  s.addText("Specific data-processing terms, retention windows, and sub-processor disclosures are governed by the municipal services agreement — this slide summarizes the platform's default architecture, not a substitute for that agreement.", {
    x: 0.6, y: 5.85, w: W - 1.2, h: 0.5, fontFace: "Courier New", fontSize: 9, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.3,
  });
}

// ================= SLIDE 10 — NEXT STEP: THE 30-DAY WARD PILOT =================
{
  const s = newSlide();
  s.addText("NEXT STEP", {
    x: 0, y: 1.35, w: W, h: 0.3, align: "center", fontFace: "Courier New", fontSize: 11, bold: true, color: MINT, isTextBox: true, margin: 0, charSpacing: 2,
  });
  s.addText("10 / 10", {
    x: 0, y: 1.35, w: W - 0.6, h: 0.3, align: "right", fontFace: "Courier New", fontSize: 10, color: MUTED, isTextBox: true, margin: 0,
  });
  s.addText(
    [{ text: "The ", options: { color: TEXT } }, { text: "30-Day Ward Pilot", options: { color: MINT } }],
    { x: 0.6, y: 1.8, w: W - 1.2, h: 0.9, align: "center", fontFace: FONT, fontSize: 30, bold: true, isTextBox: true, margin: 0 }
  );
  s.addText("No procurement cycle required to start the conversation — setup takes under two weeks, one ward at a time.", {
    x: W / 2 - 4.5, y: 2.7, w: 9, h: 0.6, align: "center", fontFace: FONT, fontSize: 14, color: MUTED, isTextBox: true, margin: 0, lineSpacingMultiple: 1.3,
  });
  // CTA buttons
  const btn1W = 3.2, btn2W = 3.4, gap = 0.3;
  const totalW = btn1W + btn2W + gap;
  let x = W / 2 - totalW / 2;
  s.addShape(pres.ShapeType.roundRect, {
    x, y: 3.75, w: btn1W, h: 0.55, rectRadius: 0.08, fill: { color: MINT }, line: { type: "none" },
  });
  s.addText("partners@citixenux.com", {
    x, y: 3.75, w: btn1W, h: 0.55, align: "center", valign: "middle", fontFace: FONT, fontSize: 12, bold: true, color: "051311", isTextBox: true, margin: 0,
    hyperlink: { url: "mailto:partners@citixenux.com" },
  });
  x += btn1W + gap;
  s.addShape(pres.ShapeType.roundRect, {
    x, y: 3.75, w: btn2W, h: 0.55, rectRadius: 0.08, fill: { type: "none" }, line: { color: BORDER, width: 1 },
  });
  s.addText("citixenux.com/pilot ↗", {
    x, y: 3.75, w: btn2W, h: 0.55, align: "center", valign: "middle", fontFace: FONT, fontSize: 12, bold: true, color: TEXT, isTextBox: true, margin: 0,
    hyperlink: { url: "https://citixenux.com/pilot" },
  });
  s.addText("Active reference deployment: La Crosse, WI — Ward 4", {
    x: 0, y: 4.7, w: W, h: 0.3, align: "center", fontFace: "Courier New", fontSize: 9, color: MUTED, isTextBox: true, margin: 0,
  });
}

pres.writeFile({ fileName: "/home/claude/citixen-ux/CITIXEN_UX_Executive_Deck.pptx" }).then(() => {
  console.log("done");
});
