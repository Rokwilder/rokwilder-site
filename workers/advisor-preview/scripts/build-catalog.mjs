#!/usr/bin/env node
// Build a compact official-data catalog for the preview advisor worker.
// Reads only public files in this repo. Does not touch live KV or D1.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const outFile = path.resolve(here, '../src/catalog.json');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function loadJson(rel) {
  return JSON.parse(read(rel));
}
function runJs(rel, extras = {}) {
  const code = read(rel);
  const ctx = { window: {}, console, ...extras };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: rel });
  return ctx;
}
function wordKind(words) {
  return words === 'drew' ? 'drew' : 'yes';
}
function drawWord(v, kind) {
  if (v == null || !Number.isFinite(v)) return null;
  if (kind === 'drew') {
    if (v === 1) return 'ALL DREW';
    if (v >= 0.75) return 'MOST DREW';
    if (v >= 0.25) return 'SOME DREW';
    if (v >= 0.05) return 'FEW DREW';
    if (v > 0) return 'LONG SHOT';
    if (v === 0) return 'NONE DREW';
    return null;
  }
  if (v >= 0.995) return "YES, you'll draw";
  if (v >= 0.75) return 'LIKELY';
  if (v >= 0.25) return 'MAYBE';
  if (v > 0) return 'LONG SHOT';
  if (v === 0) return 'NOT THIS YEAR';
  return null;
}
function landText(band, pct) {
  if (typeof pct === 'number' && Number.isFinite(pct)) {
    const p = Math.round(pct * 100);
    if (band === 'pub' || p >= 70) return 'Mostly public, about ' + p + '%';
    if (band === 'priv' || p < 40) return 'Mostly private, about ' + p + '%';
    return 'Mixed public and private, about ' + p + '%';
  }
  if (band === 'pub') return 'Mostly public (70% or more)';
  if (band === 'mix') return 'Mixed public and private (40 to 70%)';
  if (band === 'priv') return 'Mostly private (under 40%)';
  return null;
}
function landOf(exact, bands, state, units) {
  const list = (units || []).map(String);
  if (!list.length) return { band: null, pct: null, text: null };
  const ex = exact[state] || {};
  const bd = bands[state] || {};
  // Prefer a single-unit key
  for (const u of list) {
    const k = 'gmu:' + u;
    if (ex[k] && typeof ex[k].pct === 'number') {
      return { band: ex[k].band || null, pct: ex[k].pct, text: landText(ex[k].band, ex[k].pct) };
    }
    if (ex[k] && (typeof ex[k].high === 'number' || typeof ex[k].low === 'number')) {
      const hi = ex[k].high, lo = ex[k].low;
      const pct = (Number.isFinite(hi) && Number.isFinite(lo)) ? (hi + lo) / 2 : (hi ?? lo);
      return { band: ex[k].band || null, pct, text: landText(ex[k].band, pct) };
    }
    if (bd[k]) return { band: bd[k], pct: null, text: landText(bd[k], null) };
  }
  return { band: null, pct: null, text: null };
}
function latestPointed(rec) {
  if (!rec || !rec.y) return null;
  const years = Object.keys(rec.y).filter(y => rec.y[y] != null).sort((a, b) => Number(a) - Number(b));
  if (!years.length) return null;
  const year = years[years.length - 1];
  const cell = rec.y[year];
  const pointed = cell && typeof cell === 'object' && !Array.isArray(cell);
  const rates = {};
  if (pointed) {
    for (const [p, v] of Object.entries(cell)) {
      if (typeof v === 'number') rates[String(p)] = v;
    }
  } else if (typeof cell === 'number') {
    rates['*'] = cell;
  }
  const trend = rec.t;
  let trendVal = null;
  if (typeof trend === 'string') trendVal = trend;
  return { year: Number(year), pointed, rates, trendMap: typeof trend === 'object' && trend ? trend : null, trend: trendVal };
}
function sidePayload(histHunt, sideNames) {
  if (!histHunt) return {};
  const out = {};
  for (const [name, aliases] of Object.entries(sideNames)) {
    let rec = null;
    for (const a of aliases) {
      if (histHunt[a] && histHunt[a].y) { rec = histHunt[a]; break; }
    }
    if (!rec && histHunt.y) rec = histHunt;
    const got = latestPointed(rec);
    if (got) out[name] = got;
  }
  return out;
}

