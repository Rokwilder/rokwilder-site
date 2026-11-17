// UnitIQ app: eight states, package entry, and Colorado unit 60 left out of the package form.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const units = JSON.parse(readFileSync(join(root, 'member/units.json'), 'utf8'));
for (const st of ['CO', 'UT', 'AZ', 'WY', 'ID', 'NV', 'MT', 'NM']) {
  ok(units[st] && units[st].elk.length > 0 && units[st].deer.length > 0 && units[st].pronghorn.length > 0, st + ' has elk, deer, and pronghorn units');
}
ok(!units.CO.elk.includes('60') && !units.CO.deer.includes('60') && !units.CO.pronghorn.includes('60'), 'Colorado package list has no unit 60');
ok(!JSON.stringify(units.CO).includes('S60'), 'Colorado package list has no S60');
ok(units.WY.elk.includes('060') && !units.WY.elk.includes('60'), 'Wyoming keeps hunt area 060');

const buy = readFileSync(join(root, 'buy.html'), 'utf8');
for (const st of ['Colorado', 'Utah', 'Arizona', 'Wyoming', 'Idaho', 'Nevada', 'Montana', 'New Mexico']) {
  ok(buy.includes(st), 'buy form names ' + st);
}
ok(buy.includes('Unit 60 and S60 are not sold'), 'buy form says unit 60 is not sold');
ok(buy.includes("product:p,state:$('st').value,species:$('sp').value,unit:$('un').value,season:$('se').value"), 'checkout body is product, state, species, unit, season');
ok(!buy.includes('—'), 'buy form has no em dash');

const app = readFileSync(join(root, 'member/app.html'), 'utf8') + readFileSync(join(root, 'member/app.js'), 'utf8');
for (const name of ['Colorado', 'Utah', 'Arizona', 'Wyoming', 'Idaho', 'Nevada', 'Montana', 'New Mexico']) ok(app.includes(name), 'app names ' + name);
ok(app.includes('UnitIQ Scouting Package, $99'), 'app has the $99 package entry');
ok(app.includes('starting at $300') && app.includes('btn dis'), 'Boots stays greyed out at starting at $300');
ok(app.includes('Utah and Arizona coming once licensed'), 'Utah and Arizona Boots stay closed');
ok(!app.includes('—'), 'app copy has no em dash');

const box = {window: {}};
vm.createContext(box);
vm.runInContext(readFileSync(join(root, 'find/land-bands.js'), 'utf8'), box);
const L = box.window.RWLand;
ok(L.blockedPackage('co', '60') && L.blockedPackage('CO', 'S60') && L.blockedPackage('co', '060'), 'blocked helper catches 60 and S60');
ok(!L.blockedPackage('wy', '060') && !L.blockedPackage('co', '61') && !L.blockedPackage('nm', '60'), 'other states and other units stay open');

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
