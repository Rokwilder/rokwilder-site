// Colorado tag quotas from CPW primary draw recaps.
// Reads the total quota and the licenses drawn on each hunt page.
// Does not estimate a missing year. Hunters afield are left out unless a harvest
// file is passed in HARVEST_JSON (this build does not download the Widen share pages).
//
// Writes:
//   private/fullpass/co-quotas.js          exact counts, for the Full Pass worker only
//   find/history/colorado-quotas.sources.json   sources and year coverage, no counts
//
// Add co-quotas.js to the private bundle served at
// https://api.rokwilder.com/api/fullpass/data/co.js
// Paste it at the end of that file so it sets window.RWQ.co. Do not commit the counts.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';

const root = new URL('../..', import.meta.url).pathname;
const YEARS = [2023, 2024, 2025, 2026];
const ONLY = process.env.ONLY || '';
const PAGES = [
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-elk/elk-statistics', 'elk'],
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-deer/deer-statistics', 'deer'],
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-pronghorn/pronghorn-statistics', 'pronghorn'],
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-bear/bear-statistics', 'bear'],
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-moose/moose-statistics', 'moose'],
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-bighorn-sheep/bighorn-sheep-statistics', 'sheep'],
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-mountain-goat/mountain-goat-statistics', 'goat']
];
const NOTE = 'Tags are the total quota in the CPW primary draw recap. Drawn is how many of those licenses the draw issued. Hunters afield are not in this file. CPW links 2024 and 2025 harvest reports from the species statistics page, and those links did not return a file this build could read. The 2026 harvest survey was still open. A year that says not available was not in the recap we read. These figures are not estimates.';

function yearOf(slug) {
  if (/2026|[-_]26\b/.test(slug)) return 2026;
  if (/2025|[-_]25\b/.test(slug)) return 2025;
  if (/2024|[-_]24\b/.test(slug)) return 2024;
  if (/2023|[-_]23\b/.test(slug)) return 2023;
  return null;
}
function isRecap(slug) {
  const s = slug.toLowerCase();
  if (/secondary|drawnout|drawn-out|harvest|population|otc|unlimited/.test(s)) return false;
  return /postdrawrecap|drawrecap|post-draw-report|post-draw-recap/.test(s);
}
async function get(url) {
  const res = await fetch(url, {headers:{'user-agent':'Mozilla/5.0 Rokwilder research'}, redirect:'follow'});
  if (!res.ok) throw new Error(res.status + ' ' + url);
  return res.text();
}
function parseQuotas(tsv) {
  const pages = new Map();
  for (const line of tsv.split('\n')) {
    const c = line.split('\t');
    if (c.length < 12 || c[0] === 'level') continue;
    const text = c.slice(11).join(' ').trim();
    if (!text) continue;
    const page = +c[1];
    let arr = pages.get(page);
    if (!arr) { arr = []; pages.set(page, arr); }
    arr.push({left:+c[6], top:+c[7], text});
  }
  const codeRe = /^[A-Z]{2,3}\d{2,3}[A-Z]\d[A-Z]$/;
  const out = {};
  let pagesWith = 0, missingQ = 0;
  for (const words of pages.values()) {
    const codes = words.filter(w => codeRe.test(w.text));
    if (!codes.length) continue;
    pagesWith++;
    codes.sort((a, b) => a.top - b.top || a.left - b.left);
    const title = codes[0];
    const amount = words.filter(w => w.text === 'Amount' && w.top < title.top + 90).sort((a, b) => a.top - b.top)[0];
    let quota = null;
    if (amount) {
      const nums = words.filter(w => /^\d+$/.test(w.text) && w.top > amount.top && w.top < amount.top + 22 && Math.abs(w.left - amount.left) < 50);
      nums.sort((a, b) => a.top - b.top || Math.abs(a.left - amount.left) - Math.abs(b.left - amount.left));
      if (nums[0]) quota = +nums[0].text;
    }
    let drawn = null, drawnCode = null;
    for (const code of codes) {
      if (code.top < 150) continue;
      const row = words.filter(w => Math.abs(w.top - code.top) < 2.8 && /^\d+$/.test(w.text) && w.left < code.left && code.left - w.left < 90);
      row.sort((a, b) => b.left - a.left);
      if (row[0]) { drawn = +row[0].text; drawnCode = code.text; break; }
    }
    if (quota == null) missingQ++;
    const code = drawnCode || title.text;
    if (quota == null && drawn == null) continue;
    out[code] = {quota, drawn};
  }
  return {out, pagesWith, missingQ};
}

const sandbox = {window:{}, FL:{}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'drawodds/lite.js'), 'utf8') + '\n' + readFileSync(join(root, 'find/labels.js'), 'utf8') + '\n' + readFileSync(join(root, 'drawodds/oial.js'), 'utf8') + '\nglobalThis.D=D;', sandbox);
const codes = new Set(Object.keys(sandbox.D));
console.log('site codes', codes.size);

const dir = join(tmpdir(), 'cpw-quotas');
mkdirSync(dir, {recursive:true});
const byYear = {};
for (const y of YEARS) byYear[y] = {};
let sources = [];
let unavailable = [];

