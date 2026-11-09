// Build nevada/data.js from NDOW's 2025 Big Game Main Draw bonus-point PDFs.
// The public file stores 1st-choice result bands only. Counts, quotas and rates stay in memory.
// Retrieved from https://www.ndow.org/blog/bonus-point-data/ on 2026-11-08.
// Those PDFs are the latest hunt-level tables linked on that page. They are the 2025 main draw.
// No 2026 hunt-level bonus-point table was linked there, and this script does not invent one.
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const FILES = [
  ['https://www.ndow.org/wp-content/uploads/2026/01/Mule-Deer-Antlered-ALW-Bonus-Point-and-Application-Trend-Resident-2025.pdf', 'deer-alw-res'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Mule-Deer-Antlered-ALW-Bonus-Point-and-Application-Trend-NonResident-2025.pdf', 'deer-alw-nr'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Mule-Deer-Antlered-Archery-Bonus-Point-and-Application-Trend-Resident-2025.pdf', 'deer-bow-res'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Mule-Deer-Antlered-Archery-Bonus-Point-and-Application-Trend-NonResident-2025.pdf', 'deer-bow-nr'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Mule-Deer-Antlered-Muzzleloader-Bonus-Point-and-Application-Trend-Resident-2025.pdf', 'deer-muz-res'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Mule-Deer-Antlered-Muzzleloader-Bonus-Point-and-Application-Trend-NonResident-2025.pdf', 'deer-muz-nr'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Mule-Deer-Junior-Antlered-Bonus-Point-and-Application-Trend-2025.pdf', 'deer-junior'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Mule-Deer-NonResident-Guided-Antlered-ALW-Bonus-Point-and-Application-Trend-2025.pdf', 'deer-guided'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Elk-Antlered-ALW-Bonus-Point-and-Application-Trend-Resident-2025.pdf', 'elk-m-alw-res'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Elk-Antlered-ALW-Bonus-Point-and-Application-Trend-NonResident-2025.pdf', 'elk-m-alw-nr'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Elk-Antlered-Archery-Bonus-Point-and-Application-Trend-2025.pdf', 'elk-m-bow'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Elk-Antlered-Muzzleloader-Bonus-Point-and-Application-Trend-2025.pdf', 'elk-m-muz'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Elk-Antlerless-ALW-Bonus-Point-and-Application-Trend-Resident-2025.pdf', 'elk-f-alw-res'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Elk-Antlerless-ALW-Bonus-Point-and-Application-Trend-NonResident-2025.pdf', 'elk-f-alw-nr'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Elk-Antlerless-Archery-Bonus-Point-and-Application-Trend-2025.pdf', 'elk-f-bow'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Elk-Antlerless-Muzzleloader-Bonus-Point-and-Application-Trend-2025.pdf', 'elk-f-muz'],
  ['https://www.ndow.org/wp-content/uploads/2026/04/Elk-Spike-ALW-Bonus-Point-and-Application-Trend-2025-1.pdf', 'elk-spike'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Moose-Antlered-ALW-Bonus-Point-and-Application-Trend-2025.pdf', 'moose'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Antelope-Horns-Longer-ALW-Bonus-Point-and-Application-Trend-Resident-2025.pdf', 'ant-m-alw-res'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Antelope-Horns-Longer-ALW-Bonus-Point-and-Application-Trend-NonResident-2025.pdf', 'ant-m-alw-nr'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Antelope-Horns-Longer-Archery-Bonus-Point-and-Application-Trend-Resident-2025.pdf', 'ant-m-bow-res'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Antelope-Horns-Longer-Archery-Bonus-Point-and-Application-Trend-NonResident-2025.pdf', 'ant-m-bow-nr'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Antelope-Horns-Longer-Muzzleloader-Bonus-Point-and-Application-Trend-2025.pdf', 'ant-m-muz'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Antelope-Horns-Shorter-ALW-Bonus-Point-and-Application-Trend-2025.pdf', 'ant-f'],
  ['https://www.ndow.org/wp-content/uploads/2026/03/Antelope-Junior-Horns-Shorter-Bonus-Point-and-Application-Trend-2025.pdf', 'ant-junior'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Desert-Bighorn-Any-Ram-ALW-Bonus-Point-and-Application-Trend-Resident-2025.pdf', 'dsheep-m-alw-res'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Desert-Bighorn-Any-Ram-ALW-Bonus-Point-and-Application-Trend-NonResident-2025.pdf', 'dsheep-m-alw-nr'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Desert-Bighorn-Any-Ram-Archery-Bonus-Point-and-Application-Trend-2025.pdf', 'dsheep-m-bow'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Desert-Bighorn-Any-Ewe-Bonus-Point-and-Application-Trend-2025.pdf', 'dsheep-f'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/California-Bighorn-Any-Ram-Bonus-Point-and-Application-Trend-Resident-2025.pdf', 'csheep-res'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/California-Bighorn-Any-Ram-Bonus-Point-and-Application-Trend-NonResident-2025.pdf', 'csheep-nr'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Rocky-Mountain-Bighorn-Any-Ram-Bonus-Point-and-Application-Trend-2025.pdf', 'rsheep'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Mountain-Goat-Any-Goat-Bonus-Point-and-Application-Trend-2025.pdf', 'goat'],
  ['https://www.ndow.org/wp-content/uploads/2026/01/Black-Bear-Bonus-Point-and-Application-Trend-2025.pdf', 'bear']
];

const CHOICES = ['1st', '2nd', '3rd', '4th', '5th'];
const TITLE = /^(Res|NR)\b.+\b(Deer|Elk|Antelope|Bighorn|Sheep|Goat|Bear|Moose)\b/;

export function bandOf(success, apps) {
  if (!(apps > 0) || !Number.isInteger(success) || !Number.isInteger(apps) || success < 0 || success > apps) return null;
  if (success === apps) return 1;
  const r = success / apps;
  if (r >= 0.75) return 0.75;
  if (r >= 0.25) return 0.25;
  if (r >= 0.05) return 0.05;
  if (success > 0) return 0.01;
  return 0;
}

function num(text) {
  if (!/^\d{1,7}$/.test(text) && !/^\d{1,3}(,\d{3})+$/.test(text)) return null;
  return Number(text.replace(/,/g, ''));
}

function parseTsv(tsv) {
  const words = [];
  for (const line of tsv.split('\n').slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols.length < 12) continue;
    const text = cols.slice(11).join('\t').trim();
    if (!text || text.startsWith('###')) continue;
    words.push({page: Number(cols[1]), left: Number(cols[6]), top: Number(cols[7]), text});
  }
  const byPage = new Map();
  for (const w of words) {
    if (!byPage.has(w.page)) byPage.set(w.page, []);
    byPage.get(w.page).push(w);
  }
  const lines = [];
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const ws = byPage.get(page).sort((a, b) => a.top - b.top || a.left - b.left);
    let cur = [];
    let anchor = null;
    const flush = () => {
      if (!cur.length) return;
      cur.sort((a, b) => a.left - b.left);
      lines.push({page, words: cur, text: cur.map(w => w.text).join(' ').replace(/\s+/g, ' ').trim()});
      cur = [];
    };
    for (const w of ws) {
      if (anchor === null || Math.abs(w.top - anchor) <= 3.6) {
        cur.push(w);
        if (anchor === null) anchor = w.top;
      } else {
        flush();
        cur = [w];
        anchor = w.top;
      }
    }
    flush();
  }
  return lines;
}

