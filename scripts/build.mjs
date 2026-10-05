// Static build: copies public/ to dist/ and writes one redirect page per link in links.json.
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'dist';
// TEMPORARY: when testing at joeyday.github.io/<repo>/, set BASE=/<repo> so root-relative links work.
// Remove (along with the workflow's BASE line) once the custom domain is live.
const BASE = (process.env.BASE ?? '').replace(/\/$/, '');
const links = JSON.parse(readFileSync('links.json', 'utf8'));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Shorty allowed spaces and such in targets; normalize so the URL is valid in every context.
const clean = (u) => encodeURI(decodeURI(u));

const redirectPage = (target) => {
  const t = clean(target);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Redirecting…</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(t)}">
<meta http-equiv="refresh" content="0; url=${esc(t)}">
<script>location.replace(${JSON.stringify(t).replace(/</g, '\\u003c')})</script>
</head>
<body><p>Redirecting to <a href="${esc(t)}">${esc(t)}</a>…</p></body>
</html>
`;
};

rmSync(OUT, { recursive: true, force: true });
cpSync('public', OUT, { recursive: true });

if (BASE) {
  for (const f of readdirSync(OUT, { recursive: true }).filter((f) => f.endsWith('.html'))) {
    const p = join(OUT, f);
    writeFileSync(p, readFileSync(p, 'utf8').replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`));
  }
}

const seen = new Set();
for (const { path, target } of links) {
  const key = path.toLowerCase();
  if (seen.has(key)) throw new Error(`Duplicate path: ${path}`);
  seen.add(key);
  if (/(^|\/)(\.\.?)?(\/|$)/.test(key)) throw new Error(`Bad path: ${path}`);
  const dir = join(OUT, key);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), redirectPage(target));
}

writeFileSync(join(OUT, '404.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Not found</title>
<meta name="viewport" content="width=device-width">
<link href="${BASE}/style.css" rel="stylesheet"></head>
<body><section class="page"><section class="column"><h1>Hmm.</h1>
<p>That short link doesn’t exist. <a href="${BASE}/">Go home</a>.</p></section></section></body></html>
`);

console.log(`Built ${links.length} redirects into ${OUT}/`);
