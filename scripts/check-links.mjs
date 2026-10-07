// Checks link targets and writes link-report.csv (sortable, with a blank "keep?" column).
// Usage: node scripts/check-links.mjs [--changed=<git-ref>] [--apply]
//   --changed=<ref>  only check links that are new or edited compared with links.json at <ref>
//   --apply          set `broken: true` in links.json for definitively dead links (404/410, domain
//                    gone, soft-404) and clear it for links that are OK again. Uncertain results
//                    (bot-blocking, timeouts) never change the flag. Also, when a target permanently
//                    redirects (every hop 301/308) to a working page, update `target` to the new URL and
//                    record the old one in the link's `history` (newest first). The build then shows a
//                    "this link was redirected" page until the link is marked `approved: true`, which
//                    happens automatically when only the scheme, www. or a trailing slash changed.
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const ref = args.find((a) => a.startsWith('--changed='))?.slice('--changed='.length);

const all = JSON.parse(readFileSync('links.json', 'utf8'));
let links = all;
if (ref) {
  let before = [];
  try { before = JSON.parse(execFileSync('git', ['show', `${ref}:links.json`], { encoding: 'utf8' })); } catch {}
  const old = new Map(before.map((l) => [l.path, l.target]));
  links = all.filter((l) => old.get(l.path) !== l.target);
  console.error(`${links.length} new or changed link(s) since ${ref}`);
}
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
    return { status: res.status, finalUrl: cur, hops, permanent: hops.length > 1 && hops.slice(0, -1).every((h) => h === 301 || h === 308) };
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

// Same page, cosmetically different: scheme, a leading www., host case, or a trailing slash.
const canon = (u) => { const x = new URL(enc(u)); return `${x.hostname.replace(/^www\./, '').toLowerCase()}${x.pathname.replace(/\/$/, '')}${x.search}${x.hash}`; };
const isTrivialMove = (l) => l.history?.length && l.history.every((h) => canon(h.target) === canon(l.target));

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
    results[i] = { ...link, permanent: r.permanent, status: r.status, final: r.finalUrl === enc(link.target) ? '' : r.finalUrl, verdict: classify(link, r) };
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

const isDead = (v) => v.startsWith('dead') || v.startsWith('soft-404');
const isOk = (v) => v.startsWith('ok');
const flagged = [], cleared = [], moved = [];
const today = new Date().toISOString().slice(0, 10);
if (apply) {
  const byPath = new Map(results.map((r) => [r.path, r]));
  for (const l of all) {
    const r = byPath.get(l.path);
    if (!r) continue;
    if (r.permanent && r.final && /^ok/.test(r.verdict)) {
      // fetch drops #fragments when following redirects, so carry the original one over.
      const hash = new URL(enc(l.target)).hash;
      const next = decodeURI(r.final) + (new URL(r.final).hash ? '' : hash);
      if (next !== l.target) {
        l.history = [{ target: l.target, replaced: today }, ...(l.history ?? [])];
        moved.push({ path: l.path, from: l.target, to: next });
        l.target = next;
        delete l.approved; // a new move needs a fresh review
      }
    }
    if (isTrivialMove(l)) l.approved = true; // nothing to review, so redirect straight through
    if (isDead(r.verdict) && !l.broken) { l.broken = true; flagged.push(r); }
    else if (isOk(r.verdict) && l.broken) { delete l.broken; cleared.push(r); }
  }
  writeFileSync('links.json', JSON.stringify(all, null, 2) + '\n');
}

// Markdown summary for the GitHub Actions run page (no-op locally).
if (process.env.GITHUB_STEP_SUMMARY) {
  const bad = results.filter((r) => isDead(r.verdict));
  const lines = [`### Link check: ${results.length} checked, ${bad.length} dead`];
  if (moved.length) lines.push('', '**Target updated (permanent redirect):**', ...moved.map((m) => `- \`${m.path}\`: ${m.from} → ${m.to}`));
  if (flagged.length) lines.push('', `**Newly flagged broken:** ${flagged.map((r) => `\`${r.path}\``).join(', ')}`);
  if (cleared.length) lines.push('', `**Working again:** ${cleared.map((r) => `\`${r.path}\``).join(', ')}`);
  if (bad.length) lines.push('', '| Link | Verdict | Target |', '|---|---|---|', ...bad.map((r) => `| ${r.path} | ${r.verdict} | ${r.target} |`));
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
}

const tally = {};
for (const r of results) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
console.table(tally);
