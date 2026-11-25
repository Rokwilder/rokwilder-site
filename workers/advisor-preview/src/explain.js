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


export const RESTING_TEXT = 'The advisor is resting until tomorrow. Try again then.';

export function isAiCapacityError(err) {
  if (err == null) return false;
  if (typeof err === 'number') return err === 429 || err === 503;
  const status = err.status || err.statusCode || err.status_code;
  if (status === 429 || status === 503) return true;
  const bits = [];
  if (typeof err === 'string') bits.push(err);
  if (err.message) bits.push(err.message);
  if (err.error) bits.push(typeof err.error === 'string' ? err.error : JSON.stringify(err.error));
  if (Array.isArray(err.errors)) err.errors.forEach(e => bits.push(typeof e === 'string' ? e : (e && e.message) || JSON.stringify(e)));
  if (err.code != null) bits.push(String(err.code));
  const msg = bits.join(' ').toLowerCase();
  return /neuron|quota|capacity|rate.?limit|too many requests|exhaust|allowance|limit exceeded|daily limit|out of (credits|quota)|over.?limit|ai (is )?overload/.test(msg);
}

export function extractAiUsage(res) {
  const u = (res && (res.usage || (res.result && res.result.usage))) || null;
  if (!u || typeof u !== 'object') return null;
  const inputTokens = Number(u.prompt_tokens != null ? u.prompt_tokens : (u.input_tokens != null ? u.input_tokens : 0)) || 0;
  const outputTokens = Number(u.completion_tokens != null ? u.completion_tokens : (u.output_tokens != null ? u.output_tokens : 0)) || 0;
  const totalTokens = Number(u.total_tokens != null ? u.total_tokens : (inputTokens + outputTokens)) || 0;
  // Official Workers AI rates for @cf/meta/llama-3.1-8b-instruct-fp8-fast:
  // 4119 neurons per M input tokens, 34868 neurons per M output tokens.
  const neurons = (inputTokens * 4119 + outputTokens * 34868) / 1e6;
  return { inputTokens, outputTokens, totalTokens, neurons: Math.round(neurons * 1000) / 1000 };
}

export function paragraphize(text, result) {
  let t = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!t) return t;
  t = t.replace(/\n{3,}/g, '\n\n');
  const hunts = [].concat((result && result.picks) || [], (result && result.hunts) || [], result && result.caution ? [result.caution] : []);
  if (!hunts.length) return t;
  const marks = [];
  hunts.forEach(h => {
    if (!h) return;
    let at = -1;
    if (h.title) at = t.indexOf(h.title);
    if (h.key) {
      const k = t.indexOf(h.key);
      if (k >= 0 && (at < 0 || k < at)) at = k;
    }
    if (at > 0) marks.push(at);
  });
  marks.sort((a, b) => a - b);
  const cuts = [];
  for (const at of marks) {
    let i = at;
    while (i > 0 && !/[.!?\n]/.test(t[i - 1])) i--;
    while (i > 0 && /[ \t]/.test(t[i - 1])) i--;
    if (i > 0 && t[i - 1] !== '\n') cuts.push(i);
  }
  const uniq = [...new Set(cuts)].sort((a, b) => b - a);
  for (const i of uniq) {
    t = t.slice(0, i).replace(/[ \t]+$/, '') + '\n\n' + t.slice(i);
  }
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

