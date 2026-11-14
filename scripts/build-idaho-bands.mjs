// Rebuild idaho/data.js from Idaho Fish and Game's public Hunt Planner.
// Writes verdict bands only. Exact percents, permit quotas and applicant counts are not written.
// Usage: node scripts/build-idaho-bands.mjs
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const YEAR = 2026;
const ODDS = 'https://idfg.idaho.gov/ifwis/huntplanner/api/1.1/odds/';
const LIST = 'https://idfg.idaho.gov/ifwis/huntplanner/api/1.1/list/';
const SPECIES = [
  {sp:'elk', biggame:2, listGame:'2', name:'Elk'},
  {sp:'deer', biggame:1, listGame:'1', name:'Deer'},
  {sp:'pronghorn', biggame:3, listGame:'3', name:'Pronghorn'},
  {sp:'moose', biggame:6, listGame:'6', name:'Moose'},
  {sp:'sheep-rm', biggame:7, listGame:'119', gameName:'Rocky Mountain Bighorn Sheep', name:'Rocky Mountain bighorn'},
  {sp:'sheep-ca', biggame:28, listGame:'119', gameName:'California Bighorn Sheep', name:'California bighorn'},
  {sp:'goat', biggame:8, listGame:'8', name:'Mountain goat'},
  {sp:'bear', biggame:4, listGame:null, name:'Black bear'},
  {sp:'turkey', biggame:27, listGame:null, name:'Turkey'}
];

const band = (drew, apps) => {
  if (!apps) return null;
  if (drew === apps) return 1;
  const r = drew / apps;
  if (r >= 0.75) return 0.75;
  if (r >= 0.25) return 0.25;
  if (r >= 0.05) return 0.05;
  if (r > 0) return 0.01;
  return 0;
};

async function getJson(url) {
  const res = await fetch(url, {headers:{'user-agent':'Rokwilder Idaho draw research'}});
  if (!res.ok) throw new Error(res.status + ' ' + url);
  return res.json();
}

async function odds(biggame, draw) {
  const j = await getJson(`${ODDS}?biggame=${biggame}&yr=${YEAR}&draw=${draw}`);
  if (j.response !== 'success' && !(j.rows || []).length) return [];
  return j.rows || [];
}

async function huntList(listGame) {
  const rows = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const url = `${LIST}?game=${listGame}&type=2&start=2025-01-01&end=2027-06-30&limit=100&offset=${offset}`;
    const j = await getJson(url);
    if (j.response !== 'success') break;
    total = j.total || 0;
    const batch = j.rows || [];
    if (!batch.length) break;
    rows.push(...batch);
    offset += batch.length;
  }
  return rows;
}

const sexOf = ornament => {
  if (ornament === 'Antlered' || ornament === 'Bucks Only' || ornament === 'Rams Only') return 'M';
  if (ornament === 'Antlerless' || ornament === 'Doe or Fawn') return 'F';
  if (ornament === 'Antlerless or Antlered' || ornament === 'Either-sex' || ornament === 'Either Sex') return 'E';
  return '';
};
const openYear = s => {
  const y = String(s || '').split('/').pop();
  if (y.length === 2) return 2000 + Number(y);
  return Number(y);
};

const near = [];
function noteBoundary(sp, draw, hunt, drew, apps, kind) {
  if (!apps) return;
  const whole = Math.round((drew / apps) * 100);
  const fromWhole = whole === 100 ? 1 : whole >= 75 ? 0.75 : whole >= 25 ? 0.25 : whole >= 5 ? 0.05 : whole > 0 ? 0.01 : 0;
  const rawBand = band(drew, apps);
  if (fromWhole !== rawBand) near.push(`${sp} draw ${draw} hunt ${hunt} ${kind}: IDFG whole percent would band ${fromWhole}, counts band ${rawBand}`);
}

const lists = new Map();
for (const spec of SPECIES) {
  if (!spec.listGame || lists.has(spec.listGame)) continue;
  lists.set(spec.listGame, await huntList(spec.listGame));
  console.log('list', spec.listGame, lists.get(spec.listGame).length);
}

