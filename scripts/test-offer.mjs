// Offer preview: three paid tiers, no Hotspot Map Pack, and a soft Full Pass gate on Find Your Hunt.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

function walk(dir, out=[]) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const textExt = /\.(html|js|mjs|css|xml|json|txt|md)$/i;
let mapPack = [];
for (const p of walk(root)) {
  if (!textExt.test(p)) continue;
  const rel = relative(root, p);
  if (rel.startsWith('find/history/') || rel === 'scripts/test-offer.mjs') continue;
  const text = readFileSync(p, 'utf8');
  if (/Map Pack|hotspot_pack|Full Scouting Package/i.test(text)) mapPack.push(rel);
  if (/(^|[^.\d])\$29([^.\d]|$)/.test(text) && !rel.startsWith('scripts/test-offer')) mapPack.push(rel + ' ($29)');
}
ok(mapPack.length === 0, 'no Hotspot Map Pack, hotspot_pack, Full Scouting Package, or stray $29' + (mapPack.length ? ': ' + mapPack.join(', ') : ''));

const pricing = readFileSync(join(root, 'pricing.html'), 'utf8');
const packages = readFileSync(join(root, 'packages.html'), 'utf8');
const terms = readFileSync(join(root, 'terms.html'), 'utf8');
const refund = readFileSync(join(root, 'refund.html'), 'utf8');
ok(pricing.includes('From research to scouting to hunting, all in one place.'), 'pricing uses the framing line');
ok(packages.includes('From research to scouting to hunting, all in one place.'), 'packages uses the framing line');
ok(/checkout is not open/.test(pricing) && /Checkout is not open/.test(packages), 'checkout stays closed');
ok(pricing.includes('$0') && pricing.includes('$29.99') && pricing.includes('$19.99') && pricing.includes('$99'), 'free, Full Pass, Founding and scouting prices');
ok(pricing.includes('locked as long as you keep renewing'), 'Founding Hunter lock wording stays');
ok(/1 package for every 25 tags/.test(pricing) && /at least 3 and at most 30/.test(pricing), 'pricing states the per-unit cap');
ok(/at least 3 and at most 30/.test(packages) && /at least 3 and at most 30/.test(terms), 'packages and terms use the same cap');
ok(/flat 30 per unit per season/.test(pricing + packages + terms), 'over-the-counter and unlimited units are a flat 30');
ok(/varied mix of spots/.test(pricing) && /varied mix of spots/.test(packages) && /varied mix of spots/.test(terms), 'larger units get a varied mix of spots');
ok(!/at most 10/.test(pricing + packages + terms), 'the old maximum of 10 is gone');
ok(/so we don't send too many hunters to the same spots/.test(pricing + packages + terms), 'cap reason is plain');
ok(/refund that purchase in full|refund that package in full|refund it in full/.test(terms), 'terms still refund a sold-out unit');
ok(/5 to 8/.test(pricing) && /5 to 8/.test(packages), 'Boots limit stays 5 to 8');
ok(/Colorado for now; Utah and Arizona coming once licensed/.test(pricing), 'Boots licensing line stays');
ok(/1 free revision/.test(pricing) && /1 free revision/.test(packages) && /1 free revision/.test(terms), 'scouting package includes one free revision');
ok(/UnitIQ Scouting Package/.test(pricing) && /UnitIQ Scouting Package/.test(refund), 'scouting package name is consistent');
ok(/You could draw 732 elk hunts/.test(pricing), 'free column describes the count');
ok(!/repeat\(5,1fr\)/.test(pricing), 'pricing grid is no longer five columns');

const pages = [
  ['find.html', 'find/find.js'],
  ['utah/find.html', 'utah/find.js'],
  ['arizona/find.html', 'arizona/find.js'],
  ['wyoming/find.html', 'wyoming/find.js'],
  ['idaho/find.html', 'idaho/find.js'],
  ['nevada/find.html', 'nevada/find.js'],
  ['idaho/general.html', 'idaho/general.js']
];
for (const [htmlName, jsName] of pages) {
  const html = readFileSync(join(root, htmlName), 'utf8');
  const js = readFileSync(join(root, jsName), 'utf8');
  ok(/gate\.js/.test(html), htmlName + ' loads the gate');
  ok(/RWGate/.test(js), jsName + ' uses the gate');
}
const gate = readFileSync(join(root, 'find/gate.js'), 'utf8');
const co = readFileSync(join(root, 'find/find.js'), 'utf8');
ok(/FULLPASS_GATING/.test(gate) && /FULLPASS_GATING/.test(co), 'FULLPASS_GATING flag remains');
ok(/preview['"]\)==='fullpass'|preview === 'fullpass'/.test(gate) || /preview'\)==='fullpass'/.test(gate), 'preview=fullpass opens the paid list');
ok(/Unlock with Full Pass/.test(gate), 'unlock panel names the Full Pass');
ok(/See Full Pass/.test(gate) && /#waitlist/.test(gate), 'unlock button reads See Full Pass and links to the waitlist');
ok(/You could draw/.test(gate), 'free result leads with a count');
ok(/up to 3 hunts from each sample unit/.test(gate), 'free copy caps the sample at 3 hunts per unit');
const css = readFileSync(join(root, 'style.css'), 'utf8');
ok(/\.fpbox a\.btn\{color:#111/.test(css), 'unlock button text stays dark on the orange button');
const gateBox = {window:{}, location:{search:''}, URLSearchParams};
vm.createContext(gateBox);
vm.runInContext(gate, gateBox);
const many = [];
for (let i = 0; i < 8; i++) many.push({id:'a'+i, u:'12'});
for (let i = 0; i < 8; i++) many.push({id:'b'+i, u:'2'});
many.push({id:'both', u:['12','2']});
const picked = gateBox.window.RWGate.takePerUnit(many, row => row.u);
ok(picked.filter(row => row.u === '12').length === 3, 'unit 12 keeps 3 sample hunts');
ok(picked.filter(row => row.u === '2').length === 3, 'unit 2 keeps 3 sample hunts');
ok(picked.length === 6, 'a hunt in a full unit is not added once both units are full');

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
