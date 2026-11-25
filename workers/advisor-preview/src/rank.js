// Official-data ranking for the preview advisor. No guessed numbers.
export const STATE_NAMES = {
  co: 'Colorado', ut: 'Utah', az: 'Arizona', wy: 'Wyoming',
  id: 'Idaho', nv: 'Nevada', mt: 'Montana', nm: 'New Mexico'
};

export function drawWord(v, kind) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  const n = Number(v);
  if (kind === 'drew') {
    if (n === 1) return 'ALL DREW';
    if (n >= 0.75) return 'MOST DREW';
    if (n >= 0.25) return 'SOME DREW';
    if (n >= 0.05) return 'FEW DREW';
    if (n > 0) return 'LONG SHOT';
    if (n === 0) return 'NONE DREW';
    return null;
  }
  if (n >= 0.995) return "YES, you'll draw";
  if (n >= 0.75) return 'LIKELY';
  if (n >= 0.25) return 'MAYBE';
  if (n > 0) return 'LONG SHOT';
  if (n === 0) return 'NOT THIS YEAR';
  return null;
}

export function rateAt(side, pts, words) {
  if (!side || !side.rates) return null;
  let rate = null;
  if (!side.pointed) {
    rate = side.rates['*'];
  } else if (pts == null || pts === '') {
    return null;
  } else if (Object.prototype.hasOwnProperty.call(side.rates, String(pts))) {
    rate = side.rates[String(pts)];
  } else {
    return null;
  }
  if (typeof rate !== 'number') return null;
  const trend = side.pointed && side.trendMap && side.trendMap[String(pts)]
    ? side.trendMap[String(pts)]
    : (side.trend || null);
  return {
    rate,
    word: drawWord(rate, words),
    year: side.year,
    trend: trend && trend !== 'Holding steady' ? trend : (trend === 'Holding steady' ? 'Holding steady' : null),
    pointed: !!side.pointed
  };
}