const IH = {};
const counts = {};
for (const spec of SPECIES) {
  counts[spec.sp] = {1:0, 2:0, dated:0};
  const pool = (lists.get(spec.listGame) || []).filter(h => !spec.gameName || h.game === spec.gameName);
  const byNum = new Map();
  for (const h of pool) {
    const n = String(h.number);
    if (!byNum.has(n)) byNum.set(n, []);
    byNum.get(n).push(h);
  }
  for (const draw of [1, 2]) {
    const rows = await odds(spec.biggame, draw);
    console.log('odds', spec.sp, 'draw', draw, rows.length);
    for (const r of rows) {
      if (r.Yr !== String(YEAR) || r.Draw !== draw) throw new Error('unexpected row ' + spec.sp);
      if (r.ResApp + r.NonResApp !== r.ApplChoice1) throw new Error('residency split is not first choice ' + r.CHunt);
      const n = String(r.CHunt);
      const segs = (byNum.get(n) || []).filter(h => openYear(h.open) === YEAR);
      const sexes = [...new Set(segs.map(h => sexOf(h.ornament)).filter(Boolean))];
      const games = [...new Set(segs.map(h => h.game))];
      const methods = [...new Set(segs.map(h => h.method))].sort();
      const seg = [];
      const seen = new Set();
      for (const h of segs) {
        const key = [h.season, h.method, h.open, h.close].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        seg.push({s:h.season, m:h.method, o:h.open, c:h.close});
      }
      seg.sort((a, b) => a.o.localeCompare(b.o) || a.m.localeCompare(b.m));
      noteBoundary(spec.sp, draw, n, r.ResPermit, r.ResApp, 'res');
      noteBoundary(spec.sp, draw, n, r.NonResPermit, r.NonResApp, 'nr');
      const rec = {
        sp: spec.sp,
        n,
        area: String(r.CHuntArea),
        areaId: r.AreaID,
        draw,
        game: games.length === 1 ? games[0] : spec.name,
        sex: sexes.length === 1 ? sexes[0] : '',
        youth: segs.some(h => /youth/i.test(h.season)) ? 1 : 0,
        extra: /X$/.test(String(r.CHuntArea)) ? 1 : 0,
        methods,
        seg,
        res: band(r.ResPermit, r.ResApp),
        nr: band(r.NonResPermit, r.NonResApp)
      };
      IH[`${spec.sp}-${n}-${draw}`] = rec;
      counts[spec.sp][draw]++;
      if (seg.length) counts[spec.sp].dated++;
    }
  }
}

const bands = new Set([0, 0.01, 0.05, 0.25, 0.75, 1, null]);
for (const [k, h] of Object.entries(IH)) {
  if (!bands.has(h.res) || !bands.has(h.nr)) throw new Error('bad band ' + k);
  for (const key of Object.keys(h)) {
    if (/quota|applicant|percent|permit|odds/i.test(key)) throw new Error(key + ' leaked into ' + k);
  }
}

const meta = {
  built: '2026-11-08',
  year: YEAR,
  retrieved: '2026-11-08',
  oddsPage: 'https://idfg.idaho.gov/ifwis/huntplanner/odds/',
  oddsApi: ODDS,
  huntList: 'https://idfg.idaho.gov/ifwis/huntplanner/filter/',
  rules: 'https://adminrules.idaho.gov/rules/current/13/130104.pdf',
  species: Object.fromEntries(SPECIES.map(s => [s.sp, {name:s.name, biggame:s.biggame}])),
  counts
};
const header = `// Idaho controlled-hunt draw results for Rokwilder Find Your Hunt.
// Source: Idaho Fish and Game Hunt Planner drawing-odds API, 2026 season, first choice, retrieved 2026-11-08.
// Public file: verdict bands only (1, .75, .25, .05, .01, 0, or null). 1 means every first-choice person of that residency was drawn.
// .75 / .25 / .05 are the floors three-in-four, one-in-four and one-in-twenty. .01 is below one-in-twenty but not zero. 0 means people applied and none were drawn.
// null means IDFG recorded nobody of that residency putting the hunt first, so there is no rate.
// Bands use drawn and applied counts, not IDFG's rounded whole-number rate.
// Exact rates, tag counts and application counts are not in this file. The Full Pass file is separate and is not in this public file.
// This is the 2026 historical result. It is not a personal chance in a future drawing.
`;
const body = header + 'const ID_META=' + JSON.stringify(meta) + ';\nconst IH=' + JSON.stringify(IH) + ';\n';
const leak = body.match(/%|\bquota\b|\bapplicants\b|"raw"/);
if (leak) throw new Error('public file failed the leak scan: ' + leak[0] + ' at ' + body.indexOf(leak[0]));
writeFileSync(join(root, 'idaho/data.js'), body);
console.log('hunts', Object.keys(IH).length);
console.log('counts', JSON.stringify(counts));
console.log('rounding crosses a band line:', near.length);
for (const line of near) console.log(' ', line);
