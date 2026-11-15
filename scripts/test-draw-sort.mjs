// Every point level the finder accepts, for every state and species (or hunt type).
// Hardest-first and easiest-first stay in difficulty order. Equal difficulty keeps the unit tie break.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const notes = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

function el(){
  const node = {
    hidden: false, value: '', textContent: '', innerHTML: '', className: '', checked: false, disabled: false,
    dataset: {}, style: {},
    classList: {toggle(){}, add(){}, remove(){}, contains(){ return false; }},
    setAttribute(){}, removeAttribute(){}, addEventListener(){}, removeEventListener(){},
    appendChild(){}, focus(){}, click(){},
    getBoundingClientRect(){ return {top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0}; },
    querySelector(){ return el(); },
    querySelectorAll(){ return []; },
  };
  node.parentNode = node;
  return node;
}
function documentStub(){
  const ids = {};
  return {
    getElementById(id){ return ids[id] || (ids[id] = el()); },
    querySelector(){ return el(); },
    querySelectorAll(){ return []; },
    createElement(){ return el(); },
    addEventListener(){},
    head: el(),
    body: el(),
    documentElement: el(),
  };
}

function boot(files){
  const document = documentStub();
  const window = {
    document,
    location: {search: '', href: 'http://local/find.html', hash: '', pathname: '/find.html'},
    history: {replaceState(){}, pushState(){}, state: null},
    addEventListener(){},
    scrollTo(){},
    scrollY: 0,
    innerHeight: 800,
    innerWidth: 390,
    navigator: {userAgent: 'test'},
  };
  window.window = window;
  window.URLSearchParams = URLSearchParams;
  window.URL = URL;
  window.console = console;
  window.Promise = Promise;
  window.Set = Set;
  window.Map = Map;
  const context = vm.createContext(window);
  vm.runInContext('var document=window.document, location=window.location, history=window.history, navigator=window.navigator; function scrollTo(){}', context);
  for (const file of files) vm.runInContext(readFileSync(join(root, file), 'utf8'), context, {filename: file});
  return window;
}

function keysOf(rows){ return rows.map(r => r.k).join('|'); }

function check(name, win, maxOf){
  const D = win.__DRAW;
  if (!D) { ok(false, name + ' exported __DRAW'); return; }
  const contexts = D.contexts();
  ok(contexts.length > 0, name + ' has contexts (' + contexts.length + ')');
  let cases = 0, hunts = 0, hardMoves = 0;
  for (const ctx of contexts) {
    ctx.apply();
    const max = maxOf(D);
    for (let p = 0; p <= max; p++) {
      D.setPts(p);
      let base, hard, easy;
      try {
        base = D.list();
        hard = D.ordered('hard');
        easy = D.ordered('easy');
        const def = D.ordered('');
        if (keysOf(def) !== keysOf(base)) throw new Error('default order changed at ' + ctx.id + ' pts ' + p);
        if (hard.length !== base.length || easy.length !== base.length) throw new Error('sort dropped hunts at ' + ctx.id + ' pts ' + p);
        const mh = win.RWDraw.monotonic(hard, 'hard', r => D.measure(r), D.tie);
        if (!mh.ok) throw new Error('hardest not monotonic at ' + ctx.id + ' pts ' + p + ' ' + mh.why + ' i=' + mh.i);
        const me = win.RWDraw.monotonic(easy, 'easy', r => D.measure(r), D.tie);
        if (!me.ok) throw new Error('easiest not monotonic at ' + ctx.id + ' pts ' + p + ' ' + me.why + ' i=' + me.i);
        if (p === max && base.length > 1 && keysOf(hard) !== keysOf(base)) hardMoves++;
      } catch (e) {
        ok(false, name + ' ' + (e && e.message || e));
        return;
      }
      cases++;
      hunts += base.length;
    }
  }
  notes.push(name + ': ' + contexts.length + ' contexts, ' + cases + ' point-level lists, ' + hunts + ' hunt rows, ' + hardMoves + ' top-point lists whose hardest order differs from the default');
  ok(true, name + ' every accepted point level');
}

const states = [
  ['Colorado', ['drawodds/lite.js','drawodds/youth.js','find/labels.js','drawodds/oial.js','find/excluded.js','find/otc.js','find/unit-filter.js','find/gate.js','find/draw-sort.js','find/find.js'], D => D.max],
  ['Utah', ['utah/data.js','find/unit-filter.js','find/gate.js','find/draw-sort.js','utah/find.js'], D => D.max],
  ['Arizona', ['arizona/data.js','find/unit-filter.js','find/gate.js','find/draw-sort.js','arizona/find.js'], D => D.max],
  ['Wyoming', ['wyoming/data.js','find/unit-filter.js','find/gate.js','find/draw-sort.js','wyoming/find.js'], D => D.maxFor()],
  ['Idaho', ['idaho/data.js','find/unit-filter.js','find/gate.js','find/draw-sort.js','idaho/find.js'], D => D.max],
  ['Nevada', ['nevada/data.js','find/unit-filter.js','find/gate.js','find/draw-sort.js','nevada/find.js'], D => D.maxFor()],
  ['Montana', ['montana/data.js','find/land-bands.js','find/unit-filter.js','find/gate.js','find/draw-sort.js','montana/find.js'], D => D.maxFor()],
];

for (const [name, files, maxOf] of states) {
  try {
    check(name, boot(files), maxOf);
  } catch (e) {
    ok(false, name + ' failed to load: ' + (e && e.stack || e));
  }
}

ok(!/—/.test(readFileSync(join(root, 'find/draw-sort.js'), 'utf8')), 'sort copy has no em dash');
console.log(notes.join('\n'));
if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
