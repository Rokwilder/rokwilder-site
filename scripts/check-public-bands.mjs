// Public leak guard for Wyoming draw data.
// build-nofree-site.mjs is the paywall stripper used for Colorado, Utah and Arizona.
// It is not in this public repository. Where that script exists it only rewrites those
// three data files, and it refuses an input that is already band-only, so it cannot
// be pointed at wyoming/data.js. This check is the guard that runs on the public site:
// wyoming/data.js may contain only verdict bands, and the repo must not contain the
// private exact file.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname;
const bands = new Set([0, 0.01, 0.05, 0.25, 0.75, 1]);
let fails = 0;
const bad = m => { console.error('FAIL', m); fails++; };
const ok = m => console.log('PASS', m);

const dataPath = join(root, 'wyoming/data.js');
const src = readFileSync(dataPath, 'utf8');
if (/window\.RW_FP\s*=\s*true/.test(src)) bad('wyoming/data.js sets window.RW_FP');
else ok('public file does not set window.RW_FP');
if (/"raw"\s*:/.test(src) || /\bquota\b/.test(src) || /\bapplicants\b/.test(src)) bad('wyoming/data.js contains raw, quota or applicants');
else ok('public file has no raw, quota or applicants fields');

const sandbox = {window: {}};
vm.createContext(sandbox);
vm.runInContext(src + '\nglobalThis.WH=WH; globalThis.WY_META=WY_META;', sandbox);
const {WH, WY_META} = sandbox;
if (!WH || !WY_META) bad('WH or WY_META missing');
const keys = Object.keys(WH || {});
ok(`${keys.length} hunt records`);
const species = new Set(keys.map(k => WH[k].sp));
for (const sp of ['elk','deer','pronghorn','moose','sheep','goat','bison']) {
  if (!species.has(sp)) bad('missing species ' + sp);
}
if (species.size === 7) ok('seven species');
const pools = new Set();
let oddsN = 0;
for (const h of Object.values(WH)) {
  if (h.raw) bad('raw field on ' + h.area);
  for (const [pool, b] of Object.entries(h.od || {})) {
    pools.add(pool + (b.pts ? ':pts' : ':random'));
    if (!Array.isArray(b.o) || !b.o.length) bad('empty odds');
    for (const v of b.o) {
      oddsN++;
      if (!bands.has(v)) bad('odds value not a verdict band: ' + v);
    }
  }
}
ok(`${oddsN} band values, all in {0, .01, .05, .25, .75, 1}`);
if (![...pools].some(p => p.startsWith('res'))) bad('no resident pool');
if (![...pools].some(p => p.startsWith('nr'))) bad('no nonresident pool');
if (![...pools].some(p => p.startsWith('nrs'))) bad('no nonresident special pool');
else ok('resident, regular and special pools present');

const html = readFileSync(join(root, 'wyoming/find.html'), 'utf8');
if (/noindex/i.test(html)) bad('wyoming/find.html is still noindex');
else ok('wyoming/find.html is indexable');
const sm = readFileSync(join(root, 'sitemap.xml'), 'utf8');
const sw = readFileSync(join(root, 'sitemap-wyoming.xml'), 'utf8');
const sp = readFileSync(join(root, 'sitemap-pages.xml'), 'utf8');
if (!sm.includes('sitemap-wyoming.xml')) bad('sitemap index missing Wyoming');
if (!sw.includes('https://rokwilder.com/wyoming/find.html')) bad('Wyoming sitemap missing the find page');
if (!sp.includes('https://rokwilder.com/wyoming/find.html')) bad('pages sitemap missing Wyoming');
else ok('sitemaps list Wyoming');

function walk(dir, out=[]) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const privateName = /wy_full\.(js|json)$/i;
const privateMarker = 'FULL (' + 'Full Pass / private';
for (const p of walk(root)) {
  const rel = relative(root, p);
  if (privateName.test(rel)) bad('private path committed: ' + rel);
  if (!/\.(js|mjs|html|json)$/.test(p)) continue;
  if (rel === 'scripts/check-public-bands.mjs') continue;
  const text = readFileSync(p, 'utf8');
  if (text.includes(privateMarker) || text.includes('window.RW_FP=true')) bad('private exact-data marker in ' + rel);
}
ok('no private exact-data file in the repository');

