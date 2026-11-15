// Turn parsed NMDGF tables into the public finder, the private Full Pass file,
// draw history, and harvest-by-hunt-code. Bands only in the public files.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bandOf, firstChoiceRate, parseUnits, parentTokens, residentOnly, weaponFromCode, speciesOf, normDesc, gmuSort} from './nm-odds.mjs';
import {packScalar} from './history/bands.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const parsed = JSON.parse(readFileSync(process.argv[2] || '/tmp/nm-build/parsed.json', 'utf8'));

const BAG = {
  ES: 'Either sex',
  MB: 'Mature bull',
  A: 'Antlerless',
  'MB/A': 'Mature bull or antlerless',
  'APRE/6': 'Antler-point-restricted elk, six or more points on one side',
  'APRE/6/A': 'Antler-point-restricted elk or antlerless',
  FAD: 'Fork-antlered deer',
  FAMD: 'Fork-antlered mule deer',
  FAWTD: 'Fork-antlered white-tailed deer',
  ESWTD: 'Either-sex white-tailed deer',
  RAM: 'Ram',
  EWE: 'Ewe',
  BHO: 'Broken-horn oryx',
  VB: '1 bearded turkey',
  '2VB': '2 bearded turkeys'
};

function bagLabel(sp, code, bookText) {
  if (bookText && /\s/.test(bookText) && !/^[A-Z0-9/-]+$/.test(bookText)) return bookText;
  if (code === 'F-IM' && sp === 'ibex') return 'Female or immature ibex';
  if (code === 'F-IM' && sp === 'barbary') return 'Female or immature Barbary sheep';
  if (code === 'F-IM' && sp === 'pronghorn') return 'Female or immature pronghorn';
  if (code === '1B') return 'One bear';
  return BAG[code] || code || '';
}

function bookRow(code) {
  return parsed.booklet.rows[code] || null;
}

function areasFor(code) {
  return (parsed.booklet.bighorn_areas[code] || []).map(s => s.replace(/\s+/g, ' ').trim());
}

function poolSide(side, drawn) {
  const src = side || {};
  const a1 = src.a1 == null ? null : src.a1;
  const raw = {
    a1,
    a2: src.a2 == null ? null : src.a2,
    a3: src.a3 == null ? null : src.a3,
    issued: src.issued == null ? null : src.issued,
    rate1: null
  };
  if (drawn) {
    raw.s1 = src.s1 == null ? null : src.s1;
    raw.s2 = src.s2 == null ? null : src.s2;
    raw.s3 = src.s3 == null ? null : src.s3;
    if (Object.prototype.hasOwnProperty.call(src, 's4')) raw.s4 = src.s4 == null ? null : src.s4;
    raw.rate1 = firstChoiceRate(raw.s1, raw.a1);
  }
  return raw;
}

const yearMaps = {};
for (const book of parsed.books) {
  const bag = yearMaps[book.year] || (yearMaps[book.year] = {});
  for (const hunt of book.hunts) bag[hunt.code] = hunt;
}

const current = [];
for (const hunt of [...(yearMaps[2026] ? Object.values(yearMaps[2026]) : [])]) current.push(hunt);
current.sort((a, b) => a.code.localeCompare(b.code));

const publicHunts = {};
const privateHunts = {};
const built = [];