const STATE_NAMES = {
  co: 'Colorado', ut: 'Utah', az: 'Arizona', wy: 'Wyoming',
  id: 'Idaho', nv: 'Nevada', mt: 'Montana', nm: 'New Mexico'
};
const FIND_HREF = {
  co: 'find.html', ut: 'utah/find.html', az: 'arizona/find.html', wy: 'wyoming/find.html',
  id: 'idaho/find.html', nv: 'nevada/find.html', mt: 'montana/find.html', nm: 'newmexico/find.html'
};
const WEAPON_FROM_CODE = { A: 'archery', M: 'muzzleloader', R: 'rifle', X: 'season choice' };

function weaponFromLabel(s) {
  const t = String(s || '').toLowerCase();
  if (t.includes('arch')) return 'archery';
  if (t.includes('muzzle')) return 'muzzleloader';
  if (t.includes('rifle') || t.includes('shotgun') || t.includes('any weapon')) return 'rifle';
  return '';
}

function addHunt(hunts, h) {
  if (!h || !h.key || !h.state) return;
  hunts[h.state + ':' + h.key] = h;
}

function extractJsObject(rel, names) {
  const ctx = runJs(rel);
  // const/let bindings in the data files are lexical, so copy them onto the context.
  const grab = names.map(n => n + ': (typeof ' + n + '!=="undefined"? ' + n + ': null)').join(', ');
  vm.runInContext('globalThis.__ex = {' + grab + '};', ctx);
  const ex = ctx.__ex || {};
  for (const n of names) if (ex[n]) return { ctx, obj: ex[n], name: n };
  for (const n of names) if (ctx[n]) return { ctx, obj: ctx[n], name: n };
  return { ctx, obj: null, name: null };
}

// ---------- Colorado ----------
function buildColorado(hunts, hist, exact, landBands) {
  const { obj: D } = extractJsObject('drawodds/lite.js', ['D']);
  const labels = extractJsObject('find/labels.js', ['FL']);
  const FL = labels.obj || {};
  const hfile = hist.colorado;
  const sources = {
    draw: '2026 CPW primary draw, 1st choice',
    harvest: 'CPW 2025 harvest report',
    years: hfile.years,
    words: wordKind(hfile.words),
    note: hfile.note
  };
  for (const [key, d] of Object.entries(D)) {
    const species = d[0];
    const unit = d[1];
    const season = d[2];
    const sexRaw = d[3];
    const units = (FL[key] && FL[key][2]) ? FL[key][2] : [unit];
    const sex = /antlered|bull|buck|bearded|male|^m$/i.test(String(sexRaw)) ? 'bull/buck'
      : /antlerless|cow|doe|female|^f$/i.test(String(sexRaw)) ? 'cow/doe'
      : /either/i.test(String(sexRaw)) ? 'either-sex'
      : String(sexRaw || '');
    const sexTitle = species === 'elk' && /antlered/i.test(String(sexRaw)) ? 'bull elk'
      : species === 'elk' && /antlerless/i.test(String(sexRaw)) ? 'cow or calf elk'
      : species === 'elk' && /either/i.test(String(sexRaw)) ? 'either-sex elk'
      : species === 'deer' && /antlered/i.test(String(sexRaw)) ? 'buck deer'
      : species === 'deer' && /antlerless/i.test(String(sexRaw)) ? 'doe or fawn deer'
      : (sexRaw ? sexRaw + ' ' + species : species);
    const unitLabel = Array.isArray(units)
      ? (units.length === 1 ? 'Unit ' + units[0] : 'Units ' + units.slice(0, 4).join(', '))
      : 'Unit ' + unit;
    const weapon = WEAPON_FROM_CODE[key.at(-1)] || weaponFromLabel(season);
    const harvestPct = typeof d[7] === 'number' ? d[7] : null;
    const land = landOf(exact, landBands, 'co', [].concat(units));
    const histHunt = hfile.hunts[key];
    const sides = sidePayload(histHunt, { res: ['res', 'yres'], nonres: ['nonres', 'nr', 'ynonres'] });
    addHunt(hunts, {
      key, state: 'co', species, sex, sexTitle,
      title: unitLabel + ' · ' + season + ' · ' + sexTitle,
      weapon, season: String(season || ''), units: [].concat(units).map(String),
      harvest: harvestPct != null ? { pct: harvestPct, source: sources.harvest } : null,
      land, href: FIND_HREF.co + '?h=' + encodeURIComponent(key),
      sides, sources
    });
  }
  return sources;
}

