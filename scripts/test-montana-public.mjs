// Montana public file: bands only, squared bonus points, preference-point combo.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
import {bandOf, bonusChances, groupForPoint, parsePointGroup} from './mt-odds.mjs';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const sandbox = {window: {}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'montana/data.js'), 'utf8') + '\nglobalThis.MH=MH; globalThis.MT_META=MT_META;', sandbox);
vm.runInContext(readFileSync(join(root, 'montana/general-data.js'), 'utf8') + '\nglobalThis.MC=MC; globalThis.MG=MG;', sandbox);
const {MH, MT_META, MC, MG} = sandbox;
const find = readFileSync(join(root, 'montana/find.js'), 'utf8');
const html = readFileSync(join(root, 'montana/find.html'), 'utf8');
const general = readFileSync(join(root, 'montana/general.js'), 'utf8');
const ghtml = readFileSync(join(root, 'montana/general.html'), 'utf8');
const pub = readFileSync(join(root, 'montana/data.js'), 'utf8') + readFileSync(join(root, 'montana/general-data.js'), 'utf8');

ok(!/rate1|"(a1|s1|raw)"/.test(pub), 'public files have no applicant counts or raw rates');
ok(!/—|–/.test(html + ghtml + find + general), 'Montana pages have no em dash or en dash');
ok(!/noindex/i.test(html + ghtml), 'pages are indexable');
ok(/Montana Fish, Wildlife and Parks/.test(html), 'page names FWP');
ok(/squared/.test(html) && /101 chances/.test(html), 'squared bonus points use the official 10 point example');
ok(/25 percent/.test(ghtml) && /zero points/.test(ghtml.toLowerCase()) && /one point/.test(ghtml.toLowerCase()), 'combo page explains the random quarter and that one point is different');
ok(!/54%|53\.61|75\.77/.test(html + ghtml + find + general + pub), 'exact combo percents are not in the public files');
ok(/2027 is not published|not posted 2027|had not posted 2027/.test(html + ghtml), '2027 dates are not invented');
ok(/Resident general licenses/.test(html) && /Nonresident combination/.test(html), 'section buttons match the Idaho pattern');
ok(MT_META.year === 2026 && MT_META.samples.length === 2, '2026 data with two sample districts');

const bands = new Set([0, 0.01, 0.05, 0.25, 0.75, 1]);
const tally = {};
let bad = 0;
for (const h of Object.values(MH)) {
  tally[h.sp] = (tally[h.sp] || 0) + 1;
  for (const side of Object.values(h.od || {})) {
    if (h.pts) {
      for (const v of Object.values(side.bp || {})) if (!bands.has(v)) bad++;
    } else if (side.band != null && !bands.has(side.band)) bad++;
  }
  if (h.sp === 'bison' && h.pts) bad++;
}
ok(bad === 0, 'every stored value is a band and bison has no point ladder');
ok(tally.elk >= 100 && tally.deer >= 100 && tally.antelope >= 50, 'elk, deer, and antelope hunts are present (' + JSON.stringify(tally) + ')');
ok(tally.moose && tally.sheep && tally.goat && tally.bison === 3 && tally.bear === 2, 'moose, sheep, goat, bison, and black bear are present');

const known = MH['elk|217-10'];
ok(!!known && known.od.res.bp['0'] === 0.01 && known.od.res.bp['7'] === 0.75 && known.od.res.bp['9'] === 1, 'HD 217 elk permit bands match the 2026 first-choice rows');
ok(known && !Object.prototype.hasOwnProperty.call(known.od.res.bp, '12'), 'a level with no 2026 row is omitted');
ok(bandOf(3, 115) === 0.01 && bandOf(7, 8) === 0.75 && bandOf(1, 1) === 1 && bandOf(0, 10) === 0, 'band cuts follow the public words');
ok(bonusChances(0) === 1 && bonusChances(10) === 101 && bonusChances(3) === 10, 'bonus chances are the square plus one');

