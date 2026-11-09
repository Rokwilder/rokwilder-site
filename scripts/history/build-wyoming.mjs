// Wyoming 2024-2026 history from the demand reports linked on WGFD's draw-results page.
// Preference-point rows use the success odds WGFD prints.
// Random rows use quota divided by 1st-choice applicants, because that report prints counts and not a percentage.
// Point-pool odds are not mixed with the random pool. That mix is the estimate on the hunt card, not this history.
import {execFileSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import vm from 'node:vm';
import {packPoints, packScalar} from './bands.mjs';

const root = new URL('../..', import.meta.url).pathname;
const PAGE = 'https://wgfd.wyo.gov/licenses-applications/draw-results-odds';
const YEARS = [2024, 2025, 2026];
const PARTY = new Set(['elk', 'deer', 'pronghorn']);

function pdfText(path) {
  return execFileSync('pdftotext', ['-layout', path, '-'], {encoding:'utf8', maxBuffer: 32 * 1024 * 1024});
}
function normDesc(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}
function descOk(current, prior) {
  const a = normDesc(current);
  const b = normDesc(prior);
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}
function classify(title) {
  const t = title.toLowerCase().replace(/_/g, ' ');
  if (/landowner|leftover/.test(t)) return null;
  let sp = null;
  if (/antelope/.test(t)) sp = 'pronghorn';
  else if (/deer/.test(t)) sp = 'deer';
  else if (/\belk\b/.test(t)) sp = 'elk';
  else if (/moose/.test(t)) sp = 'moose';
  else if (/sheep|bighorn|\bbs\b/.test(t)) sp = 'sheep';
  else if (/goat|\bmg\b/.test(t)) sp = 'goat';
  else if (/bison|\bwb\b/.test(t)) sp = 'bison';
  else return null;
  const nr = /non-?resident|\bnr\b/.test(t);
  const res = !nr && (/resident|\bres\b/.test(t) || /\br$/.test(t.trim()));
  if (!nr && !res) return null;
  const reduced = /doe|fawn|cow|calf|ewe|(^|\s)cc(\s|$)/.test(t);
  const female = /female|(^|\s)el(\s|$)/.test(t);
  const special = /special/.test(t);
  const pp = /preference|\bpp\b/.test(t);
  let kind;
  if (female && (sp === 'bison' || sp === 'sheep')) kind = nr ? 'f_nr' : 'f_res';
  else if (reduced) kind = nr ? 'cc_nr' : 'cc_res';
  else if (pp && special) kind = 'pp_nrs';
  else if (pp) kind = nr ? 'pp_nr' : 'pp_res';
  else if (special) kind = 'rand_nrs';
  else kind = nr ? 'rand_nr' : 'res';
  return {sp, kind, points: kind.startsWith('pp')};
}
function huntKey(sp, area, type) {
  return `${sp}-${String(area).padStart(3, '0')}-${type}`;
}

function parsePoints(text, sp) {
  const hunts = {};
  let open = null;
  const party = PARTY.has(sp);
  function ensure(area, type, desc) {
    const key = huntKey(sp, area, type);
    if (!hunts[key]) hunts[key] = {desc, exact:{}, range:[]};
    open = hunts[key];
    if (desc && desc.length > open.desc.length) open.desc = desc;
  }
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\f/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line || /Hunt Area|Demand Report|Page:|Fiscal Division|Success Odds/.test(line)) continue;
    const tail = line.match(/^(.*?)(?:<=|<)\s*(\d+)\s+(\d+)\s+(\d+\.\d+)%$/);
    const exact = line.match(/^(.*?)\s(\d+)\s+(\d+)\s+(\d+\.\d+)%$/);
    let body, mode, point, odds;
    if (tail && /<=|</.test(line)) {
      const mark = line.includes('<=') ? '<=' : '<';
      const m = line.match(new RegExp(`^(.*)(?:${mark === '<=' ? '<=' : '<'})\\s*(\\d+)\\s+(\\d+)\\s+(\\d+\\.\\d+)%$`));
      if (!m) continue;
      body = m[1].trim();
      mode = mark;
      point = Number(m[2]);
      odds = Number(m[4]) / 100;
    } else if (exact) {
      body = exact[1].trim();
      mode = '=';
      point = Number(exact[2]);
      odds = Number(exact[4]) / 100;
    } else continue;
    if (odds < 0 || odds > 1 || point > 80) continue;
    const head = body.match(/^(\d{3}|[A-Z]{2,4})\s+(\d)\s+(.+?)\s+\d+\s+\d+$/);
    if (head) ensure(head[1], head[2], head[3]);
    if (!open) continue;
    if (mode === '=') open.exact[point] = odds;
    else open.range.push({mode, point, odds});
  }
  const out = {};
  for (const [key, h] of Object.entries(hunts)) {
    const points = {...h.exact};
    const ranges = h.range.sort((a, b) => b.point - a.point);
    for (const row of ranges) {
      if (row.mode === '<=' ) {
        for (let i = 0; i <= row.point; i++) if (points[i] == null) points[i] = row.odds;
      } else if (!party) {
        for (let i = 0; i < row.point; i++) if (points[i] == null) points[i] = row.odds;
      }
    }
    out[key] = {desc: h.desc, points};
  }
  return out;
}

