// Trophy potential: gate, sort, filter, and copy. Does not require the private data files.
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const ui = readFileSync(join(root, 'find/trophy-ui.js'), 'utf8');
ok(!/—|–/.test(ui), 'trophy UI copy has no em dash or en dash');
ok(!/325 class|190 class|Boone|Pope and Young/.test(ui), 'trophy UI does not name record-book classes');

function boot(state, search, paid, data){
  const document = {
    currentScript: {getAttribute: () => state, src: 'http://local/find/trophy-ui.js'},
    getElementById: () => null,
    head: {appendChild(){}},
    createElement: () => ({id: '', textContent: ''})
  };
  const location = {
    search,
    href: 'http://local/find.html' + search,
    pathname: '/find.html',
    hash: ''
  };
  const history = {state: null, replaceState(_s, _t, url){ location.href = 'http://local' + url; const q = url.indexOf('?'); location.search = q >= 0 ? url.slice(q).split('#')[0] : ''; }};
  const sandbox = {window: {RWGate: {paid: () => paid}, RWT: data}, document, location, history, URL, URLSearchParams, console};
  vm.createContext(sandbox);
  vm.runInContext(ui, sandbox);
  return sandbox.window.RWTrophy;
}

const data = {ut: {species: {elk: {field: 'average age of harvested bulls', years: '2023 to 2025', source: 'Utah DWR', gap: ''}}, hunts: {
  a: {level: 'top', summary: 'Older bulls than most units (8.7 yr average age). Big bulls possible but hard to find.', evidence: 'Avg age of harvested bulls: 8.7 yrs (Utah DWR, Monroe, 2023 to 2025)', badge: 'Managed for older bulls (UT age objective 6.0 to 6.5 yrs)', value: 8.7, unit: 'Monroe'},
  b: {level: 'below', summary: 'Younger bulls than most units (5.1 yr average age).', evidence: 'Avg age of harvested bulls: 5.1 yrs (Utah DWR, Wasatch Mtns, 2023 to 2025)', badge: '', value: 5.1, unit: 'Wasatch Mtns'},
  c: {level: 'none', summary: 'Not enough official data to judge.', evidence: '', badge: '', value: null, unit: 'Alton'},
  d: {level: 'thin', summary: 'Thin data (n=6). Too few animals were checked to rank this hunt.', evidence: 'Avg horn length at check-in: 26.5 inches (Utah DWR, hunt DS6600, Henry Mtns, 2025, n=6)', badge: '', value: 26.5, unit: 'Henry Mtns'}
}}};

const paid = boot('ut', '?preview=fullpass', true, data);
const chip = paid.chip('a');
ok(chip.includes('Top') && chip.includes('Older bulls than most units (8.7 yr average age)'), 'member chip shows the level and the plain-English line');
ok(chip.includes('Avg age of harvested bulls: 8.7 yrs (Utah DWR, Monroe, 2023 to 2025)'), 'member chip keeps the evidence line under the summary');
ok(chip.includes('Managed for older bulls'), 'managed-for-quality badge is separate');
ok(!/—|–|325|class bull/.test(chip), 'chip has no dash and no inch class');
ok(paid.chip('d').includes('Thin data'), 'thin sample shows Thin data instead of a level');

const free = boot('ut', '', false, data);
ok(free.chip('a') === '' && free.bar('elk') === '' && free.block('a') === '', 'free visitors get no trophy level or number');

const rows = [{k: 'b'}, {k: 'c'}, {k: 'a'}, {k: 'd'}];
paid.read();
const params = new URLSearchParams('preview=fullpass');
// set high to low through the same path the buttons use
const box = {value: '', focus(){}, setSelectionRange(){}};
const sortBtn = {getAttribute: () => 'hi', onclick: null};
const dom = {
  querySelectorAll(sel){
    if (sel === '[data-ts]') return [sortBtn];
    return [];
  },
  querySelector(sel){
    if (sel === '#tmq') return {checked: false, onchange: null};
    if (sel === '#tuf') return box;
    return null;
  }
};
let refreshed = 0;
paid.wire(dom, () => { refreshed++; });
dom.querySelectorAll('[data-ts]')[0].onclick();
ok(refreshed === 1, 'trophy sort refresh runs');
const hi = paid.refine(rows).map(r => r.k);
ok(hi[0] === 'a' && hi[1] === 'b' && hi[hi.length - 1] !== 'a', 'high to low puts Top ahead of Below average');
ok(hi.indexOf('c') > hi.indexOf('b') && hi.indexOf('d') > hi.indexOf('b'), 'Not enough data and Thin data sort after ranked hunts');

// low to high
const loc = paid;
// flip by calling wire again is messy; set via stamp path
const u = new URLSearchParams('preview=fullpass&ts=lo');
// re-boot low
const lowT = boot('ut', '?preview=fullpass&ts=lo', true, data);
const lo = lowT.refine(rows).map(r => r.k);
ok(lo[0] === 'b' && lo[1] === 'a', 'low to high puts Below average ahead of Top');
ok(lo.indexOf('c') > lo.indexOf('a') && lo.indexOf('d') > lo.indexOf('a'), 'unranked hunts stay last when sorting low to high');

const mq = boot('ut', '?preview=fullpass&mq=1&uf=Monroe', true, data);
const filtered = mq.refine(rows).map(r => r.k);
ok(filtered.length === 1 && filtered[0] === 'a', 'managed-for-quality filter and unit filter work together');
ok(mq.bar('elk').includes('Trophy, high to low') && mq.bar('elk').includes('Managed for quality only'), 'member bar has the sort and the filter');
ok(mq.emptyNote(4, 0).includes('trophy filter'), 'an empty filtered list says so');

const missing = boot('ut', '?preview=fullpass', true, {});
ok(missing.bar('elk').includes('not in the public file') && missing.chip('a') === '', 'a paid page without the private file does not invent levels');

const pub = readFileSync(join(root, 'utah/data.js'), 'utf8') + readFileSync(join(root, 'find/find.js'), 'utf8');
ok(!/window\.RWT[.\[]/.test(pub) && !pub.includes('8.7 yrs'), 'public hunt files do not carry trophy numbers');
ok(readFileSync(join(root, 'find.html'), 'utf8').includes("data-state':'co'"), 'Colorado finder loads trophy-ui');
ok(readFileSync(join(root, 'member/rw.js'), 'utf8').includes("trophy-'+st+'.js"), 'member loader requests the private trophy file');

if (fails) process.exit(1);
console.log('trophy tests passed');