const nvPath = join(root, 'nevada/data.js');
const nvSrc = readFileSync(nvPath, 'utf8');
if (/window\.RW_FP\s*=\s*true/.test(nvSrc)) bad('nevada/data.js sets window.RW_FP');
else ok('Nevada public file does not set window.RW_FP');
if (/"raw"\s*:/.test(nvSrc) || /\bquota\b/.test(nvSrc) || /\bapplicants\b/.test(nvSrc) || /%/.test(nvSrc)) bad('nevada/data.js contains raw, quota, applicants or a percent sign');
else ok('Nevada public file has no raw counts or percent signs');
const nvBox = {window: {}};
vm.createContext(nvBox);
vm.runInContext(nvSrc + '\nglobalThis.NH=NH; globalThis.NV_META=NV_META;', nvBox);
const nvBands = new Set([0, 0.01, 0.05, 0.25, 0.75, 1]);
let nvCells = 0;
for (const h of Object.values(nvBox.NH || {})) {
  for (const v of Object.values(h.bp || {})) {
    nvCells++;
    if (!nvBands.has(v)) bad('Nevada band is not a verdict band: ' + v);
  }
}
ok(`${Object.keys(nvBox.NH || {}).length} Nevada hunts, ${nvCells} point-level bands`);
const nvHtml = readFileSync(join(root, 'nevada/find.html'), 'utf8');
if (/noindex/i.test(nvHtml)) bad('nevada/find.html is still noindex');
else ok('nevada/find.html is indexable');
if (nvSrc.includes('window.RW_FP=true') || readFileSync(join(root, 'nevada/find.js'), 'utf8').includes('window.RW_FP=true')) bad('Nevada public files assign the member flag');
else ok('Nevada public files do not assign the member flag');
const nvSm = readFileSync(join(root, 'sitemap-nevada.xml'), 'utf8');
if (!sm.includes('sitemap-nevada.xml')) bad('sitemap index missing Nevada');
if (!nvSm.includes('https://rokwilder.com/nevada/find.html')) bad('Nevada sitemap missing the find page');
if (!sp.includes('https://rokwilder.com/nevada/find.html')) bad('pages sitemap missing Nevada');
else ok('sitemaps list Nevada');

const idPath = join(root, 'idaho/data.js');
const idSrc = readFileSync(idPath, 'utf8');
if (/window\.RW_FP\s*=\s*true/.test(idSrc)) bad('idaho/data.js sets window.RW_FP');
else ok('Idaho public file does not set window.RW_FP');
if (/"raw"\s*:/.test(idSrc) || /\bquota\b/.test(idSrc) || /\bapplicants\b/.test(idSrc) || /%/.test(idSrc)) bad('idaho/data.js contains raw, quota, applicants or a percent sign');
else ok('Idaho public file has no raw counts or percent signs');
const idBox = {window: {}};
vm.createContext(idBox);
vm.runInContext(idSrc + '\nglobalThis.IH=IH; globalThis.ID_META=ID_META;', idBox);
const idBands = new Set([0, 0.01, 0.05, 0.25, 0.75, 1, null]);
let idOdds = 0;
for (const h of Object.values(idBox.IH || {})) {
  for (const v of [h.res, h.nr]) {
    idOdds++;
    if (!idBands.has(v)) bad('Idaho odds value not a verdict band or null: ' + v);
  }
}
ok(`${idOdds} Idaho residency cells, bands or null only`);
const idHtml = readFileSync(join(root, 'idaho/find.html'), 'utf8');
if (/noindex/i.test(idHtml)) bad('idaho/find.html is still noindex');
else ok('idaho/find.html is indexable');
const idSm = readFileSync(join(root, 'sitemap-idaho.xml'), 'utf8');
if (!sm.includes('sitemap-idaho.xml')) bad('sitemap index missing Idaho');
if (!idSm.includes('https://rokwilder.com/idaho/find.html')) bad('Idaho sitemap missing the find page');
if (!idSm.includes('https://rokwilder.com/idaho/general.html')) bad('Idaho sitemap missing the general page');
if (!sp.includes('https://rokwilder.com/idaho/find.html')) bad('pages sitemap missing Idaho');
else ok('sitemaps list Idaho');
if (idSrc.includes('window.RW_FP=true') || readFileSync(join(root, 'idaho/find.js'), 'utf8').includes('window.RW_FP=true')) bad('Idaho public files assign the member flag');
else ok('Idaho public files do not assign the member flag');

if (fails) {
  console.error(fails + ' FAIL');
  process.exit(1);
}
console.log('ALL PASS');
