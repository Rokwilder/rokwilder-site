// Colorado 2024-2026 primary draw recaps from the statistics pages on cpw.state.co.us.
// Choice 1 only. Adult and youth columns stay separate. Resident and nonresident stay separate.
// A year is kept only when the hunt code is the same. Codes that changed are left out.
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {packPoints} from './bands.mjs';

const root = new URL('../..', import.meta.url).pathname;
const YEARS = [2024, 2025, 2026];
const ONLY = process.env.ONLY || '';
const PAGES = [
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-elk/elk-statistics', 'elk'],
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-deer/deer-statistics', 'deer'],
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-pronghorn/pronghorn-statistics', 'pronghorn'],
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-bear/bear-statistics', 'bear'],
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-moose/moose-statistics', 'moose'],
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-bighorn-sheep/bighorn-sheep-statistics', 'sheep'],
  ['https://cpw.state.co.us/activities/hunting/big-game/hunting-mountain-goat/mountain-goat-statistics', 'goat'],
  ['https://cpw.state.co.us/activities/hunting/small-game/turkey/turkey-statistics', 'turkey']
];

function yearOf(slug) {
  if (/2026|[-_]26\b/.test(slug)) return 2026;
  if (/2025|[-_]25\b/.test(slug)) return 2025;
  if (/2024|[-_]24\b/.test(slug)) return 2024;
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
function num(token) {
  if (token === '-' || token === '–' || token === '—') return 0;
  if (!/^\d+$/.test(token)) return null;
  return Number(token);
}
function linesOf(tsv) {
  const rows = [];
  for (const line of tsv.split('\n')) {
    const cols = line.split('\t');
    if (cols.length < 12 || cols[0] === 'level') continue;
    const text = cols.slice(11).join(' ').trim();
    if (!text || text.startsWith('###')) continue;
    rows.push({page:Number(cols[1]), left:Number(cols[6]), top:Number(cols[7]), text});
  }
  const byPage = new Map();
  for (const w of rows) {
    if (!byPage.has(w.page)) byPage.set(w.page, []);
    byPage.get(w.page).push(w);
  }
  const groups = [];
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const ws = byPage.get(page).sort((a, b) => a.top - b.top || a.left - b.left);
    let cur = [];
    let anchor = null;
    const flush = () => {
      if (!cur.length) return;
      cur.sort((a, b) => a.left - b.left);
      groups.push(cur);
      cur = [];
    };
    for (const w of ws) {
      if (anchor === null || Math.abs(w.top - anchor) <= 2.2) {
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
  return groups;
}
function parseRecap(tsv) {
  const lines = linesOf(tsv);
  const hunts = {};
  let code = null;
  let lastPoint = null;
  let stopped = false;
  function start(next) {
    code = next;
    lastPoint = null;
    stopped = false;
    if (!hunts[code]) hunts[code] = {res:{}, nonres:{}, yres:{}, ynonres:{}};
  }
  for (const words of lines) {
    const texts = words.map(w => w.text);
    const joined = texts.join(' ');
    const found = texts.find(t => /^[A-Z]{2,3}\d{2,3}[A-Z]\d[A-Z]$/.test(t));
    if (found && texts.filter(t => t === found).length === 1 && !/^\d+$/.test(texts[0])) {
      if (texts.length < 8) { start(found); continue; }
    }
    if (lastPoint != null && (/^Total Choice 1$/.test(joined) || joined.startsWith('Total Choice 1 '))) {
      stopped = true;
      continue;
    }
    if (!code || stopped) continue;
    const marks = [];
    words.forEach((w, i) => {
      if (/^\d{1,2}$/.test(w.text) && Number(w.text) <= 40) marks.push(i);
    });
    let pair = null;
    for (let a = 0; a < marks.length && !pair; a++) {
      for (let b = a + 1; b < marks.length; b++) {
        if (words[marks[a]].text === words[marks[b]].text && words[marks[b]].left - words[marks[a]].left > 180) {
          pair = [marks[a], marks[b]];
          break;
        }
      }
    }
    if (!pair) continue;
    const point = Number(words[pair[0]].text);
    const left = words.slice(pair[0] + 1, pair[1]).map(w => w.text);
    const right = words.slice(pair[1] + 1, pair[1] + 7).map(w => w.text);
    if (left.length !== 6 || right.length !== 6) continue;
    const L = left.map(num);
    const R = right.map(num);
    if (L.some(v => v == null) || R.some(v => v == null)) continue;
    if (lastPoint != null && point >= lastPoint) { stopped = true; continue; }
    const hunt = hunts[code];
    if ([hunt.res, hunt.nonres, hunt.yres, hunt.ynonres].some(bag => bag[point] != null)) { stopped = true; continue; }
    let bad = false;
    const put = (bag, apps, drew) => {
      if (bad || apps <= 0) return;
      if (drew > apps) { bad = true; return; }
      bag[point] = drew / apps;
    };
    put(hunt.res, L[0], R[0]);
    put(hunt.nonres, L[1], R[1]);
    put(hunt.yres, L[2], R[2]);
    put(hunt.ynonres, L[3], R[3]);
    if (bad) { delete hunts[code]; code = null; continue; }
    lastPoint = point;
  }
  for (const [k, h] of Object.entries(hunts)) {
    if (!Object.keys(h.res).length && !Object.keys(h.nonres).length && !Object.keys(h.yres).length && !Object.keys(h.ynonres).length) delete hunts[k];
  }
  return hunts;
}

const sandbox = {window:{}, FL:{}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'drawodds/lite.js'), 'utf8') + '\n' + readFileSync(join(root, 'find/labels.js'), 'utf8') + '\n' + readFileSync(join(root, 'drawodds/oial.js'), 'utf8') + '\nglobalThis.D=D;', sandbox);
const codes = new Set(Object.keys(sandbox.D));
console.log('site codes', codes.size);

const dir = join(tmpdir(), 'cpw-history');
mkdirSync(dir, {recursive:true});
const byYear = {2024:{}, 2025:{}, 2026:{}};
const sources = [];
const unavailable = [];
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
    if (!year) continue;
    if (picks[year]) picks[year].push(link);
    else picks[year] = [link];
  }
  for (const year of YEARS) {
    const list = picks[year] || [];
    if (list.length !== 1) {
      unavailable.push({species, year, why: list.length ? 'More than one primary recap link, so none was used.' : 'No primary draw recap link on the statistics page.', links:list});
      console.log('ambiguous', species, year, list.length);
      continue;
    }
    const viewer = list[0];
    try {
      const view = await get(viewer);
      const file = view.match(/href="(\/content\/[^"]+\.pdf\?[^"]*download=true)"/);
      if (!file) throw new Error('no original PDF on the viewer page');
      const pdfUrl = 'https://cpw.widen.net' + file[1].replace(/&amp;/g, '&');
      const dest = join(dir, `${species}-${year}.pdf`);
      execFileSync('curl', ['-fsSL', '-A', 'Mozilla/5.0', '-o', dest, pdfUrl], {stdio:'inherit'});
      const tsv = execFileSync('pdftotext', ['-tsv', dest, '-'], {encoding:'utf8', maxBuffer: 256 * 1024 * 1024});
      const parsed = parseRecap(tsv);
      let kept = 0;
      for (const [code, rows] of Object.entries(parsed)) {
        if (!codes.has(code)) continue;
        byYear[year][code] = rows;
        kept++;
      }
      sources.push({year, species, page, viewer, pdf: pdfUrl.split('?')[0], parsed:Object.keys(parsed).length, matched:kept});
      console.log('ok', species, year, 'parsed', Object.keys(parsed).length, 'matched', kept);
    } catch (err) {
      unavailable.push({species, year, why:'The recap could not be parsed: ' + String(err.message || err).slice(0, 180), viewer});
      console.log('fail', species, year, err.message);
    }
  }
}

