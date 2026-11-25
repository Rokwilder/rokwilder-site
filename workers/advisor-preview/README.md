# UnitIQ hunt advisor (preview only)

This is a separate Cloudflare Worker, `rokwilder-api-advisor-preview`. It is not the live member API.

- Do not deploy this code onto `rokwilder-api` or `rokwilder-waitlist`.
- The bound D1 database is `rokwilder-advisor-preview` (quota only). It has no access to the live members database.
- There is no Stripe binding and no live session secret. Login is a test stub for screenshots.
- Official hunt facts are bundled from public files in this repo (`scripts/build-catalog.mjs`). Live PRIVATE_KV is not read.

After changing official data files, run:

    node scripts/build-catalog.mjs

Frontend preview mode (`?preview=advisor` on the draft site) is the only way the pages call this worker.
