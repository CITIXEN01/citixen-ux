// Jurisdictional Stack data — the 4-layer legal library behind the
// "Citizen Paperwork File" (see index.html's Civic Tools drawer and
// app.html's National/Analytics tabs). Layer 1 (Federal) is shared by
// every jurisdiction; Layers 2-4 (State / Municipal / District-Ward) are
// looked up by state/city/ward slug, mirroring api/_lib/store.js's own
// State -> City -> Ward hierarchy.
//
// WHAT'S REAL AND WHAT'S A PLACEHOLDER, AND WHY THAT MATTERS HERE:
// The Federal-layer excerpts below are genuine, public-domain historical
// text (the First and Fourth Amendments, the Constitution's Preamble, the
// Declaration's opening). These are safe to quote verbatim because they
// are exactly that: quotes of a fixed, public-domain document.
//
// State/Municipal/Ward-layer text is deliberately NOT written as if it
// were quoted statutory or ordinance language — this module has no live
// connection to Wisconsin's or any other state's actual statutes, and
// fabricating specific section numbers or "quoted" ordinance text here
// would misrepresent real law. Instead each entry is an honest, clearly
// labeled summary of what that layer covers, with a note on where a real
// deployment would source it live (the state's statutes portal, the
// city's Municode/American Legal code, the council's own minutes). Every
// document's video/audio tabs are likewise placeholder containers: this
// repo ships no actual recordings, so the API says so (`videoAvailable`/
// `audioAvailable: false`) rather than pretending a 5-minute breakdown
// exists when it doesn't.

const FEDERAL_LAYER = [
  {
    id: 'us-constitution',
    title: 'U.S. Constitution — Preamble & Bill of Rights',
    kind: 'Federal',
    source: 'Public domain — National Archives',
    fullText:
      'We the People of the United States, in Order to form a more perfect Union, establish Justice, insure domestic Tranquility, provide for the common defence, promote the general Welfare, and secure the Blessings of Liberty to ourselves and our Posterity, do ordain and establish this Constitution for the United States of America.\n\n' +
      'Amendment I: Congress shall make no law respecting an establishment of religion, or prohibiting the free exercise thereof; or abridging the freedom of speech, or of the press; or the right of the people peaceably to assemble, and to petition the Government for a redress of grievances.\n\n' +
      'Amendment IV: The right of the people to be secure in their persons, houses, papers, and effects, against unreasonable searches and seizures, shall not be violated, and no Warrants shall issue, but upon probable cause, supported by Oath or affirmation, and particularly describing the place to be searched, and the persons or things to be seized.',
    cliffNotes: [
      'Establishes the federal government and its three branches.',
      'First Amendment protects speech, press, assembly, and petitioning government — the constitutional basis for filing a public hazard report.',
      'Fourth Amendment protects against unreasonable search and seizure of "papers and effects" — part of why CITIXEN strips identifying data before anything is retained.'
    ],
    videoAvailable: false,
    audioAvailable: false
  },
  {
    id: 'declaration-of-independence',
    title: 'Declaration of Independence',
    kind: 'Federal',
    source: 'Public domain — National Archives',
    fullText:
      'We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness. That to secure these rights, Governments are instituted among Men, deriving their just powers from the consent of the governed, that whenever any Form of Government becomes destructive of these ends, it is the Right of the People to alter or to abolish it, and to institute new Government...',
    cliffNotes: [
      'Founding statement that government exists to secure the people\'s rights and derives its authority from their consent.',
      'The philosophical basis for a citizen\'s standing to hold local government accountable for infrastructure and safety.'
    ],
    videoAvailable: false,
    audioAvailable: false
  }
];

// Strict null checks for every caller-supplied name: state/city/ward lookups
// ultimately trace back to a URL param or a store.js record, either of which
// can be missing or malformed. Falling back to a plain, honest placeholder
// string here (rather than letting `undefined` flow into the fullText/
// cliffNotes concatenations below, or letting a caller who passes null
// mid-expression throw) keeps Ward 4/municipal lookups rendering cleanly —
// with no console error — even when a name can't be resolved.
function safeName(value, fallback){
  return (typeof value === 'string' && value.trim()) ? value.trim() : fallback;
}

