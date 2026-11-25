// Hunt advisor API. This preview worker must never bind the live members D1
// (2707c02b-725a-418a-89b9-4ec9c533f668) or PRIVATE_KV.
// Production auth is rw_s + Full Pass. The preview stub is used only when
// PREVIEW=1 and SESSION_SECRET is not set. This worker never mints a real
// member session and never logs secret values.
import { memberFromRequest, envConfigured } from './auth.js';
import { catalogHow } from './catalog-bundle.js';
import { handleAsk, handleUsage } from './advisor-handler.js';
import { setCount } from './quota.js';

const WORKER_NAME = 'rokwilder-api-advisor-preview';
const COOKIE = 'rw_advisor_preview';
const ORIGINS = [
  'https://rokwilder.com',
  'https://www.rokwilder.com',
  'http://rokwilder.com',
  'http://www.rokwilder.com'
];

function allowedOrigin(o) {
  if (!o) return null;
  if (ORIGINS.includes(o)) return o;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return o;
  return null;
}
function cors(o) {
  const allow = allowedOrigin(o) || 'https://rokwilder.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  };
}
function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', ...headers }
  });
}
function setRoleCookie(role) {
  const v = role === 'member' || role === 'free' ? role : '';
  const max = v ? 'Max-Age=86400' : 'Max-Age=0';
  return `${COOKIE}=${v}; Path=/; HttpOnly; SameSite=Lax; ${max}`;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const o = req.headers.get('Origin');
    const h = cors(o);
    if (req.method === 'OPTIONS') return new Response(null, { status: allowedOrigin(o) ? 204 : 403, headers: h });

    try {
      if (url.pathname === '/api/health' && req.method === 'GET') {
        const flags = envConfigured(env);
        return json({
          ok: true,
          worker: WORKER_NAME,
          preview: env.PREVIEW === '1',
          liveMembersDb: false,
          catalog: catalogHow(),
          auth: flags.sessionSecret ? 'session' : (env.PREVIEW === '1' ? 'preview-stub' : 'none'),
          sessionSecretConfigured: flags.sessionSecret,
          workersAiBound: flags.ai
        }, 200, h);
      }

      // Preview-only helpers for screenshots. Not present on the live API.
      if (env.PREVIEW === '1' && url.pathname === '/api/preview/session' && req.method === 'POST') {
        let body = {};
        try { body = await req.json(); } catch (e) { body = {}; }
        const role = body.role === 'member' ? 'member' : 'free';
        return json({ ok: true, preview: true, role, note: 'Test-only preview login. This is not a real member session.' }, 200, { ...h, 'Set-Cookie': setRoleCookie(role) });
      }
      if (env.PREVIEW === '1' && url.pathname === '/api/preview/session' && req.method === 'GET') {
        const user = await memberFromRequest(req, env);
        return json({ ok: true, ...user, preview: true }, 200, h);
      }
      if (env.PREVIEW === '1' && url.pathname === '/api/preview/quota' && req.method === 'POST') {
        const user = await memberFromRequest(req, env);
        if (!user.userId) return json({ error: 'Preview login required.' }, 401, h);
        let body = {};
        try { body = await req.json(); } catch (e) { body = {}; }
        const usage = await setCount(env.DB, user.userId, body.count);
        return json({ ok: true, usage }, 200, h);
      }

      if (url.pathname === '/api/account' && req.method === 'GET') {
        const user = await memberFromRequest(req, env);
        return json({
          loggedIn: user.loggedIn,
          preview: env.PREVIEW === '1',
          email: user.email,
          fullpass: user.fullpass,
          testMode: env.PREVIEW === '1'
        }, 200, h);
      }

      if (url.pathname === '/api/fullpass/advisor/usage' && req.method === 'GET') {
        return handleUsage(req, env, h, json);
      }
      if (url.pathname === '/api/fullpass/advisor/ask' && req.method === 'POST') {
        return handleAsk(req, env, h, json);
      }

      return json({ error: 'not found', preview: env.PREVIEW === '1', worker: WORKER_NAME }, 404, h);
    } catch (e) {
      return json({ error: 'Something went wrong. Please try again.', preview: env.PREVIEW === '1' }, 500, h);
    }
  }
};
