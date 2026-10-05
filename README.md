# jday.co

Static site for jday.co: the homepage plus a URL shortener (ported from Shorty).

- `public/` — copied as-is into the site (homepage, CSS)
- `links.json` — all short links (`path` may be nested, e.g. `wishlist/joey`)
- `scripts/import-shorty.mjs` — one-off import from the old Shorty MySQL dump
- `scripts/build.mjs` — `npm run build` writes `dist/` (one redirect page per link, plus `404.html`)

## Backlog (URL shortener, in order)
- [x] Include a link on the redirect page in case the browser doesn't respect meta refresh
- [ ] Link checker notices when a target is itself a redirect and updates our link to the new URL, keeping a versioned history of where it used to go
- [ ] `?info` parameter: info page for a link (versions, etc.)
- [ ] Admin page for adding new links
- [ ] Admin page can also edit existing links, versioned the same way as checker updates
    - [ ] Then repoint several links to my own pages (e.g. old Tota Scriptura links)
- [ ] Migrate to a Cloud Run instance for true 302 redirects (min instances = 1, no cold starts)

## Other backlog
- Generate the homepage from a Markdown/YAML file
- `jday.us` (and `s.jday.us`) redirects
- Prune dead links after reviewing `link-report.csv`