function stateLayer(stateName){
  stateName = safeName(stateName, 'this state');
  return [{
    id: 'state-constitution',
    title: stateName + ' State Constitution',
    kind: 'State',
    source: 'Representative summary — not sourced live',
    fullText:
      'Representative summary — pending integration with ' + stateName + '\'s official statutes portal. ' +
      'A production deployment reads this layer live from the state\'s own published constitution and code, rather than storing statutory text in this file, so it never drifts out of date.',
    cliffNotes: [
      'Defines the powers and limits of ' + stateName + '\'s state government, distinct from federal authority.',
      'Establishes home-rule authority that lets municipalities set their own ordinances within state law.',
      'Governs how state infrastructure funding and local aid are appropriated to cities and wards.'
    ],
    videoAvailable: false,
    audioAvailable: false
  }];
}

function municipalLayer(cityName){
  cityName = safeName(cityName, 'this municipality');
  return [
    {
      id: 'municipal-code',
      title: cityName + ' Municipal Code',
      kind: 'Municipal',
      source: 'Representative summary — not sourced live',
      fullText:
        'Representative summary — pending integration with ' + cityName + '\'s official municipal code portal (e.g. Municode or American Legal Publishing). ' +
        'A production deployment reads this layer live from the city\'s own published code rather than storing ordinance text here.',
      cliffNotes: [
        'Defines property-maintenance, right-of-way, and public-nuisance standards — the legal basis for most hazard categories reported through CITIXEN.',
        'Assigns the department responsible for each category of civic hazard (Public Works, Utilities, Sanitation).',
        'Establishes citizen complaint and appeal procedures.'
      ],
      videoAvailable: false,
      audioAvailable: false
    },
    {
      id: 'city-charter',
      title: cityName + ' City Charter',
      kind: 'Municipal',
      source: 'Representative summary — not sourced live',
      fullText:
        'Representative summary — pending integration with ' + cityName + '\'s official charter document. ' +
        'A production deployment reads this layer live from the city clerk\'s published records.',
      cliffNotes: [
        cityName + '\'s charter establishes its form of government and the council\'s composition by ward.',
        'Defines how the city budget, including CapEx for infrastructure repair, is adopted each cycle.'
      ],
      videoAvailable: false,
      audioAvailable: false
    },
    {
      id: 'zoning-ordinance',
      title: cityName + ' Zoning Ordinance',
      kind: 'Municipal',
      source: 'Representative summary — not sourced live',
      fullText:
        'Representative summary — pending integration with ' + cityName + '\'s official zoning map and ordinance text. ' +
        'A production deployment reads current zoning districts and use tables live from the city planning department\'s published records.',
      cliffNotes: [
        'Defines what can be built where (residential, commercial, mixed-use) and sets setback, height, and lot-coverage rules.',
        'Governs the permit and variance process a resident or landlord must follow to change a property\'s use.'
      ],
      videoAvailable: false,
      audioAvailable: false
    },
    {
      id: 'tenant-ordinance',
      title: cityName + ' Tenant & Landlord Ordinance',
      kind: 'Municipal',
      source: 'Representative summary — not sourced live',
      fullText:
        'Representative summary — pending integration with ' + cityName + '\'s official tenant-protection and rental-licensing code. ' +
        'A production deployment reads current habitability standards and notice requirements live from the city\'s published ordinance.',
      cliffNotes: [
        'Sets minimum habitability standards (heat, water, pest control) a landlord must maintain.',
        'Defines notice periods for entry, rent increases, and non-renewal, and where to file a habitability complaint.'
      ],
      videoAvailable: false,
      audioAvailable: false
    },
    {
      id: 'parking-ordinance',
      title: cityName + ' Parking Ordinance',
      kind: 'Municipal',
      source: 'Representative summary — not sourced live',
      fullText:
        'Representative summary — pending integration with ' + cityName + '\'s official parking and traffic code. ' +
        'A production deployment reads current permit-zone maps, time limits, and snow-emergency rules live from the city\'s published ordinance.',
      cliffNotes: [
        'Defines residential permit zones, metered time limits, and street-sweeping/snow-emergency parking bans.',
        'The legal basis for the "Parking" hotkey in Local Reports — routes to Traffic/Parking Enforcement.'
      ],
      videoAvailable: false,
      audioAvailable: false
    },
    {
      id: 'noise-ordinance',
      title: cityName + ' Noise Ordinance',
      kind: 'Municipal',
      source: 'Representative summary — not sourced live',
      fullText:
        'Representative summary — pending integration with ' + cityName + '\'s official noise-control code. ' +
        'A production deployment reads current decibel limits and quiet-hours windows live from the city\'s published ordinance.',
      cliffNotes: [
        'Sets quiet hours and maximum decibel levels for residential and commercial zones.',
        'The legal basis for the "Noise" hotkey in Local Reports — routes to Code Enforcement or Police non-emergency.'
      ],
      videoAvailable: false,
      audioAvailable: false
    }
  ];
}