const elk = MC.hunts['combo|elk'];
const deer = MC.hunts['combo|deer'];
const g0 = elk.groups.find(g => g.p === 0);
const g1 = elk.groups.find(g => g.p === 1);
const g2 = elk.groups.find(g => g.p === 2);
const g3 = elk.groups.find(g => g.p === 3);
ok(g0.band === 0.25 && g1.band === 0 && g2.band === 0.75 && g3.band === 1, '2026 elk combination: 0 points drew, 1 point did not, 2 points most drew, 3 points all drew');
ok(!('rate' in g0) && !('apps' in g0), 'combo public groups do not carry counts');
const d1 = deer.groups.find(g => g.p === 1);
ok(d1.band === 0.05, '2026 deer combination at 1 point is its own result, not the elk result');

const groups = [
  {label: '0 preference points', lo: 0, hi: 0, exact: true, id: '0'},
  {label: '0.2 to 1.8 preference points', lo: 0.2, hi: 1.8, exact: false, id: 'low'},
  {label: '2 preference points', lo: 2, hi: 2, exact: true, id: '2'},
  {label: '2.2 to 3 preference points', lo: 2.2, hi: 3, exact: false, id: 'high'},
];
ok(groupForPoint(groups, 0).id === '0' && groupForPoint(groups, 1).id === 'low' && groupForPoint(groups, 2).id === '2' && groupForPoint(groups, 3).id === 'high', 'whole preference points land in the official group');
ok(parsePointGroup('2.2 to 3').lo === 2.2 && parsePointGroup('0').exact === true, 'group labels parse');

ok(MG.seasons.length > 100 && MG.seasons.every(r => r.hd && r.sp && r.opp), 'resident general seasons are district rows from the regulations');
ok(/not a draw result/.test(general), 'general seasons are not described as a draw');

const bow = MH['elk|410-21'];
ok(bow && bow.wpn === 'bow' && bow.firstOnly !== true, '410-21 is the archery elk permit from the report label');
ok(MH['elk|270-45'] && MH['elk|270-45'].firstOnly === true && MH['elk|270-45'].unl === true, '270-45 keeps the first-choice-only and unlimited labels');

function el(){
  const node = {
    hidden: false, value: '', textContent: '', innerHTML: '', className: '',
    dataset: {}, style: {},
    classList: {toggle(){}, add(){}, remove(){}},
    setAttribute(){}, removeAttribute(){}, addEventListener(){},
    querySelector(){ return el(); }, querySelectorAll(){ return []; },
  };
  return node;
}
function boot(files){
  const document = {
    getElementById(){ return el(); },
    querySelector(){ return el(); },
    querySelectorAll(){ return []; },
    createElement(){ return el(); },
    addEventListener(){},
    head: el(), body: el(), documentElement: el(),
  };
  const window = {
    document,
    location: {search: '', href: 'http://local/general.html', hash: '', pathname: '/montana/general.html'},
    history: {replaceState(){}, state: null},
    addEventListener(){},
  };
  window.window = window;
  window.URLSearchParams = URLSearchParams;
  window.URL = URL;
  const context = vm.createContext(window);
  vm.runInContext('var document=window.document, location=window.location, history=window.history;', context);
  for (const file of files) vm.runInContext(readFileSync(join(root, file), 'utf8'), context, {filename: file});
  return window;
}
const combo = boot(['montana/general-data.js','find/gate.js','find/draw-sort.js','montana/general.js']);
const D = combo.__DRAW;
D.contexts()[0].apply();
D.setPts(2);
const easy = D.ordered('easy').map(r => r.h.sp);
const hard = D.ordered('hard').map(r => r.h.sp);
ok(easy[0] === 'deer' && hard[0] === 'elk', 'at 2 preference points the deer combination is easier than the elk combination');
D.setPts(1);
const hard1 = D.ordered('hard').map(r => r.h.sp);
ok(hard1[0] === 'elk' && hard1[1] === 'deer', 'at 1 preference point the elk combination is harder because that group did not draw');
ok(combo.RWDraw.monotonic(D.ordered('hard'), 'hard', r => D.measure(r), D.tie).ok, 'preference-point hardest order is monotonic');

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