for (const rec of current) {
  const sp = speciesOf(rec.species, rec.code);
  if (!sp) throw new Error('unknown species ' + rec.code + ' ' + rec.species);
  const book = bookRow(rec.code);
  const fromCode = weaponFromCode(rec.code);
  const areaChoice = sp === 'bighorn';
  const areaLines = areaChoice ? areasFor(rec.code) : [];
  const unit = rec.unit || '';
  const units = areaChoice ? parseUnits(areaLines.join(' ; ')) : parseUnits(unit);
  const unmapped = areaChoice ? [] : parentTokens(unit);
  const wmaOnly = /\bWMAs?\s+only\b/i.test(unit);
  const privateOnly = /private[\s-]*land only/i.test(unit);
  const partial = /east of|west of|north of|south of|\bportion\b|\bexcluding\b/i.test(unit);
  const gate = residentOnly({sp, bag: rec.bag, unit, bookResOnly: !!(book && book.book_res_only)});
  const od = {};
  const pools = {};
  for (const name of ['res', 'nr', 'out']) {
    const raw = poolSide(rec.pools[name], rec.drawn_published);
    pools[name] = raw;
    if (raw.rate1 != null) od[name] = bandOf(raw.rate1);
  }
  const row = {
    sp,
    code: rec.code,
    area: unit,
    units,
    bag: rec.bag || '',
    blab: bagLabel(sp, rec.bag, book && book.bag_text),
    wpn: (book && book.wpn) || fromCode.wpn,
    wlab: (book && book.wlab) || fromCode.wlab,
    season: (book && book.season) || '',
    fee: book && book.fee ? book.fee : '',
    youth: /youth/i.test(unit) || !!(book && book.youth),
    mobility: /mobility/i.test(unit) || !!(book && book.mobility),
    military: /military/i.test(unit),
    once: /once-in-a-lifetime|once in a lifetime/i.test(unit),
    resOnly: gate.resOnly,
    why: gate.why,
    privateOnly,
    wmaOnly,
    partial,
    areaChoice,
    unmapped,
    areas: areaLines,
    drawn: rec.drawn_published === true,
    od
  };
  built.push(row);
  const pub = {
    sp: row.sp, code: row.code, area: row.area, units: row.units, bag: row.bag, blab: row.blab,
    wpn: row.wpn, wlab: row.wlab, season: row.season, fee: row.fee,
    youth: row.youth, mobility: row.mobility, military: row.military, once: row.once,
    resOnly: row.resOnly, why: row.why, privateOnly: row.privateOnly, wmaOnly: row.wmaOnly,
    partial: row.partial, areaChoice: row.areaChoice, unmapped: row.unmapped, areas: row.areas, drawn: row.drawn, od: row.od
  };
  publicHunts[row.code] = pub;
  privateHunts[row.code] = {
    ...pub,
    raw: {
      quota: rec.quota,
      dist: rec.dist || {},
      res: pools.res,
      nr: pools.nr,
      out: pools.out
    }
  };
}

// Northern mountains, not the northwest plateau. Southwestern is the Gila side of the state.
const NORTH = new Set(['6A','6C','7','45','48','49','50','51A','51B','52','53','54','55A','55B','56','57','58','59']);
const SW = new Set(['13','15','16A','16B','16C','16D','16E','17','18','19','21A','21B','22','23','24']);
function score(unit) {
  const out = {elk: 0, deer: 0};
  for (const h of built) {
    if (h.privateOnly || h.wmaOnly || h.partial || h.areaChoice || h.youth) continue;
    if (h.units.length !== 1 || h.units[0] !== unit) continue;
    if (h.od.res == null || h.od.res < 0.05) continue;
    if (h.sp === 'elk') out.elk++;
    if (h.sp === 'deer') out.deer++;
  }
  out.min = Math.min(out.elk, out.deer);
  return out;
}
function pick(set) {
  return [...set].map(u => ({u, ...score(u)}))
    .filter(x => x.min >= 2)
    .sort((a, b) => b.min - a.min || (b.elk + b.deer) - (a.elk + a.deer) || gmuSort(a.u, b.u));
}
const northPick = pick(NORTH);
const swPick = pick(SW);
if (!northPick.length || !swPick.length) throw new Error('could not pick two ordinary sample units');
const samples = [northPick[0].u, swPick[0].u];

