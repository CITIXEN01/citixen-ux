# Nexus Sales Workspace (`/nexuslive`)

Internal sales workspace: CRM dashboard, Sales Flowchart, Gateway Module demo, Legal & Admin Reminders.
It is **not public**. Access is enforced on the server, not in the page.

## What is in the page
- Everything is sample data. Nothing is sent, filed, ordered or activated from this page.
- There is **no passcode or login in the HTML or JavaScript**. A client-side passcode is readable in page source, so it was removed. Access control lives in `middleware.js`.
- No third-party scripts. React (minified bundle), a small htm-compatible template parser (`htm-lite.js`) and a compiled Tailwind stylesheet are served from `/nexuslive-assets/`. If a script fails to load, the page says which one instead of showing a black screen.

## Access control (Vercel)
`middleware.js` puts HTTP Basic Auth in front of `/nexuslive`, `/nexuslive.html` and `/nexuslive-assets/*`.

1. Vercel project > Settings > Environment Variables (Production and Preview):
   - `NEXUSLIVE_USER` (for example `team`)
   - `NEXUSLIVE_PASS` (a long random password; rotate it when someone leaves)
2. Deploy this branch to a Preview first.
3. Verify (all three must pass before using Production):
   ```
   curl -si https://<preview-url>/nexuslive | head -1                       # HTTP/2 401
   curl -si https://<preview-url>/nexuslive-assets/react-bundle.min.js | head -1   # HTTP/2 401
   curl -si -u team:<password> https://<preview-url>/nexuslive | head -1    # HTTP/2 200
   ```
4. If either variable is missing the route returns 503 (fails closed). It never serves the page unprotected because of a missing setting.

Nothing else in the site is touched. The matcher lists only the paths above.

### Stronger option: Cloudflare Access
If `citixenux.com` is proxied by Cloudflare, use Zero Trust > Access > Applications > Self-hosted, hostname `citixenux.com`, path `nexuslive*` (add a second path `nexuslive-assets*`), policy "Allow" for the team email addresses. This gives per-person sign-in and revocation instead of one shared password. Keep `middleware.js` as a second layer, or remove it once Access is verified.

### Other servers
- nginx: `location ^~ /nexuslive { auth_basic "Nexus Live"; auth_basic_user_file /etc/nginx/.nexuslive.htpasswd; }` plus the same block for `/nexuslive-assets/`.
- Apache: `AuthType Basic`, `AuthUserFile`, `Require valid-user` for those two paths in `.htaccess`.

## Rebuilding the stylesheet
After editing class names in `nexuslive.html`:
```
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > /tmp/tw.in.css
npx tailwindcss@3.4 -c tailwind.nexuslive.config.js -i /tmp/tw.in.css -o nexuslive-assets/nexuslive.css --minify
```

## Notes
- `htm-lite.js` is a small local parser with the same `htm.bind(React.createElement)` interface. To use upstream htm instead, replace that file with htm 3.1.1's `htm.umd.js`.
- The phone number (608) 555-0199 is a placeholder from the fictional 555-01xx range. Replace it before real use.
- Wording rules: tamper-evident (never "immutable" or "SOC 2"); any offset is subject to approval and the written agreement controls.
