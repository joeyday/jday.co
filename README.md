# jday.co

Static site for jday.co: the homepage plus a URL shortener (ported from Shorty).

- `public/` — copied as-is into the site (homepage, CSS)
- `links.json` — all short links (`path` may be nested, e.g. `wishlist/joey`)
- `scripts/import-shorty.mjs` — one-off import from the old Shorty MySQL dump
- `scripts/build.mjs` — `npm run build` writes `dist/` (one redirect page per link, plus `404.html`)

## Backlog (URL shortener, in order)
- [x] Include a link on the redirect page in case the browser doesn't respect meta refresh
- [x] Link checker notices when a target is itself a redirect and updates our link to the new URL, keeping a versioned history of where it used to go (`history` in links.json, newest first). Updated links show a warning page with old and new URLs until marked `"approved": true` in links.json
- [x] Info page for each link at `<path>/info/` (a non-redirecting page with target, history, etc.; `info` is a reserved path segment, and the build fails on a collision)
- [x] Admin page for adding new links at `/admin/` (`public/admin/index.html`). It talks to the GitHub contents API from the browser and commits to `links.json`, which triggers a deploy. The fine-grained token (this repo only, Contents read/write, expiring) is typed in each time and held only in memory, never stored. The page loads no external scripts and has a CSP. `admin` (top-level) and `info` are reserved paths; the build fails on collisions. Leaving the path blank (or pressing "Suggest a short path") auto-assigns a random unused code, at least 2 characters and as short as possible, from `a-z0-9` only (36 characters, not 62: paths are case-insensitive in the build and GitHub Pages is case-sensitive, so mixed-case codes wouldn't resolve)
- [ ] Admin page can also edit existing links, versioned the same way as checker updates
    - [ ] Then repoint several links to my own pages (e.g. old Tota Scriptura links)
- [ ] Migrate to a Cloud Run instance for true 302 redirects (min instances = 1, no cold starts)

## Other backlog
- Generate the homepage from a Markdown/YAML file
- `jday.us` (and `s.jday.us`) redirects
- Prune dead links after reviewing `link-report.csv`
- Font Awesome icons: use the kit/CDN at build time to fetch the SVGs and bake them into the built site (served from our own domain), without committing them to the repo. Idea only; license position unclear (an email from Font Awesome says including SVGs on the site isn't a breach, but nothing about the repo). Open questions: does the kit allow server-side fetches (domain/referrer allow-list), and does "never committed" actually matter for the license?
