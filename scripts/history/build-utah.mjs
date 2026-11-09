// Utah 2023-2025 draw-result history from the PDFs on wildlife.utah.gov/biggame/odds.
// The rate is total permits divided by eligible applicants at that point level.
// A row is kept only when that ratio agrees with the "1 in X" figure DWR prints.
// 2026 is the interactive draw site. DWR did not publish a 2026 hunt-level PDF.
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {packPoints} from './bands.mjs';

const root = new URL('../..', import.meta.url).pathname;
const YEARS = [2023, 2024, 2025];
const FILES = {
  2023: [
    ['https://wildlife.utah.gov/pdf/bg/2023/23_bg-odds.pdf', 'limited', false],
    ['https://wildlife.utah.gov/pdf/bg/2023/23_deer_odds.pdf', 'deer', false],
    ['https://wildlife.utah.gov/pdf/bg/2023/23_antlerless_drawing_odds_report.pdf', 'antlerless', false],
    ['https://wildlife.utah.gov/pdf/bg/2023/23_youth_elk.pdf', 'youth-elk', true],
    ['https://wildlife.utah.gov/pdf/bg/2023/23_youth_deer.pdf', 'youth-deer', true],
    ['https://wildlife.utah.gov/pdf/bg/2023/23_dh_odds.pdf', 'dedicated', false]
  ],
  2024: [
    ['https://wildlife.utah.gov/pdf/bg/2024/24_bg-odds.pdf', 'limited', false],
    ['https://wildlife.utah.gov/pdf/bg/2024/24_deer_odds.pdf', 'deer', false],
    ['https://wildlife.utah.gov/pdf/bg/2024/24_antlerless_drawing_odds_report.pdf', 'antlerless', false],
    ['https://wildlife.utah.gov/pdf/bg/2024/24_youth_elk.pdf', 'youth-elk', true],
    ['https://wildlife.utah.gov/pdf/bg/2024/24_youth_deer.pdf', 'youth-deer', true],
    ['https://wildlife.utah.gov/pdf/bg/2024/24_dh_odds.pdf', 'dedicated', false]
  ],
  2025: [
    ['https://wildlife.utah.gov/pdf/bg/2025/25_bg-odds.pdf', 'limited', false],
    ['https://wildlife.utah.gov/pdf/bg/2025/25_deer_odds.pdf', 'deer', false],
    ['https://wildlife.utah.gov/pdf/bg/2025/25_antlerless_drawing_odds_report.pdf', 'antlerless', false],
    ['https://wildlife.utah.gov/pdf/bg/2025/25_youth_elk.pdf', 'youth-elk', true],
    ['https://wildlife.utah.gov/pdf/bg/2025/25_youth_deer.pdf', 'youth-deer', true],
    ['https://wildlife.utah.gov/pdf/bg/2025/25_dh_odds.pdf', 'dedicated', false]
  ]
};

