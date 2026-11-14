// Finder preview: unit filter, tie order, tag history, free view.
// Stubs the member API. Exact tag counts come from private/fullpass/co-quotas.js,
// which is not served as a public file.
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {existsSync, readFileSync, mkdirSync} from 'node:fs';
import {extname, join, normalize} from 'node:path';

const require = createRequire(import.meta.url);
const playwrightPath = existsSync('/tmp/pw/node_modules/playwright/index.js') ? '/tmp/pw/node_modules/playwright/index.js' : 'playwright';
const {chromium, webkit} = require(playwrightPath);

const root = new URL('..', import.meta.url).pathname;
const outDir = '/opt/cursor/artifacts';
mkdirSync(outDir, {recursive:true});
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon'};
const quota = readFileSync(join(root, 'private/fullpass/co-quotas.js'));
const coJs = Buffer.concat([
  readFileSync(join(root, 'drawodds/lite.js')), Buffer.from('\n'),
  readFileSync(join(root, 'drawodds/youth.js')), Buffer.from('\n'),
  readFileSync(join(root, 'find/labels.js')), Buffer.from('\n'),
  readFileSync(join(root, 'drawodds/oial.js')), Buffer.from('\n'),
  quota
]);

function start(){
  return new Promise(resolve => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let path = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      if (path.endsWith('/')) path += 'index.html';
      const file = normalize(join(root, path));
      if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
      try {
        const body = readFileSync(file);
        res.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
        res.end(body);
      } catch {
        res.writeHead(404); res.end('missing');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function stub(page, pass){
  const account = pass
    ? {loggedIn:true, fullpass:{active:true, states:['ALL']}}
    : {loggedIn:false};
  page.route('**/api/account**', route => route.fulfill({json:account}));
  page.route('**/api/catalog**', route => route.fulfill({json:{checkoutOpen:false}}));
  page.route('**/api/health**', route => route.fulfill({json:{checkoutOpen:false}}));
  page.route('**/api/fullpass/data/co.js**', route => route.fulfill({
    status: pass ? 200 : 404,
    contentType: 'text/javascript',
    body: pass ? coJs : ' '
  }));
}

async function reveal(page, sel){
  await page.evaluate(sel => {
    const el = document.querySelector(sel);
    const header = document.querySelector('header');
    const bar = header && getComputedStyle(header).position === 'sticky' ? header.offsetHeight : 0;
    const y = el.getBoundingClientRect().top + window.scrollY - bar - 10;
    window.scrollTo(0, Math.max(0, y));
  }, sel);
}
async function shot(page, name){
  const file = join(outDir, name);
  await page.screenshot({path:file, fullPage:false});
  console.log('shot', file);
  return file;
}

const deer = 'sp=deer&r=res&p=0&w=R&se=3&sx=M';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const server = await start();
const port = server.address().port;
const base = 'http://127.0.0.1:' + port + '/find.html';

let phoneType = webkit;
try {
  const probe = await webkit.launch();
  await probe.close();
} catch (err) {
  console.log('WebKit unavailable, using Chromium at 390x844:', err.message.split('\n')[0]);
  phoneType = chromium;
}

const phone = await phoneType.launch();
const desk = await chromium.launch();

try {
  const pctx = await phone.newContext({viewport:{width:390, height:844}});
  const pp = await pctx.newPage();
  await stub(pp, true);
  await pp.goto(base + '?' + deer + '&unit=60', {waitUntil:'domcontentloaded'});
  await pp.waitForSelector('#out .fh', {timeout:20000});
  const unitVal = await pp.inputValue('#unitq');
  ok(unitVal === '60', 'phone unit box is 60');
  const filtered = await pp.evaluate(() => [...document.querySelectorAll('#out .fh')].map(el => {
    const k = el.dataset.k;
    const units = (typeof FL !== 'undefined' && FL[k] && FL[k][2]) || [D[k][1]];
    return {k, hit: RWUnit.hit(units, '60'), text: el.innerText};
  }));
  ok(filtered.length > 0 && filtered.every(r => r.hit), 'phone list is only hunts that include unit 60 (' + filtered.map(r => r.k).join(', ') + ')');
  ok(filtered.some(r => r.k === 'DM060O3R'), 'DM060O3R is in the unit 60 list');
  await reveal(pp, '#out .fh');
  await shot(pp, 'phone-unit-60-deer.png');
  await reveal(pp, '#unitq');
  await shot(pp, 'phone-unit-60-box.png');

  await pp.goto(base + '?' + deer + '&unit=60&h=DM060O3R', {waitUntil:'domcontentloaded'});
  await pp.waitForSelector('.qhist', {timeout:20000});
  const tags = await pp.locator('.qhist').innerText();
  ok(tags.includes('2024') && tags.includes('70 tags') && tags.includes('2026') && tags.includes('120 tags'), 'unit 60 detail shows 70 then 120 tags');
  ok(tags.includes('Tags up 71% from 2025.'), 'trend says tags up 71% from 2025');
  ok(tags.includes('Hunters afield: not available'), 'missing hunters afield say not available');
  await reveal(pp, '.qhist');
  await shot(pp, 'phone-unit-60-tags.png');

  const fctx = await phone.newContext({viewport:{width:390, height:844}});
  const fp = await fctx.newPage();
  await stub(fp, false);
  await fp.goto(base + '?' + deer + '&unit=60', {waitUntil:'domcontentloaded'});
  await fp.waitForSelector('#out h2', {timeout:20000});
  const freeText = await fp.locator('#out').innerText();
  ok(!freeText.includes('120 tags') && !freeText.includes('70 tags'), 'free unit 60 list has no tag counts');
  ok(/you could draw/i.test(freeText), 'free list shows the count');
  await reveal(fp, '#out h2');
  await shot(fp, 'phone-free-unit-60.png');
  await fp.goto(base + '?' + deer + '&h=DM012O3R', {waitUntil:'domcontentloaded'});
  await fp.waitForSelector('#detail .fpx, #detail .note', {timeout:20000});
  const freeDetail = await fp.locator('#detail').innerText();
  ok(freeDetail.includes('Tags each year, and hunters afield: Full Pass.'), 'free detail locks tag counts');
  ok(!freeDetail.includes('120 tags') && !freeDetail.includes('70 tags'), 'free detail has no tag counts');
  await reveal(fp, '#detail .yo, #detail h2, #detail .fv');
  await shot(fp, 'phone-free-detail.png');
  await fctx.close();
  await pctx.close();

  const dctx = await desk.newContext({viewport:{width:1280, height:800}});
  const dp = await dctx.newPage();
  await stub(dp, true);
  await dp.goto(base + '?' + deer, {waitUntil:'domcontentloaded'});
  await dp.waitForSelector('#out .fh', {timeout:20000});
  const order = await dp.evaluate(() => [...document.querySelectorAll('#out .fh')].map(el => {
    const k = el.dataset.k;
    const units = (typeof FL !== 'undefined' && FL[k] && FL[k][2]) || [D[k][1]];
    return {k, v: window.__FY.odds(k), u: RWUnit.sortNum(units)};
  }));
  let tied = true;
  for (let i = 1; i < order.length; i++) {
    if (order[i].v !== order[0].v) break;
    if (order[i].u < order[i - 1].u) tied = false;
  }
  const top = order.filter(r => r.v === order[0].v);
  ok(top.length >= 2 && tied, 'tied hunts are in unit order: ' + top.map(r => r.k + '@' + r.u).join(', '));
  await dp.evaluate(() => {
    document.querySelectorAll('#out .fl > li').forEach((li, i) => { if (i > 3) li.style.display = 'none'; });
  });
  await reveal(dp, '#out h2');
  await dp.locator('#out').screenshot({path:join(outDir, 'desktop-tie-order.png')});
  console.log('shot', join(outDir, 'desktop-tie-order.png'));
  await dp.goto(base + '?' + deer + '&unit=60&h=DM060O3R', {waitUntil:'domcontentloaded'});
  await dp.waitForSelector('.qhist', {timeout:20000});
  await reveal(dp, '.qhist');
  await shot(dp, 'desktop-unit-60-tags.png');
  await dctx.close();
} finally {
  await phone.close();
  await desk.close();
  server.close();
}

if (fails) { console.error(fails + ' failed'); process.exit(1); }
console.log('preview passed');
