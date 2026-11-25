# Advisor go-live (do not run until Christopher says yes)

Nothing in this file should be applied yet. Draft PR 39 stays a draft. Do not merge, and do not deploy or migrate production until he explicitly approves the final preview.

## Already done in this preview

- Production auth path: `rw_s` cookie + Full Pass entitlement (same shape as rokwilder-api). Read-only check in this module; on cutover, pass the live `fullPass()` so grace expiry stays consistent with `/api/account`.
- Preview worker still has no live members D1, no PRIVATE_KV, and no SESSION_SECRET. Screenshots use the preview stub only because that secret is unset. The stub cannot mint a real `rw_s` session. When SESSION_SECRET is set, the stub is ignored.
- Official hunt catalog is packaged into the worker via `scripts/embed-catalog.mjs` (`src/catalog-data.js`, gitignored). Live PRIVATE_KV is not read. GitHub fetch is a last-resort fallback only.
- Quota: 50 questions per member per Mountain Time calendar month, atomic increment, failed asks and the sex step do not count. If Workers AI is out of daily free neurons (or any AI capacity/limit error), members see "The advisor is resting until tomorrow. Try again then." That ask is not counted, and they never see a raw error.
- Existing live route `/api/fullpass/advisor` (Colorado map layers) is not overwritten. New routes are `/api/fullpass/advisor/ask` and `/api/fullpass/advisor/usage`.
- Frontend talks to `https://api.rokwilder.com` by default. `?preview=advisor` and `?preview=advisor-free` still use the preview worker.

## Remaining steps on his yes

1. Confirm the final preview (including screenshots in `/workspace/advisor-preview/golive/`) looks right.
2. Apply the prepared, non-destructive migration `migrations/prod/0004_advisor_usage.sql` to the live members D1 (`rokwilder-members`). This only creates `advisor_usage` if it does not exist. It does not change users, orders, entitlements, or any existing rows.
3. Copy the advisor modules into the live `rokwilder-api` worker (do not deploy this preview wrangler config onto rokwilder-api). Mount `handleAsk` / `handleUsage` on the new routes only. Pass the live `fullPass()` into `memberFromRequest`. Bind Workers AI (`AI`) on that worker. Keep existing bindings and secrets as they are. Run `node scripts/embed-catalog.mjs` so the catalog is bundled before that deploy.
4. Deploy the updated `rokwilder-api` to production (api.rokwilder.com). Do not bind PRIVATE_KV into the advisor path. Do not change Stripe, DNS, or the waitlist worker.
5. Merge draft PR 39 into `main` so GitHub Pages serves the frontend that points at the live API. Cache-bust query strings are already bumped on the advisor files. Leave PR 2 untouched.
6. Smoke-check on the live site while signed in as a Full Pass member, and while logged out / free: locked box, a real ask, a Wyoming answer, out-of-questions, and (if neurons are exhausted) the resting note.
7. Optional later: upgrade to Workers Paid if daily free neurons (10,000/day, reset 00:00 UTC) or Workers Free CPU (10 ms) starts to bite. This launch is approved for the Cloudflare Free Workers plan.

## Risks

- Workers Paid could not be confirmed: `GET /accounts/.../subscriptions` still returns 403 (billing:read denied). The account already has a Workers AI binding, and the preview worker has run `@cf/meta/llama-3.1-8b-instruct-fp8-fast`. Workers AI is included on the Free plan with 10,000 Neurons/day. Usage above that fails on Free (it cannot bill overage) and surfaces the resting note.
- Workers Free CPU is 10 ms per request. Decompressing the official catalog, ranking, and calling AI may exceed that and fail some asks. If that happens in production, the friendly 500 copy is used and the question is not counted. Workers Paid (30 ms standard CPU) would reduce this risk.
- The preview worker cannot exercise live `rw_s` + members D1 without binding the live members database. That binding is still forbidden here because `fullPass()` on the live API can write (grace expiry). Auth is covered by unit tests with a fake secret and a fake entitlements DB. The first real-cookie check happens at step 6.
- Catalog GitHub fallback exists if a deploy forgets `catalog-data.js`. Production should ship the bundle.
- Quota on go-live starts at zero for every member for the current Mountain Time month.
