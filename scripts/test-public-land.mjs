// Public-land bands: thresholds, combined notes, and a trace from every browser band back to provenance.
import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const sandbox = {window: {RW_LAND_DATA: {co: {'gmu:60': 'priv'}, wy: {}, id: {}, nv: {}, ut: {}}}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'find/land-bands.js'), 'utf8'), sandbox);
const L = sandbox.window.RWLand;

ok(L.bandOf(0.30) === 'priv', '30% is mostly private');
ok(L.bandOf(0.399) === 'priv' && L.bandOf(0) === 'priv', 'under 40% is mostly private');
ok(L.bandOf(0.40) === 'mix' && L.bandOf(0.699) === 'mix', '40% up to 70% is mixed');
ok(L.bandOf(0.70) === 'pub' && L.bandOf(1) === 'pub', '70% and above is mostly public');
ok(L.bandOf(null) === null && L.bandOf(Number.NaN) === null, 'missing share has no band');
ok(L.LABEL.priv === 'Mostly private (under 40%)', 'private band label');
ok(L.LABEL.mix === 'Mixed public/private (40–70%)' && L.LABEL.pub === 'Mostly public (70%+)', 'other band labels');

ok(L.packageCap(24) === 3 && L.packageCap(100) === 4 && L.packageCap(749) === 29 && L.packageCap(750) === 30 && L.packageCap(2000) === 30, 'package cap is 1 per 25 tags, minimum 3, maximum 30');
ok(L.packageCap(0) === null && L.packageCap(null) === null && L.packageCap(12.5) === null, 'missing or zero tags produce no cap');
ok(L.combined({harvest: 'good', land: 'priv'}) === 'Good harvest success, but mostly private land, so plan access.', 'private-land harvest note');
ok(L.combined({odds: 'good', land: 'pub', voice: 'forecast'}) === 'Good odds and mostly public land.', 'public-land odds note');
ok(L.combined({odds: 'good', land: 'pub', voice: 'history'}) === 'Most first-choice applicants drew, and the land is mostly public.', 'historical public-land note');
ok(L.combined({privateOnly: true, land: 'pub'}) === 'This hunt is private land only, so plan access.', 'private-only hunts do not wear the unit band');
ok(!/perfect/i.test(JSON.stringify([
  L.combined({odds: 'good', harvest: 'high', land: 'pub', voice: 'forecast'}),
  L.combined({odds: 'poor', harvest: 'low', land: 'priv', voice: 'forecast'}),
  L.combined({odds: 'mixed', land: 'mix', voice: 'history'})
])), 'combined notes do not say perfect');

const line = L.extra({band: 'pub', land: 'pub', odds: 'good', voice: 'forecast', place: 'Unit 60', href: L.pkgHref('', 'co', '60')});
ok(line.includes('Mostly public (70%+)'), 'card shows the band, not a computed percent');
ok(!/\d+\.\d+%/.test(line), 'card does not print a decimal percent');
ok(line.includes('Good odds and mostly public land.'), 'card shows the combined note');
ok(line.includes('Ready for the next step? Get the UnitIQ Scouting Package for Unit 60.'), 'next step names the UnitIQ Scouting Package');
ok(line.includes('packages.html?state=co&amp;unit=60#unitiq-scouting'), 'next step links to packages.html for that unit');
ok(!/map pack|hotspot|only 5|limited|spots left|hurry|perfect/i.test(line), 'next step has no map-pack, scarcity, or hype wording');
ok(!/stripe|checkout\.stripe/i.test(line), 'next step is not a payment link');
const otcLine=L.extra({band:'mix',land:'mix',voice:'forecast',place:'Unit 60',href:L.pkgHref('','co','60'),cap:30});
ok(otcLine.includes('Only 30 scouting packages go out for this unit each season, so we don\'t send too many hunters to the same spots.'), 'an over-the-counter unit says 30 packages');
ok(!/hurry|countdown/i.test(otcLine), 'the cap sentence is not a countdown');

