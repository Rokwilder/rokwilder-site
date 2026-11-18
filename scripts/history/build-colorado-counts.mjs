// Colorado tag quotas and first-choice applicants from CPW primary post-draw recaps.
// Reads the printed Total Quota amount and the printed Total Choice 1 general plus
// landowner (LPP) applicant totals. Does not estimate a missing cell. Does not use
// choice 2, 3, or 4.
//
// Writes:
//   private/fullpass/co-counts.js
//     Exact counts. Git ignores private/. Paste this file onto the end of the
//     member-only script at https://api.rokwilder.com/api/fullpass/data/co.js.
//     It merges into window.RWQ.co and does not replace a quota or a drawn count
//     that file already set. Do not commit the counts. Do not put them on the site.
//   find/history/colorado-counts.sources.json
//     Source pages and PDF links only. No tag counts and no applicant counts.
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const YEARS = [2024, 2025, 2026];
const CODE = /^[A-Z]{2,3}\d{2,3}[A-Z]\d[A-Z]$/;
const FILES = [
  [2024, 'elk', '/tmp/cpw/2024-elk.pdf', 'https://cpw.widen.net/content/v8uftzwwry/original/2024-Primary-ELK-Post-Draw-Report.pdf', 'https://cpw.state.co.us/activities/hunting/big-game/hunting-elk/elk-statistics'],
  [2025, 'elk', '/tmp/cpw/2025-elk.pdf', 'https://cpw.widen.net/content/v8vurwjjn6/original/PostDrawRecapReport_ELK-25_05172025_0612.pdf', 'https://cpw.state.co.us/activities/hunting/big-game/hunting-elk/elk-statistics'],
  [2026, 'elk', '/tmp/cpw/2026-elk.pdf', 'https://cpw.widen.net/content/tl5sj6pnkb/original/PostDrawRecapReport_ELK-26_05142026_1426.pdf', 'https://cpw.state.co.us/activities/hunting/big-game/hunting-elk/elk-statistics'],
  [2024, 'deer', '/tmp/cpw/2024-deer.pdf', 'https://cpw.widen.net/content/dmbkrapqzq/original/2024-Primary-DEER-Post-Draw-Report.pdf', 'https://cpw.state.co.us/activities/hunting/big-game/hunting-deer/deer-statistics'],
  [2025, 'deer', '/tmp/cpw/2025-deer.pdf', 'https://cpw.widen.net/content/vy2t2jygvr/original/PostDrawRecapReport_DEER-25_05102025_1540.pdf', 'https://cpw.state.co.us/activities/hunting/big-game/hunting-deer/deer-statistics'],
  [2026, 'deer', '/tmp/cpw/2026-deer.pdf', 'https://cpw.widen.net/content/mirgybedih/original/PostDrawRecapReport_DEER-26_05112026_1505.pdf', 'https://cpw.state.co.us/activities/hunting/big-game/hunting-deer/deer-statistics'],
  [2024, 'pronghorn', '/tmp/cpw/2024-pronghorn.pdf', 'https://cpw.widen.net/content/ltxj5zp37d/original/2024-Primary-PRONGHORN-Post-Draw-Report.pdf', 'https://cpw.state.co.us/activities/hunting/big-game/hunting-pronghorn/pronghorn-statistics'],
  [2025, 'pronghorn', '/tmp/cpw/2025-pronghorn.pdf', 'https://cpw.widen.net/content/jsyu9ob6ci/original/PostDrawRecapReport_PRONG-25_05222025_0816.pdf', 'https://cpw.state.co.us/activities/hunting/big-game/hunting-pronghorn/pronghorn-statistics'],
  [2026, 'pronghorn', '/tmp/cpw/2026-pronghorn.pdf', 'https://cpw.widen.net/content/5facqkeb5y/original/PostDrawRecapReport_PRONG-26_05212026_1006.pdf', 'https://cpw.state.co.us/activities/hunting/big-game/hunting-pronghorn/pronghorn-statistics'],
  [2024, 'bear', '/tmp/cpw/2024-bear.pdf', 'https://cpw.widen.net/content/nyn9eoj6jp/original/2024-Primary-BEAR-Post-Draw-Report.pdf', 'https://cpw.state.co.us/activities/hunting/big-game/hunting-bear/bear-statistics'],
  [2025, 'bear', '/tmp/cpw/2025-bear.pdf', 'https://cpw.widen.net/content/sforuen1ne/original/PostDrawRecapReport_BEAR-25_05072025_1542.pdf', 'https://cpw.state.co.us/activities/hunting/big-game/hunting-bear/bear-statistics'],
  [2026, 'bear', '/tmp/cpw/2026-bear.pdf', 'https://cpw.widen.net/content/56phze0u6t/original/PostDrawRecapReport_BEAR-26_05062026_1346.pdf', 'https://cpw.state.co.us/activities/hunting/big-game/hunting-bear/bear-statistics']
];