// ---------- Utah ----------
function buildUtah(hunts, hist, exact, landBands) {
  const { obj: UH } = extractJsObject('utah/data.js', ['UH']);
  const hfile = hist.utah;
  const sources = {
    draw: '2025 Utah DWR 1st-choice result. 2026 was not published as a full table',
    harvest: 'Utah DWR 2025 preliminary harvest report',
    years: hfile.years,
    words: wordKind(hfile.words),
    note: hfile.note
  };
  for (const [key, h] of Object.entries(UH)) {
    const wn = Array.isArray(h.wn) ? h.wn.join(', ') : (h.wn || '');
    const weapon = weaponFromLabel(wn) || (h.w === 'A' ? 'archery' : h.w === 'M' ? 'muzzleloader' : h.w === 'R' ? 'rifle' : '');
    const units = Array.isArray(h.b) ? h.b.map(String) : [];
    const harvestPct = h.hv && typeof h.hv[3] === 'number' ? h.hv[3] : null;
    const land = landOf(exact, landBands, 'ut', units);
    const title = [h.sex, h.name, wn].filter(Boolean).join(' · ');
    const histHunt = hfile.hunts[key];
    addHunt(hunts, {
      key, state: 'ut', species: h.sp, sex: h.sex || '', sexTitle: (h.sex ? h.sex + ' ' : '') + (h.sp || ''),
      title, weapon, season: wn, units, pool: h.pool || '',
      harvest: harvestPct != null ? { pct: harvestPct, source: h.hs === 'up' ? 'Utah DWR 2025-26 upland game report' : sources.harvest } : null,
      land, href: FIND_HREF.ut + '?h=' + encodeURIComponent(key),
      sides: sidePayload(histHunt, { res: ['res'], nonres: ['nonres', 'nr'] }),
      sources
    });
  }
  return sources;
}

// ---------- Wyoming ----------
function buildWyoming(hunts, hist, exact, landBands) {
  const { obj: WH } = extractJsObject('wyoming/data.js', ['WH']);
  const hfile = hist.wyoming;
  const sources = {
    draw: '2026 WGFD 1st-choice result',
    harvest: null,
    years: hfile.years,
    words: wordKind(hfile.words),
    note: hfile.note
  };
  for (const [key, h] of Object.entries(WH)) {
    const area = h.area === 'GEN' ? 'Nonresident general license' : ('Hunt area ' + h.area);
    const title = [h.cls === 'reduced' ? 'Reduced price' : '', area, h.desc].filter(Boolean).join(' · ');
    const units = h.area && h.area !== 'GEN' ? [String(h.area)] : [];
    const land = landOf(exact, landBands, 'wy', units);
    const histHunt = hfile.hunts[key];
    addHunt(hunts, {
      key, state: 'wy', species: h.sp, sex: h.sx || '', sexTitle: h.desc || h.sp,
      title, weapon: weaponFromLabel(h.w) || '', season: h.type ? ('Type ' + h.type) : '',
      units, wyType: h.type, wyDrawSpecial: true,
      harvest: null,
      land, href: FIND_HREF.wy + '?h=' + encodeURIComponent(key),
      sides: sidePayload(histHunt, { res: ['res'], nonres: ['nr'], special: ['nrs'] }),
      sources,
      resUsesPoints: !!(h.od && h.od.res && h.od.res.pts)
    });
  }
  return sources;
}

