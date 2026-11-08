// Behavior checks for the public Wyoming page. No exact odds, quotas or applicant counts.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const sandbox = {window: {}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'wyoming/data.js'), 'utf8') + '\nglobalThis.WH=WH; globalThis.WY_META=WY_META;', sandbox);
const {WH, WY_META} = sandbox;
const find = readFileSync(join(root, 'wyoming/find.js'), 'utf8');
const html = readFileSync(join(root, 'wyoming/find.html'), 'utf8');

ok(Object.keys(WH).length === 699, '699 hunt records');
ok(WY_META.year === 2026 && !/2027/.test(JSON.stringify(WY_META)), 'data year is 2026 and meta invents no 2027 date');
ok(!html.includes('noindex'), 'page is not noindex');
ok(/More states to come: Nevada, New Mexico and Montana/.test(html), 'more states line');
ok(/idaho\/find\.html">Idaho/.test(html), 'Wyoming state picker links to Idaho');
ok(/have passed/.test(html) && /has not posted 2027/.test(html), '2026 dates marked historical and 2027 not invented');
ok(/October 31/.test(html) && /Nov\. 2/.test(html), 'both posted preference-point end dates are shown');
ok(/at least 75%/.test(html) && /40%/.test(html) && /60%/.test(html), 'Chapter 44 split is stated');
ok(/estimate/.test(html), 'page says the random portion is an estimate');
ok(!/Exact Wyoming odds are in the Full Pass/.test(html + find), 'page does not claim exact Wyoming Full Pass figures are included');
ok(/exact Wyoming and Idaho odds are not in the Full Pass/i.test(find), 'find.js says exact Wyoming and Idaho odds are not in the Full Pass');
ok(!/goHUNT|Epic Outdoors|Huntin' Fool|onX Hunt/i.test(html + find), 'Wyoming page has no competitor names');
ok(!/Boots-on-the-Ground/.test(html), 'no Boots pitch on the Wyoming draw page');

const bands = new Set([0, 0.01, 0.05, 0.25, 0.75, 1]);
let badBand = 0;
for (const h of Object.values(WH)) for (const b of Object.values(h.od)) for (const v of b.o) if (!bands.has(v)) badBand++;
ok(badBand === 0, 'every stored odds value is a verdict band');

function poolOf(sp, res, dr) {
  if (res === 'res') return 'res';
  return ['elk','deer','pronghorn'].includes(sp) ? dr : 'nr';
}
function rows(sp, res, dr, pts, sx='') {
  const pool = poolOf(sp, res, dr);
  const out = [];
  for (const [k, h] of Object.entries(WH)) {
    if (h.sp !== sp) continue;
    if (sx && h.sx !== sx) continue;
    if (dr === 'nrs' && h.cls === 'reduced') continue;
    const b = h.od[pool];
    if (!b) continue;
    const v = b.o[Math.min(pts, b.o.length - 1)];
    if (v >= 0.05) out.push(v);
  }
  return out;
}
const elkRes = rows('elk', 'res', 'nr', 12);
ok(elkRes.length > 0, 'resident elk returns hunts and ignores points');
const elkResPts = rows('elk', 'res', 'nr', 0);
ok(elkRes.join() === elkResPts.join(), 'resident elk verdict does not change with points');
ok(Object.values(WH).filter(h => h.sp === 'elk' && h.od.res).every(h => h.od.res.pts === false), 'resident elk is marked random');
ok(Object.values(WH).filter(h => h.sp === 'moose' && h.od.res).every(h => h.od.res.pts === true), 'resident moose uses points');
ok(Object.values(WH).filter(h => h.sp === 'goat').every(h => Object.values(h.od).every(b => b.pts === false)), 'goat is random only');
ok(Object.values(WH).filter(h => h.sp === 'bison').every(h => Object.values(h.od).every(b => b.pts === false)), 'bison is random only');
ok(Object.values(WH).some(h => h.sp === 'elk' && h.od.nrs), 'elk has a special-draw pool');
ok(Object.values(WH).some(h => h.sp === 'pronghorn' && h.od.nr && h.od.nrs), 'pronghorn has regular and special');
ok(Object.values(WH).filter(h => h.cls === 'reduced').every(h => !h.od.nrs), 'reduced-price hunts have no special pool');
const nr5 = rows('elk', 'nr', 'nr', 5);
const nr0 = rows('elk', 'nr', 'nr', 0);
ok(nr5.length > 0 && nr5.length !== nr0.length, 'nonresident elk regular list changes with points');
const special = rows('pronghorn', 'nr', 'nrs', 2);
const regular = rows('pronghorn', 'nr', 'nr', 2);
ok(special.length > 0 && regular.length > 0 && special.join() !== regular.join(), 'pronghorn special and regular lists differ');
ok(WY_META.src.elk.pp_nr.url.startsWith('https://wgfd.wyo.gov/'), 'elk point report links to WGFD');
ok(WY_META.src.bison.f_res && WY_META.src.goat.rand_nr, 'bison and goat source reports are present');

ok(/if\(!FP\)return `<div class="fo lk">/.test(find) && !/if\(!FP\)return [^;]*pct\(/.test(find), 'free cards do not print a percentage');
ok(find.includes('capped at 100%'), 'the random cap is described as an estimate');

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
