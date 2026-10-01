/* =====================================================================
   CITIXEN UX™ — 3-TIER SEVERITY MATRIX (shared by index.html and app.html)
   ---------------------------------------------------------------------
   One classifier for map pins, dispatch-feed badges, seed data and new
   reports, so both pages triage the same way:

   CRITICAL  (red #FF3B30, pulsing pin) — active life-safety hazards only:
             road blockages, exposed/downed high-voltage wiring, missing
             critical traffic controls, water main breaks, gas leaks,
             sinkholes, or a report the citizen explicitly flagged as an
             urgent safety hazard (urgentOverride).
   WARNING   (amber #F59E0B pin) — functional degradation (streetlight
             outages, active-lane potholes) or any open item whose SLA age
             is overdue.
   STANDARD  (Laser Mint #00E699 pin) — routine, non-hazardous maintenance:
             Sidewalk / ADA, overfilled trash bins, faded crosswalks, code
             audits. Sidewalk / ADA always dispatches as Standard.
   Resolved items keep their Resolved status (mint, badge RESOLVED).
   ===================================================================== */
(function () {
  'use strict';

  var COLORS = { Critical: '#FF3B30', Warning: '#F59E0B', Standard: '#00E699', Resolved: '#00E699' };
  var SLA_OVERDUE_MIN = 120; // same 2-hour red line as the feed's SLA-age color

  var CRITICAL = /life[- ]?safety|road (?:is )?(?:blocked|closed)|(?:lane|road|street) block(?:ed|age)|blocking (?:the )?(?:road|lane|street|traffic)|downed (?:power )?lines?|power line down|live wire|exposed (?:high[- ]voltage |electrical |live )?wir|high[- ]voltage|sparking|missing (?:stop|yield|traffic|signal)|stop sign (?:down|missing|knocked)|(?:traffic )?signal (?:out|dark|down)|traffic lights? (?:out|down|dark)|water main|main break|gas leak|sinkhole/i;
  var STANDARD_FIRST = /sidewalk|\bada\b|curb ramp/i;
  var WARNING = /street ?(?:light|lamp)|lamp ?post|light(?:ing)? (?:out|outage)|outage|power \/ lighting|pothole/i;

  function text(item) {
    return [item.category, item.title, item.desc].filter(Boolean).join(' ');
  }

  // Returns 'Critical' | 'Warning' | 'Standard' (or 'Resolved' unchanged).
  function classify(item) {
    if (!item) return 'Standard';
    if (item.status === 'Resolved') return 'Resolved';
    if (item.urgentOverride) return 'Critical';
    var t = text(item);
    var level;
    if (STANDARD_FIRST.test(t)) level = 'Standard';          // ADA / Sidewalk corrective patch
    else if (CRITICAL.test(t)) level = 'Critical';
    else if (WARNING.test(t)) level = 'Warning';
    else level = 'Standard';
    if (level === 'Standard' && typeof item.ageMin === 'number' && item.ageMin >= SLA_OVERDUE_MIN) level = 'Warning';
    return level;
  }

  window.CitixenSeverity = {
    classify: classify,
    color: function (status) { return COLORS[status] || COLORS.Standard; },
    pillClass: function (status) { return status === 'Critical' ? 'pill-crit' : status === 'Warning' ? 'pill-warn' : 'pill-ok'; },
    pulses: function (status) { return status === 'Critical'; },
    // Reclassify a list of cases in place (seed data on load).
    applyTo: function (list) { (list || []).forEach(function (c) { c.status = classify(c); }); return list; }
  };
})();