function genericFromHistory(hunts, state, hfile, meta, exact, landBands, parseKey) {
  const sources = {
    draw: meta.draw,
    harvest: meta.harvest || null,
    years: hfile.years,
    words: wordKind(hfile.words),
    note: hfile.note
  };
  for (const [key, rec] of Object.entries(hfile.hunts || {})) {
    const parsed = parseKey(key, rec) || {};
    const units = parsed.units || [];
    addHunt(hunts, {
      key, state, species: parsed.species || '', sex: parsed.sex || '', sexTitle: parsed.sexTitle || parsed.species || key,
      title: parsed.title || key,
      weapon: parsed.weapon || '', season: parsed.season || '',
      units, harvest: parsed.harvest || null,
      land: landOf(exact, landBands, state, units),
      href: (FIND_HREF[state] || 'find.html') + '?h=' + encodeURIComponent(key),
      sides: sidePayload(rec, parsed.sideNames || { res: ['res'], nonres: ['nr', 'nonres'] }),
      sources
    });
  }
  return sources;
}

function buildIdaho(hunts, hist, exact, landBands) {
  let IH = {};
  try { IH = extractJsObject('idaho/data.js', ['IH']).obj || {}; } catch (e) { IH = {}; }
  const hfile = hist.idaho;
  const sources = {
    draw: '2026 IDFG first-choice result',
    harvest: null,
    years: hfile.years,
    words: wordKind(hfile.words),
    note: hfile.note
  };
  const keys = new Set([...Object.keys(IH), ...Object.keys(hfile.hunts || {})]);
  for (const key of keys) {
    const h = IH[key] || {};
    const species = h.sp || (key.split('-')[0] || '');
    const area = h.area || h.unit || '';
    const title = h.title || h.name || [species, area && ('Area ' + area), h.desc].filter(Boolean).join(' · ') || key;
    const units = h.units ? [].concat(h.units).map(String) : (area ? [String(area)] : []);
    addHunt(hunts, {
      key, state: 'id', species, sex: h.sx || h.sex || '', sexTitle: h.desc || species,
      title, weapon: weaponFromLabel(h.w || h.weapon || h.season), season: String(h.season || h.wn || ''),
      units, harvest: null,
      land: landOf(exact, landBands, 'id', units),
      href: FIND_HREF.id + '?h=' + encodeURIComponent(key),
      sides: sidePayload(hfile.hunts[key], { res: ['res'], nonres: ['nr'] }),
      sources
    });
  }
  return sources;
}