function pagesOf(pdf) {
  const tsv = execFileSync('pdftotext', ['-tsv', pdf, '-'], {encoding:'utf8', maxBuffer: 512 * 1024 * 1024});
  const pages = new Map();
  for (const line of tsv.split('\n')) {
    const c = line.split('\t');
    if (c.length < 12 || c[0] === 'level') continue;
    const text = c.slice(11).join(' ').trim();
    if (!text || text.startsWith('###')) continue;
    const page = Number(c[1]);
    if (!pages.has(page)) pages.set(page, []);
    pages.get(page).push({left: Number(c[6]), top: Number(c[7]), text});
  }
  return pages;
}

function linesOf(words) {
  const rows = words.slice().sort((a, b) => a.top - b.top || a.left - b.left);
  const lines = [];
  for (const word of rows) {
    const last = lines[lines.length - 1];
    if (!last || Math.abs(word.top - last.top) > 1.6) lines.push({top: word.top, words: [word]});
    else last.words.push(word);
  }
  for (const line of lines) line.words.sort((a, b) => a.left - b.left);
  return lines;
}

function asCount(text) {
  if (text === '-' || text === '–' || text === '—') return 0;
  if (/^\d+$/.test(text)) return Number(text);
  return null;
}

function parsePage(words) {
  const lines = linesOf(words);
  const codes = words.filter(w => CODE.test(w.text));
  const unique = [];
  for (const code of codes) {
    if (!unique.some(u => u.text === code.text)) unique.push(code);
  }
  const out = [];
  for (const code of unique) {
    let quota = null;
    const amounts = words.filter(w => w.text === 'Amount' && w.top < code.top + 80);
    amounts.sort((a, b) => Math.abs(a.left - 70) - Math.abs(b.left - 70));
    for (const amount of amounts) {
      const nums = words.filter(w => /^\d+$/.test(w.text) && w.top > amount.top && w.top < amount.top + 20 && Math.abs(w.left - amount.left) < 40);
      nums.sort((a, b) => a.top - b.top || Math.abs(a.left - amount.left) - Math.abs(b.left - amount.left));
      if (nums[0]) { quota = Number(nums[0].text); break; }
    }
    let apps = null;
    for (const line of lines) {
      const ws = line.words;
      const total = ws.findIndex(w => w.text === 'Total');
      if (total < 0 || ws[total].left > 250) continue;
      if (ws[total + 1]?.text !== 'Choice' || ws[total + 2]?.text !== '1') continue;
      const nums = [];
      for (let i = total + 3; i < ws.length; i++) {
        if (ws[i].left > 430) break;
        const n = asCount(ws[i].text);
        if (n == null) continue;
        nums.push(n);
      }
      if (nums.length !== 2) continue;
      apps = nums[0] + nums[1];
      break;
    }
    out.push({code: code.text, quota, apps});
  }
  return out;
}

