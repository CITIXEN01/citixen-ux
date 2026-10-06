# Citixen UX route map

Source of truth is `vercel.json`. Everything is spelled `citixenux.com` / Citixen UX (with an x).

## Access state: locked down

The **second entry in `redirects`** (the long regex ending `|sites|onboard)(\.html)?(/.*)?`) sends every
non-public page to `/app`. While it is there, only `/app`, `/report/{id}`, `/api/*` and static assets are reachable.
**Delete that one entry to open the routes below.** Nothing else needs to change.

## Routes (when the lockdown entry is removed)

| Path | Serves | Notes |
|---|---|---|
| `/` , `/beta` | redirect to `/app` (beta adds `?beta_cohort=alpha_10&ref=direct`) | temporary (307) |
| `/app` | `app.html` | civilian PWA |
| `/report/{id}` | `report.html` | public receipt permalink |
| `/muni` | `muni.html` | municipal gateway |
| `/muni/{slug}` | `app.html?muni={slug}` | civilian intake. **Not localized yet**: the PWA ignores `muni`. |
| `/muni/{slug}/dispatch` | `dispatch.html` (lacrosse), `muni-city.html?view=dispatch` (austin) | `dispatch.html` is hard-coded to La Crosse |
| `/muni/{slug}/admin` | `muni-city.html?view=admin` | Audit Vault, settings, Executive Cadence (Enterprise) |
| `/muni/{slug}/onboard` | `onboard.html?muni={slug}` | preview build, sends nothing |
| `/onboard/{slug}` | 308 to `/muni/{slug}/onboard` | |
| `/nexus` | `nexus.html` | internal hub; Systems Engineering feed is the site registry |
| `/sites`, `/sites/{slug}` | `sites.html` | multi-tenant directory |
| `/dispatch`, `/admin` | redirect to `/muni` (tenant picker) | legacy roots |
| `/ledger`, `/operator`, `/careers`, `/join/{id}` | unchanged | not in the architecture brief; kept |
| anything else | `404.html` (real 404) | the old catch-all that returned 200 is gone |

`/rep` and `rep.html` are removed (still in git history). Representative visibility is the municipality's call.

## Slugs are allow-listed in `vercel.json`

A slug only routes if it is in the pattern (`austin|lacrosse|holmen` for intake and `/sites`, `austin|lacrosse` for hubs,
`holmen` for onboarding). Anything else is a 404. When you add a tenant: add it to `shared/tenants.js` **and**
to those patterns.
