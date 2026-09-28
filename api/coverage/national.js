// GET /api/coverage/national
//
// The National Network tab's data source: aggregate scale ticker numbers
// plus a per-municipality (per-ward) breakdown for the coverage card grid.
// Every number here is a genuine sum over the live store — never a
// hand-typed placeholder — so onboarding a new city/ward in _lib/store.js
// is the only thing that moves these totals.
const { allWards, summarize } = require('../_lib/store');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }

  const wards = allWards();

  const citiesSeen = new Set(wards.map(w => w.stateSlug + '/' + w.citySlug));

  let nationalGridTilesDigitized = 0;
  let totalCapExScopedNationwide = 0;

  const municipalities = wards.map(w => {
    const stats = summarize(w.ward.cells);
    nationalGridTilesDigitized += stats.coveredCount;
    totalCapExScopedNationwide += (w.ward.capExScopedUSD || 0);
    return {
      state: w.stateSlug,
      stateName: w.stateName,
      city: w.citySlug,
      cityName: w.cityName,
      ward: w.wardSlug,
      wardName: w.ward.name,
      alderman: w.ward.alderman,
      coveragePct: stats.coveragePct,
      coveredCount: stats.coveredCount,
      totalCells: stats.total,
      capExScopedUSD: w.ward.capExScopedUSD
    };
  }).sort((a, b) => b.capExScopedUSD - a.capExScopedUSD);

  res.status(200).json({
    activeMunicipalities: citiesSeen.size,
    districtsMapped: wards.length,
    nationalGridTilesDigitized,
    totalCapExScopedNationwide,
    municipalities
  });
};