function classify(title, weapon) {
  const live = /^NR\b/.test(title) ? 'nr' : 'res';
  let who = 'main';
  if (/Junior/i.test(title)) who = 'junior';
  if (/Restricted|Guided/i.test(title)) who = 'guided';
  let sp;
  let sx;
  if (/Mule Deer/i.test(title)) { sp = 'deer'; sx = 'M'; }
  else if (/Spike/i.test(title)) { sp = 'elk'; sx = 'S'; }
  else if (/Elk Antlerless/i.test(title)) { sp = 'elk'; sx = 'F'; }
  else if (/\bElk\b/i.test(title)) { sp = 'elk'; sx = 'M'; }
  else if (/Horns Shorter/i.test(title)) { sp = 'antelope'; sx = 'F'; }
  else if (/Antelope/i.test(title)) { sp = 'antelope'; sx = 'M'; }
  else if (/(Nelson|Desert)/i.test(title) && /Ewe/i.test(title)) { sp = 'dsheep'; sx = 'F'; }
  else if (/(Nelson|Desert)/i.test(title)) { sp = 'dsheep'; sx = 'M'; }
  else if (/California/i.test(title)) { sp = 'csheep'; sx = 'M'; }
  else if (/Rocky/i.test(title)) { sp = 'rsheep'; sx = 'M'; }
  else if (/Goat/i.test(title)) { sp = 'goat'; sx = 'E'; }
  else if (/Moose/i.test(title)) { sp = 'moose'; sx = 'M'; }
  else if (/Bear/i.test(title)) { sp = 'bear'; sx = 'E'; }
  else throw new Error('unrecognized hunt title: ' + title);
  const w = weapon.toLowerCase();
  let wpn = 'other';
  if (/shotgun/.test(w)) wpn = 'shotgun';
  else if (/muzzle/.test(w)) wpn = 'muz';
  else if (/archery/.test(w)) wpn = 'bow';
  else if (/any legal/.test(w)) wpn = 'alw';
  else if (/classic/.test(w)) wpn = 'classic';
  else if (/primitive/.test(w)) wpn = 'prim';
  else if (/seasonal/.test(w)) wpn = 'seasonal';
  return {sp, sx, who, live, wpn, wlab: weapon.replace(/\s+/g, ' ').trim()};
}