const hunts = {};
for (const code of codes) {
  const rec = {};
  for (const side of ['res', 'nonres', 'yres', 'ynonres']) {
    const yearPoints = {};
    for (const year of YEARS) {
      const row = byYear[year][code];
      if (row && row[side] && Object.keys(row[side]).length) yearPoints[year] = row[side];
    }
    const packed = packPoints(yearPoints, YEARS, 'yes');
    if (packed) rec[side] = packed;
  }
  if (Object.keys(rec).length) hunts[code] = rec;
}
const out = {
  state: 'colorado',
  words: 'yes',
  years: YEARS,
  note: 'CPW primary-draw result, 1st choice, at this point level. This is the published draw, not the 2027 estimate on the card. Youth rows use the youth columns. Not a forecast.',
  hunts
};
writeFileSync(join(root, 'find/history/colorado.json'), JSON.stringify(out));
writeFileSync(join(root, 'find/history/colorado.sources.json'), JSON.stringify({
  state: 'colorado',
  yearsAdded: YEARS.filter(year => sources.some(s => s.year === year)),
  unavailable,
  match: 'The hunt code must be identical. A renamed or replaced code is not matched to an older code.',
  band: 'yes',
  choice: '1st choice only. Adult resident, adult nonresident, youth resident and youth nonresident are separate. Landowner columns are not used.',
  hunts: Object.keys(hunts).length,
  sources
}, null, 2));
console.log('history hunts', Object.keys(hunts).length);
