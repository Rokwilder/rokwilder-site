// Idaho tag quotas and first-choice applicants from the IDFG Hunt Planner odds API.
// PermitAvailable is the printed quota. ApplChoice1 is the printed first-choice total.
// The resident and nonresident columns must add up to those printed totals.
// A row that fails that check is left out. Second choice is not included.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
import {writeCounts, writeSourceList} from './write-counts.mjs';

const root = new URL('../..', import.meta.url).pathname;
const YEARS = [2024, 2025, 2026];
const ODDS = 'https://idfg.idaho.gov/ifwis/huntplanner/api/1.1/odds/';
const PAGE = 'https://idfg.idaho.gov/ifwis/huntplanner/odds/';
const SPECIES = [
  {sp: 'elk', biggame: 2},
  {sp: 'deer', biggame: 1},
  {sp: 'pronghorn', biggame: 3},
  {sp: 'moose', biggame: 6},
  {sp: 'sheep-rm', biggame: 7},
  {sp: 'sheep-ca', biggame: 28},
  {sp: 'goat', biggame: 8},
  {sp: 'bear', biggame: 4},
  {sp: 'turkey', biggame: 27}
];

function whole(n) {
  return Number.isInteger(n) && n >= 0 ? n : null;
}

async function getJson(url) {
  const res = await fetch(url, {headers: {'user-agent': 'Rokwilder Idaho draw research'}});
  if (!res.ok) throw new Error(res.status + ' ' + url);
  return res.json();
}

const sandbox = {window: {}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'idaho/data.js'), 'utf8') + '\nglobalThis.IH=IH;', sandbox);

const byYear = {};
const sources = [];
for (const year of YEARS) {
  byYear[year] = {};
  for (const spec of SPECIES) {
    for (const draw of [1, 2]) {
      const url = ODDS + '?biggame=' + spec.biggame + '&yr=' + year + '&draw=' + draw;
      const j = await getJson(url);
      let kept = 0;
      let rejected = 0;
      for (const r of j.rows || []) {
        if (String(r.Yr) !== String(year) || r.Draw !== draw) throw new Error('unexpected row ' + spec.sp);
        const quota = whole(r.PermitAvailable);
        const apps = whole(r.ApplChoice1);
        const resApps = whole(r.ResApp);
        const nrApps = whole(r.NonResApp);
        const resTags = whole(r.ResPermit);
        const nrTags = whole(r.NonResPermit);
        const issued = whole(r.PermitTotal);
        if (quota == null || apps == null || resApps == null || nrApps == null || resTags == null || nrTags == null || issued == null
          || resApps + nrApps !== apps || resTags + nrTags !== issued) {
          rejected++;
          continue;
        }
        const key = spec.sp + '-' + r.CHunt + '-' + draw;
        byYear[year][key] = {area: String(r.CHuntArea), quota, apps};
        kept++;
      }
      sources.push({year, species: spec.sp, draw, page: PAGE, url, hunts: kept, rejected});
      console.log(year, spec.sp, 'draw', draw, 'kept', kept, 'rejected', rejected);
    }
  }
}

const hunts = {};
let areaSkip = 0;
for (const [key, cur] of Object.entries(sandbox.IH)) {
  const now = byYear[2026][key];
  if (!now || now.area !== String(cur.area)) {
    areaSkip++;
    continue;
  }
  const rec = {};
  for (const year of YEARS) {
    const row = byYear[year][key];
    if (!row || row.area !== String(cur.area)) continue;
    rec[String(year)] = {quota: row.quota, apps: row.apps};
  }
  if (Object.keys(rec).length) hunts[key] = rec;
}

const note = 'Tags are the printed PermitAvailable quota from the IDFG Hunt Planner odds API. Applicants are the printed first-choice total, ApplChoice1. That total is resident applicants plus nonresident applicants, and the resident and nonresident permit columns are checked against the printed permit total. Second choice is not included. A prior year is left off when the area code is not the same as the 2026 hunt. General-season tags are not in this file. These figures are not estimates.';
const pack = {
  state: 'idaho',
  years: YEARS,
  note,
  sources,
  skipped: [{
    scope: 'general season',
    why: 'A general-season window is where a resident tag is valid. It is not a controlled-hunt draw, so it has no quota in this API.'
  }, {
    scope: 'area changed',
    hunts: areaSkip,
    why: 'The 2026 area code on the odds API did not match the hunt on the site, so that hunt was left out.'
  }],
  hunts
};
writeCounts(root, 'id', pack);
writeSourceList(root, 'idaho', {
  state: 'idaho',
  years: YEARS,
  counts: 'not in this file',
  note: 'Source list only. Tag quotas and applicant counts are not in this file. They belong in the Full Pass file served by the member API.',
  page: PAGE,
  sources: YEARS.map(year => ({year, page: PAGE, url: ODDS}))
});
const sample = hunts['elk-2001-1'];
console.log('hunts', Object.keys(hunts).length, 'area skipped', areaSkip);
console.log('elk-2001-1', JSON.stringify(sample));
if (!sample || sample['2025'].quota !== 40 || sample['2025'].apps !== 764) {
  console.error('elk 2001 draw 1 did not match the 2025 API check of 40 tags and 764 first-choice applicants');
  process.exit(1);
}
