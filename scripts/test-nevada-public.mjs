// Behavior checks for the public Nevada preview. Bands only. No counts and no rates.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
import {bandOf} from './build-nevada-bands.mjs';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const sandbox = {window: {}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'nevada/data.js'), 'utf8') + '\nglobalThis.NH=NH; globalThis.NV_META=NV_META;', sandbox);
const {NH, NV_META} = sandbox;
const find = readFileSync(join(root, 'nevada/find.js'), 'utf8');
const html = readFileSync(join(root, 'nevada/find.html'), 'utf8');
const keys = Object.keys(NH);

ok(keys.length === 918, '918 hunt records');
ok(NV_META.year === 2025 && NV_META.retrieved === '2026-11-08', 'data year is the 2025 main draw, retrieved Nov 8 2026');
ok(!/May 13, 2027|March 23, 2027|June 15, 2027/.test(html + JSON.stringify(NV_META)), 'no invented 2027 big-game deadline');
ok(/January 25, 2027/.test(html) && /February 12, 2027/.test(html), 'posted 2027 spring turkey dates are cited from CR 26-01');
ok(!/noindex/i.test(html), 'page is indexable');
ok(!/Preview for review/i.test(html), 'preview banner is removed');
ok(/More states to come: New Mexico and Montana/.test(html), 'coming-states line');
ok(/idaho\/find\.html/.test(html), 'Nevada page links to Idaho');
const gate = readFileSync(join(root, 'find/gate.js'), 'utf8');
ok(/Unlock with Full Pass/.test(gate) && /RWGate/.test(find) && /not an exact percentage/i.test(html + find), 'Nevada list is gated and the public copy stays a band, not an exact percentage');
ok(/rate1/.test(find) && /2025 1st-choice result/.test(find), 'exact percent reads the 2025 1st-choice rate');
ok(!/window\.RW_FP=true/.test(find), 'the public script does not assign the member flag');
ok(/gate\.js/.test(html), 'Nevada page loads the list gate');
ok(!/Yes, you'll draw/.test(html + find), 'Nevada does not use the future-draw verdict words');
ok(!/preference point/i.test(find), 'the tool does not treat Nevada points as preference points');
ok(!/goHUNT|Epic Outdoors|Huntin' Fool|onX Hunt/i.test(html + find), 'Nevada page has no competitor names');
ok(!/Boots-on-the-Ground/.test(html), 'no Boots pitch on the Nevada draw page');
ok(/hasOwnProperty\.call\(h\.bp,S\.pts\)|hasOwnProperty\.call\(h\.bp, S\.pts\)/.test(find), 'a missing point level is not borrowed from another level');

const bands = new Set([0, 0.01, 0.05, 0.25, 0.75, 1]);
let badBand = 0;
const tally = {};
for (const h of Object.values(NH)) {
  tally[h.sp] = (tally[h.sp] || 0) + 1;
  for (const v of Object.values(h.bp)) if (!bands.has(v)) badBand++;
  if (h.who === 'junior' && h.live !== 'res') badBand++;
  if (h.who === 'guided' && (h.live !== 'nr' || h.sp !== 'deer' || !['alw', 'shotgun'].includes(h.wpn))) badBand++;
}
ok(badBand === 0, 'every stored value is a band, junior rows are resident, and guided rows are nonresident mule deer');
ok(tally.elk === 242 && tally.deer === 407 && tally.antelope === 185, 'elk 242, mule deer 407, antelope 185');
ok(tally.dsheep === 61 && tally.csheep === 14 && tally.rsheep === 2 && tally.goat === 4 && tally.moose === 1 && tally.bear === 2, 'sheep, goat, moose and bear counts');
ok(!Object.values(NH).some(h => h.sp === 'moose' && h.live === 'nr'), '2025 moose file has no nonresident section');
ok(!Object.values(NH).some(h => h.sp === 'elk' && h.sx === 'S' && h.live === 'nr'), '2025 spike elk file has no nonresident section');
ok(!Object.values(NH).some(h => h.sp === 'deer' && h.sx === 'F'), '2025 page has no mule deer antlerless table');

const known = NH['deer|M|alw|main|res|011-013|oct-05-2025-nov-05-2025'];
ok(!!known, 'resident any-legal-weapon mule deer units 011-013 is present');
ok(known && known.bp[13] === 1 && known.bp[11] === 0 && known.bp[2] === 0.05 && known.bp[8] === 0.25, '011-013 bands match the 2025 1st-choice rows');
ok(known && !Object.prototype.hasOwnProperty.call(known.bp, 14), 'a level with no 1st-choice row is omitted');
ok(bandOf(1, 1) === 1 && bandOf(3, 4) === 0.75 && bandOf(1, 4) === 0.25 && bandOf(1, 20) === 0.05 && bandOf(1, 21) === 0.01 && bandOf(0, 5) === 0, 'band cuts are the public words, not a printed rate');
ok(NV_META.src['deer-alw-res'].startsWith('https://www.ndow.org/'), 'source links to NDOW');
ok(/squared/.test(html) && /random/.test(html) && /June 15/.test(html) && /June 16/.test(html), 'squared random draw and both second-draw deadlines are stated');

function list(sp, sx, live, who, wpn, pts) {
  return Object.values(NH).filter(h => h.sp === sp && h.sx === sx && h.live === live && h.who === who && h.wpn === wpn && Object.prototype.hasOwnProperty.call(h.bp, pts) && h.bp[pts] >= 0.05);
}
const elk1 = list('elk', 'M', 'res', 'main', 'alw', 1);
const elk8 = list('elk', 'M', 'res', 'main', 'alw', 8);
ok(elk1.length === 1 && elk8.length === 12, 'resident antlered elk any-legal-weapon list changes with the exact point level');
ok(list('deer', 'M', 'nr', 'guided', 'alw', 0).length === 5, 'guided nonresident any-legal-weapon mule deer is its own list');
ok(list('deer', 'M', 'nr', 'main', 'alw', 5).length === 5, 'main-draw nonresident mule deer is separate from guided');
ok(Object.values(NH).some(h => h.who === 'guided' && h.wpn === 'shotgun' && h.units === '203'), 'guided unit 203 keeps the printed shotgun or bow weapon');
ok(list('moose', 'M', 'res', 'main', 'alw', 0).length === 0, 'the one resident moose hunt is not shown at 0 points unless its band clears one in twenty');

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
