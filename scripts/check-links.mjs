// Checks every target in links.json and writes link-report.csv (sortable, with a blank "keep?" column).
// Usage: node scripts/check-links.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const links = JSON.parse(readFileSync('links.json', 'utf8'));
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const enc = (u) => encodeURI(decodeURI(u));

async function probe(url) {
  const hops = [];
  let cur = enc(url);
  for (let i = 0; i < 8; i++) {
    const res = await fetch(cur, {
      redirect: 'manual',
      headers: { 'user-agent': UA, accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(20000),
    });
    res.body?.cancel().catch(() => {});
    hops.push(res.status);
    const loc = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && loc) { cur = new URL(loc, cur).href; continue; }
    return { status: res.status, finalUrl: cur, hops };
  }
  return { status: 'loop', finalUrl: cur, hops };
}

// Sites that routinely reject scripted requests, so a failure there says little.
const BOT_HOSTS = /(^|\.)(facebook|twitter|x|instagram|linkedin|librarything|stackoverflow|quora|reddit)\.com$/;

function classify(link, r) {
  const o = new URL(enc(link.target)), f = new URL(r.finalUrl);
  const s = r.status;
  if (BOT_HOSTS.test(o.hostname) && !(s >= 200 && s < 300) && s !== 404 && s !== 410) return `uncertain (${s}, site blocks bots)`;
  if (typeof s === 'number' && s >= 200 && s < 300) {
    const toRoot = o.pathname.length > 1 && f.pathname === '/' && !f.search;
    const hostChanged = o.hostname.replace(/^www\./, '') !== f.hostname.replace(/^www\./, '');
    if (toRoot && hostChanged) return 'soft-404 (redirects to other site homepage)';
    if (toRoot) return 'soft-404 (redirects to homepage)';
    if (/login|signin|sign_in|accounts\./i.test(f.href) && !/login|signin/i.test(o.href)) return 'needs-login';
    return hostChanged ? 'ok (moved domain)' : 'ok';
  }
  if (s === 404 || s === 410) return 'dead (404/410)';
  if ([401, 403, 429, 999, 503].includes(s)) return `uncertain (${s}, may block bots)`;
  if (typeof s === 'number' && s >= 500) return `error (${s})`;
  return `other (${s})`;
}

const results = new Array(links.length);
let next = 0, done = 0;
async function worker() {
  while (next < links.length) {
    const i = next++, link = links[i];
    let r;
    try { try { r = await probe(link.target); } catch (e) { if (/ENOTFOUND/.test(e.cause?.code)) throw e; r = await probe(link.target); } }
    catch (e) {
      const code = e.cause?.code ?? e.name;
      r = { status: code, finalUrl: '', hops: [] };
      results[i] = { ...link, status: code, final: '', verdict: /ENOTFOUND|EAI_AGAIN/.test(code) ? 'dead (domain gone)' : /TIMEOUT|Timeout|ABORT/i.test(code + e.message) ? 'unreachable (timeout)' : `unreachable (${code})` };
      continue;
    } finally { if (++done % 50 === 0) console.error(`${done}/${links.length}`); }
    results[i] = { ...link, status: r.status, final: r.finalUrl === enc(link.target) ? '' : r.finalUrl, verdict: classify(link, r) };
  }
}
await Promise.all(Array.from({ length: 16 }, worker));

const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const rows = [['verdict', 'path', 'clicks', 'created', 'status', 'target', 'final_url', 'keep?']];
const rank = (v) => (v.startsWith('ok') ? 3 : v.startsWith('uncertain') ? 2 : 1);
[...results].sort((a, b) => rank(a.verdict) - rank(b.verdict) || a.verdict.localeCompare(b.verdict) || b.clicks - a.clicks)
  .forEach((r) => rows.push([r.verdict, r.path, r.clicks, r.created, r.status, r.target, r.final, '']));
writeFileSync('link-report.csv', rows.map((r) => r.map(q).join(',')).join('\n') + '\n');
writeFileSync('link-report.json', JSON.stringify(results, null, 2));

const tally = {};
for (const r of results) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
console.table(tally);