export function templateText(result) {
  if (!result || result.kind === 'unknown' || result.kind === 'need_sex') {
    return noDash((result && result.reason) || "I don't know.");
  }
  const intro = [];
  const paras = [];
  if (result.kind === 'recommend') {
    const q = result.query || {};
    const who = [q.stateName, q.residency === 'nonres' || q.residency === 'nr' ? 'nonresident' : 'resident', q.species, q.points != null ? (q.points + ' point' + (q.points === 1 ? '' : 's')) : '', q.weapon && q.weapon !== 'any' ? q.weapon : ''].filter(Boolean).join(', ');
    intro.push('Here is a first-choice plan from our official file for ' + who + '.');
    const utah = utahDisclaimer(result);
    if (utah) intro.push(utah);
    if (result.source && !utah) intro.push('Draw words come from ' + result.source + '. This is not a forecast for the next draw.');
    else if (result.source && utah) intro.push('This is not a forecast for the next draw.');
    (result.picks || []).forEach((h, i) => {
      paras.push((i + 1) + '. ' + huntLine(h));
    });
    if (result.caution) {
      const y = result.caution.draw && result.caution.draw.year;
      paras.push(result.caution.title + ' (hunt code ' + result.caution.key + ') was not a hunt you would have drawn' + (y ? ' in the ' + y + ' draw' : '') + ', so I would not put it first.');
    }
    const priv = (result.picks || []).find(h => h.land && (h.land.band === 'priv' || (typeof h.land.pct === 'number' && h.land.pct < 0.4)));
    if (priv) {
      paras.push('I do not know your access on private land, and I will not guess. ' + priv.title + ' is mostly private, so only put it first if you have a place to hunt.');
    }
  } else if (result.kind === 'compare') {
    intro.push('Here is how those saved hunts compare in our official file.');
    (result.hunts || []).forEach(h => paras.push(huntLine(h)));
    (result.bits || []).forEach(b => paras.push(b));
    if (result.missing && result.missing.length) {
      paras.push("I don't know " + result.missing.length + ' of the saved hunts in our official file.');
    }
  } else if (result.kind === 'one') {
    const h = (result.hunts || [])[0];
    if (h) paras.push(huntLine(h));
    if (result.reason) paras.push(result.reason);
  } else {
    intro.push(result.reason || "I don't know.");
  }
  const body = [intro.filter(Boolean).join(' '), ...paras.filter(Boolean)].filter(Boolean).join('\n\n');
  return paragraphize(enforceYear(noDash(body), result), result);
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
  return 'You write short, plain explanations for a hunting draw-odds tool used by a 68-year-old hunter who is not computer savvy. Use ONLY the facts JSON. Do not add hunts, hunt codes, odds, percents, years, or units that are not in the facts. If something is missing, say you do not know. Do not forecast a future draw. Always name the data year. Never say "this year". Never say "you will draw" or "you\'ll draw" unless you also name the year in that sentence. Prefer "In the 2026 draw, you would have drawn." Short sentences. No headings. Do not use em-dashes or en-dashes. Name each hunt by its title and hunt code. If a caution hunt is in the facts, mention it. If the facts include a Utah disclaimer, include that exact wording. Write one short paragraph per hunt, with a blank line between those paragraphs. Do not start with "Here is a draft" or similar. Do not give legal, medical, or regulation advice.';
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
  let res;
  try {
    res = await ai.run('@cf/meta/llama-3.1-8b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: 'Question: ' + String(question || '').slice(0, 500) + '\n\nFacts JSON:\n' + JSON.stringify(facts) + '\n\nA safe draft you may lightly rewrite, or repeat:\n' + tmpl }
      ],
      max_tokens: 450
    });
  } catch (e) {
    if (isAiCapacityError(e)) return { text: RESTING_TEXT, usedModel: false, capacity: true };
    throw e;
  }
  if (res && (res.success === false || res.error || (Array.isArray(res.errors) && res.errors.length))) {
    if (isAiCapacityError(res) || (res.errors || []).some(e => isAiCapacityError(e))) {
      return { text: RESTING_TEXT, usedModel: false, capacity: true };
    }
  }
  const usage = extractAiUsage(res);
  let text = '';
  if (typeof res === 'string') text = res;
  else if (res && typeof res.response === 'string') text = res.response;
  else if (res && res.result && typeof res.result.response === 'string') text = res.result.response;
  text = paragraphize(enforceYear(noDash(text).trim(), result), result);
  const safeTmpl = paragraphize(enforceYear(tmpl, result), result);
  if (!looksSafe(text, result)) return { text: safeTmpl, usedModel: false, reason: 'safety', usage };
  if (text.length < 20) return { text: safeTmpl, usedModel: false, reason: 'short', usage };
  return { text, usedModel: true, usage };
}
