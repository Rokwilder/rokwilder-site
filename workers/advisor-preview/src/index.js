// Preview-only UnitIQ hunt advisor API.
// This worker must never be bound to the live members D1 or PRIVATE_KV.
// Auth is a test stub for screenshots. It cannot mint a real member session.
import { loadCatalog } from './catalog-loader.js';
import { runJob } from './rank.js';
import { templateText, polishWithAI } from './explain.js';
import { getUsage, tryReserve, releaseReservation, setCount } from './quota.js';

const WORKER_NAME = 'rokwilder-api-advisor-preview';
// Official catalog is the gzip already in this preview branch. Not live KV.
const CATALOG_URL = 'https://raw.githubusercontent.com/Rokwilder/rokwilder-site/cursor/advisor-preview-ced1/workers/advisor-preview/src/catalog.json.gz';
async function officialCatalog() {
  const r = await fetch(CATALOG_URL);
  if (!r.ok) throw new Error('catalog fetch failed');
  return loadCatalog(await r.arrayBuffer());
}

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
function cookieValue(req, name) {
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function previewUser(req) {
  const role = cookieValue(req, COOKIE);
  if (role === 'member') return { loggedIn: true, role: 'member', userId: 'preview-member', fullpass: { active: true, states: ['ALL'] } };
  if (role === 'free') return { loggedIn: true, role: 'free', userId: 'preview-free', fullpass: { active: false, states: [] } };
  return { loggedIn: false, role: 'out', userId: null, fullpass: { active: false, states: [] } };
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
        return json({ ok: true, worker: WORKER_NAME, preview: true, liveMembersDb: false }, 200, h);
      }

      if (url.pathname === '/api/preview/session' && req.method === 'POST') {
        let body = {};
        try { body = await req.json(); } catch (e) { body = {}; }
        const role = body.role === 'member' ? 'member' : 'free';
        return json({ ok: true, preview: true, role, note: 'Test-only preview login. This is not a real member session.' }, 200, { ...h, 'Set-Cookie': setRoleCookie(role) });
      }
      if (url.pathname === '/api/preview/session' && req.method === 'GET') {
        return json({ ok: true, ...previewUser(req), preview: true }, 200, h);
      }

      // Test-only quota seed for the 51st-question check. Preview worker only.
      if (url.pathname === '/api/preview/quota' && req.method === 'POST') {
        const user = previewUser(req);
        if (!user.userId) return json({ error: 'Preview login required.' }, 401, h);
        let body = {};
        try { body = await req.json(); } catch (e) { body = {}; }
        const usage = await setCount(env.DB, user.userId, body.count);
        return json({ ok: true, usage }, 200, h);
      }

      if (url.pathname === '/api/account' && req.method === 'GET') {
        const user = previewUser(req);
        return json({
          loggedIn: user.loggedIn,
          preview: true,
          email: user.loggedIn ? 'preview@rokwilder.example' : null,
          fullpass: user.fullpass,
          testMode: true
        }, 200, h);
      }

      if (url.pathname === '/api/fullpass/advisor/usage' && req.method === 'GET') {
        const user = previewUser(req);
        if (!user.loggedIn) return json({ error: 'Please log in first.' }, 401, h);
        if (!user.fullpass.active) return json({ error: 'The hunt advisor is part of the Full Pass.', usage: null }, 402, h);
        const usage = await getUsage(env.DB, user.userId);
        return json({ ok: true, usage }, 200, h);
      }

      if (url.pathname === '/api/fullpass/advisor/ask' && req.method === 'POST') {
        const user = previewUser(req);
        if (!user.loggedIn) return json({ error: 'Please log in first.' }, 401, h);
        if (!user.fullpass.active) return json({ error: 'The hunt advisor is part of the Full Pass.', kind: 'locked' }, 402, h);
        let body;
        try { body = await req.json(); } catch (e) { return json({ error: 'Bad request.' }, 400, h); }
        if (!body || typeof body !== 'object') return json({ error: 'Bad request.' }, 400, h);

        const reserved = await tryReserve(env.DB, user.userId);
        if (!reserved.reserved) {
          return json({
            ok: false,
            kind: 'limit',
            error: "You've used all 50 questions for this month. Your limit resets on " + reserved.usage.reset + '. You can still use Hunt Planner, compare hunts, and Find Your Hunt as usual. If you need a hand before then, use the help form on this page or email support@rokwilder.com.',
            usage: reserved.usage
          }, 429, h);
        }

        try {
          const catalog = await officialCatalog();
          const result = runJob(catalog, body);
          const question = String(body.question || '').slice(0, 1200);
          let text = templateText(result);
          let usedModel = false;
          if (env.AI && result.kind !== 'unknown') {
            try {
              const polished = await polishWithAI(env.AI, result, question);
              text = polished.text;
              usedModel = !!polished.usedModel;
            } catch (e) {
              usedModel = false;
              text = templateText(result);
            }
          }
          const usage = reserved.usage;
          return json({
            ok: true,
            preview: true,
            kind: result.kind,
            text,
            usedModel,
            result: {
              kind: result.kind,
              query: result.query || null,
              source: result.source || null,
              picks: result.picks || result.hunts || null,
              caution: result.caution || null,
              bits: result.bits || null,
              reason: result.reason || null
            },
            usage
          }, 200, h);
        } catch (e) {
          await releaseReservation(env.DB, user.userId);
          return json({ error: 'Something went wrong. That question was not counted. Please try again.' }, 500, h);
        }
      }

      return json({ error: 'not found', preview: true, worker: WORKER_NAME }, 404, h);
    } catch (e) {
      return json({ error: 'Something went wrong. Please try again.', preview: true }, 500, h);
    }
  }
};
