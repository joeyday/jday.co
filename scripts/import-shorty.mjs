// One-off: convert the Shorty MySQL dump into links.json.
// Usage: node scripts/import-shorty.mjs path/to/jdayus_shorty.sql
import { readFileSync, writeFileSync } from 'node:fs';

const sql = readFileSync(process.argv[2], 'latin1');
const start = sql.indexOf('INSERT INTO `shorty_shorties` VALUES ') + 'INSERT INTO `shorty_shorties` VALUES '.length;
const end = sql.indexOf(';\n', start);
const body = sql.slice(start, end);

// Tokenize the VALUES list: (v,v,'str',...),(...)
const rows = [];
let i = 0, row = null;
while (i < body.length) {
  const c = body[i];
  if (c === '(') { row = []; i++; }
  else if (c === ')') { rows.push(row); row = null; i++; }
  else if (c === ',' || c === ' ') i++;
  else if (c === "'") {
    let s = ''; i++;
    while (body[i] !== "'" || body[i + 1] === "'") {
      if (body[i] === '\\') { s += body[i + 1]; i += 2; }
      else if (body[i] === "'") { s += "'"; i += 2; }
      else s += body[i++];
    }
    i++; row.push(s);
  } else {
    let j = i; while (!',)'.includes(body[j])) j++;
    row.push(Number(body.slice(i, j))); i = j;
  }
}

const links = rows.map(([id, day, month, year, target, clicks, ...keys]) => ({
  id,
  path: keys.filter(Boolean).map((k) => k.trim()).join('/'),
  target: target.trim(),
  created: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  clicks,
}));

writeFileSync('links.json', JSON.stringify(links, null, 2) + '\n');
console.log(`${links.length} links written`);
