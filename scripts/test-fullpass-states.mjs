// Full Pass on Wyoming, Idaho and Nevada.
// Stubs /api/account and /api/fullpass/data/{wy,id,nv}.js.
// The stub files match the staged private shapes. Their counts are samples, not agency reports.
// Run: node scripts/test-fullpass-states.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = process.env.RW_SHOTS || '/opt/cursor/artifacts';
fs.mkdirSync(shots, {recursive: true});

async function loadPlaywright() {
  try { return await import('playwright'); }
  catch (e) {
    const from = process.env.PLAYWRIGHT_PATH || '/tmp/pw/node_modules/playwright/index.js';
    return await import(pathToFileURL(from).href);
  }
}
const pwMod = await loadPlaywright();
const {chromium, webkit} = pwMod.chromium ? pwMod : pwMod.default;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp'
};

function readData(file, names) {
  const box = {window: {}};
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8') + '\n' + names.map(n => `globalThis.${n}=${n};`).join('\n'), box);
  return box;
}

const flag = 'window.RW_' + 'FP=true;';
const wyPub = readData('wyoming/data.js', ['WH', 'WY_META']);
const idPub = readData('idaho/data.js', ['IH', 'ID_META']);
const nvPub = readData('nevada/data.js', ['NH', 'NV_META']);

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function pctLabel(v) {
  const r = Math.round(v * 100);
  return v > 0 && r === 0 ? 'under 1%' : v < 1 && r === 100 ? 'over 99%' : r + '%';
}
// A sample rate inside the public band, so the word and the percent agree.
function inside(band) {
  if (band >= 0.995) return 1;
  if (band >= 0.75) return 0.82;
  if (band >= 0.25) return 0.4;
  if (band >= 0.05) return 0.12;
  return 0.02;
}
function counts(band, apps) {
  const rate = inside(band);
  return {apps, drawn: Math.round(rate * apps), rate};
}

function wyStub() {
  const WH = {};
  const elk = Object.entries(wyPub.WH).filter(([, h]) => h.sp === 'elk' && h.od && h.od.res && h.od.res.o[0] >= 0.05);
  const samples = elk.filter(([, h]) => h.area === '100' || h.area === '102').slice(0, 6);
  const likely = elk.find(([, h]) => h.area !== '100' && h.area !== '102' && h.od.res.o[0] === 0.75);
  const others = elk.filter(([, h]) => h.area !== '100' && h.area !== '102' && h !== (likely && likely[1])).slice(0, 12);
  for (const [k, h] of [...samples, ...(likely ? [likely] : []), ...others]) {
    const rec = clone(h);
    const R = inside(h.od.res.o[0]);
    rec.raw = {res: {rand: {quota: Math.round(R * 100), first: 100}, R, rsrc: 'res'}};
    WH[k] = rec;
  }
  const note = '// Shape sample for local tests. These counts are not a WGFD report.';
  return note + '\n' + flag + '\nconst WY_META=' + JSON.stringify(wyPub.WY_META) + ';\nconst WH=' + JSON.stringify(WH) + ';\n';
}
function idStub() {
  const IH = {};
  const rows = Object.entries(idPub.IH).filter(([, h]) => h.sp === 'elk' && h.draw === 1 && h.res != null && h.res >= 0.05);
  const samples = rows.filter(([, h]) => h.area === '31' || h.area === '37').slice(0, 6);
  const others = rows.filter(([, h]) => h.area !== '31' && h.area !== '37').slice(0, 12);
  const picked = [...samples, ...others].sort((a, b) => b[1].res - a[1].res || String(a[1].n).localeCompare(String(b[1].n), undefined, {numeric: true}) || String(a[1].area).localeCompare(String(b[1].area)));
  for (const [k, h] of [...samples, ...others]) {
    const rec = clone(h);
    const res = counts(h.res, 40);
    const nr = counts(h.nr == null ? 0 : h.nr, 20);
    rec.raw = {res, nr};
    IH[k] = rec;
  }
  const top = counts(picked[0][1].res, 40);
  return {
    js: flag + '\n// 2026 shape sample for local tests. These counts are not an IDFG report.\nconst ID_META=' + JSON.stringify(idPub.ID_META) + ';\nconst IH=' + JSON.stringify(IH) + ';\n',
    exact: pctLabel(top.rate),
    drawn: top.drawn + ' drawn of ' + top.apps
  };
}
function nvStub() {
  const rows = Object.entries(nvPub.NH).filter(([, h]) => h.sp === 'elk' && h.sx === 'M' && h.live === 'res' && h.who === 'main' && h.wpn === 'alw' && h.bp[5] >= 0.05);
  rows.sort((a, b) => b[1].bp[5] - a[1].bp[5] || String(a[1].units).localeCompare(String(b[1].units), undefined, {numeric: true}) || String(a[1].season).localeCompare(String(b[1].season)));
  const NH = {};
  for (const [k, h] of rows) {
    const rec = clone(h);
    const lv = {};
    for (const [p, band] of Object.entries(h.bp)) {
      const c = counts(band, 20);
      lv[p] = {s1: c.drawn, a1: c.apps, rate1: c.rate, s: c.drawn + 1, a: c.apps + 4};
    }
    rec.raw = {quota: 8, lv};
    NH[k] = rec;
  }
  const top = counts(rows[0][1].bp[5], 20);
  return {
    js: flag + '\n// 2025 shape sample for local tests. These counts are not an NDOW report.\nconst NV_META=' + JSON.stringify(nvPub.NV_META) + ';\nconst NH=' + JSON.stringify(NH) + ';\n',
    exact: pctLabel(top.rate),
    drawn: top.drawn + ' drawn of ' + top.apps
  };
}