function agrees(apps, permits, printed) {
  if (printed === 'N/A') return permits === 0;
  const m = /^1 in (\d+(?:\.\d+)?)$/.exec(printed);
  if (!m || !permits) return false;
  const shown = Number(m[1]);
  return Math.abs(apps / permits - shown) <= 0.25;
}
function parsePdf(text, youth) {
  const chunks = text.split(/Hunt:\s+/).slice(1);
  const hunts = {};
  for (const chunk of chunks) {
    const code = (chunk.match(/^([A-Z]{1,3}\d{3,5})\b/) || [])[1];
    if (!code) continue;
    const res = {};
    const nonres = {};
    let bad = false;
    let rows = 0;
    for (const raw of chunk.split('\n')) {
      const line = raw.replace(/\s+/g, ' ').trim();
      if (!line || /^Totals\b/.test(line) || /^Points\b/.test(line)) continue;
      const m = line.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(N\/A|1 in \d+(?:\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(N\/A|1 in \d+(?:\.\d+)?)$/);
      if (!m) continue;
      const point = Number(m[1]);
      const resApps = Number(m[2]);
      const resPermits = Number(m[5]);
      const nrPoint = Number(m[7]);
      const nrApps = Number(m[8]);
      const nrPermits = Number(m[11]);
      if (point > 80 || nrPoint !== point) { bad = true; break; }
      if (!agrees(resApps, resPermits, m[6]) || !agrees(nrApps, nrPermits, m[12])) { bad = true; break; }
      if (resApps > 0) res[point] = resPermits / resApps;
      if (nrApps > 0) nonres[point] = nrPermits / nrApps;
      rows++;
    }
    if (bad || !rows) continue;
    hunts[code] = youth ? {yres: res, ynonres: nonres} : {res, nonres};
  }
  return hunts;
}

const sandbox = {window:{}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'utah/data.js'), 'utf8') + '\nglobalThis.UH=UH;', sandbox);
const codes = new Set(Object.keys(sandbox.UH));
const dir = join(tmpdir(), 'utah-history');
mkdirSync(dir, {recursive:true});
const byYear = {2023:{}, 2024:{}, 2025:{}};
const sources = [];
const unavailable = [{
  year: 2026,
  why: 'Utah DWR stopped publishing a full draw-odds PDF in 2026. The odds page sends 2026 results to the interactive draw site, and that site does not offer one hunt-level table that can be parsed without guessing.'
}];
for (const year of YEARS) {
  for (const [url, name, youth] of FILES[year]) {
    const dest = join(dir, `${year}-${name}.pdf`);
    try {
      execFileSync('curl', ['-fsSL', '-A', 'Mozilla/5.0', '-o', dest, url], {stdio:'inherit'});
      const text = execFileSync('pdftotext', ['-layout', dest, '-'], {encoding:'utf8', maxBuffer: 128 * 1024 * 1024});
      if (!/Utah|Draw Results|Success/.test(text.slice(0, 1500))) throw new Error('not a DWR draw-results PDF');
      const parsed = parsePdf(text, youth);
      let matched = 0;
      for (const [code, rows] of Object.entries(parsed)) {
        if (!codes.has(code)) continue;
        const destRow = byYear[year][code] || {};
        if (youth) {
          destRow.yres = rows.yres;
          destRow.ynonres = rows.ynonres;
        } else if (!destRow.res) {
          destRow.res = rows.res;
          destRow.nonres = rows.nonres;
        }
        byYear[year][code] = destRow;
        matched++;
      }
      sources.push({year, name, url, parsed:Object.keys(parsed).length, matched});
      console.log('ok', year, name, Object.keys(parsed).length, 'matched', matched);
      if (!Object.keys(parsed).length) unavailable.push({year, url, why:'The PDF did not yield hunt rows that matched the printed 1-in-X ratios.'});
    } catch (err) {
      unavailable.push({year, url, why:'Could not parse: ' + String(err.message || err).slice(0, 180)});
      console.log('fail', year, name, err.message);
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
writeFileSync(join(root, 'find/history/utah.json'), JSON.stringify({
  state: 'utah',
  words: 'yes',
  years: YEARS,
  note: 'Utah DWR 1st-choice result at this point level, from the published draw-odds PDF. 2026 was not published as a full table. This is not the 2027 estimate on the card.',
  hunts
}));
writeFileSync(join(root, 'find/history/utah.sources.json'), JSON.stringify({
  state: 'utah',
  yearsAdded: YEARS.filter(year => sources.some(s => s.year === year && s.matched > 0)),
  unavailable,
  match: 'The hunt number must be identical, for example EB3000. A renamed hunt number is not matched. Youth PDFs are stored separately from the regular draw.',
  band: 'yes',
  page: 'https://wildlife.utah.gov/biggame/odds',
  hunts: Object.keys(hunts).length,
  sources
}, null, 2));
console.log('history hunts', Object.keys(hunts).length);
