import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { loadCatalog } from '../src/catalog-loader.js';
import { runJob, recommend, officialFacts, classifyJob, cleanHuntTitle, sourceLabelForYear } from '../src/rank.js';
import { templateText, looksSafe, enforceYear, utahDisclaimer, paragraphize, RESTING_TEXT, isAiCapacityError, extractAiUsage } from '../src/explain.js';
import { monthKey, resetLabel, tryReserve, getUsage, setCount, releaseReservation } from '../src/quota.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const gz = fs.readFileSync(path.join(here, '../src/catalog.json.gz'));

function fakeDb(seed = {}) {
  const rows = { ...seed };
  return {
    prepare(sql) {
      const self = { sql, binds: [] };
      return {
        bind(...args) { self.binds = args; return this; },
        async first() {
          if (/SELECT count/.test(self.sql)) {
            const key = self.binds[0] + '|' + self.binds[1];
            const count = rows[key] || 0;
            return { count };
          }
          return null;
        },
        async run() {
          if (/INSERT INTO advisor_usage/.test(self.sql) && /count = count \+ 1/.test(self.sql)) {
            const [userId, yyyymm] = self.binds;
            const key = userId + '|' + yyyymm;
            const cur = rows[key] || 0;
            if (cur >= 50) return { meta: { changes: 0 } };
            rows[key] = cur + 1;
            return { meta: { changes: 1 } };
          }
          if (/SET count = MAX\(count - 1/.test(self.sql)) {
            const userId = self.binds[1], yyyymm = self.binds[2];
            const key = userId + '|' + yyyymm;
            rows[key] = Math.max((rows[key] || 0) - 1, 0);
            return { meta: { changes: 1 } };
          }
          if (/SET count=excluded.count/.test(self.sql) || /INSERT INTO advisor_usage/.test(self.sql)) {
            const [userId, yyyymm, count] = self.binds;
            rows[userId + '|' + yyyymm] = count;
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }
      };
    }
  };
}

const catalog = await loadCatalog(gz);
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok ', name); }
  catch (e) { failed++; console.error('FAIL', name, e.message); }
}
async function testAsync(name, fn) {
  try { await fn(); console.log('ok ', name); }
  catch (e) { failed++; console.error('FAIL', name, e.message); }
}

test('catalog has eight states', () => {
  const st = new Set(Object.values(catalog.hunts).map(h => h.state));
  for (const s of ['co','ut','az','wy','id','nv','mt','nm']) assert.ok(st.has(s), s);
});

test('CO elk without a sex choice asks Bull / Cow / Either first', () => {
  const r = recommend(catalog, { state: 'co', species: 'elk', residency: 'res', points: 6, weapon: 'rifle' });
  assert.equal(r.kind, 'need_sex');
  const labels = (r.sexOptions || []).map(o => o.label);
  assert.deepEqual(labels, ['Bull', 'Cow', 'Either']);
  assert.match(r.reason, /bull/i);
  assert.equal((r.picks || []).length, 0);
});

test('CO elk 6 resident points ranks official 2026 hunts', () => {
  const r = recommend(catalog, { state: 'co', species: 'elk', residency: 'res', points: 6, weapon: 'rifle', sex: 'antlered' });
  assert.equal(r.kind, 'recommend');
  assert.ok(r.picks.length >= 3, 'expected 3 picks, got ' + r.picks.length);
  const keys = r.picks.map(p => p.key);
  assert.ok(r.picks.every(p => p.draw && p.draw.year === 2026), 'draw year should be 2026');
  assert.ok(r.picks.every(p => p.draw.rate >= 0.25), 'top picks should be drawable bands');
  // Known official facts from the public file
  const u66 = officialFacts(catalog, 'co', 'EM066O1R', 'res', 6);
  assert.equal(u66.draw.word, 'LIKELY');
  assert.equal(u66.draw.year, 2026);
  assert.equal(u66.harvest.pct, 50);
  const u64 = officialFacts(catalog, 'co', 'EE064O1R', 'res', 6);
  assert.equal(u64.draw.word, "YES, you'll draw");
  const u61 = officialFacts(catalog, 'co', 'EM061O1R', 'res', 6);
  assert.equal(u61.draw.word, 'NOT THIS YEAR');
  const text = templateText(r);
  assert.match(text, /2026/);
  assert.doesNotMatch(text, /this year/i);
  assert.doesNotMatch(text, /[\u2014\u2013]/);
  assert.ok(looksSafe(text, r));
  console.log('  CO picks', keys.join(', '));
});

test('bull-only CO elk does not include cow hunts', () => {
  const r = recommend(catalog, { state: 'co', species: 'elk', residency: 'res', points: 6, weapon: 'rifle', sex: 'antlered' });
  assert.equal(r.kind, 'recommend');
  const keys = r.picks.map(p => p.key);
  assert.ok(keys.every(k => k[1] !== 'F'), 'no cow hunt codes, got ' + keys.join(', '));
  const text = templateText(r);
  assert.doesNotMatch(text, /\bcow\b/i);
  if (r.caution) assert.notEqual(r.caution.key[1], 'F');
  console.log('  bull-only picks', keys.join(', '));
});

test('Utah elk resident example uses 2025 published table', () => {
  const r = recommend(catalog, { state: 'ut', species: 'elk', residency: 'res', points: 6, weapon: 'any', sex: 'antlered' });
  assert.equal(r.kind, 'recommend');
  assert.ok(r.picks.length >= 1);
  assert.ok(r.picks.every(p => p.draw && p.draw.year === 2025), 'Utah history year should be 2025');
  assert.match(r.source || '', /2025 Utah DWR/);
  const text = templateText(r);
  assert.match(text, /2025/);
  assert.match(text, /Based on the 2025 Utah draw\. Utah has not published the full 2026 results table\./);
  assert.doesNotMatch(text, /this year/i);
  console.log('  UT picks', r.picks.map(p => p.key + ' ' + p.title).join(' | '));
});

test('Wyoming resident elk example (points often not used)', () => {
  const r = recommend(catalog, { state: 'wy', species: 'elk', residency: 'res', points: 6, weapon: 'any', sex: 'antlered' });
  assert.equal(r.kind, 'recommend');
  assert.ok(r.picks.length >= 1);
  assert.ok(r.picks.every(p => p.draw && p.draw.year >= 2025));
  const text = templateText(r);
  assert.match(text, /202[56]/);
  console.log('  WY picks', r.picks.map(p => p.key + ' ' + p.title + ' ' + p.draw.word).join(' | '));
});


test('Wyoming truncated official titles are repaired or replaced with a clean label', () => {
  const facts = officialFacts(catalog, 'wy', 'elk-122-2', 'res', 6);
  assert.ok(facts);
  assert.equal(facts.title, 'Hunt area 122, type 2, antlered elk');
  assert.doesNotMatch(facts.title, /FIVE \(5/);
  const r = recommend(catalog, { state: 'wy', species: 'elk', residency: 'res', sex: 'antlered' });
  const hit = (r.picks || []).concat(r.caution || []).find(h => h && h.key === 'elk-122-2');
  const text = templateText(r);
  if (hit) {
    assert.equal(hit.title, 'Hunt area 122, type 2, antlered elk');
    assert.match(text, /Hunt area 122, type 2, antlered elk/);
  }
  assert.doesNotMatch(text, /FIVE \(5/);
  assert.doesNotMatch(text, /this year/i);
  console.log('  WY 122 title', facts.title, hit ? 'in result' : 'not in top picks');
});

test('year post-check rewrites this year and bare you will draw', () => {
  const r = recommend(catalog, { state: 'co', species: 'elk', residency: 'res', points: 6, weapon: 'rifle', sex: 'antlered' });
  const out = enforceYear("You'll draw this year. Unit 76 was NOT THIS YEAR.", r);
  assert.match(out, /2026/);
  assert.doesNotMatch(out, /this year/i);
  assert.match(out, /you would have drawn/i);
  const utah = utahDisclaimer({ query: { state: 'ut' }, source: '2025 Utah DWR 1st-choice result. 2026 was not published as a full table', picks: [{ state: 'ut', draw: { year: 2025 } }] });
  assert.equal(utah, 'Based on the 2025 Utah draw. Utah has not published the full 2026 results table.');
});

test('compare three official CO hunts', () => {
  const r = runJob(catalog, {
    job: 'compare',
    residency: 'res',
    points: 6,
    hunts: [
      { state: 'co', key: 'EM066O1R' },
      { state: 'co', key: 'EM057O1R' },
      { state: 'co', key: 'EE064O1R' }
    ]
  });
  assert.equal(r.kind, 'compare');
  assert.equal(r.hunts.length, 3);
  const text = templateText(r);
  assert.match(text, /EM066O1R/);
  assert.match(text, /EE064O1R/);
  console.log('  compare bits:', (r.bits || []).join(' / '));
  console.log('  compare text sample:', text.slice(0, 280));
});

test('out of scope says I do not know and does not invent hunts', () => {
  const r = runJob(catalog, { job: 'auto', question: 'Is it legal to hunt over bait in Colorado, and what caliber should I buy?' });
  assert.equal(r.kind, 'unknown');
  const text = templateText(r);
  assert.match(text, /I don't know/i);
  assert.doesNotMatch(text, /EM066O1R/);
  console.log('  unknown text:', text);
});

test('classify suggested questions', () => {
  assert.equal(classifyJob({ question: 'What are my odds with my points?', hunt: { state: 'co', key: 'EM066O1R' } }), 'lookup');
  assert.equal(classifyJob({ question: 'Compare with my saved hunts', hunts: [{ state: 'co', key: 'EM066O1R' }, { state: 'co', key: 'EE064O1R' }] }), 'compare');
  assert.equal(classifyJob({ question: 'I have 6 elk points in Colorado. Where should I put in?', state: 'co', species: 'elk' }), 'recommend');
});

await testAsync('quota blocks the 51st reserve and failed release works', async () => {
  const db = fakeDb();
  const id = 'preview-member';
  const first = await tryReserve(db, id);
  assert.equal(first.reserved, true);
  assert.equal(first.usage.used, 1);
  const set = await setCount(db, id, 50);
  assert.equal(set.used, 50);
  const blocked = await tryReserve(db, id);
  assert.equal(blocked.reserved, false);
  assert.equal(blocked.usage.remaining, 0);
  const mid = await setCount(db, id, 12);
  assert.equal(mid.used, 12);
  await releaseReservation(db, id);
  const after = await getUsage(db, id);
  assert.equal(after.used, 11);
  assert.match(resetLabel(), /Mountain Time/);
  assert.match(monthKey(), /^2026(11|12)$/);
});

await test('typed caliber/bait stays unknown even if the form sent recommend', () => {
  const job = classifyJob({ job:'recommend', question:'What caliber should I use, and is baiting legal on this unit?', state:'co', species:'elk', residency:'res', points:6 });
  assert.equal(job, 'unknown');
});

await test('where-to-put-in stays recommend even if saved hunts are attached', () => {
  const job = classifyJob({
    job:'auto',
    question:'I have 6 elk points in Colorado. Where should I put in?',
    state:'co', species:'elk', residency:'res', points:6, weapon:'rifle',
    hunts:[{state:'co', key:'EM066O1R'},{state:'co', key:'EM057O1R'},{state:'co', key:'EE064O1R'}]
  });
  assert.equal(job, 'recommend');
  const cmp = classifyJob({ job:'auto', question:'Which of these hunts is better for me?', hunts:[{key:'a'},{key:'b'}] });
  assert.equal(cmp, 'compare');
});


test('answer prose is one short paragraph per hunt', () => {
  const r = recommend(catalog, { state: 'co', species: 'elk', residency: 'res', points: 6, weapon: 'rifle', sex: 'antlered' });
  const text = templateText(r);
  const paras = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  assert.ok((r.picks || []).length >= 2, 'expected several ranked hunts');
  assert.ok(paras.length >= 1 + r.picks.length, 'intro plus one paragraph per hunt, got ' + paras.length);
  r.picks.forEach(h => {
    assert.ok(paras.some(p => p.includes(h.key)), 'paragraph for ' + h.key);
  });
});

test('WY elk-122-2 uses one consistent year in the draw source label', () => {
  const facts = officialFacts(catalog, 'wy', 'elk-122-2', 'res', 6);
  assert.ok(facts && facts.draw);
  const year = facts.draw.year;
  assert.ok(year);
  assert.match(String(facts.drawSource || ''), new RegExp(String(year)));
  const other = year === 2025 ? 2026 : 2025;
  assert.doesNotMatch(String(facts.drawSource || ''), new RegExp(String(other)));
  const one = runJob(catalog, { job: 'lookup', hunt: { state: 'wy', key: 'elk-122-2' }, residency: 'res', points: 6, question: 'Tell me about this hunt' });
  const text = templateText(one);
  assert.match(text, new RegExp(String(year)));
  assert.doesNotMatch(text, new RegExp('In the ' + other + ' draw'));
  assert.doesNotMatch(text, new RegExp(other + ' WGFD'));
  console.log('  WY 122 year/source', year, facts.drawSource);
});

test('capacity errors map to the resting note and do not look like raw errors', () => {
  assert.equal(RESTING_TEXT, 'The advisor is resting until tomorrow. Try again then.');
  assert.doesNotMatch(RESTING_TEXT, /\u2014|\u2013/);
  assert.equal(isAiCapacityError({ status: 429 }), true);
  assert.equal(isAiCapacityError({ status: 503 }), true);
  assert.equal(isAiCapacityError(new Error('Neurons daily limit exceeded')), true);
  assert.equal(isAiCapacityError({ errors: [{ message: 'You have exceeded your daily Workers AI quota' }] }), true);
  assert.equal(isAiCapacityError(new Error('model timeout')), false);
  const u = extractAiUsage({ usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100 } });
  assert.equal(u.inputTokens, 1000);
  assert.equal(u.outputTokens, 100);
  assert.equal(u.neurons, Math.round((1000 * 4119 + 100 * 34868) / 1e6 * 1000) / 1000);
});

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all tests passed');