function wardLayer(wardName, alderman, cityName){
  wardName = safeName(wardName, 'this ward');
  alderman = safeName(alderman, 'The elected representative for this ward');
  cityName = safeName(cityName, 'this municipality');
  return [
    {
      id: 'ward-directives',
      title: wardName + ' Council Directives',
      kind: 'District/Ward',
      source: 'Representative summary — not sourced live',
      fullText:
        'Representative summary — pending integration with ' + cityName + '\'s council meeting records for ' + wardName + '. ' +
        'A production deployment reads current directives live from the council\'s own published minutes and resolutions.',
      cliffNotes: [
        'Standing directives and budget priorities set by ' + wardName + '\'s council session for infrastructure repair.',
        'SLA and dispatch-response targets that feed the Ward Health Index shown in the Analytics tab.'
      ],
      videoAvailable: false,
      audioAvailable: false
    },
    {
      id: 'aldermanic-directory',
      title: wardName + ' Aldermanic Directory',
      kind: 'District/Ward',
      source: 'Representative summary — not sourced live',
      fullText:
        alderman + ' represents ' + wardName + ' in ' + cityName + '. Contact and office-hours details for this seat are ' +
        'published by the city clerk\'s office — a production deployment reads them live rather than hardcoding contact information here.',
      cliffNotes: [
        alderman + ' is the elected council member/alderman for ' + wardName + '.',
        'Residents may contact their alderman directly regarding unresolved reports or next quarter\'s budget priorities for the ward.'
      ],
      videoAvailable: false,
      audioAvailable: false
    },
    {
      id: 'council-meeting-schedule',
      title: wardName + ' Council Meeting Schedule',
      kind: 'District/Ward',
      source: 'Representative summary — not sourced live',
      fullText:
        'Representative summary — pending integration with ' + cityName + '\'s official council/committee calendar for ' + wardName + '. ' +
        'A production deployment reads the current meeting calendar, agendas, and remote-attendance links live from the city clerk\'s published schedule.',
      cliffNotes: [
        'Regular council session cadence and how to find the agenda ahead of a meeting.',
        'How a resident signs up for public comment, in person or remotely.'
      ],
      videoAvailable: false,
      audioAvailable: false
    }
  ];
}

// Assembles the full 4-layer stack for one ward. Callers pass the same
// slugs/names they already have from api/_lib/store.js's getWard() —
// this module has no dependency on store.js so the two can evolve
// independently, but they're always looked up together in practice.
function getJurisdictionStack(stateName, cityName, wardName, alderman){
  // Every downstream lookup (stateLayer/municipalLayer/wardLayer) already
  // guards its own arguments via safeName(), so this never throws even if
  // called with undefined/null across the board — it just returns the
  // stack with honest "this state/municipality/ward" placeholders.
  return {
    federal: FEDERAL_LAYER,
    state: stateLayer(stateName),
    municipal: municipalLayer(cityName),
    ward: wardLayer(wardName, alderman, cityName)
  };
}

module.exports = { FEDERAL_LAYER, stateLayer, municipalLayer, wardLayer, getJurisdictionStack };
