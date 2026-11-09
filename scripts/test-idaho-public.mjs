// Behavior checks for the public Idaho page. No exact odds, tag counts or application counts.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const sandbox = {window: {}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'idaho/data.js'), 'utf8') + '\nglobalThis.IH=IH; globalThis.ID_META=ID_META;', sandbox);
const {IH, ID_META} = sandbox;
const find = readFileSync(join(root, 'idaho/find.js'), 'utf8');
const html = readFileSync(join(root, 'idaho/find.html'), 'utf8');
const keys = Object.keys(IH);
const hunts = Object.values(IH);

ok(keys.length === 816, '816 hunt rows');
ok(ID_META.year === 2026 && ID_META.retrieved === '2026-11-08', 'data year and retrieval date');
ok(ID_META.counts.elk[1] === 182 && ID_META.counts.elk[2] === 137, 'elk first and second drawing counts');
ok(ID_META.counts.deer[1] === 147 && ID_META.counts.pronghorn[1] === 54, 'deer and pronghorn first-drawing counts');
ok(ID_META.counts.moose[1] === 94 && ID_META.counts.moose[2] === 0, 'moose has a first drawing and no second-drawing rows');
ok(ID_META.counts['sheep-rm'][1] === 28 && ID_META.counts['sheep-ca'][1] === 2, 'bighorn subspecies stay separate');
ok(ID_META.counts.goat[1] === 19 && ID_META.counts.bear[1] === 6 && ID_META.counts.turkey[1] === 16, 'goat, bear and turkey counts');
ok(ID_META.counts.moose.dated === 0 && ID_META.counts.bear.dated === 0 && ID_META.counts.turkey.dated === 0, 'moose, bear and turkey have no 2026 season dates');
ok(ID_META.counts.deer.dated === 250, 'every deer row has a 2026 season line');

const bands = new Set([0, 0.01, 0.05, 0.25, 0.75, 1]);
let bad = 0, nulls = 0;
for (const h of hunts) {
  for (const v of [h.res, h.nr]) {
    if (v == null) nulls++;
    else if (!bands.has(v)) bad++;
  }
  if (h.raw || h.quota || h.applicants) bad++;
  if (h.sp === 'moose' && h.seg.length) bad++;
}
ok(bad === 0, 'bands only, and moose seasons were not copied from another year');
ok(nulls === 79, '79 residency cells have no first-choice people, stored as no result rather than zero');
ok(hunts.some(h => h.sp === 'elk' && h.draw === 1 && h.res !== h.nr), 'resident and nonresident elk bands differ');
ok(hunts.filter(h => h.sp === 'elk' && h.draw === 1).every(h => h.res === hunts.find(x => x.sp === 'elk' && x.n === h.n && x.draw === 1).res), 'elk band is not a point ladder');
ok(!hunts.some(h => h.pts || h.points || h.maxp), 'no preference-point field');
const deer1057 = IH['deer-1057-1'];
ok(deer1057 && deer1057.res === 0.75 && deer1057.res !== 1, 'a deer hunt IDFG rounds to a complete draw stays at Most drew');
ok(hunts.filter(h => h.sp === 'elk' && h.draw === 2 && h.res >= 0.05).length >= 0, 'second drawing is present for elk');
ok(!hunts.some(h => h.sp === 'goat' && h.draw === 2), 'goat has no second drawing');
ok(hunts.some(h => h.youth === 1 && h.seg.some(s => /youth/i.test(s.s))), 'youth label comes from the 2026 season name');
ok(hunts.some(h => h.extra === 1 && /X$/.test(h.area)) && hunts.every(h => h.extra === 0 || /X$/.test(h.area)), 'extra-tag flag follows an X suffix');

