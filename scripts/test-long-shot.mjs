// Long-shot cutoff: odds above 0 and under 5% stay on a random-draw list.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const window = {};
vm.runInNewContext(readFileSync(new URL('../find/long-shot.js', import.meta.url), 'utf8'), {window});
const L = window.RWLong;
ok(L.word(0.01) === 'LONG SHOT' && L.word(0.049) === 'LONG SHOT' && L.word(0.05) === 'LONG SHOT', 'odds above 0 and under 5%, and the 5% band, are long shots');
ok(L.word(0) === 'NOT THIS YEAR' && L.word(0.25) === 'MAYBE' && L.word(0.75) === 'LIKELY', 'zero stays not this year, and the higher cutoffs stay put');
ok(L.allLong([{v:0.01},{v:0.04}]) && !L.allLong([{v:0.01},{v:0.05}]) && !L.allLong([]), 'the banner is only when every listed hunt is under 5%');
const banner = L.banner({points:18, rule:L.rules.utBonus, member:true, next:{name:'Fillmore, Oak Creek', points:19, year:'2025'}});
ok(banner.includes('No guaranteed draws at 18 points, but you can still draw.') && banner.includes('Utah gives half of the tags to a random drawing') && banner.includes('Fillmore, Oak Creek drew at 19 points in 2025'), 'member banner names the points and the next official draw');
ok(L.banner({points:10, rule:L.rules.utBonus, member:false, next:{name:'Hidden', points:12, year:'2025'}}).includes('the point level where a hunt drew is in the Full Pass') && !L.banner({points:10, rule:L.rules.utBonus, member:false, next:{name:'Hidden', points:12, year:'2025'}}).includes('Hidden'), 'free banner keeps the next point level out');
ok(!L.empty({points:18, member:true, next:null}).includes('0 hunts'), 'an empty list does not say 0 hunts');
ok(L.bestFirst([{k:'b',v:0.01},{k:'a',v:0.04}])[0].k === 'a', 'long shots sort best odds first');

const UH = new Function(readFileSync(new URL('../utah/data.js', import.meta.url), 'utf8') + '\nreturn UH;')();
for (const pts of [10, 18]) {
  const rows = Object.values(UH).filter(h => h.pool === 'sheep-rbs').map(h => h.d.res.o[Math.min(pts, h.d.res.o.length - 1)]);
  ok(rows.length > 0 && rows.every(v => v > 0 && v < 0.05), 'Utah Rocky Mountain bighorn resident at ' + pts + ' points is all long shots');
}

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