ok(L.idKey('36A-1') === null && L.idKey('11') === '11' && L.idKey('08A') === '8A', 'Idaho subunits are not given a full-unit key');
ok(L.nvKey('011 - 013') === '011+012+013', 'Nevada ranges expand to unit ids');
ok(L.nvKey('192, 194 - 196, 201 - 204, 206, 291 (see CR 25-08)') === '192+194+195+196+201+202+203+204+206+291', 'a citation suffix does not hide a full unit list');
ok(L.nvKey('East portion of 181 (see CR 25-07)') === null, 'a portion of a unit is not guessed');
ok(L.coKey('elk', [60, 61]) === 'gmu:60+61' && L.coKey('sheep', ['S01']) === 'sheep:S1', 'Colorado keys');
ok(L.wyKey('elk', '001') === 'elk:1' && L.wyKey('elk', 'GEN') === null, 'Wyoming general licenses are not one hunt area');
ok(L.utKey([685, 33]) === '33+685', 'Utah boundary ids sort into one key');

const exactPath = join(root, 'data/public-land/exact.json');
const provPath = join(root, 'data/public-land/provenance.json');
const dataPath = join(root, 'find/land-data.js');
ok(existsSync(exactPath) && existsSync(provPath) && existsSync(dataPath), 'exact shares, provenance, and the browser band file exist');

if (existsSync(exactPath) && existsSync(dataPath)) {
  const exact = JSON.parse(readFileSync(exactPath, 'utf8'));
  const prov = JSON.parse(readFileSync(provPath, 'utf8'));
  const dataBox = {window: {}};
  vm.createContext(dataBox);
  vm.runInContext(readFileSync(dataPath, 'utf8'), dataBox);
  const data = dataBox.window.RW_LAND_DATA;
  const publicFiles = ['find/land-data.js', 'find/land-bands.js', 'find/find.js', 'utah/find.js', 'wyoming/find.js', 'idaho/find.js', 'nevada/find.js']
    .map(rel => readFileSync(join(root, rel), 'utf8')).join('\n');
  let traced = 0;
  let bad = 0;
  const leaks = [];
  for (const [state, rows] of Object.entries(exact)) {
    for (const [key, row] of Object.entries(rows)) {
      const shown = data[state] && data[state][key];
      if (row.status === 'computed' && row.band) {
        traced++;
        if (shown !== row.band) bad++;
        if (row.pct != null && L.bandOf(row.pct) !== row.band) bad++;
        if (row.low != null && row.high != null && (L.bandOf(row.low) !== row.band || L.bandOf(row.high) !== row.band)) bad++;
        for (const n of [row.pct, row.low, row.high]) {
          if (n == null) continue;
          const fraction = n.toFixed(4);
          if (fraction !== '0.4000' && fraction !== '0.7000' && publicFiles.includes(fraction)) leaks.push(state + ':' + key + ':' + fraction);
        }
      } else if (shown) bad++;
    }
  }
  ok(traced > 0 && bad === 0, traced + ' computed bands match the browser file and the band thresholds');
  ok(leaks.length === 0, 'exact shares are not copied into the public scripts');
  ok(prov.landlocked && prov.landlocked.status === 'skipped', 'landlocked parcels are skipped, with a reason');
  ok(Array.isArray(prov.policy) && prov.policy.length >= 5 && prov.sources && prov.method, 'provenance records the method, policy, and sources');
  ok(!/perfect hunt/i.test(publicFiles), 'public scripts never say perfect hunt');
  const bandsOnly = Object.values(data).every(group => Object.values(group).every(v => v === 'pub' || v === 'mix' || v === 'priv'));
  ok(bandsOnly, 'the browser file stores only band codes');
}

const pages = ['find.html', 'utah/find.html', 'wyoming/find.html', 'idaho/find.html', 'nevada/find.html'];
ok(pages.every(rel => readFileSync(join(root, rel), 'utf8').includes('land-bands.js')), 'each find page loads the band script');
const packages = readFileSync(join(root, 'packages.html'), 'utf8');
ok(packages.includes('id="unitiq-scouting"') && packages.includes('$99') && packages.includes('Nothing is for sale yet'), 'the $99 package is still on the packages page and checkout stays closed');
ok(/\$29</.test(packages) || packages.includes('>$29<') || packages.includes('$29'), 'this PR does not remove the other package prices');

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