function columnsFrom(line) {
  const heads = line.words.filter(w => CHOICES.includes(w.text));
  if (heads.length !== 10) return null;
  const success = heads.slice(0, 5);
  const apps = heads.slice(5);
  return {success, apps};
}

function assignRow(line, cols) {
  const pointCut = cols.success[0].left - 12;
  let point = null;
  const got = {s: [null, null, null, null, null], a: [null, null, null, null, null]};
  const far = cols.apps[4].left + 22;
  for (const w of line.words) {
    if (w.left > far) continue;
    if (w.left < pointCut) {
      if (w.text === 'Total') point = 'total';
      else if (num(w.text) !== null && point === null) point = num(w.text);
      continue;
    }
    const n = num(w.text);
    if (n === null) continue;
    let best = null;
    let bestD = 1e9;
    const groups = [['s', cols.success], ['a', cols.apps]];
    for (const [name, heads] of groups) {
      heads.forEach((h, i) => {
        const d = Math.abs(w.left - h.left);
        if (d < bestD) { bestD = d; best = [name, i]; }
      });
    }
    if (!best || bestD > 16) throw new Error('column ' + w.text + ' at ' + w.left + ' on ' + line.text);
    const [name, i] = best;
    if (got[name][i] !== null) throw new Error('two values in one column: ' + line.text);
    got[name][i] = n;
  }
  return {point, s: got.s.map(v => v ?? 0), a: got.a.map(v => v ?? 0)};
}

function parsePdf(tsv, srcId, url) {
  const lines = parseTsv(tsv);
  const hunts = [];
  let title = '';
  let units = '';
  let season = '';
  let weapon = '';
  let mode = '';
  let cols = null;
  let open = null;

  const identity = () => [title, units, season, weapon].join('|');

  function startHunt() {
    const id = identity();
    if (open && open.id === id && !open.closed) return;
    if (open && !open.closed) throw new Error(srcId + ' closed without a total: ' + open.id);
    const meta = classify(title, weapon);
    open = {id, ...meta, units, season, src: srcId, url, rows: [], total: null, closed: false};
    hunts.push(open);
  }

  for (const line of lines) {
    const t = line.text;
    if (!t || /Nevada Bonus Point and Application Choice Trends/.test(t) || t === '2025 Big Game Main Draw') continue;
    if (/^Page \d+ of \d+$/.test(t) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t)) continue;
    if (/^Successful Applicants by Choice$/.test(t) || /^Total Applicants by Choice$/.test(t)) continue;
    if (line.words.length <= 2 && line.words[0].left > 470 && /^(Total|Applicants)$/.test(t)) continue;

    if (TITLE.test(t)) {
      title = t;
      mode = 'title';
      continue;
    }
    if (/^Units?:/.test(t)) {
      units = t.replace(/^Units?:\s*/, '');
      season = '';
      weapon = '';
      mode = 'units';
      continue;
    }
    if (mode === 'units' && !/^Season:/.test(t)) {
      units = (units + ' ' + t).replace(/\s+/g, ' ').trim();
      continue;
    }
    if (/^Season:/.test(t)) {
      season = t.replace(/^Season:\s*/, '');
      mode = 'season';
      continue;
    }
    if (mode === 'season' && !/^Weapon\b/.test(t)) {
      season = (season + ' ' + t).replace(/\s+/g, ' ').trim();
      continue;
    }
    if (/^Weapon\b/.test(t)) {
      weapon = t.replace(/^Weapon\s*/, '');
      mode = 'weapon';
      continue;
    }
    if (mode === 'weapon' && !/^Quota:/.test(t) && !/Bonus Points/.test(t)) {
      weapon = (weapon + ' ' + t).replace(/\s+/g, ' ').trim();
      continue;
    }
    if (/^Quota:/.test(t)) {
      mode = 'quota';
      continue;
    }
    if (/Bonus Points/.test(t) && t.includes('1st')) {
      const next = columnsFrom(line);
      if (!next) throw new Error(srcId + ' choice headers: ' + t);
      cols = next;
      if (!title || !units || !season || !weapon) throw new Error(srcId + ' table before a hunt header: ' + t);
      startHunt();
      continue;
    }
    if (!open || !cols) continue;
    const first = line.words.find(w => w.left < cols.success[0].left - 12);
    if (!first || (first.text !== 'Total' && num(first.text) === null)) continue;
    const row = assignRow(line, cols);
    if (row.point === 'total') {
      open.total = row;
      open.closed = true;
      const sumS = open.rows.reduce((n, r) => n + r.s[0], 0);
      const sumA = open.rows.reduce((n, r) => n + r.a[0], 0);
      if (sumS !== row.s[0] || sumA !== row.a[0]) {
        throw new Error(srcId + ' total mismatch ' + open.units + ' ' + open.season + ' rows ' + sumS + '/' + sumA + ' total ' + row.s[0] + '/' + row.a[0]);
      }
      continue;
    }
    if (open.closed) throw new Error(srcId + ' row after total ' + open.units);
    if (open.rows.some(r => r.point === row.point)) throw new Error(srcId + ' duplicate point ' + row.point + ' ' + open.units);
    open.rows.push(row);
  }
  if (open && !open.closed) throw new Error(srcId + ' file ended without a total: ' + open.id);
  return hunts;
}

