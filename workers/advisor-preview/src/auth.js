// Real Full Pass check: rw_s cookie + entitlements.
// Read-only against the members database (no grace expiry writes).
// On go-live, the live API should pass its existing fullPass() so grace
// expiry stays consistent with /api/account. This module never logs secrets
// and never mints a real member session.
import { readSession, cookieValue } from './session.js';

const SESSION_COOKIE = 'rw_s';
const PREVIEW_COOKIE = 'rw_advisor_preview';
const ACTIVE_SQL = "status='active' AND starts_at<=? AND (ends_at IS NULL OR ends_at>?)";

function loggedOut() {
  return {
    loggedIn: false,
    role: 'out',
    userId: null,
    email: null,
    fullpass: { active: false, states: [] },
    auth: 'none'
  };
}

// SELECT only. Column names match rokwilder-api entitlements (user_email, kind).
export async function readFullPass(db, email, nowSec) {
  if (!db || !email) return { active: false, states: [] };
  const { results } = await db.prepare(
    `SELECT state FROM entitlements WHERE user_email=? AND kind='fullpass' AND ${ACTIVE_SQL}`
  ).bind(email, nowSec, nowSec).all();
  const states = [...new Set((results || []).map(r => r.state).filter(Boolean))];
  return { active: states.length > 0, states };
}

export function hasAdvisorAccess(member, state) {
  if (!member || !member.fullpass || !member.fullpass.active) return false;
  const states = member.fullpass.states || [];
  if (states.includes('ALL')) return true;
  if (!state) return true;
  const want = String(state).toUpperCase();
  return states.some(s => String(s).toUpperCase() === want);
}

// lookupFullPass(email, nowSec) is optional. The live API should pass a wrapper
// around its existing fullPass() so grace expiry still runs there.
export async function memberFromRequest(req, env, nowSec = Math.floor(Date.now() / 1000), lookupFullPass) {
  const secret = env && env.SESSION_SECRET;
  if (secret) {
    const token = cookieValue(req, SESSION_COOKIE);
    if (!token) return loggedOut();
    const email = await readSession(secret, token, nowSec);
    if (!email) return loggedOut();
    const db = env.MEMBERS_DB || env.DB;
    const fp = lookupFullPass
      ? await lookupFullPass(email, nowSec)
      : await readFullPass(db, email, nowSec);
    const active = !!(fp && fp.active);
    return {
      loggedIn: true,
      role: active ? 'member' : 'free',
      userId: email,
      email,
      fullpass: { active, states: (fp && fp.states) || [] },
      auth: 'session'
    };
  }
  // Preview worker only: stub is allowed when SESSION_SECRET is not set.
  // This cannot mint a real rw_s member session.
  if (env && env.PREVIEW === '1') {
    const role = cookieValue(req, PREVIEW_COOKIE);
    if (role === 'member') {
      return {
        loggedIn: true,
        role: 'member',
        userId: 'preview-member',
        email: 'preview@rokwilder.example',
        fullpass: { active: true, states: ['ALL'] },
        auth: 'preview-stub'
      };
    }
    if (role === 'free') {
      return {
        loggedIn: true,
        role: 'free',
        userId: 'preview-free',
        email: 'preview@rokwilder.example',
        fullpass: { active: false, states: [] },
        auth: 'preview-stub'
      };
    }
  }
  return loggedOut();
}

export function envConfigured(env) {
  return {
    sessionSecret: !!(env && env.SESSION_SECRET),
    stripeSecret: !!(env && env.STRIPE_SECRET_KEY),
    ai: !!(env && env.AI),
    db: !!(env && env.DB)
  };
}