const wyFile = wyStub();
const idPack = idStub();
const nvPack = nvStub();
const stubs = {wy: wyFile, id: idPack.js, nv: nvPack.js};
const expect = {
  wy: {exact: '82%'},
  id: {exact: idPack.exact, drawn: idPack.drawn},
  nv: {exact: nvPack.exact, drawn: nvPack.drawn}
};

const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = (u === '/' ? '/index.html' : u).replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('missing'); return; }
    res.writeHead(200, {'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store'});
    res.end(buf);
  });
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const origin = 'http://127.0.0.1:' + server.address().port;

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

function account(kind) {
  const pass = kind === 'pass';
  return {
    loggedIn: true,
    testMode: false,
    email: 'hunter@example.com',
    canManageBilling: false,
    packages: [],
    fullpass: pass
      ? {active: true, states: ['ALL'], founding: true, renews: true, ends: 1893456000}
      : {active: false, states: []}
  };
}

const pages = {
  wy: {url: '/wyoming/find.html?go=1', file: 'wy.js', name: 'Wyoming', exact: expect.wy.exact},
  id: {url: '/idaho/find.html?go=1', file: 'id.js', name: 'Idaho', exact: expect.id.exact, drawn: expect.id.drawn},
  nv: {url: '/nevada/find.html?pts=5&go=1', file: 'nv.js', name: 'Nevada', exact: expect.nv.exact, drawn: expect.nv.drawn}
};

async function openFinder(browser, viewport, st, mode, status) {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
    deviceScaleFactor: viewport.width < 500 ? 2 : 1
  });
  const page = await context.newPage();
  const hits = [];
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  await page.route('https://api.rokwilder.com/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const headers = {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store'
    };
    if (req.method() === 'OPTIONS') { await route.fulfill({status: 204, headers}); return; }
    if (url.pathname.startsWith('/api/fullpass/data/')) {
      hits.push(url.pathname);
      const code = url.pathname.split('/').pop();
      if (mode === 'missing') {
        await route.fulfill({status: status || 404, headers, contentType: 'text/plain', body: 'missing'});
        return;
      }
      if (mode === 'pass' && stubs[code.replace('.js', '')]) {
        await route.fulfill({status: 200, headers, contentType: 'text/javascript', body: stubs[code.replace('.js', '')]});
        return;
      }
      await route.fulfill({status: 404, headers, contentType: 'text/plain', body: 'missing'});
      return;
    }
    let body = {ok: true};
    if (url.pathname === '/api/catalog') body = {testMode: false, checkoutOpen: false, founding: {open: true, left: 199, limit: 200, ends: null}, seasons: ['2027'], products: {fullpass: {name: 'UnitIQ Full Pass', amount: 2999, price: '$29.99/yr'}}};
    else if (url.pathname === '/api/health') body = {ok: true, testMode: false, stripe: 'live', checkoutOpen: false};
    else if (url.pathname === '/api/account') body = account(mode === 'free' ? 'free' : 'pass');
    await route.fulfill({status: 200, headers, contentType: 'application/json', body: JSON.stringify(body)});
  });
  await page.goto(origin + pages[st].url, {waitUntil: 'domcontentloaded'});
  return {context, page, hits, errors};
}

async function shot(page, name) {
  const file = path.join(shots, name + '.png');
  await page.screenshot({path: file, fullPage: false});
  console.log('SHOT ' + file);
}

