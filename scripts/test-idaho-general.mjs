// Preview checks for Idaho general season and the nonresident deer/elk draw.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const sandbox = {window: {}};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'idaho/general-data.js'), 'utf8') + '\nglobalThis.IG=IG;', sandbox);
const {IG} = sandbox;
const html = readFileSync(join(root, 'idaho/general.html'), 'utf8');
const js = readFileSync(join(root, 'idaho/general.js'), 'utf8');
const controlled = readFileSync(join(root, 'idaho/find.html'), 'utf8');
const data = readFileSync(join(root, 'idaho/general-data.js'), 'utf8');
const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
const pricing = readFileSync(join(root, 'pricing.html'), 'utf8');

ok(IG.draw2026.length === 194, '194 rows in the 2026 nonresident draw, including two statewide DAV rows');
ok(IG.draw2026.filter(row => row.sp === 'elk' && row.kind === 'elk').length === 47, '47 elk zone and tag rows');
ok(IG.draw2026.filter(row => row.sp === 'deer' && row.kind !== 'dav-deer').length === 145, '145 regular and white-tailed deer units');
ok(IG.choices2027.length === 219, '219 choices for the 2027 draw');
ok(IG.choices2027.filter(row => row.kind === 'elk').length === 47, '47 elk hunt codes for 2027');
ok(IG.choices2027.filter(row => row.kind === 'dav-elk').length === 27, '27 DAV elk codes for 2027');
ok(IG.seasons.length > 400 && IG.seasons.some(row => row.g === 'Elk') && IG.seasons.some(row => row.g.includes('Deer')), 'general-season windows include elk and deer');
ok(!IG.seasons.some(row => row.permits || row.band), 'season windows have no tag count and no draw band');

const bands = new Set([0, 0.01, 0.05, 0.25, 0.75, 1, null]);
ok(IG.draw2026.every(row => bands.has(row.band)), 'every 2026 draw value is a band or no result');
ok(IG.choices2027.every(row => row.band === null), 'every 2027 choice has no result band');
ok(!/%|\bapplicants\b|\bquota\b/.test(data), 'public file has no success rate, applicant count, or quota field name');

const lolo = IG.draw2026.find(row => row.place === 'Lolo' && row.tag === 'A');
const pioneer = IG.draw2026.find(row => row.place === 'Pioneer' && row.tag === 'B');
const bannock = IG.draw2026.find(row => row.place === 'Bannock' && row.tag === 'A');
const empty = IG.draw2026.filter(row => row.band == null);
ok(lolo && lolo.band === 1 && lolo.later === 1, 'Lolo A first choice all drew, and a later choice also received tags');
ok(pioneer && pioneer.band === 0.01 && pioneer.later === 0, 'Pioneer B stays under one in twenty');
ok(bannock && bannock.band === 0.25 && bannock.later === 0, 'Bannock A is Some drew and did not issue a later choice');
ok(empty.length === 8 && empty.every(row => row.kind === 'deer-whitetail'), 'eight white-tailed units have no first-choice result');
const elk1 = IG.choices2027.find(row => row.code === 'ELK1');
ok(elk1 && elk1.limit === 193 && elk1.band === null && elk1.place === 'Bannock', 'ELK1 is a 2027 tag limit, not a result');
const rd55 = IG.draw2026.find(row => row.kind === 'deer-regular' && row.place === '55');
ok(rd55 && rd55.band === 0.05, 'unit 55 follows the counts when the printed whole-number rate crosses a line');

ok(/noindex/.test(html), 'general page stays noindex while it is a draft');
ok(!controlled.includes('noindex'), 'the live controlled-hunt page stays indexable');
ok(!sitemap.includes('general.html'), 'the draft page is not in the sitemap');
ok(/not a forecast/i.test(html) && /not a harvest rate/i.test(html), 'season windows are not described as draw chances or harvest');
ok(/no result yet|had not been held/i.test(html + js), '2027 is labeled as having no result');
ok(/over the counter/i.test(html) && /random draw/i.test(html), 'OTC resident sales and the nonresident draw are both named');
ok(!/pct\(/.test(js) && !/\d+%/.test(js), 'the page script does not print a success rate');
const sections = ['Controlled Hunts', 'General-Season Hunts', 'Nonresident Tag Draws'];
ok(sections.every(label => html.includes(label) && controlled.includes(label)), 'both Idaho pages have the three section buttons');
ok(/2027 nonresident results are not released/.test(js), '2027 results are explained as unreleased');
ok(/Nonresidents only/.test(js) && /residents over the counter/.test(js), 'resident and nonresident paths stay labeled');
ok(controlled.includes('general.html?mode=seasons') && controlled.includes('general.html?mode=draw'), 'controlled page links each new section');
ok(/checkout is not open/.test(pricing), 'checkout remains closed');
ok(pricing.includes('$29.99') && pricing.includes('$19.99'), 'Full Pass and Founding prices are unchanged');

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
