# jday.co

Static site for jday.co: the homepage plus a URL shortener (ported from Shorty).

- `public/` — copied as-is into the site (homepage, CSS)
- `links.json` — all short links (`path` may be nested, e.g. `wishlist/joey`)
- `scripts/import-shorty.mjs` — one-off import from the old Shorty MySQL dump
- `scripts/build.mjs` — `npm run build` writes `dist/` (one redirect page per link, plus `404.html`)

## Backlog
- Admin page that commits to `links.json` via the GitHub API, plus a GitHub Action to build and deploy
- Generate the homepage from a Markdown/YAML file
- Add `CNAME`; decide how `jday.us` (and `s.jday.us`) redirects
- Check which link targets are dead
- Click counts (historical ones are kept in `links.json`)
