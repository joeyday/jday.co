// Static build: copies public/ to dist/ and writes one redirect page per link in links.json.
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'dist';
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
<link href="/style.css" rel="stylesheet"></head>
<body><section class="page"><section class="column"><h1>Hmm.</h1>
<p>That short link doesn’t exist. <a href="/">Go home</a>.</p></section></section></body></html>
`);

console.log(`Built ${links.length} redirects into ${OUT}/`);
