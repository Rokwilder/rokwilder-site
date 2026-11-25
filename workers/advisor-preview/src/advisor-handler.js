// Shared ask/usage handlers for the preview worker and, on go-live, rokwilder-api.
// Do not overwrite the existing live /api/fullpass/advisor map-layer route.
import { officialCatalog, catalogHow } from './catalog-bundle.js';
import { runJob } from './rank.js';
import { templateText, polishWithAI, enforceYear, looksSafe, paragraphize, RESTING_TEXT, isAiCapacityError } from './explain.js';
import { getUsage, tryReserve, releaseReservation } from './quota.js';
import { memberFromRequest, hasAdvisorAccess } from './auth.js';

function safeText(result, text) {
  const t = paragraphize(enforceYear(text, result), result);
  if (looksSafe(t, result)) return t;
  return paragraphize(enforceYear(templateText(result), result), result);
}

export async function handleUsage(req, env, h, json, lookupFullPass) {
  const user = await memberFromRequest(req, env, Math.floor(Date.now() / 1000), lookupFullPass);
  if (!user.loggedIn) return json({ error: 'Please log in first.' }, 401, h);
  if (!user.fullpass.active) return json({ error: 'The hunt advisor is part of the Full Pass.', usage: null, kind: 'locked' }, 402, h);
  const usage = await getUsage(env.DB, user.userId);
  return json({ ok: true, usage }, 200, h);
}

function restingPayload(usage, preview) {
  return {
    ok: true,
    preview: !!preview,
    kind: 'resting',
    text: RESTING_TEXT,
    usedModel: false,
    counted: false,
    usage,
    result: { kind: 'resting', picks: null, caution: null, bits: null, reason: RESTING_TEXT }
  };
}

export async function handleAsk(req, env, h, json, lookupFullPass) {
  const user = await memberFromRequest(req, env, Math.floor(Date.now() / 1000), lookupFullPass);
  if (!user.loggedIn) return json({ error: 'Please log in first.' }, 401, h);
  if (!user.fullpass.active) return json({ error: 'The hunt advisor is part of the Full Pass.', kind: 'locked' }, 402, h);
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: 'Bad request.' }, 400, h); }
  if (!body || typeof body !== 'object') return json({ error: 'Bad request.' }, 400, h);
  if (env.PREVIEW === '1' && body.previewResting === true) {
    const usage = await getUsage(env.DB, user.userId);
    return json(restingPayload(usage, true), 200, h);
  }
  const state = (body.state || (body.hunt && body.hunt.state) || '').toString();
  if (state && !hasAdvisorAccess(user, state)) {
    return json({ error: 'The hunt advisor is part of the Full Pass.', kind: 'locked' }, 402, h);
  }

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
    if (result.kind === 'need_sex') {
      await releaseReservation(env.DB, user.userId);
      const usage = await getUsage(env.DB, user.userId);
      return json({
        ok: true,
        preview: env.PREVIEW === '1',
        kind: 'need_sex',
        text: templateText(result),
        usedModel: false,
        counted: false,
        catalog: catalogHow(),
        result: {
          kind: 'need_sex',
          query: result.query || null,
          source: result.source || null,
          picks: null,
          caution: null,
          bits: null,
          reason: result.reason || null,
          sexOptions: result.sexOptions || null
        },
        usage
      }, 200, h);
    }
    const question = String(body.question || '').slice(0, 1200);
    let text = safeText(result, templateText(result));
    let usedModel = false;
    let usageTokens = null;
    if (env.AI && result.kind !== 'unknown' && result.kind !== 'need_sex') {
      try {
        const polished = await polishWithAI(env.AI, result, question);
        if (polished && polished.capacity) {
          await releaseReservation(env.DB, user.userId);
          const usage = await getUsage(env.DB, user.userId);
          return json(restingPayload(usage, env.PREVIEW === '1'), 200, h);
        }
        text = safeText(result, polished.text);
        usedModel = !!polished.usedModel;
        if (env.PREVIEW === '1' && polished.usage) {
          // Preview-only measurement. Not shown in the member UI.
          usageTokens = polished.usage;
        }
        if (!looksSafe(text, result)) {
          text = safeText(result, templateText(result));
          usedModel = false;
        }
      } catch (e) {
        if (isAiCapacityError(e)) {
          await releaseReservation(env.DB, user.userId);
          const usage = await getUsage(env.DB, user.userId);
          return json(restingPayload(usage, env.PREVIEW === '1'), 200, h);
        }
        usedModel = false;
        text = safeText(result, templateText(result));
      }
    }
    return json({
      ok: true,
      preview: env.PREVIEW === '1',
      kind: result.kind,
      text,
      usedModel,
      catalog: catalogHow(),
      result: {
        kind: result.kind,
        query: result.query || null,
        source: result.source || null,
        picks: result.picks || result.hunts || null,
        caution: result.caution || null,
        bits: result.bits || null,
        reason: result.reason || null
      },
      usage: reserved.usage,
      ...(env.PREVIEW === '1' && usageTokens ? { usageTokens } : {})
    }, 200, h);
  } catch (e) {
    await releaseReservation(env.DB, user.userId);
    return json({ error: 'Something went wrong. That question was not counted. Please try again.' }, 500, h);
  }
}
