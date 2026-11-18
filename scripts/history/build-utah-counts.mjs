// Utah permit and applicant totals from the DWR draw-odds PDFs.
// Uses the printed Totals line only. Point rows are added to check that line.
// A hunt is skipped when those two readings disagree. 2026 has no hunt-level PDF.
//
// Tags are permits the draw issued (resident total plus nonresident total).
// DWR does not print a separate quota on this report.
// Applicants are resident eligible applicants plus nonresident eligible applicants.
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {writeCounts, writeSourceList} from './write-counts.mjs';

const root = new URL('../..', import.meta.url).pathname;
const YEARS = [2024, 2025];
const PAGE = 'https://wildlife.utah.gov/biggame/odds';
const FILES = {
  2024: [
    ['https://wildlife.utah.gov/pdf/bg/2024/24_bg-odds.pdf', 'limited'],
    ['https://wildlife.utah.gov/pdf/bg/2024/24_deer_odds.pdf', 'deer'],
    ['https://wildlife.utah.gov/pdf/bg/2024/24_antlerless_drawing_odds_report.pdf', 'antlerless'],
    ['https://wildlife.utah.gov/pdf/bg/2024/24_youth_elk.pdf', 'youth-elk'],
    ['https://wildlife.utah.gov/pdf/bg/2024/24_youth_deer.pdf', 'youth-deer'],
    ['https://wildlife.utah.gov/pdf/bg/2024/24_dh_odds.pdf', 'dedicated']
  ],
  2025: [
    ['https://wildlife.utah.gov/pdf/bg/2025/25_bg-odds.pdf', 'limited'],
    ['https://wildlife.utah.gov/pdf/bg/2025/25_deer_odds.pdf', 'deer'],
    ['https://wildlife.utah.gov/pdf/bg/2025/25_antlerless_drawing_odds_report.pdf', 'antlerless'],
    ['https://wildlife.utah.gov/pdf/bg/2025/25_youth_elk.pdf', 'youth-elk'],
    ['https://wildlife.utah.gov/pdf/bg/2025/25_youth_deer.pdf', 'youth-deer'],
    ['https://wildlife.utah.gov/pdf/bg/2025/25_dh_odds.pdf', 'dedicated']
  ]
};
const RATIO = '(?:N\\/A|1 in \\d+(?:\\.\\d+)?)';
const POINT = new RegExp('^(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+' + RATIO + '\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+' + RATIO + '$');
const TOTAL = new RegExp('^Totals\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+' + RATIO + '\\s+Totals\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+' + RATIO + '$');

function parsePdf(text) {
  const hunts = {};
  let skipped = 0;
  for (const chunk of text.split(/Hunt:\s+/).slice(1)) {
    const code = (chunk.match(/^([A-Z]{1,3}\d{3,5})\b/) || [])[1];
    if (!code) { skipped++; continue; }
    let sum = null;
    let printed = null;
    for (const raw of chunk.split('\n')) {
      const line = raw.replace(/\s+/g, ' ').trim();
      const point = line.match(POINT);
      if (point) {
        if (Number(point[1]) !== Number(point[6])) { sum = null; printed = null; break; }
        sum = sum || {resApps: 0, resPermits: 0, nrApps: 0, nrPermits: 0, rows: 0};
        sum.resApps += Number(point[2]);
        sum.resPermits += Number(point[5]);
        sum.nrApps += Number(point[7]);
        sum.nrPermits += Number(point[10]);
        sum.rows++;
        continue;
      }
      const total = line.match(TOTAL);
      if (total) {
        printed = {
          resApps: Number(total[1]),
          resPermits: Number(total[4]),
          nrApps: Number(total[5]),
          nrPermits: Number(total[8])
        };
      }
    }
    if (!sum || !printed || !sum.rows
      || sum.resApps !== printed.resApps || sum.resPermits !== printed.resPermits
      || sum.nrApps !== printed.nrApps || sum.nrPermits !== printed.nrPermits) {
      skipped++;
      continue;
    }
    const row = {quota: printed.resPermits + printed.nrPermits, apps: printed.resApps + printed.nrApps};
    if (hunts[code] && (hunts[code].quota !== row.quota || hunts[code].apps !== row.apps)) {
      hunts[code] = null;
      skipped++;
      continue;
    }
    hunts[code] = row;
  }
  return {hunts, skipped};
}

