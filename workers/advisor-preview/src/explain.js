// Plain-English templates plus an optional Workers AI polish. No invented facts.

function noDash(s) {
  return String(s || '').replace(/\u2014|\u2013/g, ',');
}

function drawSentence(h) {
  const y = h && h.draw && h.draw.year;
  const w = h && h.draw && h.draw.word;
  if (!y && !w) return 'No published first-choice result at those points in our file.';
  if (!y) return w || 'No published first-choice result at those points in our file.';
  if (!w) return 'I don\'t know a published first-choice result for the ' + y + ' draw.';
  if (w === "YES, you'll draw" || /you(?:'ll| will) draw/i.test(w)) {
    return 'In the ' + y + ' draw, you would have drawn' + (h.drawSource ? ' (' + h.drawSource + ')' : '') + (h.draw.trend ? '. ' + h.draw.trend + '.' : '.');
  }
  if (w === 'NOT THIS YEAR' || /not this year/i.test(w)) {
    return 'In the ' + y + ' draw, you would not have drawn' + (h.drawSource ? ' (' + h.drawSource + ')' : '') + (h.draw.trend ? '. ' + h.draw.trend + '.' : '.');
  }
  return 'In the ' + y + ' draw, this hunt was ' + w + (h.drawSource ? ' (' + h.drawSource + ')' : '') + (h.draw.trend ? '. ' + h.draw.trend + '.' : '.');
}

function huntLine(h) {
  const bits = [h.stateName + ': ' + h.title + ' (hunt code ' + h.key + ')'];
  if (h.draw) bits.push(drawSentence(h));
  else bits.push('No published first-choice result at those points in our file.');
  if (h.harvest) {
    bits.push(h.harvest.text + (h.harvest.source ? ' (' + h.harvest.source + ')' : '') + '.');
  }
  if (h.land && h.land.text) bits.push(h.land.text + '.');
  return bits.join(' ');
}

export function utahDisclaimer(result) {
  const hunts = [].concat(result && result.picks || [], result && result.hunts || [], result && result.caution ? [result.caution] : []);
  const isUt = (result && result.query && result.query.state === 'ut') || hunts.some(h => h && h.state === 'ut');
  if (!isUt) return '';
  let dataYear = null;
  hunts.forEach(h => { if (h && h.draw && h.draw.year) dataYear = dataYear || h.draw.year; });
  const src = String((result && result.source) || '');
  const m = src.match(/\b(20\d{2})\b/);
  if (!dataYear && m) dataYear = Number(m[1]);
  if (!dataYear) dataYear = 2025;
  const missing = src.match(/\b(20\d{2}) was not published/i);
  const nextYear = missing ? Number(missing[1]) : dataYear + 1;
  return 'Based on the ' + dataYear + ' Utah draw. Utah has not published the full ' + nextYear + ' results table.';
}

export function collectYears(result) {
  const years = [];
  function add(y) {
    const n = Number(y);
    if (n >= 2000 && n <= 2100 && !years.includes(n)) years.push(n);
  }
  const hunts = [].concat(result && result.picks || [], result && result.hunts || [], result && result.caution ? [result.caution] : []);
  hunts.forEach(h => { if (h && h.draw && h.draw.year) add(h.draw.year); });
  const src = String((result && result.source) || '');
  (src.match(/20\d{2}/g) || []).forEach(add);
  return years;
}

function yearForSentence(sentence, years) {
  const found = String(sentence || '').match(/20\d{2}/);
  if (found) return found[0];
  return years && years[0] ? String(years[0]) : null;
}

export function enforceYear(text, result) {
  const years = collectYears(result);
  let t = noDash(String(text || '')).trim();
  if (!t) return t;
  const notice = utahDisclaimer(result);
  // Rewrite sentence by sentence so "this year" and bare "you'll draw" pick up a year.
  const chunks = t.split(/((?:[.!?]|\n)+\s*)/);
  const out = [];
  for (let i = 0; i < chunks.length; i++) {
    let s = chunks[i];
    if (/^[.!\n]/.test(s) || !/[a-zA-Z]/.test(s)) { out.push(s); continue; }
    const y = yearForSentence(s, years);
    if (y) {
      s = s.replace(/\byou(?:'ll| will) draw\b(?:[^.]*?)\bthis year(?:'s)?(?: draw)?/gi, 'In the ' + y + ' draw, you would have drawn');
      s = s.replace(/\bthis year(?:'s)?(?: draw)?,?\s+you(?:'ll| will) draw/gi, 'In the ' + y + ' draw, you would have drawn');
      s = s.replace(/\byou(?:'ll| will) draw in (?:the )?((?:20\d{2})|the 20\d{2} draw)\b/gi, function(m){
        const yy = (m.match(/20\d{2}/) || [y])[0];
        return 'In the ' + yy + ' draw, you would have drawn';
      });
    }
    s = s.replace(/\bNOT THIS YEAR\b/g, y ? ('not a hunt you would have drawn in ' + y) : 'not a hunt you would have drawn');
    s = s.replace(/\bthis year(?:'s)?(?: draw)?\b/gi, y ? ('the ' + y + ' draw') : 'the published draw');
    if (/\byou(?:'ll| will) draw\b/i.test(s)) {
      if (!/20\d{2}/.test(s) && y) {
        s = s.replace(/^\s*(You(?:'ll| will) draw)\b/i, 'In the ' + y + ' draw, you would have drawn');
        s = s.replace(/\byou(?:'ll| will) draw\b/i, 'you would have drawn');
        if (!/^\s*In the /i.test(s)) s = 'In the ' + y + ' draw, ' + s.replace(/^\s*/, '');
      } else if (/20\d{2}/.test(s)) {
        s = s.replace(/\bYou(?:'ll| will) draw\b/g, 'you would have drawn');
        s = s.replace(/\byou(?:'ll| will) draw\b/gi, 'you would have drawn');
        if (!/in the 20\d{2} draw/i.test(s) && y) {
          s = s.replace(/^\s*/, 'In the ' + y + ' draw, ');
        }
      }
    }
    s = s.replace(/\bIn the (20\d{2}) draw, in the \1 draw, /gi, 'In the $1 draw, ');
    s = s.replace(/\bin the (20\d{2}) draw in the \1 draw\b/gi, 'in the $1 draw');
    s = s.replace(/you would have drawn the (20\d{2}) draw/gi, 'In the $1 draw, you would have drawn');
    s = s.replace(/\bIn the (20\d{2}) draw, In the \1 draw, /g, 'In the $1 draw, ');
    out.push(s);
  }
  t = out.join('').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
  if (notice && !/Based on the \d{4} Utah draw/i.test(t)) {
    t = notice + ' ' + t;
  }
  return noDash(t);
}

export function displayDraw(h) {
  if (!h || !h.draw) return '';
  return drawSentence(h).replace(/\.$/, '');
}

export function templateText(result) {
  if (!result || result.kind === 'unknown' || result.kind === 'need_sex') {
    return noDash((result && result.reason) || "I don't know.");
  }
  const parts = [];
  if (result.kind === 'recommend') {
    const q = result.query || {};
    const who = [q.stateName, q.residency === 'nonres' || q.residency === 'nr' ? 'nonresident' : 'resident', q.species, q.points != null ? (q.points + ' point' + (q.points === 1 ? '' : 's')) : '', q.weapon && q.weapon !== 'any' ? q.weapon : ''].filter(Boolean).join(', ');
    parts.push('Here is a first-choice plan from our official file for ' + who + '.');
    const utah = utahDisclaimer(result);
    if (utah) parts.push(utah);
    if (result.source && !utah) parts.push('Draw words come from ' + result.source + '. This is not a forecast for the next draw.');
    else if (result.source && utah) parts.push('This is not a forecast for the next draw.');
    (result.picks || []).forEach((h, i) => {
      parts.push((i + 1) + '. ' + huntLine(h));
    });
    if (result.caution) {
      const y = result.caution.draw && result.caution.draw.year;
      parts.push(result.caution.title + ' (hunt code ' + result.caution.key + ') was not a hunt you would have drawn' + (y ? ' in the ' + y + ' draw' : '') + ', so I would not put it first.');
    }
    const priv = (result.picks || []).find(h => h.land && (h.land.band === 'priv' || (typeof h.land.pct === 'number' && h.land.pct < 0.4)));
    if (priv) {
      parts.push('I do not know your access on private land, and I will not guess. ' + priv.title + ' is mostly private, so only put it first if you have a place to hunt.');
    }
  } else if (result.kind === 'compare') {
    parts.push('Here is how those saved hunts compare in our official file.');
    (result.hunts || []).forEach(h => parts.push(huntLine(h)));
    (result.bits || []).forEach(b => parts.push(b));
    if (result.missing && result.missing.length) {
      parts.push("I don't know " + result.missing.length + ' of the saved hunts in our official file.');
    }
  } else if (result.kind === 'one') {
    const h = (result.hunts || [])[0];
    if (h) parts.push(huntLine(h));
    if (result.reason) parts.push(result.reason);
  } else {
    parts.push(result.reason || "I don't know.");
  }
  return enforceYear(noDash(parts.filter(Boolean).join(' ')), result);
}

export function allowedFacts(result) {
  const codes = new Set();
  const titles = new Set();
  const numbers = new Set();
  const years = new Set();
  function addHunt(h) {
    if (!h) return;
    if (h.key) codes.add(String(h.key).toUpperCase());
    if (h.title) titles.add(h.title.toLowerCase());
    (h.units || []).forEach(u => numbers.add(String(u)));
    if (h.draw) {
      if (h.draw.year) years.add(String(h.draw.year));
      if (typeof h.draw.rate === 'number') {
        numbers.add(String(Math.round(h.draw.rate * 100)));
      }
    }
    if (h.harvest && typeof h.harvest.pct === 'number') numbers.add(String(Math.round(h.harvest.pct)));
    if (h.land && typeof h.land.pct === 'number') numbers.add(String(Math.round(h.land.pct * 100)));
  }
  (result.picks || []).forEach(addHunt);
  (result.hunts || []).forEach(addHunt);
  if (result.caution) addHunt(result.caution);
  if (result.query && result.query.points != null) numbers.add(String(result.query.points));
  years.add('2023'); years.add('2024'); years.add('2025'); years.add('2026'); years.add('2027');
  // Common official band cutoffs and percents that may appear in wording
  [0, 1, 5, 15, 25, 30, 37, 40, 49, 50, 70, 74, 75, 80, 99, 100].forEach(n => numbers.add(String(n)));
  return { codes, numbers, years };
}

export function looksSafe(text, result) {
  const t = String(text || '');
  if (!t.trim()) return false;
  const { codes } = allowedFacts(result);
  // Hunt-code shaped tokens. Allow only codes from the result.
  const found = t.match(/\b[A-Z]{1,4}\d{2,5}[A-Z0-9]*\b|\b(?:elk|deer|ant|moose|sheep|goat|bison)-\d{2,4}-\d+\b/gi) || [];
  for (const raw of found) {
    const up = raw.toUpperCase();
    if (!codes.has(up) && !codes.has(raw)) return false;
  }
  return true;
}

export function systemPrompt() {
  return 'You write short, plain explanations for a hunting draw-odds tool used by a 68-year-old hunter who is not computer savvy. Use ONLY the facts JSON. Do not add hunts, hunt codes, odds, percents, years, or units that are not in the facts. If something is missing, say you do not know. Do not forecast a future draw. Always name the data year. Never say "this year". Never say "you will draw" or "you\'ll draw" unless you also name the year in that sentence. Prefer "In the 2026 draw, you would have drawn." Short sentences. No headings. Do not use em-dashes or en-dashes. Name each hunt by its title and hunt code. If a caution hunt is in the facts, mention it. If the facts include a Utah disclaimer, include that exact wording. Do not start with "Here is a draft" or similar. Do not give legal, medical, or regulation advice.';
}

export async function polishWithAI(ai, result, question) {
  const facts = {
    kind: result.kind,
    query: result.query || null,
    source: result.source || null,
    disclaimer: utahDisclaimer(result) || null,
    reason: result.reason || null,
    bits: result.bits || null,
    picks: (result.picks || result.hunts || []).map(h => ({
      key: h.key, title: h.title, state: h.stateName, href: h.href,
      draw: h.draw, drawSource: h.drawSource, harvest: h.harvest, land: h.land && h.land.text
    })),
    caution: result.caution ? { key: result.caution.key, title: result.caution.title, draw: result.caution.draw } : null
  };
  const tmpl = templateText(result);
  const res = await ai.run('@cf/meta/llama-3.1-8b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: 'Question: ' + String(question || '').slice(0, 500) + '\n\nFacts JSON:\n' + JSON.stringify(facts) + '\n\nA safe draft you may lightly rewrite, or repeat:\n' + tmpl }
    ],
    max_tokens: 450
  });
  let text = '';
  if (typeof res === 'string') text = res;
  else if (res && typeof res.response === 'string') text = res.response;
  else if (res && res.result && typeof res.result.response === 'string') text = res.result.response;
  text = enforceYear(noDash(text).trim(), result);
  const safeTmpl = enforceYear(tmpl, result);
  if (!looksSafe(text, result)) return { text: safeTmpl, usedModel: false, reason: 'safety' };
  if (text.length < 20) return { text: safeTmpl, usedModel: false, reason: 'short' };
  return { text, usedModel: true };
}
