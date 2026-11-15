// New Mexico public file: bands only, no points, first-choice rate in the selected pool.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {bandOf, firstChoiceRate, parentTokens, parseUnits, residentOnly} from './nm-odds.mjs';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const parsed = spawnSync('python3', ['scripts/nm_parse.py', '--self-test'], {cwd: root, encoding: 'utf8'});
ok(parsed.status === 0, 'workbook parser keeps each pool and does not invent bear drawn counts' + (parsed.status ? '\n' + parsed.stderr : ''));

ok(firstChoiceRate(63, 1152) === 63 / 1152, 'first-choice rate is drawn divided by applicants in that pool');
ok(firstChoiceRate(0, 10) === 0, 'zero drawn with applicants is a real zero');
ok(firstChoiceRate(0, 0) === null && firstChoiceRate(null, 40) === null && firstChoiceRate(3, null) === null, 'zero applicants or a missing drawn count is not a rate');
ok(bandOf(63 / 1152) === 0.05 && bandOf(3 / 80) === 0.01 && bandOf(1) === 1 && bandOf(0) === 0, 'bands use the drew cutoffs');
ok(parseUnits('Units 2, 7, 9, 10') .join() === '7,9,10', 'a parent unit number is not expanded into lettered units');
ok(parentTokens('Unit 2 and Unit 2A').join() === '2', 'Unit 2 is named and Unit 2A is not also a parent');
ok(residentOnly({sp: 'elk', bag: 'A', unit: 'Unit 15'}).resOnly === true, 'antlerless elk is resident only');
ok(residentOnly({sp: 'deer', bag: 'FAD', unit: 'Unit 9, including Water Canyon WMA'}).resOnly === false, 'including a WMA is not resident only');
ok(residentOnly({sp: 'elk', bag: 'MB', unit: 'Unit 4: Sargent WMA only'}).resOnly === true, 'a WMA-only hunt is resident only');

const sandbox = {window: {}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'newmexico/data.js'), 'utf8') + '\nglobalThis.NH=NH; globalThis.NM_META=NM_META;', sandbox);
const {NH, NM_META} = sandbox;
const pub = readFileSync(join(root, 'newmexico/data.js'), 'utf8');
const find = readFileSync(join(root, 'newmexico/find.js'), 'utf8');
const html = readFileSync(join(root, 'newmexico/find.html'), 'utf8');
const rw = readFileSync(join(root, 'member/rw.js'), 'utf8');

ok(!/"raw"|rate1|"a1"|"s1"/.test(pub), 'public file has no applicant counts or raw rates');
ok(!/—|–/.test(html + find), 'New Mexico pages have no em dash or en dash');
ok(!/trophy-ui|trophy-nm|Boone/.test(html + find), 'New Mexico does not load a trophy line');
ok(!/noindex/i.test(html), 'the page is indexable');
ok(/New Mexico Department of Wildlife/.test(html), 'page names the Department');
ok(/does not use preference points or bonus points/i.test(html), 'the page says points are not used');
ok(NM_META.year === 2026 && NM_META.points === false && NM_META.samples.join() === '45,23', '2026 data with sample units 45 and 23');
ok(/EXACT=new Set\(\[[^\]]*'\bnm\b'/.test(rw) || /'nm'/.test(rw.split('EXACT')[1].split(';')[0]), 'member loader requests nm.js');
ok(!/TROPHY=new Set\(\[[^\]]*'nm'/.test(rw), 'member loader does not request trophy-nm.js');

const bands = new Set([0, 0.01, 0.05, 0.25, 0.75, 1]);
const tally = {};
let bad = 0;
for (const h of Object.values(NH)) {
  tally[h.sp] = (tally[h.sp] || 0) + 1;
  for (const v of Object.values(h.od || {})) if (!bands.has(v)) bad++;
  if (h.sp === 'elk' && h.bag === 'A' && !h.resOnly) bad++;
  if (h.sp === 'bear' || h.sp === 'turkey') {
    if (h.drawn || Object.keys(h.od || {}).length) bad++;
  }
}
ok(bad === 0, 'stored values are bands, antlerless elk is resident only, and bear and turkey have no invented rate');
ok(tally.elk === 322 && tally.deer === 337 && tally.pronghorn === 153 && tally.oryx === 46, 'big game counts match the 2026 complete report');
ok(tally.barbary === 22 && tally.bighorn === 4 && tally.ibex === 4 && tally.javelina === 5, 'sheep, ibex, and javelina counts match the report');
ok(tally.bear === 7 && tally.turkey === 8, 'bear and turkey draw hunts are included');

const elk = NH['ELK-1-132'];
ok(elk && elk.od.res === 0.05 && elk.od.nr === 0.01 && elk.od.out === 0.05, 'ELK-1-132 bands match 63/1152, 4/153, and 7/80');
ok(elk && elk.season === 'Oct. 17-21' && elk.units.join() === '' && elk.unmapped.join() === '2', 'Unit 2 elk keeps the booklet date and is not painted on a guessed polygon');
ok(NH['ANT-1-101'] && NH['ANT-1-101'].od.res === 0.01 && !NH['ANT-1-101'].od.nr, 'a pool with no first-choice applicants is omitted');
ok(NH['BER-1-101'] && NH['BER-1-101'].resOnly === true && NH['BER-1-104'] && NH['BER-1-104'].resOnly === false, 'WMA-only bear is resident only and the Valle Vidal bear hunt is not');

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
