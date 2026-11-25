// Plain-English templates plus an optional Workers AI polish. No invented facts.

function noDash(s) {
  return String(s || '').replace(/\u2014|\u2013/g, ',');
}

function huntLine(h) {
  const bits = [h.stateName + ': ' + h.title + ' (hunt code ' + h.key + ')'];
  if (h.draw) {
    bits.push(h.draw.year + ' draw: ' + h.draw.word + (h.drawSource ? ' (' + h.drawSource + ')' : '') + (h.draw.trend ? '. ' + h.draw.trend + '.' : '.'));
  } else {
    bits.push('No published first-choice result at those points in our file.');
  }
  if (h.harvest) {
    bits.push(h.harvest.text + (h.harvest.source ? ' (' + h.harvest.source + ')' : '') + '.');
  }
  if (h.land && h.land.text) bits.push(h.land.text + '.');
  return bits.join(' ');
}

export function templateText(result) {
  if (!result || result.kind === 'unknown') {
    return noDash((result && result.reason) || "I don't know.");
  }
  const parts = [];
  if (result.kind === 'recommend') {
    const q = result.query || {};
    const who = [q.stateName, q.residency === 'nonres' || q.residency === 'nr' ? 'nonresident' : 'resident', q.species, q.points != null ? (q.points + ' point' + (q.points === 1 ? '' : 's')) : '', q.weapon && q.weapon !== 'any' ? q.weapon : ''].filter(Boolean).join(', ');
    parts.push('Here is a first-choice plan from our official file for ' + who + '.');
    if (result.source) parts.push('Draw words come from ' + result.source + '. This is not a forecast for the next draw.');
    (result.picks || []).forEach((h, i) => {
      parts.push((i + 1) + '. ' + huntLine(h));
    });
    if (result.caution) {
      parts.push(result.caution.title + ' (hunt code ' + result.caution.key + ') was ' + (result.caution.draw && result.caution.draw.word ? result.caution.draw.word : 'not a draw') + ' at this point level in ' + (result.caution.draw && result.caution.draw.year) + ', so I would not put it first this year.');
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
  return noDash(parts.filter(Boolean).join(' '));
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
  return 'You write short, plain explanations for a hunting draw-odds tool used by a 68-year-old hunter who is not computer savvy. Use ONLY the facts JSON. Do not add hunts, hunt codes, odds, percents, years, or units that are not in the facts. If something is missing, say you do not know. Do not forecast a future draw. Short sentences. No headings. Do not use em-dashes or en-dashes. Name each hunt by its title and hunt code. Do not give legal, medical, or regulation advice.';
}

export async function polishWithAI(ai, result, question) {
  const facts = {
    kind: result.kind,
    query: result.query || null,
    source: result.source || null,
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
  text = noDash(text).trim();
  if (!looksSafe(text, result)) return { text: tmpl, usedModel: false, reason: 'safety' };
  if (text.length < 20) return { text: tmpl, usedModel: false, reason: 'short' };
  return { text, usedModel: true };
}
