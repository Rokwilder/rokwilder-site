# How to mount the advisor on rokwilder-api (only after go-live approval)

Do not apply this until Christopher says yes. Do not overwrite the existing `/api/fullpass/advisor` map-layer route.

1. Copy these modules into the live worker (or import them from a shared folder): `session.js` is already in the live worker as `crypto.js` (`readSession`). Prefer the live `readSession` + `fullPass`. Also copy `catalog-loader.js`, `catalog-bundle.js`, generated `catalog-data.js`, `rank.js`, `explain.js`, `quota.js`, `auth.js`, `advisor-handler.js`.
2. Bind Workers AI as `AI`. Keep the existing `DB` (members D1, after `0004_advisor_usage.sql` is applied) and `SESSION_SECRET`. Do not add this preview wrangler file. Do not bind the preview D1 to production.
3. In the live `fetch` handler, before the current `/api/fullpass/advisor` map route:

```js
if (url.pathname === '/api/fullpass/advisor/usage' && req.method === 'GET') {
  return handleUsage(req, env, corsHeaders, json, (email, now) => fullPass(env, email, now));
}
if (url.pathname === '/api/fullpass/advisor/ask' && req.method === 'POST') {
  return handleAsk(req, env, corsHeaders, json, (email, now) => fullPass(env, email, now));
}
```

4. Leave `/api/fullpass/advisor` (the Colorado SAM/MIG map payload) unchanged.
