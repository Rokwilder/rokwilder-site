import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { loadCatalog } from '../src/catalog-loader.js';
import { runJob, recommend, officialFacts, classifyJob } from '../src/rank.js';
import { templateText, looksSafe } from '../src/explain.js';
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

test('CO elk 6 resident points ranks official 2026 hunts', () => {
  const r = recommend(catalog, { state: 'co', species: 'elk', residency: 'res', points: 6, weapon: 'rifle' });
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
  assert.doesNotMatch(text, /[\u2014\u2013]/);
  assert.ok(looksSafe(text, r));
  console.log('  CO picks', keys.join(', '));
});

test('Utah elk resident example uses 2025 published table', () => {
  const r = recommend(catalog, { state: 'ut', species: 'elk', residency: 'res', points: 6, weapon: 'any' });
  assert.equal(r.kind, 'recommend');
  assert.ok(r.picks.length >= 1);
  assert.ok(r.picks.every(p => p.draw && p.draw.year === 2025), 'Utah history year should be 2025');
  assert.match(r.source || '', /2025 Utah DWR/);
  const text = templateText(r);
  assert.match(text, /2025/);
  console.log('  UT picks', r.picks.map(p => p.key + ' ' + p.title).join(' | '));
});

test('Wyoming resident elk example (points often not used)', () => {
  const r = recommend(catalog, { state: 'wy', species: 'elk', residency: 'res', points: 6, weapon: 'any' });
  assert.equal(r.kind, 'recommend');
  assert.ok(r.picks.length >= 1);
  assert.ok(r.picks.every(p => p.draw && p.draw.year >= 2025));
  const text = templateText(r);
  assert.match(text, /202[56]/);
  console.log('  WY picks', r.picks.map(p => p.key + ' ' + p.title + ' ' + p.draw.word).join(' | '));
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

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all tests passed');
