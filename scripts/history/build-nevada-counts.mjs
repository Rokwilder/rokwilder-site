// Nevada quotas and first-choice applicants from the NDOW bonus-point PDFs.
// Quota is the printed Quota line. Applicants are the printed 1st-choice total.
// That total must equal the sum of the 1st-choice point rows, which the PDF parser checks.
// 2nd through 5th choice are not included. 2026 is not linked on the bonus-point page.
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {parsePdf} from '../build-nevada-bands.mjs';
import {writeCounts, writeSourceList} from './write-counts.mjs';

const root = new URL('../..', import.meta.url).pathname;
const PAGE = 'https://www.ndow.org/blog/bonus-point-data/';
const YEARS = [2024, 2025];

function pdfText(path) {
  return execFileSync('pdftotext', ['-tsv', path, '-'], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
}
function unitsNorm(s) {
  return String(s).toUpperCase().replace(/\s+/g, '');
}
function seasonKey(s) {
  const months = {jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12};
  const hits = [...String(s).toLowerCase().matchAll(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/g)];
  if (hits.length < 2) return '';
  return hits.slice(0, 2).map(h => months[h[1]] + '-' + Number(h[2])).join('|');
}
function stable(h) {
  return [h.sp, h.sx, h.wpn, h.who, h.live, unitsNorm(h.units)].join('|');
}

const sandbox = {window: {}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'nevada/data.js'), 'utf8') + '\nglobalThis.NH=NH;', sandbox);
const current = sandbox.NH;

const html = await (await fetch(PAGE, {headers: {'user-agent': 'Mozilla/5.0 Rokwilder research'}})).text();
const hrefs = [...html.matchAll(/https:\/\/www\.ndow\.org\/wp-content\/uploads\/[^"']+\.pdf/g)].map(m => m[0]);
const files = [...new Set(hrefs)].filter(url => /Bonus-Point/i.test(url) && YEARS.some(y => url.includes(String(y))));
console.log('pdfs', files.length);

const dir = join(tmpdir(), 'ndow-counts');
mkdirSync(dir, {recursive: true});
const byYear = {};
const skipped = [{
  year: 2026,
  why: 'NDOW bonus-point page links the 2025 main-draw tables. No 2026 hunt-level table was linked there.'
}];
const sources = [];
for (const url of files) {
  const year = YEARS.find(y => url.includes('-' + y + '.pdf') || url.includes(String(y) + '.pdf'));
  if (!year) continue;
  const name = url.split('/').pop();
  const dest = join(dir, year + '-' + name);
  try {
    execFileSync('curl', ['-fsSL', '-A', 'Mozilla/5.0', '-o', dest, url], {stdio: 'inherit'});
    const parsed = parsePdf(pdfText(dest), name, url);
    if (!byYear[year]) byYear[year] = [];
    let used = 0;
    for (const h of parsed) {
      const apps = h.total && Number.isInteger(h.total.a[0]) ? h.total.a[0] : null;
      if (!Number.isInteger(h.quota) || apps == null) continue;
      byYear[year].push({...h, apps, stable: stable(h), seasonKey: seasonKey(h.season)});
      used++;
    }
    sources.push({year, page: PAGE, pdf: url, hunts: used});
    console.log('ok', year, name, used);
  } catch (err) {
    skipped.push({year, url, why: String(err.message || err).slice(0, 200)});
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
for (const [id, group] of currentGroups) {
  for (const cur of group) {
    const rec = {};
    for (const year of YEARS) {
      const candidates = indexed[year].get(id) || [];
      let pick = null;
      if (candidates.length === 1 && group.length === 1) pick = candidates[0];
      else {
        const same = candidates.filter(c => c.seasonKey && c.seasonKey === cur.seasonKey);
        if (same.length === 1) pick = same[0];
      }
      if (!pick) continue;
      rec[String(year)] = {quota: pick.quota, apps: pick.apps};
    }
    if (!Object.keys(rec).length) { unmatched++; continue; }
    hunts[cur.key] = rec;
  }
}

const note = 'Tags are the Quota printed on the NDOW bonus-point table for this residency and this hunt. Applicants are the printed 1st-choice applicant total. That total is checked against the sum of the 1st-choice point rows. 2nd through 5th choice are not included. Resident and nonresident tables are separate hunts on the site, so they are not added together. A unit list or season that does not match is left out. These figures are not estimates.';
writeCounts(root, 'nv', {
  state: 'nevada',
  years: YEARS,
  note,
  sources,
  skipped,
  unmatched,
  hunts
});
writeSourceList(root, 'nevada', {
  state: 'nevada',
  years: YEARS,
  counts: 'not in this file',
  note: 'Source list only. Quotas and applicant counts are not in this file. They belong in the Full Pass file served by the member API.',
  page: PAGE,
  unavailable: ['2026 was not linked on the bonus-point page. 2023 tables are on that page and are not in this file.'],
  sources: sources.map(s => ({year: s.year, page: s.page, pdf: s.pdf}))
});
const sampleKey = 'deer|M|alw|main|res|011-013|oct-05-2025-nov-05-2025';
const sample = hunts[sampleKey];
console.log('hunts', Object.keys(hunts).length, 'unmatched', unmatched, 'skipped files', skipped.length);
console.log(sampleKey, JSON.stringify(sample));
if (!sample || !sample['2025'] || sample['2025'].quota !== 40 || sample['2025'].apps !== 704) {
  console.error('resident mule deer 011-013 did not match the printed quota 40 and 704 first-choice applicants');
  process.exit(1);
}
