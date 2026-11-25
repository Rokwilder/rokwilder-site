# UnitIQ hunt advisor

Preview worker: `rokwilder-api-advisor-preview`. Production cutover is described in `GO_LIVE.md` and is not done until Christopher says yes.

- Do not deploy this wrangler config onto `rokwilder-api` or `rokwilder-waitlist`.
- This preview D1 is `rokwilder-advisor-preview` (quota only). It must never bind the live members database or PRIVATE_KV.
- Production auth is the real `rw_s` cookie plus a Full Pass entitlement. The preview stub runs only when `PREVIEW=1` and `SESSION_SECRET` is unset. It cannot mint a real member session. Secret values are never logged.
- Official hunt facts are packaged with `scripts/embed-catalog.mjs` from `src/catalog.json.gz` (built by `scripts/build-catalog.mjs`). Live PRIVATE_KV is not read.
- On the Cloudflare Free Workers plan, Workers AI has 10,000 Neurons per day. If that (or any AI capacity/limit error) hits, members see "The advisor is resting until tomorrow. Try again then." That question is not counted.

After changing official data files:

    node scripts/build-catalog.mjs
    node scripts/embed-catalog.mjs

Frontend: `https://api.rokwilder.com` by default. `?preview=advisor` and `?preview=advisor-free` still call this preview worker.
