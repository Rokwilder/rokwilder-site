// Draft-preview guard. Checkout stays closed on these pages, Wyoming stays band-only,
// and no live payment key or competitor name is introduced.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const bad = (m) => { console.error('FAIL', m); fails++; };
const ok = (m) => console.log('PASS', m);
const rd = (f) => readFileSync(join(root, f), 'utf8');

const closed = ['index.html', 'pricing.html', 'packages.html', 'unitiq.html', 'faq.html', 'buy.html', 'account.html', 'login.html', 'boots.html'];
for (const f of closed) {
  const s = rd(f);
  if (!/checkout is not open/i.test(s)) bad(f + ' is missing the checkout-closed warning');
  else ok(f + ' says checkout is not open');
}

const wy = rd('wyoming/find.html');
if (/RW\.boot|fullpass\/data/.test(wy)) bad('Wyoming page asks for exact-odds data');
else ok('Wyoming page does not call the Full Pass loader');
if (!/data-band-only="wy"/.test(wy) || !wy.includes('src="data.js"')) bad('Wyoming page lost its public data file');
else ok('Wyoming page still loads public data.js');

const rw = rd('member/rw.js');
if (!/EXACT=new Set\(\['co','ut','az'\]\)/.test(rw)) bad('member helper exact-odds set changed');
else ok('exact odds limited to Colorado, Utah and Arizona');
if (!/st==='wy'/.test(rw) || !/checkoutOpen!==true/.test(rw)) bad('member helper missing Wyoming or checkout gate');
else ok('member helper blocks Wyoming exact odds and closed checkout');
if (!/checkout\.stripe\.com/.test(rw)) bad('member helper does not limit pay links to Stripe Checkout');
else ok('pay links must be Stripe Checkout');

const payPages = ['buy.html', 'pricing.html', 'account.html', 'member/rw.js'];
for (const f of payPages) {
  const s = rd(f);
  if (/sk_live_|sk_test_|whsec_|pk_live_|pk_test_/.test(s)) bad(f + ' contains a Stripe key');
  else ok(f + ' has no Stripe key');
}

const publicCopy = ['index.html', 'pricing.html', 'packages.html', 'unitiq.html', 'faq.html', 'buy.html', 'boots.html', 'login.html', 'account.html', 'member/rw.js', 'wyoming/find.html', 'wyoming/find.js'];
for (const f of publicCopy) {
  const s = rd(f);
  if (/goHUNT|Epic Outdoors|Huntin' Fool|onX Hunt/i.test(s)) bad(f + ' names a competitor');
  else ok(f + ' has no competitor name');
}

const buy = rd('buy.html');
if (!/startCheckout/.test(buy) || !/The server sets the price/.test(buy)) bad('buy page can set its own price');
else ok('buy page uses the server price and the closed checkout helper');
if (/<option value="WY"/.test(buy)) bad('buy page offers Wyoming packages');
else ok('buy page does not sell Wyoming');

const boots = rd('boots.html');
if (!/value="UT" disabled/.test(boots) || !/value="AZ" disabled/.test(boots)) bad('Boots state list is not Colorado-only');
else ok('Boots form disables Utah and Arizona');
if (!/72 hours/.test(boots) || !/not cash back/.test(boots)) bad('Boots page is missing the refund wording');
else ok('Boots page repeats the 72-hour and no-cash-back rules');

const faq = rd('faq.html');
for (const bit of ['7 days', 'once per person', '30 days', 'delivery date', '72 hours']) {
  if (!faq.includes(bit)) bad('FAQ missing launch rule: ' + bit);
  else ok('FAQ includes ' + bit);
}

if (fails) { console.error(fails + ' failed'); process.exit(1); }
console.log('preview closed checks passed');