const META = {
  year: 2026,
  licenseYear: '2026-27',
  retrieved: '2026-11-15',
  points: false,
  pools: ['res', 'nr', 'out'],
  samples,
  pages: {
    odds: 'https://wildlife.dgf.nm.gov/hunting/applications-and-draw-information/how-new-mexico-draw-works/',
    booklet: 'https://wildlife.dgf.nm.gov/download/2026-2027-new-mexico-hunting-rules-and-info/?wpdmdl=52826',
    harvest: 'https://wildlife.dgf.nm.gov/hunting/harvest-reporting-information/',
    gis: 'https://wildlife.dgf.nm.gov/hunting/maps/big-game-unit-maps-pdfs/',
    eplus: 'https://wildlife.dgf.nm.gov/hunting/maps/eplus/',
    faq: 'https://wildlife.dgf.nm.gov/download/26-27-big-game-draw-frequently-asked-questions/?wpdmdl=53341',
    ownership: 'https://services2.arcgis.com/CjbW1bVhK4dB3WOa/arcgis/rest/services/BLM_NM_Surface_Ownership/FeatureServer/1',
    units: 'https://services2.arcgis.com/CjbW1bVhK4dB3WOa/arcgis/rest/services/NMDGF_Game_Management_Units_I_E__v2_WFL1/FeatureServer/0'
  },
  src: {
    complete2026: 'https://wildlife.dgf.nm.gov/download/2026-big-game-drawing-odds-complete-report/?wpdmdl=56113',
    complete2025: 'https://wildlife.dgf.nm.gov/download/2025-drawing-odds-complete-report/?wpdmdl=52046',
    complete2024: 'https://wildlife.dgf.nm.gov/download/2024-drawing-odds-complete-report/?wpdmdl=48997',
    complete2023: 'https://wildlife.dgf.nm.gov/download/2023-big-game-draw-odds-complete-report/?wpdmdl=48734',
    bear2026: 'https://wildlife.dgf.nm.gov/download/2026-bear-and-turkey-draw-odds-report/?wpdmdl=55353',
    bear2025: 'https://wildlife.dgf.nm.gov/download/2025-bear-and-turkey-draw-odds-report/?wpdmdl=50810'
  }
};

function sameHunt(base, other) {
  if (!other) return false;
  if (normDesc(base.area) !== normDesc(other.unit)) return false;
  if (base.bag && other.bag && String(base.bag).toUpperCase() !== String(other.bag).toUpperCase()) return false;
  return true;
}

const historyHunts = {};
const YEARS = [2023, 2024, 2025, 2026];
let historyRows = 0;
for (const h of built) {
  const sides = {};
  for (const pool of ['res', 'nr', 'out']) {
    const rates = {};
    for (const year of YEARS) {
      const other = yearMaps[year] && yearMaps[year][h.code];
      if (!sameHunt(h, other)) continue;
      if (!other.drawn_published) continue;
      const side = other.pools[pool];
      const rate = side ? firstChoiceRate(side.s1, side.a1) : null;
      if (rate == null) continue;
      rates[year] = rate;
    }
    const packed = packScalar(rates, YEARS, 'drew');
    if (packed) {
      sides[pool] = packed;
      historyRows++;
    }
  }
  if (Object.keys(sides).length) historyHunts[h.code] = sides;
}

const history = {
  state: 'newmexico',
  words: 'drew',
  years: YEARS,
  note: 'History is the 2023, 2024, 2025, and 2026 first-choice result for this hunt code and this pool. A year is left out when the unit description or the bag changed, or when that pool had no first-choice applicants. Bear and turkey reports did not publish first-choice drawn counts, so those hunts have no history band. This is not a forecast. Hunt codes change format in the 2027-28 license year.',
  hunts: historyHunts
};

const harvest = {};
for (const h of built) {
  const src = parsed.harvest.by_code[h.code];
  if (!src) continue;
  const years = {};
  for (const [year, rec] of Object.entries(src)) {
    const row = {};
    if (rec.sold != null) row.sold = rec.sold;
    if (rec.success != null) row.success = rec.success;
    if (rec.males != null) row.males = rec.males;
    if (rec.females != null) row.females = rec.females;
    if (Object.keys(row).length) years[year] = row;
  }
  if (Object.keys(years).length) harvest[h.code] = years;
}