for (const [page, species] of PAGES.filter(p => !ONLY || p[1] === ONLY)) {
  let html;
  try { html = await get(page); }
  catch (err) {
    unavailable.push({species, why:'No statistics page at ' + page + ' (' + err.message + ').'});
    console.log('no page', species);
    continue;
  }
  const links = [...html.matchAll(/https:\/\/cpw\.widen\.net\/s\/[^"']+/g)].map(m => m[0]);
  const picks = {};
  for (const link of links) {
    const slug = decodeURIComponent(link.split('/').pop());
    if (!isRecap(slug)) continue;
    const year = yearOf(slug);
    if (!year || !YEARS.includes(year)) continue;
    if (!picks[year]) picks[year] = [];
    if (!picks[year].includes(link)) picks[year].push(link);
  }
  for (const year of YEARS) {
    const list = picks[year] || [];
    if (!list.length) {
      unavailable.push({species, year, why:'No primary draw recap link on the statistics page.', links:list});
      console.log('skip', species, year, 0);
      continue;
    }
    for (let i = 0; i < list.length; i++) {
      const viewer = list[i];
      try {
        const view = await get(viewer);
        const file = view.match(/href="(\/content\/[^"]+\.pdf\?[^"]*download=true)"/);
        if (!file) throw new Error('no original PDF on the viewer page');
        const pdfUrl = 'https://cpw.widen.net' + file[1].replace(/&amp;/g, '&');
        const dest = join(dir, `${species}-${year}-${i}.pdf`);
        if (!existsSync(dest)) execFileSync('curl', ['-fsSL', '-A', 'Mozilla/5.0', '-o', dest, pdfUrl], {stdio:'inherit'});
        const tsv = execFileSync('pdftotext', ['-tsv', dest, '-'], {encoding:'utf8', maxBuffer: 512 * 1024 * 1024});
        const parsed = parseQuotas(tsv);
        if (!parsed.pagesWith || parsed.missingQ / parsed.pagesWith > 0.1) {
          throw new Error('quota column missing on ' + parsed.missingQ + ' of ' + parsed.pagesWith + ' hunt pages');
        }
        let kept = 0;
        for (const [code, row] of Object.entries(parsed.out)) {
          if (!codes.has(code)) continue;
          if (!byYear[year][code]) byYear[year][code] = row;
          kept++;
        }
        sources.push({
          year, species, page, viewer, pdf: pdfUrl.split('?')[0],
          huntPages: parsed.pagesWith, matched: kept,
          fields: ['total quota', 'licenses drawn']
        });
        console.log('ok', species, year, 'file', i, 'pages', parsed.pagesWith, 'matched', kept);
      } catch (err) {
        unavailable.push({species, year, why:'The recap could not be used: ' + String(err.message || err).slice(0, 220), viewer});
        console.log('fail', species, year, err.message);
      }
    }
  }
}

const hunts = {};
for (const code of codes) {
  const rec = {};
  for (const year of YEARS) {
    const row = byYear[year][code];
    if (!row) continue;
    const cell = {};
    if (row.quota != null) cell.quota = row.quota;
    if (row.drawn != null) cell.drawn = row.drawn;
    if (cell.quota == null && cell.drawn == null) continue;
    cell.confirmed = true;
    rec[String(year)] = cell;
  }
  if (Object.keys(rec).length) hunts[code] = rec;
}

const pack = {
  years: YEARS,
  note: NOTE,
  hunts
};
const privateDir = join(root, 'private/fullpass');
mkdirSync(privateDir, {recursive:true});
const pubPath = join(root, 'find/history/colorado-quotas.sources.json');
if (ONLY && existsSync(pubPath)) {
  const prev = JSON.parse(readFileSync(pubPath, 'utf8'));
  const prevJs = readFileSync(join(privateDir, 'co-quotas.js'), 'utf8');
  const prevPack = JSON.parse(prevJs.replace(/^window\.RWQ=window\.RWQ\|\|{};window\.RWQ\.co=/, '').replace(/;\s*$/, ''));
  Object.assign(prevPack.hunts, hunts);
  pack.hunts = prevPack.hunts;
  const seen = new Set((prev.sources || []).map(s => s.pdf));
  sources = prev.sources.concat(sources.filter(s => !seen.has(s.pdf)));
  unavailable = (prev.unavailable || []).filter(u => u.species !== ONLY).concat(unavailable);
}
const js = 'window.RWQ=window.RWQ||{};window.RWQ.co=' + JSON.stringify(pack) + ';\n';
writeFileSync(join(privateDir, 'co-quotas.js'), js);
const pub = {
  state: 'colorado',
  years: YEARS,
  counts: 'not in this file',
  huntersAfield: 'not available in this build',
  note: NOTE,
  huntsWithAYear: Object.keys(pack.hunts).length,
  sources,
  unavailable
};
writeFileSync(pubPath, JSON.stringify(pub, null, 2) + '\n');
console.log('hunts', Object.keys(hunts).length);
const sample = hunts.DM060O3R;
console.log('DM060O3R', JSON.stringify(sample));
console.log('DM060O2R', JSON.stringify(hunts.DM060O2R));
