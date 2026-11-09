// Idaho controlled-hunt history from IDFG's Hunt Planner odds API.
// Bands use the same count rule as scripts/build-idaho-bands.mjs.
// A prior year is kept only when the hunt number, species, drawing and area code all match 2026.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
import {bandOf, packScalar} from './bands.mjs';

const root = new URL('../..', import.meta.url).pathname;
const YEARS = [2024, 2025, 2026];
const ODDS = 'https://idfg.idaho.gov/ifwis/huntplanner/api/1.1/odds/';
const SPECIES = [
  {sp:'elk', biggame:2},
  {sp:'deer', biggame:1},
  {sp:'pronghorn', biggame:3},
  {sp:'moose', biggame:6},
  {sp:'sheep-rm', biggame:7},
  {sp:'sheep-ca', biggame:28},
  {sp:'goat', biggame:8},
  {sp:'bear', biggame:4},
  {sp:'turkey', biggame:27}
];

function rateOf(drew, apps) {
  if (!apps) return null;
  if (!Number.isInteger(drew) || !Number.isInteger(apps) || drew < 0 || drew > apps) return null;
  return drew / apps;
}

async function getJson(url) {
  const res = await fetch(url, {headers:{'user-agent':'Rokwilder Idaho draw research'}});
  if (!res.ok) throw new Error(res.status + ' ' + url);
  return res.json();
}

const sandbox = {window:{}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'idaho/data.js'), 'utf8') + '\nglobalThis.IH=IH;', sandbox);

const byYear = {};
for (const year of YEARS) {
  byYear[year] = {};
  for (const spec of SPECIES) {
    for (const draw of [1, 2]) {
      const j = await getJson(`${ODDS}?biggame=${spec.biggame}&yr=${year}&draw=${draw}`);
      const rows = j.rows || [];
      console.log(year, spec.sp, 'draw', draw, rows.length);
      for (const r of rows) {
        if (String(r.Yr) !== String(year) || r.Draw !== draw) throw new Error('unexpected row ' + spec.sp);
        const key = `${spec.sp}-${r.CHunt}-${draw}`;
        byYear[year][key] = {
          area: String(r.CHuntArea),
          res: rateOf(r.ResPermit, r.ResApp),
          nr: rateOf(r.NonResPermit, r.NonResApp)
        };
      }
    }
  }
}

const hunts = {};
let mismatch = 0;
let areaSkip = 0;
for (const [key, cur] of Object.entries(sandbox.IH)) {
  const now = byYear[2026][key];
  if (!now || now.area !== String(cur.area)) {
    areaSkip++;
    continue;
  }
  if (bandOf(now.res, 'drew') !== cur.res || bandOf(now.nr, 'drew') !== cur.nr) mismatch++;
  const resRates = {};
  const nrRates = {};
  for (const year of YEARS) {
    const row = byYear[year][key];
    if (!row || row.area !== String(cur.area)) continue;
    if (year === 2026 && (bandOf(row.res, 'drew') !== cur.res || bandOf(row.nr, 'drew') !== cur.nr)) continue;
    if (row.res != null) resRates[year] = row.res;
    if (row.nr != null) nrRates[year] = row.nr;
  }
  const res = packScalar(resRates, YEARS, 'drew');
  const nr = packScalar(nrRates, YEARS, 'drew');
  if (!res && !nr) continue;
  const rec = {};
  if (res) rec.res = res;
  if (nr) rec.nr = nr;
  hunts[key] = rec;
}

const out = {
  state: 'idaho',
  words: 'drew',
  years: YEARS,
  note: 'IDFG first-choice result for this hunt number and area. A year is left off when the area code changed or nobody of this residency applied. Not a forecast.',
  hunts
};
mkdirSync(join(root, 'find/history'), {recursive:true});
writeFileSync(join(root, 'find/history/idaho.json'), JSON.stringify(out));
const sources = YEARS.map(year => ({
  year,
  url: ODDS,
  page: 'https://idfg.idaho.gov/ifwis/huntplanner/odds/',
  note: 'Hunt Planner drawing-odds API, first choice, resident and nonresident counts. Band is drawn divided by applied, with 1 only when every applicant was drawn.'
}));
writeFileSync(join(root, 'find/history/idaho.sources.json'), JSON.stringify({
  state: 'idaho',
  yearsAdded: YEARS,
  unavailable: [{
    scope: 'general season',
    why: 'A general-season window is where a resident tag is valid. It is not a draw result, so it has no draw history.'
  }, {
    scope: 'nonresident deer and elk tag draw, 2024 and 2025',
    why: 'The 2026 nonresident draw PDF is the only file of that report on IDFG and in the Internet Archive capture of that URL. 2024 and 2025 were not published at a URL that could be retrieved.'
  }],
  match: 'Species, controlled-hunt number, drawing (first or second) and area code must all match the 2026 hunt. A different area code is not history for that hunt.',
  band: 'drew',
  hunts: Object.keys(hunts).length,
  mismatch2026: mismatch,
  areaSkipped: areaSkip,
  sources
}, null, 2));
console.log('hunts', Object.keys(hunts).length, '2026 mismatches left out', mismatch, 'area skip', areaSkip);
