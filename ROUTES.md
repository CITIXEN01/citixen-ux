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
| `/muni/{slug}/admin` | `muni-command.html` | Command dashboard: Living Ledger, § 893.80 packet export, intake portal routes, Cmd+K |
| `/muni/{slug}/dispatch` | `muni-city.html` | Dispatch hub: map, triage, Audit Vault, geo-fence settings, Executive Cadence (Enterprise). Open a tab with `?view=audit\|cadence\|settings\|triage` |
| `/muni/la-crosse-wi/dispatch/crew-queue` | `dispatch.html` | La Crosse crew queue (hard-coded to La Crosse) |
| `/muni/{slug}/gateway` | `muni-gateway.html?city={slug}` | Onboarding gateway: review grant packet, financial offset, e-sign. Preview build, sends nothing. Needs `tenant.onboarding` |
| `/muni/{slug}/onboard` | `onboard.html?muni={slug}` | preview build, sends nothing |
| `/onboard/{slug}` | 308 to `/muni/{slug}/onboard` | |
| `/nexus` | `nexus.html` | internal hub; Systems Engineering feed is the site registry |
| `/sites`, `/sites/{slug}` | `sites.html` | multi-tenant directory; also registered intake routes (`holmen-wi-public-works`, `holmen-wi-parks`) |
| `/dispatch`, `/admin` | redirect to `/muni` (tenant picker) | legacy roots |
| `/ledger`, `/operator`, `/careers`, `/join/{id}` | unchanged | not in the architecture brief; kept |
| `/muni/{anything unknown}` (e.g. `/muni/holmen-wi-gatewa`, `/muni/holmen-wi/invalid`) | `404.html` via the last rewrite | branded "Redirecting to Village of Holmen Gateway..." page, `location.replace` to `/muni/holmen-wi/gateway` after 1 s (meta refresh if JS is off). Served 200 + noindex. Real routes win because rewrites are first-match and this one is last. `/muni/holmen-wi/gateway/{rest}` is a plain 307 to the gateway |
| anything else | `404.html` (real 404, same redirecting page) | the old catch-all that returned 200 is gone |

`/rep` and `rep.html` are removed (still in git history). Representative visibility is the municipality's call.

## Slug standard

Every city slug is `{city}-{state}`: lowercase, hyphenated, two-letter state: `holmen-wi`, `la-crosse-wi`, `austin-tx`.
Intake routes under `/sites` are `{city}-{state}-{department}`: `holmen-wi-public-works`.
The old slugs (`holmen`, `lacrosse`, `austin`, `holmen-public-works`, `holmen-parks`) 308-redirect to the new ones.

## Slugs are allow-listed in `vercel.json`

A slug only routes if it is in the pattern (`austin-tx|la-crosse-wi|holmen-wi` for intake, hubs and `/sites`; the intake route slugs
from `tenant.portals` are also allowed under `/sites`; `holmen-wi` only for onboarding and gateway). Anything else is a 404. When you add a tenant: add it to `shared/tenants.js` **and**
to those patterns.


## Public exemption (testing)

`/muni/holmen-wi/gateway` is the only `/muni/*` path that is public. It is a
preview build (nothing is sent or filed). Everything else under `/muni/*`,
plus `/nexus`, `/sites`, `/deck`, `/ledger` etc., still redirects to `/app`.
The `/muni*` lockdown is a set of explicit redirects placed before the
generic lockdown regex in `vercel.json`. To re-lock the gateway, delete the
rule `/muni/holmen-wi/gateway/:rest+` and add `gateway` to the
`/muni/holmen-wi/:sub(...)` rule.

Note: `muni/holmen-wi/gateway.html` is a byte-identical copy of `muni-gateway.html`,
served by the filesystem step (cleanUrls) so the public test URL does not depend
on a rewrite. After editing `muni-gateway.html`, re-copy it:
`cp muni-gateway.html muni/holmen-wi/gateway.html`.

## Gateway flow (`/muni/holmen-wi/gateway`)

`#welcome` (step 1 Verification), `#brief` (step 2 § 893.80 Brief) and `#sign` (step 3 E-Signature) are one
portal screen with a persistent progress panel; steps unlock in order (a deep link ahead of progress bounces back).
`#review` is the full 3-page agreement viewer, linked from step 3. Everything is a preview build: nothing is sent,
filed with LWMMI, or identity-verified. The signatory and attorney names come from `onboarding` in `shared/tenants.js`.