const hunts = {};
const sources = [];
const skipped = [];
for (const [year, species, pdf, url, page] of FILES) {
  const pages = pagesOf(pdf);
  let kept = 0, quotaN = 0, appsN = 0, both = 0;
  for (const words of pages.values()) {
    for (const row of parsePage(words)) {
      if (row.quota == null && row.apps == null) continue;
      const rec = hunts[row.code] || (hunts[row.code] = {});
      const key = String(year);
      const cell = rec[key] || {};
      if (row.quota != null) {
        if (cell.quota != null && cell.quota !== row.quota) cell.quota = null;
        else if (cell.quota == null) { cell.quota = row.quota; quotaN++; }
      }
      if (row.apps != null) {
        if (cell.apps != null && cell.apps !== row.apps) cell.apps = null;
        else if (cell.apps == null) { cell.apps = row.apps; appsN++; }
      }
      if (cell.quota == null && cell.apps == null) continue;
      if (cell.quota != null && cell.apps != null) both++;
      rec[key] = cell;
      kept++;
    }
  }
  sources.push({year, species, page, pdf: url, hunts: kept, withQuota: quotaN, withApplicants: appsN, withBoth: both});
  console.log(species, year, 'hunts', kept, 'quota', quotaN, 'applicants', appsN);
  if (!kept) skipped.push({species, year, why: 'The primary recap did not yield a quota or a first-choice applicant total.'});
}

for (const rec of Object.values(hunts)) {
  for (const year of Object.keys(rec)) {
    const cell = rec[year];
    if (cell.quota == null) delete cell.quota;
    if (cell.apps == null) delete cell.apps;
    if (cell.quota == null && cell.apps == null) delete rec[year];
  }
}
for (const code of Object.keys(hunts)) {
  if (!Object.keys(hunts[code]).length) delete hunts[code];
}
const note = 'Tags are the Total Quota amount printed on the CPW primary post-draw recap. Applicants are the printed Total Choice 1 general applicants plus the printed Total Choice 1 landowner (LPP) applicants. Choice 2, 3, and 4 are not included. A missing year was not in that recap. These figures are not estimates.';
const pack = {years: YEARS, note, sources, skipped, hunts};
const privateDir = join(root, 'private/fullpass');
mkdirSync(privateDir, {recursive: true});
const js = '(function(){\n'
  + 'var add=' + JSON.stringify(pack) + ';\n'
  + 'var root=window.RWQ=window.RWQ||{};\n'
  + 'var pack=root.co=root.co||{years:[],hunts:{}};\n'
  + 'var years={};(pack.years||[]).concat(add.years||[]).forEach(function(y){years[y]=1});\n'
  + 'pack.years=Object.keys(years).map(Number).sort(function(a,b){return a-b});\n'
  + 'pack.countsNote=add.note;\n'
  + 'pack.countsSources=add.sources;\n'
  + 'pack.hunts=pack.hunts||{};\n'
  + 'Object.keys(add.hunts).forEach(function(code){\n'
  + '  var dest=pack.hunts[code]=pack.hunts[code]||{};\n'
  + '  var src=add.hunts[code];\n'
  + '  Object.keys(src).forEach(function(year){\n'
  + '    var from=src[year]||{};\n'
  + '    var cell=dest[year]=dest[year]||{};\n'
  + '    if(typeof from.quota==="number"&&typeof cell.quota!=="number")cell.quota=from.quota;\n'
  + '    if(typeof from.apps==="number")cell.apps=from.apps;\n'
  + '  });\n'
  + '});\n'
  + '})();\n';
writeFileSync(join(privateDir, 'co-counts.js'), js);
const pub = {
  state: 'colorado',
  years: YEARS,
  counts: 'not in this file',
  note: 'Source list only. Tag quotas and applicant counts are not in this file. They belong in the Full Pass file served by the member API.',
  species: sources.map(s => s.species).filter((v, i, a) => a.indexOf(v) === i),
  sources: sources.map(s => ({year: s.year, species: s.species, page: s.page, pdf: s.pdf}))
};
writeFileSync(join(root, 'find/history/colorado-counts.sources.json'), JSON.stringify(pub, null, 2) + '\n');
console.log('hunts', Object.keys(hunts).length);
const check = hunts.BE001O1A && hunts.BE001O1A['2026'];
const elk = hunts.EE001O1A && hunts.EE001O1A['2026'];
console.log('BE001O1A 2026', JSON.stringify(check));
console.log('EE001O1A 2026', JSON.stringify(elk));
if (!check || check.quota !== 5 || check.apps !== 5) {
  console.error('bear check failed');
  process.exit(1);
}
if (!elk || elk.quota !== 5 || elk.apps !== 113) {
  console.error('elk check failed');
  process.exit(1);
}
