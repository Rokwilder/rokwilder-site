import assert from 'node:assert/strict';
import { signSession, readSession, cookieValue } from '../src/session.js';
import { memberFromRequest, readFullPass, hasAdvisorAccess, envConfigured } from '../src/auth.js';

const TEST_SECRET = 'test-only-session-secret-not-used-in-production';
const now = Math.floor(Date.now() / 1000);

function fakeReq(cookie) {
  return { headers: { get(n) { return String(n).toLowerCase() === 'cookie' ? (cookie || '') : null; } } };
}

function entitlementsDb(rows) {
  return {
    prepare(sql) {
      const self = { sql, binds: [] };
      return {
        bind(...args) { self.binds = args; return this; },
        async all() {
          const email = self.binds[0];
          const at = self.binds[1];
          const results = (rows || []).filter(r =>
            r.user_email === email &&
            r.kind === 'fullpass' &&
            r.status === 'active' &&
            r.starts_at <= at &&
            (r.ends_at == null || r.ends_at > at)
          );
          return { results };
        }
      };
    }
  };
}

let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('ok ', name); }
  catch (e) { failed++; console.error('FAIL', name, e.message); }
}

await test('sign and read a session with a fake secret', async () => {
  const token = await signSession(TEST_SECRET, 'member@example.com', now + 3600);
  assert.equal(await readSession(TEST_SECRET, token, now), 'member@example.com');
  assert.equal(await readSession(TEST_SECRET, token, now + 7200), null);
  assert.equal(await readSession('other-test-secret', token, now), null);
  assert.equal(await readSession(TEST_SECRET, 'not-a-token', now), null);
});

await test('rw_s + active Full Pass is a member', async () => {
  const token = await signSession(TEST_SECRET, 'member@example.com', now + 3600);
  const env = {
    SESSION_SECRET: TEST_SECRET,
    DB: entitlementsDb([{ user_email: 'member@example.com', kind: 'fullpass', status: 'active', state: 'ALL', starts_at: now - 10, ends_at: now + 86400 }])
  };
  const m = await memberFromRequest(fakeReq('rw_s=' + token), env, now);
  assert.equal(m.auth, 'session');
  assert.equal(m.loggedIn, true);
  assert.equal(m.role, 'member');
  assert.equal(m.userId, 'member@example.com');
  assert.equal(m.fullpass.active, true);
  assert.equal(hasAdvisorAccess(m, 'co'), true);
});

await test('rw_s with no Full Pass is logged in but locked', async () => {
  const token = await signSession(TEST_SECRET, 'free@example.com', now + 3600);
  const env = { SESSION_SECRET: TEST_SECRET, DB: entitlementsDb([]) };
  const m = await memberFromRequest(fakeReq('rw_s=' + token), env, now);
  assert.equal(m.loggedIn, true);
  assert.equal(m.role, 'free');
  assert.equal(m.fullpass.active, false);
  assert.equal(hasAdvisorAccess(m, 'co'), false);
});

await test('missing or invalid rw_s is logged out', async () => {
  const env = { SESSION_SECRET: TEST_SECRET, DB: entitlementsDb([]) };
  const a = await memberFromRequest(fakeReq(''), env, now);
  assert.equal(a.loggedIn, false);
  const b = await memberFromRequest(fakeReq('rw_s=garbage'), env, now);
  assert.equal(b.loggedIn, false);
});

await test('preview stub works only when SESSION_SECRET is unset', async () => {
  const stub = await memberFromRequest(fakeReq('rw_advisor_preview=member'), { PREVIEW: '1' }, now);
  assert.equal(stub.auth, 'preview-stub');
  assert.equal(stub.role, 'member');
  const env = { PREVIEW: '1', SESSION_SECRET: TEST_SECRET, DB: entitlementsDb([]) };
  const ignored = await memberFromRequest(fakeReq('rw_advisor_preview=member'), env, now);
  assert.equal(ignored.loggedIn, false);
  assert.equal(ignored.auth, 'none');
});

await test('envConfigured reports booleans and never needs secret values', async () => {
  const flags = envConfigured({ SESSION_SECRET: TEST_SECRET, STRIPE_SECRET_KEY: 'x', AI: {}, DB: {} });
  assert.equal(flags.sessionSecret, true);
  assert.equal(flags.stripeSecret, true);
  assert.equal(flags.ai, true);
  assert.equal(flags.db, true);
  const empty = envConfigured({});
  assert.equal(empty.sessionSecret, false);
  assert.equal(empty.stripeSecret, false);
});

await test('cookieValue reads rw_s', () => {
  assert.equal(cookieValue(fakeReq('foo=1; rw_s=abc.def; bar=2'), 'rw_s'), 'abc.def');
});

await test('expired entitlement is not active', async () => {
  const fp = await readFullPass(entitlementsDb([
    { user_email: 'old@example.com', kind: 'fullpass', status: 'active', state: 'CO', starts_at: now - 200, ends_at: now - 1 }
  ]), 'old@example.com', now);
  assert.equal(fp.active, false);
});

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all auth tests passed');