function parseRandom(text, sp) {
  const out = {};
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\f/g, ' ').replace(/\s+/g, ' ').trim();
    const m = line.match(/^(\d{3}|[A-Z]{2,4})\s+(\d)\s+(.+?)\s+(\d+)\s+(\d+)\s+\d+\s+\d+$/);
    if (!m) continue;
    const quota = Number(m[4]);
    const first = Number(m[5]);
    const rate = first > 0 ? Math.min(1, quota / first) : null;
    const key = huntKey(sp, m[1], m[2]);
    out[key] = {desc: m[3], rate};
  }
  return out;
}

const sandbox = {window:{}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'wyoming/data.js'), 'utf8') + '\nglobalThis.WH=WH;', sandbox);
const WH = sandbox.WH;

const html = await (await fetch(PAGE, {headers:{'user-agent':'Mozilla/5.0 Rokwilder research'}})).text();
const blocks = html.split('field-content').slice(1);
const chosen = [];
for (const block of blocks) {
  const pairs = [...block.matchAll(/href="(\/media\/\d+\/download\?inline)"[^>]*title="([^"]+)"/g)];
  if (!pairs.length) continue;
  const titles = pairs.map(p => p[2]);
  const year = YEARS.find(y => titles.some(t => t.includes(String(y))));
  if (!year) continue;
  const bag = {};
  for (const [, href, title] of pairs) {
    const kind = classify(title);
    if (!kind) continue;
    const id = kind.sp + ':' + kind.kind;
    if (bag[id]) bag[id].clash = true;
    else bag[id] = {year, ...kind, title, url:'https://wgfd.wyo.gov' + href, clash:false};
  }
  for (const item of Object.values(bag)) {
    if (item.clash) continue;
    chosen.push(item);
  }
}
console.log('reports', chosen.length);