function buildFromMetaFile(hunts, state, file, histName, hist, exact, landBands, drawLabel, huntVar) {
  const hfile = hist[histName];
  const sources = {
    draw: drawLabel,
    harvest: null,
    years: hfile.years,
    words: wordKind(hfile.words),
    note: hfile.note
  };
  let table = {};
  try {
    const got = extractJsObject(file, huntVar);
    table = got.obj || {};
  } catch (e) { table = {}; }
  const keys = new Set([...Object.keys(table), ...Object.keys(hfile.hunts || {})]);
  for (const key of keys) {
    const h = table[key] || {};
    const species = h.sp || h.species || (String(key).split(/[|-]/)[0] || '');
    const units = h.units ? [].concat(h.units).map(String)
      : h.area ? [String(h.area)]
      : h.unit ? [String(h.unit)]
      : (h.b ? [].concat(h.b).map(String) : []);
    const title = h.title || h.name || h.desc || [species, units.length ? 'Unit ' + units.join(', ') : '', h.season || h.wn].filter(Boolean).join(' · ') || key;
    addHunt(hunts, {
      key, state, species, sex: h.sx || h.sex || '', sexTitle: h.desc || h.sex || species,
      title, weapon: weaponFromLabel(h.w || h.weapon || h.season || h.wn || ''),
      season: String(h.season || h.wn || h.type || ''),
      units, harvest: (h.hv && typeof h.hv[3] === 'number') ? { pct: h.hv[3], source: null }
        : (typeof h.hs === 'number' ? { pct: h.hs, source: null } : null),
      land: landOf(exact, landBands, state, units),
      href: FIND_HREF[state] + '?h=' + encodeURIComponent(key),
      sides: sidePayload(hfile.hunts && hfile.hunts[key], { res: ['res'], nonres: ['nr', 'nonres'] }),
      sources
    });
  }
  return sources;
}

function loadLandBands() {
  const ctx = runJs('find/land-data.js');
  return ctx.RW_LAND_DATA || ctx.window?.RW_LAND_DATA || {};
}

function main() {
  const exact = loadJson('data/public-land/exact.json');
  const landBands = loadLandBands();
  const hist = {
    colorado: loadJson('find/history/colorado.json'),
    utah: loadJson('find/history/utah.json'),
    wyoming: loadJson('find/history/wyoming.json'),
    idaho: loadJson('find/history/idaho.json'),
    nevada: loadJson('find/history/nevada.json'),
    montana: loadJson('find/history/montana.json'),
    newmexico: loadJson('find/history/newmexico.json'),
    arizona: loadJson('find/history/arizona.json')
  };
  const hunts = {};
  const sources = {};
  sources.co = buildColorado(hunts, hist, exact, landBands);
  sources.ut = buildUtah(hunts, hist, exact, landBands);
  sources.wy = buildWyoming(hunts, hist, exact, landBands);
  sources.id = buildIdaho(hunts, hist, exact, landBands);
  sources.nv = buildFromMetaFile(hunts, 'nv', 'nevada/data.js', 'nevada', hist, exact, landBands, '2025 NDOW 1st-choice result', ['NH', 'NV', 'D']);
  sources.mt = buildFromMetaFile(hunts, 'mt', 'montana/data.js', 'montana', hist, exact, landBands, '2026 FWP first-choice result', ['MH', 'MT', 'D']);
  sources.nm = buildFromMetaFile(hunts, 'nm', 'newmexico/data.js', 'newmexico', hist, exact, landBands, '2026 New Mexico first-choice result', ['NH', 'NM', 'D']);
  sources.az = buildFromMetaFile(hunts, 'az', 'arizona/data.js', 'arizona', hist, exact, landBands, 'Arizona published first-choice history is not in our file', ['AH', 'AZ', 'D']);

  const catalog = {
    built: new Date().toISOString().slice(0, 10),
    states: STATE_NAMES,
    hrefs: FIND_HREF,
    sources,
    hunts
  };
  // Drop repeated per-hunt sources; the state sources object is enough.
  for (const h of Object.values(hunts)) delete h.sources;
  const json = JSON.stringify(catalog);
  fs.writeFileSync(outFile, json);
  const gz = path.resolve(here, '../src/catalog.json.gz');
  fs.writeFileSync(gz, gzipSync(Buffer.from(json), { level: 9 }));
  const n = Object.keys(hunts).length;
  const byState = {};
  for (const h of Object.values(hunts)) byState[h.state] = (byState[h.state] || 0) + 1;
  console.log('catalog hunts', n, 'bytes', json.length, 'gzip', fs.statSync(gz).size, 'byState', byState);
}

main();