const sandbox = {window: {}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'utah/data.js'), 'utf8') + '\nglobalThis.UH=UH;', sandbox);
const codes = new Set(Object.keys(sandbox.UH));
const dir = join(tmpdir(), 'utah-counts');
mkdirSync(dir, {recursive: true});

const hunts = {};
const sources = [];
const skipped = [{
  year: 2026,
  why: 'Utah DWR did not publish a 2026 hunt-level draw-odds PDF. The odds page sends 2026 to the interactive draw site.'
}];
for (const year of YEARS) {
  for (const [url, name] of FILES[year]) {
    const dest = join(dir, year + '-' + name + '.pdf');
    try {
      execFileSync('curl', ['-fsSL', '-A', 'Mozilla/5.0', '-o', dest, url], {stdio: 'inherit'});
      const text = execFileSync('pdftotext', ['-layout', dest, '-'], {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024});
      if (!/Utah|Draw Results|Applicants/.test(text.slice(0, 2000))) throw new Error('not a DWR draw-results PDF');
      const parsed = parsePdf(text);
      let matched = 0;
      for (const [code, row] of Object.entries(parsed.hunts)) {
        if (!row || !codes.has(code)) continue;
        const rec = hunts[code] || (hunts[code] = {});
        const prev = rec[String(year)];
        if (prev && (prev.quota !== row.quota || prev.apps !== row.apps)) {
          delete rec[String(year)];
          continue;
        }
        rec[String(year)] = row;
        matched++;
      }
      const parsedN = Object.keys(parsed.hunts).filter(k => parsed.hunts[k]).length;
      sources.push({year, name, page: PAGE, pdf: url, parsed: parsedN, matched, rowsSkipped: parsed.skipped});
      console.log('ok', year, name, 'matched', matched, 'skipped rows', parsed.skipped);
      if (!parsedN) skipped.push({year, name, why: 'This PDF has no hunt number. It is a statewide applicant table, so it was not applied to a hunt.'});
      else if (!matched) skipped.push({year, name, why: 'No hunt on this PDF matched a current hunt code and the printed Totals line.'});
    } catch (err) {
      skipped.push({year, name, url, why: 'Could not read: ' + String(err.message || err).slice(0, 180)});
      console.log('fail', year, name, err.message);
    }
  }
}
for (const code of Object.keys(hunts)) {
  if (!Object.keys(hunts[code]).length) delete hunts[code];
}

const note = 'Tags are permits the Utah draw issued: the printed resident Total permits plus the printed nonresident Total permits. That figure is bonus permits plus regular permits. Utah does not print a separate quota on this report. Applicants are the printed resident Total Eligible Applicants plus the printed nonresident Total Eligible Applicants. Point rows are used only to check the printed Totals line. A hunt is left out when those two readings disagree, or when two reports give different totals for the same hunt number. 2026 was not published as a hunt table. These figures are not estimates.';
const pack = {state: 'utah', years: YEARS, note, sources, skipped, hunts};
writeCounts(root, 'ut', pack);
writeSourceList(root, 'utah', {
  state: 'utah',
  years: YEARS,
  counts: 'not in this file',
  note: 'Source list only. Permit totals and applicant counts are not in this file. They belong in the Full Pass file served by the member API.',
  page: PAGE,
  unavailable: skipped.filter(s => s.why && !s.url).map(s => (s.name ? s.year + ' ' + s.name + ': ' : '') + s.why),
  sources: sources.map(s => ({year: s.year, name: s.name, page: s.page, pdf: s.pdf}))
});
const sample = hunts.EB3003;
console.log('hunts', Object.keys(hunts).length);
console.log('EB3003', JSON.stringify(sample));
if (!sample || sample['2024'].quota !== 13 || sample['2024'].apps !== 24 || sample['2025'].quota !== 11 || sample['2025'].apps !== 26) {
  console.error('Meadowville EB3003 did not match the printed Totals lines');
  process.exit(1);
}