function normSpecies(s) {
  const t = String(s || '').toLowerCase().trim();
  if (t === 'antelope') return 'pronghorn';
  if (t === 'dsheep' || t.includes('desert')) return 'desert bighorn';
  if (t === 'sheep' || t.includes('bighorn')) return 'bighorn sheep';
  return t;
}
function speciesMatch(huntSp, want) {
  if (!want || want === 'any') return true;
  const a = normSpecies(huntSp), b = normSpecies(want);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
function weaponMatch(huntW, want) {
  if (!want || want === 'any') return true;
  const a = String(huntW || '').toLowerCase();
  const b = String(want || '').toLowerCase();
  if (!a) return false;
  if (b === 'rifle') return a === 'rifle' || a.includes('rifle') || a === 'season choice';
  return a === b || a.includes(b);
}
function isPrivateOnly(hunt) {
  if (hunt.state === 'co' && /[A-Z]{2}\d{3}P\d[A-Z]$/.test(hunt.key)) return true;
  const s = String(hunt.season || '') + ' ' + String(hunt.title || '');
  return /private-land-only|private land only/i.test(s);
}
function sexClass(hunt) {
  const sx = String(hunt.sex || hunt.sx || '').toUpperCase();
  if (sx === 'M') return 'antlered';
  if (sx === 'F') return 'antlerless';
  if (sx === 'E') return 'either';
  const s = (hunt.sexTitle || hunt.sex || hunt.title || '').toLowerCase();
  if (/cow|doe|nanny|ewe|antlerless|female/.test(s) && !/either|any elk|any deer/.test(s)) return 'antlerless';
  if (/bull|buck|ram|billy|antlered|bearded|male/.test(s) && !/either/.test(s)) return 'antlered';
  return 'either';
}

const SEX_SPECIES = {
  elk: { antlered: 'Bull', antlerless: 'Cow', either: 'Either' },
  deer: { antlered: 'Buck', antlerless: 'Doe', either: 'Either' },
  pronghorn: { antlered: 'Buck', antlerless: 'Doe', either: 'Either' },
  moose: { antlered: 'Bull', antlerless: 'Cow', either: 'Either' }
};

export function parseSex(raw) {
  const t = String(raw || '').toLowerCase().trim();
  if (!t || t === 'any' || t === 'please choose') return '';
  if (t === 'm' || t === 'bull' || t === 'buck' || t === 'antlered' || t === 'male' || t === 'antlered elk' || t === 'antlered deer') return 'antlered';
  if (t === 'f' || t === 'cow' || t === 'doe' || t === 'antlerless' || t === 'female' || t === 'cow or calf' || t === 'antlerless elk') return 'antlerless';
  if (t === 'e' || t === 'either' || t === 'either-sex' || t === 'eithersex' || t === 'either sex') return 'either';
  return '';
}

export function inferSex(q, catalog) {
  const direct = parseSex(q && q.sex);
  if (direct) return direct;
  const question = String((q && q.question) || '').toLowerCase();
  const wantsBull = /\bbulls?\b|\bbucks?\b|\bantlered\b/.test(question);
  const wantsCow = /\bcows?\b|\bdoes?\b|\bantlerless\b/.test(question);
  if (wantsBull && !wantsCow) return 'antlered';
  if (wantsCow && !wantsBull) return 'antlerless';
  if (/\beither(\s|-)?sex\b/.test(question)) return 'either';
  const hunt = q && q.hunt && q.hunt.key ? getHunt(catalog, q.hunt.state || q.state, q.hunt.key) : null;
  if (hunt) {
    const c = sexClass(hunt);
    if (c === 'antlered' || c === 'antlerless') return c;
  }
  return '';
}

function sexMatches(want, hunt) {
  if (!want || want === 'either') return true;
  const c = sexClass(hunt);
  if (want === 'antlered') return c === 'antlered' || c === 'either';
  if (want === 'antlerless') return c === 'antlerless' || c === 'either';
  return true;
}

export function sexChoices(species) {
  const sp = normSpecies(species);
  return SEX_SPECIES[sp] || null;
}

export function speciesHasSexChoice(catalog, state, species) {
  const labels = sexChoices(species);
  if (!labels) return false;
  const st = String(state || '').toLowerCase();
  let antlered = false, antlerless = false;
  for (const hunt of Object.values(catalog.hunts || {})) {
    if (hunt.state !== st) continue;
    if (!speciesMatch(hunt.species, species)) continue;
    const c = sexClass(hunt);
    if (c === 'antlered') antlered = true;
    if (c === 'antlerless') antlerless = true;
    if (antlered && antlerless) return true;
  }
  return false;
}

function fragmentBroken(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  const opens = (t.match(/\(/g) || []).length;
  const closes = (t.match(/\)/g) || []).length;
  if (opens !== closes) return true;
  if (/\(\d*\s*$/.test(t)) return true;
  if (t.length === 20) return true;
  if (/ (ONL|DEE|WE|EA|CO|EX|TA|PO|SNA)\s*$/i.test(t)) return true;
  if (/[ ,][A-Z]$/.test(t)) return true;
  return false;
}

function sexPhrase(hunt) {
  const sp = normSpecies(hunt.species) || 'animal';
  const c = sexClass(hunt);
  if (c === 'antlered') {
    if (sp === 'elk') return 'antlered elk';
    if (sp === 'deer') return 'antlered deer';
    return 'antlered ' + sp;
  }
  if (c === 'antlerless') {
    if (sp === 'elk') return 'antlerless elk';
    if (sp === 'deer') return 'antlerless deer';
    return 'antlerless ' + sp;
  }
  if (sp === 'elk') return 'any elk';
  if (sp === 'deer') return 'any deer';
  return sp;
}

export function cleanHuntTitle(hunt) {
  const raw = String(hunt && hunt.title || '');
  const desc = String(hunt && (hunt.sexTitle || hunt.desc) || '');
  const tail = raw.includes('·') ? raw.split('·').pop().trim() : raw;
  if (!fragmentBroken(raw) && !fragmentBroken(desc) && !fragmentBroken(tail)) return raw || desc;
  const units = (hunt.units && hunt.units[0]) || hunt.area || '';
  const typ = hunt.wyType || String(hunt.season || '').replace(/^Type\s+/i, '');
  const bits = [];
  if (units) bits.push('Hunt area ' + units);
  if (typ) bits.push('type ' + typ);
  bits.push(sexPhrase(hunt));
  return bits.join(', ');
}
function sideOf(hunt, residency, draw) {
  const sides = hunt.sides || {};
  const res = String(residency || 'res').toLowerCase();
  if (res === 'special' || res === 'nrs') return sides.special || sides.nrs || sides.nonres || null;
  if (res === 'nonres' || res === 'nr' || res === 'out') return sides.nonres || sides.nr || null;
  return sides.res || null;
}

export function getHunt(catalog, state, key) {
  if (!catalog || !key) return null;
  const st = String(state || '').toLowerCase();
  return catalog.hunts[st + ':' + key] || catalog.hunts[key] || null;
}

export function officialFacts(catalog, state, key, residency, pts) {
  const hunt = getHunt(catalog, state, key);
  if (!hunt) return null;
  const st = hunt.state;
  const src = catalog.sources[st] || hunt.sources || {};
  const words = src.words || 'yes';
  const side = sideOf(hunt, residency);
  const usesPts = st === 'wy' && residency === 'res' ? !!hunt.resUsesPoints : true;
  const draw = side ? rateAt(side, usesPts ? pts : null, words) : null;
  const harvest = hunt.harvest && typeof hunt.harvest.pct === 'number' ? hunt.harvest : null;
  return {
    key: hunt.key,
    state: st,
    stateName: STATE_NAMES[st] || st,
    title: cleanHuntTitle(hunt),
    species: hunt.species,
    weapon: hunt.weapon,
    season: hunt.season,
    units: hunt.units || [],
    href: hunt.href,
    draw,
    drawSource: src.draw || null,
    harvest: harvest ? { pct: harvest.pct, source: harvest.source || null, text: Math.round(harvest.pct) + '% of hunters harvested' } : null,
    land: hunt.land && (hunt.land.text || hunt.land.band) ? hunt.land : null,
    historyMissing: st === 'az' || !side,
    usesPoints: usesPts
  };
}

function score(facts, hunt) {
  if (!facts || !facts.draw) return -1;
  let s = facts.draw.rate * 100;
  if (facts.land && typeof facts.land.pct === 'number') s += facts.land.pct * 28;
  else if (facts.land && facts.land.band === 'pub') s += 22;
  else if (facts.land && facts.land.band === 'mix') s += 8;
  else if (facts.land && facts.land.band === 'priv') s -= 12;
  if (facts.harvest) s += Math.min(facts.harvest.pct, 70) * 0.2;
  if (hunt && sexClass(hunt) === 'antlerless') s -= 6;
  if (facts.draw && facts.draw.year && facts.draw.year >= 2026) s += 3;
  return s;
}

export function recommend(catalog, q) {
  const state = String(q.state || '').toLowerCase();
  const species = q.species;
  const residency = q.residency || q.res || 'res';
  const pts = q.points == null || q.points === '' ? null : Number(q.points);
  const weapon = q.weapon || 'any';
  const sex = inferSex(q, catalog);
  if (!STATE_NAMES[state]) {
    return { ok: false, kind: 'unknown', reason: "I don't know that state in our files." };
  }
  const src = catalog.sources[state] || {};
  if (state === 'az') {
    return {
      ok: true,
      kind: 'unknown',
      reason: "I don't know a published first-choice draw history for Arizona in our file. Arizona Game and Fish reports bonus points in a way we cannot turn into a first-choice rate.",
      source: src.draw,
      picks: []
    };
  }
  if (speciesHasSexChoice(catalog, state, species) && !sex) {
    const labels = sexChoices(species);
    return {
      ok: true,
      kind: 'need_sex',
      reason: 'Before I rank hunts, I need to know whether you want a ' + labels.antlered.toLowerCase() + ', a ' + labels.antlerless.toLowerCase() + ', or either.',
      sexOptions: [
        { value: 'antlered', label: labels.antlered },
        { value: 'antlerless', label: labels.antlerless },
        { value: 'either', label: labels.either }
      ],
      query: { state, stateName: STATE_NAMES[state], species, residency, points: pts, weapon, sex: '' },
      source: src.draw,
      picks: []
    };
  }
  const out = [];
  const skipped = [];
  for (const hunt of Object.values(catalog.hunts)) {
    if (hunt.state !== state) continue;
    if (!speciesMatch(hunt.species, species)) continue;
    if (!weaponMatch(hunt.weapon, weapon)) continue;
    if (!sexMatches(sex, hunt)) continue;
    if (!q.includePrivate && isPrivateOnly(hunt)) continue;
    const facts = officialFacts(catalog, hunt.state, hunt.key, residency, pts);
    if (!facts) continue;
    if (!facts.draw) { skipped.push(hunt.key); continue; }
    facts._sex = sexClass(hunt);
    facts._score = score(facts, hunt);
    out.push(facts);
  }
  if (!out.length) {
    return {
      ok: true,
      kind: 'unknown',
      reason: "I don't know a published first-choice result that matches those choices in our file.",
      source: src.draw,
      picks: [],
      query: { state, species, residency, points: pts, weapon }
    };
  }
  out.sort((a, b) => (b._score || 0) - (a._score || 0));
  const drawable = out.filter(h => h.draw.rate >= 0.25);
  const long = out.filter(h => h.draw.rate > 0 && h.draw.rate < 0.25);
  const none = out.filter(h => h.draw.rate === 0);
  const pool = drawable.length ? drawable : out;
  // Keep unit and sex variety when possible
  const varied = [];
  const seenU = new Set();
  const seenS = new Set();
  for (const p of pool) {
    const u = (p.units && p.units[0]) || p.key;
    if (seenU.has(u) && varied.length) continue;
    if (sex === 'either' && varied.length === 2 && seenS.size === 1 && p._sex === [...seenS][0] && pool.some(x => x._sex !== p._sex && !seenU.has((x.units && x.units[0]) || x.key))) continue;
    seenU.add(u);
    seenS.add(p._sex || 'either');
    varied.push(p);
    if (varied.length >= 3) break;
  }
  const chosen = varied.length ? varied : pool.slice(0, 3);
  let caution = null;
  const dream = none.concat(long).sort((a, b) => {
    const la = a.land && a.land.pct || (a.land && a.land.band === 'pub' ? 0.8 : 0);
    const lb = b.land && b.land.pct || (b.land && b.land.band === 'pub' ? 0.8 : 0);
    return lb - la;
  })[0];
  if (dream && !chosen.some(c => c.key === dream.key)) caution = dream;
  const clean = h => { if(h){ delete h._score; delete h._sex; } return h; };
  chosen.forEach(clean);
  clean(caution);
  return {
    ok: true,
    kind: 'recommend',
    query: { state, stateName: STATE_NAMES[state], species, residency, points: pts, weapon, sex },
    source: src.draw,
    note: src.note,
    words: src.words,
    picks: chosen,
    caution,
    matchCount: out.length
  };
}

export function compareHunts(catalog, list, residency, pts) {
  const facts = [];
  const missing = [];
  for (const item of list || []) {
    const state = item.state || item.snap && item.snap.state;
    const key = item.key || item.id || (item.snap && item.snap.key);
    if (!state || !key) { missing.push(item); continue; }
    const row = officialFacts(catalog, state, key, item.residency || residency, item.points != null ? item.points : pts);
    if (!row) missing.push({ state, key });
    else facts.push(row);
  }
  if (facts.length < 2) {
    return {
      ok: true,
      kind: facts.length === 1 ? 'one' : 'unknown',
      reason: facts.length === 1
        ? null
        : "I don't know those saved hunts in our official file, or I need at least two hunts to compare.",
      hunts: facts,
      missing
    };
  }
  const bits = [];
  const withDraw = facts.filter(h => h.draw && typeof h.draw.rate === 'number');
  if (withDraw.length >= 2) {
    const top = withDraw.slice().sort((a, b) => b.draw.rate - a.draw.rate);
    const hi = top[0], lo = top[top.length - 1];
    if (hi.draw.rate !== lo.draw.rate) {
      bits.push(hi.title + ' (' + hi.key + ') was easier to draw than ' + lo.title + ' (' + lo.key + ') on the last published year (' + hi.draw.word + ' versus ' + lo.draw.word + ', ' + hi.draw.year + ').');
    } else {
      bits.push('The last published draw result matches for the hunts that have one.');
    }
  }
  const withH = facts.filter(h => h.harvest && typeof h.harvest.pct === 'number');
  if (withH.length >= 2) {
    const top = withH.slice().sort((a, b) => b.harvest.pct - a.harvest.pct);
    if (top[0].harvest.pct !== top[top.length - 1].harvest.pct) {
      bits.push(top[0].title + ' has the higher published hunter success (' + Math.round(top[0].harvest.pct) + '% versus ' + Math.round(top[top.length - 1].harvest.pct) + '%).');
    }
  }
  const withL = facts.filter(h => h.land && (typeof h.land.pct === 'number' || h.land.band));
  if (withL.length >= 2) {
    const rank = h => typeof h.land.pct === 'number' ? h.land.pct : (h.land.band === 'pub' ? 0.85 : h.land.band === 'mix' ? 0.55 : 0.2);
    const top = withL.slice().sort((a, b) => rank(b) - rank(a));
    if (rank(top[0]) !== rank(top[top.length - 1])) {
      bits.push(top[0].title + ' has the higher public-land share (' + (top[0].land.text || top[0].land.band) + ' versus ' + (top[top.length - 1].land.text || top[top.length - 1].land.band) + ').');
    }
  }
  return { ok: true, kind: 'compare', hunts: facts, missing, bits };
}

export function classifyJob(body) {
  const job = String(body.job || 'auto').toLowerCase();
  const q = String(body.question || '').toLowerCase();
  const outOfScope = [
    /regulat/, /legal/, /is it legal/, /caliber/, /bait/, /rifle should i (bring|use|buy)/,
    /what (will|shall) .* (year|2027|next year)/, /forecast 2027/,
    /weather/, /outfitter/, /where should i camp/, /road clos/, /what to pack/,
    /wd[ -]?40/, /recipe/, /politic/, /medical/, /taxiderm/
  ];
  if (q && outOfScope.some(r => r.test(q))) return 'unknown';
  if (job === 'recommend' || job === 'compare' || job === 'lookup') return job;
  if (/compar|which of these|better for me|which hunt is better/.test(q)) return 'compare';
  if (body.hunt && body.hunt.key && /odds|this hunt|put this first|should i put/.test(q)) {
    if (/put this first|should i put/.test(q)) return 'recommend';
    return 'lookup';
  }
  if (body.state && (body.species || /elk|deer|pronghorn|antelope|moose|sheep|goat|bear|bison/.test(q))) {
    if (/where (should|do|would) i (put|apply|draw|hunt)/.test(q) || /put in/.test(q) || /first choice/.test(q)) return 'recommend';
  }
  if (/where (should|do|would) i (put|apply)/.test(q) || /put in with my points/.test(q)) return 'recommend';
  if (/odds with my points/.test(q)) return body.hunt && body.hunt.key ? 'lookup' : 'recommend';
  return 'unknown';
}

export function runJob(catalog, body) {
  const job = classifyJob(body);
  const residency = body.residency || body.res || 'res';
  const pts = body.points;
  if (job === 'unknown') {
    return {
      ok: true,
      kind: 'unknown',
      reason: "I don't know. In this first version I can only help with where to put in with your points, and with comparing hunts you have saved. I will not guess at regulations, gear, or next year's draw."
    };
  }
  if (job === 'recommend') {
    return recommend(catalog, body);
  }
  if (job === 'compare') {
    let list = Array.isArray(body.hunts) ? body.hunts.slice() : [];
    if (body.hunt && body.hunt.key && !list.some(h => (h.key || (h.snap && h.snap.key)) === body.hunt.key)) {
      list = [body.hunt].concat(list);
    }
    return compareHunts(catalog, list, residency, pts);
  }
  if (job === 'lookup') {
    const h = body.hunt || {};
    const facts = officialFacts(catalog, h.state || body.state, h.key, residency, pts);
    if (!facts) {
      return { ok: true, kind: 'unknown', reason: "I don't know that hunt in our official file." };
    }
    if (!facts.draw && facts.historyMissing) {
      return { ok: true, kind: 'one', hunts: [facts], reason: "I don't know a published first-choice result for this hunt in our file." };
    }
    return { ok: true, kind: 'one', hunts: [facts] };
  }
  return { ok: true, kind: 'unknown', reason: "I don't know." };
}