async function run(browser, browserName, viewport, vname) {
  for (const st of ['wy', 'id', 'nv']) {
    const spec = pages[st];
    const label = browserName + ' ' + vname + ' ' + st;

    {
      const {context, page, hits, errors} = await openFinder(browser, viewport, st, 'pass');
      await page.waitForSelector('#lt', {timeout: 20000});
      await page.waitForSelector('#rwbar');
      const text = await page.locator('#out').innerText();
      const bar = await page.locator('#rwbar').innerText();
      const cards = await page.locator('#out .fh').count();
      const unlock = await page.locator('#unlock').count();
      ok(hits.includes('/api/fullpass/data/' + spec.file), label + ' member requests ' + spec.file + ' (' + hits.join(',') + ')');
      ok(/exact draw odds are on for/.test(bar) && bar.includes(spec.name), label + ' member banner names ' + spec.name);
      ok(unlock === 0 && !/SAMPLE/.test(text), label + ' member has no sample shell');
      ok(cards > 3, label + ' member list has ' + cards + ' hunts');
      if (st === 'wy') {
        await page.locator('#lt').scrollIntoViewIfNeeded();
        await shot(page, 'wy_member_list_' + vname);
        const likely = page.locator('#out .fh', {hasText: 'LIKELY'}).first();
        await likely.click();
        await page.waitForSelector('#detail:not([hidden])');
        const detail = await page.locator('#detail').innerText();
        ok(detail.includes('82%') && /1st-choice applicants/.test(detail), label + ' detail shows the raw exact percent');
        await page.locator('#detail').getByText('82%').first().scrollIntoViewIfNeeded();
        await shot(page, 'wy_member_exact_' + vname);
      } else {
        const pct = await page.locator('#out .fo b').first().innerText();
        ok(pct === spec.exact, label + ' card percent is ' + pct);
        ok(text.includes(spec.drawn), label + ' card shows drawn and applied');
        if (st === 'nv') ok(text.includes('2025'), label + ' Nevada percent is labeled 2025');
        if (st === 'id') ok(text.includes('2026'), label + ' Idaho percent is labeled 2026');
        await page.locator('#out .fo b').first().scrollIntoViewIfNeeded();
        await shot(page, st + '_member_' + vname);
      }
      ok(errors.length === 0, label + ' member page has no script error' + (errors[0] ? ': ' + errors[0] : ''));
      const scroll = await page.evaluate(() => ({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth}));
      ok(scroll.sw <= scroll.cw + 1, label + ' no horizontal scroll');
      await context.close();
    }

    {
      const {context, page, hits} = await openFinder(browser, viewport, st, 'free');
      await page.waitForSelector('#unlock', {timeout: 20000});
      const text = await page.locator('#out').innerText();
      const bar = await page.locator('#rwbar').innerText();
      ok(hits.length === 0, label + ' free account does not request a private file');
      ok(/Free view/.test(bar) && bar.includes(spec.name), label + ' free banner names ' + spec.name);
      ok(/SAMPLE/.test(text) && /Unlock with Full Pass/.test(text), label + ' free view is the sample shell');
      ok(!text.includes(spec.exact), label + ' free view does not show the exact percent');
      await page.locator('#unlock').scrollIntoViewIfNeeded();
      await shot(page, st + '_free_' + vname);
      await context.close();
    }

    {
      const {context, page, hits} = await openFinder(browser, viewport, st, 'missing', 404);
      await page.waitForSelector('#lt', {timeout: 20000});
      const text = await page.locator('#out').innerText();
      const bar = await page.locator('#rwbar').innerText();
      const cards = await page.locator('#out .fh').count();
      const bold = await page.locator('#out .fo b').count();
      ok(hits.includes('/api/fullpass/data/' + spec.file), label + ' fallback still requests the private file');
      ok(/did not load/.test(bar) && /full/.test(bar) && bar.includes(spec.name), label + ' fallback banner keeps the full list');
      ok((await page.locator('#unlock').count()) === 0 && !/SAMPLE/.test(text), label + ' fallback has no sample shell');
      ok(bold === 0, label + ' fallback does not print an exact percent');
      ok(cards > 3, label + ' fallback shows ' + cards + ' hunts from the public file');
      await page.locator('#rwbar').scrollIntoViewIfNeeded();
      await shot(page, st + '_fallback_' + vname);
      await context.close();
    }
  }

  if (vname === 'phone') {
    const context = await browser.newContext({viewport});
    const page = await context.newPage();
    const hits = [];
    await page.route('https://api.rokwilder.com/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/fullpass/data/')) hits.push(url.pathname);
      const headers = {'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'cache-control': 'no-store'};
      if (url.pathname === '/api/account') {
        await route.fulfill({status: 200, headers, contentType: 'application/json', body: JSON.stringify(account('pass'))});
        return;
      }
      await route.fulfill({status: 200, headers, contentType: 'application/json', body: JSON.stringify({ok: true, checkoutOpen: false, testMode: false})});
    });
    await page.goto(origin + '/idaho/general.html', {waitUntil: 'domcontentloaded'});
    await page.waitForSelector('h1');
    await page.waitForTimeout(500);
    ok(hits.length === 0, browserName + ' Idaho general page does not request the controlled-hunt file');
    const src = await page.locator('script[src*="rw.js"]').getAttribute('src');
    ok(src && src.includes('?v=20261114b'), browserName + ' general page loads the new rw.js');
    await context.close();
  }
}

const phone = {width: 390, height: 844};
const desk = {width: 1280, height: 800};

let webkitBrowser = null;
try { webkitBrowser = await webkit.launch(); }
catch (e) { console.log('WebKit launch failed: ' + e.message); }
if (!webkitBrowser) ok(false, 'WebKit was not available');
else {
  await run(webkitBrowser, 'webkit', phone, 'phone');
  await webkitBrowser.close();
}
const chromiumBrowser = await chromium.launch();
await run(chromiumBrowser, 'chromium', desk, 'desktop');
await chromiumBrowser.close();
server.close();

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
