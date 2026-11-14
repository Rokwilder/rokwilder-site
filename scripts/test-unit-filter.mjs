// Unit match and tie order. No browser.
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const sb = {};
sb.window = sb;
vm.createContext(sb);
vm.runInContext(readFileSync(join(root, 'find/unit-filter.js'), 'utf8'), sb);
const {hit, sortNum} = sb.RWUnit;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

ok(hit(['60'], '60'), '60 matches unit 60');
ok(hit(['60'], '060'), '060 matches unit 60');
ok(hit(['60'], 'unit 60'), 'the word unit is ignored');
ok(hit(['S5', 'S60'], '60'), '60 matches a list that includes S60');
ok(hit(['S5', 'S60'], 'S60'), 'S60 matches S60');
ok(hit(['S5', 'S60'], '5'), '5 matches S5');
ok(hit(['S5', 'S60'], 'S5'), 'S5 matches the S5 list');
ok(!hit(['160'], '60'), '60 does not match 160');
ok(!hit(['600'], '60'), '60 does not match 600');
ok(!hit(['60'], 'S60'), 'S60 does not match plain unit 60');
ok(hit(['60', '70'], ''), 'a blank filter matches');
ok(hit(['Beaver, East'], 'beaver'), 'a name fragment matches');
ok(sortNum(['S5', 'S60']) === 5, 'the sort key is the lowest unit number');
ok(sortNum(['60']) < sortNum(['61']), '60 sorts before 61');

const sandbox = {window:{}, FL:{}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'drawodds/lite.js'), 'utf8') + '\n' + readFileSync(join(root, 'find/labels.js'), 'utf8') + '\n' + readFileSync(join(root, 'drawodds/oial.js'), 'utf8') + '\nglobalThis.D=D; globalThis.FL=FL;', sandbox);
ok(Array.isArray(sandbox.FL.SMS05O1R[2]) && sandbox.FL.SMS05O1R[2].includes('S60'), 'SMS05O1R lists S60');
ok(hit(sandbox.FL.SMS05O1R[2], '60'), 'the sheep hunt matches a typed 60');

if (fails) { console.error(fails + ' failed'); process.exit(1); }
console.log('all passed');
