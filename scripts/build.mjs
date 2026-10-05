// Static build: copies public/ to dist/ and writes one page per link in links.json.
// Links flagged `broken` get an interstitial (with a "follow it anyway" option) instead of an instant redirect.
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

// Same look as the homepage: dark background, Typekit fonts, one centered column.
const shell = (title, body, head = '') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="viewport" content="width=device-width">
<meta name="robots" content="noindex">
<link href="/style.css" rel="stylesheet" type="text/css" media="all">
<script type="text/javascript" src="//use.typekit.net/sha0tdl.js"></script>
<script type="text/javascript">try{Typekit.load();}catch(e){}</script>
${head}</head>
<body>
<section class="page">
<section class="column">
${body}
</section>
</section>
</body>
</html>
`;

const brokenPage = (path, target) => {
  const t = clean(target);
  return shell('Link may be broken', `<h1>Hmm.</h1>
<p>The link <strong>jday.co/${esc(path)}</strong> points to a page that looks like it’s gone.</p>
<p class="target">${esc(t)}</p>
<p><a class="button" href="${esc(t)}" rel="nofollow">Follow it anyway</a></p>`);
};

const notFoundPage = () => shell('Not found', `<h1>Hmm.</h1>
<p>That short link doesn’t exist.</p>`);

rmSync(OUT, { recursive: true, force: true });
cpSync('public', OUT, { recursive: true });

const seen = new Set();
let broken = 0;
for (const { path, target, broken: isBroken } of links) {
  const key = path.toLowerCase();
  if (seen.has(key)) throw new Error(`Duplicate path: ${path}`);
  seen.add(key);
  if (/(^|\/)(\.\.?)?(\/|$)/.test(key)) throw new Error(`Bad path: ${path}`);
  const dir = join(OUT, key);
  mkdirSync(dir, { recursive: true });
  if (isBroken) broken++;
  writeFileSync(join(dir, 'index.html'), isBroken ? brokenPage(path, target) : redirectPage(target));
}

writeFileSync(join(OUT, '404.html'), notFoundPage());

console.log(`Built ${links.length} links (${broken} flagged broken) into ${OUT}/`);
