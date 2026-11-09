// Nevada 2023-2025 history from the bonus-point PDFs linked on NDOW's bonus-point page.
// 1st-choice success divided by 1st-choice applicants, same band rule as scripts/build-nevada-bands.mjs.
// A prior year is attached only when species, sex, weapon, program, residency and unit list match,
// and a unit with more than one season matches only when the month and day also match.
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {bandOf, packPoints} from './bands.mjs';
import {parsePdf} from '../build-nevada-bands.mjs';

const root = new URL('../..', import.meta.url).pathname;
const PAGE = 'https://www.ndow.org/blog/bonus-point-data/';
const YEARS = [2023, 2024, 2025];

function pdfText(path) {
  return execFileSync('pdftotext', ['-tsv', path, '-'], {encoding:'utf8', maxBuffer: 64 * 1024 * 1024});
}
function unitsNorm(s) {
  return String(s).toUpperCase().replace(/\s+/g, '');
}
function seasonKey(s) {
  const months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  const hits = [...String(s).toLowerCase().matchAll(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/g)];
  if (hits.length < 2) return '';
  return hits.slice(0, 2).map(h => `${months[h[1]]}-${Number(h[2])}`).join('|');
}
function stable(h) {
  return [h.sp, h.sx, h.wpn, h.who, h.live, unitsNorm(h.units)].join('|');
}

const sandbox = {window:{}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'nevada/data.js'), 'utf8') + '\nglobalThis.NH=NH;', sandbox);
const current = sandbox.NH;

const html = await (await fetch(PAGE, {headers:{'user-agent':'Mozilla/5.0 Rokwilder research'}})).text();
const hrefs = [...html.matchAll(/https:\/\/www\.ndow\.org\/wp-content\/uploads\/[^"']+\.pdf/g)].map(m => m[0]);
const files = [...new Set(hrefs)].filter(url => /Bonus-Point/i.test(url) && YEARS.some(y => url.includes(String(y))));
console.log('pdfs', files.length);

const dir = join(tmpdir(), 'ndow-history');
mkdirSync(dir, {recursive:true});
const byYear = {};
const skipped = [];
const sources = [];
for (const url of files) {
  const year = YEARS.find(y => url.includes('-' + y + '.pdf') || url.includes(String(y) + '.pdf'));
  if (!year) continue;
  const name = url.split('/').pop();
  const dest = join(dir, year + '-' + name);
  try {
    execFileSync('curl', ['-fsSL', '-A', 'Mozilla/5.0', '-o', dest, url], {stdio:'inherit'});
    const parsed = parsePdf(pdfText(dest), name, url);
    if (!byYear[year]) byYear[year] = [];
    for (const h of parsed) {
      const bp = {};
      for (const row of h.rows) {
        if (!row.a[0]) continue;
        const rate = row.s[0] / row.a[0];
        if (row.s[0] > row.a[0]) throw new Error('success above applicants ' + h.units);
        bp[row.point] = rate;
      }
      byYear[year].push({...h, bp, stable: stable(h), seasonKey: seasonKey(h.season)});
    }
    sources.push({year, url, hunts: parsed.length});
    console.log('ok', year, name, parsed.length);
  } catch (err) {
    skipped.push({year, url, why: String(err.message || err).slice(0, 240)});
    console.log('skip', name, err.message);
  }
}

function indexYear(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.stable)) map.set(row.stable, []);
    map.get(row.stable).push(row);
  }
  return map;
}
const indexed = {};
for (const year of YEARS) indexed[year] = indexYear(byYear[year] || []);

const currentGroups = new Map();
for (const [key, h] of Object.entries(current)) {
  const id = stable(h);
  if (!currentGroups.has(id)) currentGroups.set(id, []);
  currentGroups.get(id).push({key, h, seasonKey: seasonKey(h.season)});
}

const hunts = {};
let unmatched = 0;
let bandMismatch = 0;
for (const [id, group] of currentGroups) {
  for (const cur of group) {
    const yearPoints = {};
    for (const year of YEARS) {
      const candidates = indexed[year].get(id) || [];
      let pick = null;
      if (candidates.length === 1 && group.length === 1) pick = candidates[0];
      else {
        const same = candidates.filter(c => c.seasonKey && c.seasonKey === cur.seasonKey);
        if (same.length === 1) pick = same[0];
      }
      if (!pick) continue;
      if (year === 2025) {
        const published = cur.h.bp || {};
        let bad = false;
        for (const [point, rate] of Object.entries(pick.bp)) {
          if (bandOf(rate, 'drew') !== published[point]) bad = true;
        }
        for (const point of Object.keys(published)) {
          if (pick.bp[point] == null || bandOf(pick.bp[point], 'drew') !== published[point]) bad = true;
        }
        if (bad) { bandMismatch++; continue; }
      }
      yearPoints[year] = pick.bp;
    }
    const packed = packPoints(yearPoints, YEARS, 'drew');
    if (!packed) { unmatched++; continue; }
    hunts[cur.key] = packed;
  }
}

const out = {
  state: 'nevada',
  words: 'drew',
  years: YEARS,
  note: 'NDOW 1st-choice result at this bonus-point level. A blank level was not in that year\'s table. Not a forecast.',
  hunts
};
writeFileSync(join(root, 'find/history/nevada.json'), JSON.stringify(out));
writeFileSync(join(root, 'find/history/nevada.sources.json'), JSON.stringify({
  state: 'nevada',
  yearsAdded: YEARS,
  unavailable: [{
    year: 2026,
    why: 'NDOW\'s bonus-point page links 2025 main-draw tables. No 2026 hunt-level bonus-point table was linked there.'
  }, ...skipped.map(s => ({year: s.year, url: s.url, why: 'The PDF could not be parsed with the same column checks as 2025: ' + s.why}))],
  match: 'Species, sex, weapon, residency, program (main, junior or guided) and unit list must match. If a unit has more than one season, the month and day must match too. A changed unit list is not history.',
  band: 'drew',
  hunts: Object.keys(hunts).length,
  currentWithoutHistory: unmatched,
  reparseMismatch2025: bandMismatch,
  sources,
  page: PAGE
}, null, 2));
console.log('history hunts', Object.keys(hunts).length, 'unmatched', unmatched, '2025 mismatch', bandMismatch, 'skipped files', skipped.length);