const pubHead = `// New Mexico public draw bands. 2026 first-choice results. Generated by scripts/build-newmexico.mjs.
// Bands only. Applicant counts, drawn counts, and quotas are not in this file.
`;
const privHead = `// New Mexico Full Pass file for KV. Not part of the public site.
// The member flag is set so the finder can show the official counts.
` + 'window.RW_' + 'FP=true;\n';
mkdirSync(join(root, 'newmexico'), {recursive: true});
mkdirSync(join(root, 'data'), {recursive: true});
mkdirSync(join(root, 'find/history'), {recursive: true});
writeFileSync(join(root, 'newmexico/data.js'), pubHead + 'const NM_META=' + JSON.stringify(META) + ';\nconst NH=' + JSON.stringify(publicHunts) + ';\n');
writeFileSync(join(root, 'data/nm.js'), privHead + 'const NM_META=' + JSON.stringify(META) + ';\nconst NH=' + JSON.stringify(privateHunts) + ';\n');
writeFileSync(join(root, 'find/history/newmexico.json'), JSON.stringify(history));
writeFileSync(join(root, 'newmexico/harvest.js'), '// Hunt-code rows from NMDGF harvest reports. 2026-27 harvest is not published.\nconst NM_HARV=' + JSON.stringify(harvest) + ';\n');

const sources = [
  {year: 2026, kind: 'big game complete', url: META.src.complete2026, title: '2026 Big Game Drawing Odds Complete Report'},
  {year: 2025, kind: 'big game complete', url: META.src.complete2025, title: '2025 Drawing Odds Complete Report'},
  {year: 2024, kind: 'big game complete', url: META.src.complete2024, title: '2024 Drawing Odds Complete Report'},
  {year: 2023, kind: 'big game complete', url: META.src.complete2023, title: '2023 Big Game Draw Odds Complete Report'},
  {year: 2026, kind: 'bear and turkey', url: META.src.bear2026, title: '2026 Bear and Turkey Draw Odds Report'},
  {year: 2025, kind: 'bear and turkey', url: META.src.bear2025, title: '2025 Bear and Turkey Draw Odds Report'}
];
writeFileSync(join(root, 'find/history/newmexico.sources.json'), JSON.stringify({
  state: 'newmexico',
  years: YEARS,
  retrieved: '2026-11-15',
  match: 'A prior year is used only when the hunt code, the unit description, and the bag match the 2026 report. A changed description is left out.',
  sources
}, null, 1));

const provPath = join(root, 'find/history/provenance.json');
const prov = JSON.parse(readFileSync(provPath, 'utf8'));
prov.states.newmexico = {
  state: 'newmexico',
  yearsAdded: YEARS,
  unavailable: [
    {year: 2027, why: 'The 2027-28 hunting rules booklet was not on the publications page on November 15, 2026. Hunt codes change format that year. No 2027-28 table was built.'},
    {species: 'bear and turkey', why: 'The 2026 and 2025 bear and turkey workbooks publish applicants by choice and licenses issued. They do not publish how many were drawn on the first choice, so those hunts have no history band.'},
    {species: 'bear and turkey', years: [2023, 2024], why: 'The download set used here has bear and turkey draw workbooks for 2025 and 2026. Earlier bear and turkey draw odds were not in that set.'},
    {year: '2026-27', species: 'harvest', why: '2026-27 harvest reports were not published on November 15, 2026. The season was still underway.'}
  ],
  examined: sources.map(s => ({url: s.url, title: s.title})),
  match: '2023 through 2026 first-choice drawn divided by first-choice applicants in the same pool. The unit description and bag must match the 2026 row.',
  band: 'drew',
  page: META.pages.odds,
  sources
};
writeFileSync(provPath, JSON.stringify(prov, null, 2) + '\n');

const tally = {};
for (const h of built) tally[h.sp] = (tally[h.sp] || 0) + 1;
const withSeason = built.filter(h => h.season).length;
const withHarvest = Object.keys(harvest).length;
console.log(JSON.stringify({
  hunts: built.length,
  tally,
  samples,
  north: northPick.slice(0, 5),
  southwest: swPick.slice(0, 5),
  withSeason,
  historyHunts: Object.keys(historyHunts).length,
  historyRows,
  withHarvest,
  resOnly: built.filter(h => h.resOnly).length,
  noDraw: built.filter(h => !h.drawn).length
}, null, 2));