const dir = join(tmpdir(), 'wy-history');
mkdirSync(dir, {recursive:true});
const tables = {};
const sources = [];
const skipped = [];
for (const item of chosen) {
  const dest = join(dir, `${item.year}-${item.sp}-${item.kind}.pdf`);
  try {
    execFileSync('curl', ['-fsSL', '-A', 'Mozilla/5.0', '-o', dest, item.url], {stdio:'inherit'});
    const text = pdfText(dest);
    const head = text.slice(0, 500).toLowerCase();
    if (!/wyoming game and fish|demand report/.test(head)) throw new Error('not a WGFD demand report');
    if (item.points && !/success odds|preference point/.test(head)) throw new Error('expected a preference-point report');
    if (!item.points && /success odds/.test(head)) throw new Error('expected a count report, found printed odds');
    const parsed = item.points ? parsePoints(text, item.sp) : parseRandom(text, item.sp);
    if (!Object.keys(parsed).length) throw new Error('no hunts parsed');
    tables[`${item.year}:${item.sp}:${item.kind}`] = parsed;
    sources.push({year:item.year, species:item.sp, kind:item.kind, title:item.title, url:item.url, hunts:Object.keys(parsed).length});
    console.log('ok', item.year, item.sp, item.kind, Object.keys(parsed).length);
  } catch (err) {
    skipped.push({year:item.year, species:item.sp, kind:item.kind, url:item.url, why:String(err.message || err).slice(0, 200)});
    console.log('skip', item.year, item.sp, item.kind, err.message);
  }
}

function kindFor(h, pool) {
  if (h.sp === 'bison' && h.sx === 'F') return pool === 'res' ? 'f_res' : pool === 'nr' ? 'f_nr' : null;
  if (h.cls === 'reduced') return pool === 'res' ? 'cc_res' : pool === 'nr' ? 'cc_nr' : null;
  if (pool === 'nrs') return h.od.nrs?.pts ? 'pp_nrs' : 'rand_nrs';
  if (pool === 'res') {
    if (h.od.res?.pts) return 'pp_res';
    return 'res';
  }
  if (h.od.nr?.pts) return 'pp_nr';
  return 'rand_nr';
}

const hunts = {};
for (const [key, h] of Object.entries(WH)) {
  const rec = {};
  for (const pool of ['res', 'nr', 'nrs']) {
    if (!h.od[pool]) continue;
    const kind = kindFor(h, pool);
    if (!kind) continue;
    const pointed = kind.startsWith('pp');
    if (pointed) {
      const yearPoints = {};
      for (const year of YEARS) {
        const table = tables[`${year}:${h.sp}:${kind}`];
        const row = table && table[key];
        if (!row || !descOk(h.desc, row.desc)) continue;
        yearPoints[year] = row.points;
      }
      const packed = packPoints(yearPoints, YEARS, 'yes');
      if (packed) rec[pool] = packed;
    } else {
      const rates = {};
      for (const year of YEARS) {
        const table = tables[`${year}:${h.sp}:${kind}`];
        const row = table && table[key];
        if (!row || row.rate == null || !descOk(h.desc, row.desc)) continue;
        rates[year] = row.rate;
      }
      const packed = packScalar(rates, YEARS, 'yes');
      if (packed) rec[pool] = packed;
    }
  }
  if (Object.keys(rec).length) hunts[key] = rec;
}

const out = {
  state: 'wyoming',
  words: 'yes',
  years: YEARS,
  note: 'WGFD 1st-choice result. Preference-point years are the odds WGFD prints at this point level, not the random draw after a miss. Resident elk, deer and pronghorn are the published quota divided by 1st-choice applicants. Not a forecast.',
  hunts
};
writeFileSync(join(root, 'find/history/wyoming.json'), JSON.stringify(out));
writeFileSync(join(root, 'find/history/wyoming.sources.json'), JSON.stringify({
  state: 'wyoming',
  yearsAdded: YEARS.filter(year => sources.some(s => s.year === year)),
  unavailable: skipped,
  match: 'Species, hunt area and type must match, and the license description must be the same text or a shortened print of it. A different description is not history. Party-average rows between whole points (elk, deer, pronghorn) are not applied to a whole point total. Moose and bighorn "< N" rows are everyone under that point total, which is how WGFD uses that row when parties are not allowed.',
  band: 'yes',
  hunts: Object.keys(hunts).length,
  sources,
  page: PAGE
}, null, 2));
console.log('history hunts', Object.keys(hunts).length, 'of', Object.keys(WH).length);