function pdfText(path) {
  return execFileSync('pdftotext', ['-tsv', path, '-'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
}

function ensurePdf(url, dir, name) {
  const dest = join(dir, name);
  if (!existsSync(dest)) {
    execFileSync('curl', ['-fsSL', '-A', 'Mozilla/5.0', '-o', dest, url], {stdio: 'inherit'});
  }
  return dest;
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function main() {
const dir = process.env.NDOW_PDF_DIR || join(tmpdir(), 'ndow-2025-bands');
mkdirSync(dir, {recursive: true});
const hunts = [];
const sources = {};
for (const [url, id] of FILES) {
  const path = ensurePdf(url, dir, id + '.pdf');
  const parsed = parsePdf(pdfText(path), id, url);
  if (!parsed.length) throw new Error('no hunts in ' + id);
  sources[id] = url;
  hunts.push(...parsed);
  console.log(id, parsed.length);
}

const NH = {};
const seen = new Set();
for (const h of hunts) {
  const key = [h.sp, h.sx, h.wpn, h.who, h.live, slug(h.units), slug(h.season)].join('|');
  if (seen.has(key)) throw new Error('duplicate hunt key ' + key);
  seen.add(key);
  const bp = {};
  for (const row of h.rows) {
    if (row.a[0] === 0) continue;
    const b = bandOf(row.s[0], row.a[0]);
    if (b === null) throw new Error('bad band ' + key + ' ' + row.point);
    bp[row.point] = b;
  }
  NH[key] = {
    sp: h.sp, sx: h.sx, wpn: h.wpn, wlab: h.wlab, who: h.who, live: h.live,
    units: h.units, season: h.season, src: h.src, bp
  };
}

const counts = {};
for (const h of Object.values(NH)) {
  const k = h.sp + '/' + h.sx + '/' + h.who + '/' + h.live;
  counts[k] = (counts[k] || 0) + 1;
}
console.log('hunts', Object.keys(NH).length);
console.log(counts);

const root = new URL('..', import.meta.url).pathname;
const body = `// Nevada Find Your Hunt, public file. 2025 Big Game Main Draw result bands only.
// Built by scripts/build-nevada-bands.mjs from the NDOW bonus-point PDFs linked on
// https://www.ndow.org/blog/bonus-point-data/ and retrieved 2026-11-08.
// Each bp value is a 1st-choice result band at that bonus-point level: 1 all, .75 most,
// .25 some, .05 few, .01 under one in twenty, 0 none. A level is omitted when the table has
// no 1st-choice row to score. This is not a forecast, not a preference-point ladder, and not an exact rate.
const NV_META=${JSON.stringify({
  year: 2025,
  draw: '2025 Big Game Main Draw',
  retrieved: '2026-11-08',
  page: 'https://www.ndow.org/blog/bonus-point-data/',
  program: 'https://www.ndow.org/blog/bonus-point-program/',
  faq: 'https://www.ndow.org/wp-content/uploads/2026/03/2026-Big-Game-Application-FAQ.pdf',
  rules: 'https://www.ndow.org/wp-content/uploads/2026/01/CR-26-01-2026-2027-Application-Deadlines-Draw-Result-Dates-NBWC-Approved-January-2026.pdf',
  apply: 'https://www.ndow.org/apply-buy/apply-buy-hunting/',
  src: sources
}, null, 0)};
const NH=${JSON.stringify(NH)};
`;
writeFileSync(join(root, 'nevada/data.js'), body);
console.log('wrote nevada/data.js', body.length);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) main();