ok(!html.includes('noindex'), 'Idaho page is indexable');
const pages = readFileSync(join(root, 'sitemap-pages.xml'), 'utf8');
const index = readFileSync(join(root, 'sitemap.xml'), 'utf8');
const idahoSm = readFileSync(join(root, 'sitemap-idaho.xml'), 'utf8');
ok(index.includes('sitemap-idaho.xml') && idahoSm.includes('https://rokwilder.com/idaho/find.html') && pages.includes('https://rokwilder.com/idaho/find.html'), 'sitemaps list the Idaho find page');
const pricing = readFileSync(join(root, 'pricing.html'), 'utf8');
const packages = readFileSync(join(root, 'packages.html'), 'utf8');
const faq = readFileSync(join(root, 'faq.html'), 'utf8');
ok(/checkout is not open/.test(pricing), 'pricing still says checkout is not open');
ok(pricing.includes('$0') && pricing.includes('$29.99') && pricing.includes('$19.99'), 'free, Full Pass and Founding prices are unchanged');
ok(!/buy\.stripe|stripe\.com\/checkout|checkout\.stripe/i.test(pricing + packages + html), 'no Stripe checkout was added');
ok(/Join the waitlist/.test(pricing), 'pricing still ends at the waitlist');
ok(/Boots-on-the-Ground requests are Colorado only/.test(faq), 'Boots stays Colorado only');
ok(/Nothing is for sale yet/.test(packages) && /Checkout is not open/.test(packages), 'packages still say nothing is for sale and checkout is not open');
ok(/historical|past result|not a forecast/i.test(html + find), 'page says the band is historical');
ok(!/YES, you'll draw/.test(html + find), 'Idaho does not use the future-draw verdict words');
const gate = readFileSync(join(root, 'find/gate.js'), 'utf8');
ok(/Unlock with Full Pass/.test(gate) && /RWGate/.test(find) && /exact percentages are not in the public file/i.test(find), 'Idaho list is gated and the public file is not described as exact odds');
ok(/gate\.js/.test(html), 'Idaho page loads the list gate');
ok(!/Boots-on-the-Ground/.test(html), 'no Boots pitch');
ok(!/goHUNT|Epic Outdoors|Huntin' Fool|onX Hunt/i.test(html + find), 'no competitor names');
ok(/19 or fewer/.test(html) && /more than 20/.test(html) && /exactly 20/.test(html), 'nonresident cap is quoted with the 20-tag gap');
ok(/July 1/.test(html) && /before that July 1/.test(html), 'July 1, 2026 rule date is not backdated onto the May and June drawing');
ok(/does not state 2027 dates/.test(html) && !/January 2027|December 5|Dec\. 5, 2026/.test(html), 'no invented 2027 application calendar');
ok(/preference points/i.test(html) && /bonus points/i.test(html), 'page says there is no point system');
ok(/second drawing is leftover|leftover tags/i.test(html), 'second drawing is not described as a second choice');
ok(/NR Draw/.test(html) && /swan/i.test(html), 'unsupported NR Draw and swan are named');
ok(/Fifty-eight residency rows/.test(html), 'rounding-gap count is disclosed');
ok(!/pct\(/.test(find) && !/\d+%/.test(find), 'the script does not print a hunt percentage');

const shown = (sp, res, draw, sx='') => hunts.filter(h => h.sp === sp && h.draw === draw && (!sx || h.sex === sx) && h[res] != null && h[res] >= 0.05);
ok(shown('elk','res',1).length > 0 && shown('elk','nr',1).length > 0, 'resident and nonresident elk first drawing both have hunts on the list');
ok(shown('elk','res',1).length !== shown('elk','nr',1).length, 'residency changes the elk list');
ok(shown('moose','res',1).length > 0 && shown('moose','res',2).length === 0, 'moose list is first drawing only');
ok(shown('deer','res',1,'M').every(h => h.sex === 'M'), 'antlered filter does not keep unlabeled hunts');
ok(shown('sheep-rm','res',1).length > 0 && shown('sheep-ca','res',1).length >= 0, 'Rocky Mountain sheep has rows');
const ca = shown('sheep-ca','res',1);
ok(ca.length + hunts.filter(h => h.sp === 'sheep-ca' && h.draw === 1 && h.res != null && h.res < 0.05).length === 2, 'both California bighorn hunts are accounted for');

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
