// Header, sale buttons, and login forward. Serves this repo and stubs api.rokwilder.com.
// Run: node scripts/test-header-checkout.mjs
// If playwright is not installed next to the site, set PLAYWRIGHT_PATH to its index.js.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
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

const server = http.createServer((req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = (u === '/' ? '/index.html' : u).replace(/^\/+/, '');
  const file = path.resolve(root, rel);
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403); res.end(); return;
  }
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

function catalog(open) {
  return {
    testMode: false,
    checkoutOpen: open,
    founding: {open: true, left: 199, limit: 200, ends: null},
    seasons: ['2027'],
    products: {
      fullpass: {name: 'UnitIQ Full Pass', amount: 2999, price: '$29.99/yr'},
      fullpass_founding: {name: 'UnitIQ Full Pass, Founding Hunter', amount: 1999, price: '$19.99/yr'}
    }
  };
}
function account(kind) {
  if (kind === 'out') return {loggedIn: false, testMode: false};
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

async function mockApi(page, state) {
  const posts = [];
  page._posts = posts;
  await page.route('https://api.rokwilder.com/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const reqOrigin = req.headers()['origin'] || origin;
    const headers = {
      'access-control-allow-origin': reqOrigin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'cache-control': 'no-store'
    };
    if (req.method() === 'OPTIONS') {
      await route.fulfill({status: 204, headers});
      return;
    }
    if (url.pathname === '/api/checkout' && req.method() === 'POST') {
      posts.push(req.postData() || '');
      if (!state.open) {
        await route.fulfill({status: 503, headers, contentType: 'application/json', body: JSON.stringify({error: 'Checkout is not open. Nothing was charged.'})});
        return;
      }
      if (state.kind === 'out') {
        await route.fulfill({status: 401, headers, contentType: 'application/json', body: JSON.stringify({error: 'Log in first.'})});
        return;
      }
      await route.fulfill({status: 200, headers, contentType: 'application/json', body: JSON.stringify({url: 'https://checkout.stripe.com/c/pay/cs_test_rw'})});
      return;
    }
    let body = {ok: true};
    if (url.pathname === '/api/catalog') body = catalog(state.open);
    else if (url.pathname === '/api/health') body = {ok: true, testMode: false, stripe: 'live', checkoutOpen: state.open};
    else if (url.pathname === '/api/account') body = account(state.kind);
    else if (url.pathname === '/api/spots') body = {cap: 10, left: 4};
    if (state.delayCatalog && url.pathname === '/api/catalog') await new Promise(r => setTimeout(r, state.delayCatalog));
    await route.fulfill({status: 200, headers, contentType: 'application/json', body: JSON.stringify(body)});
  });
  await page.route('https://checkout.stripe.com/**', route => route.fulfill({
    status: 200, contentType: 'text/html', body: '<title>Stripe</title><p>Stripe checkout</p>'
  }));
}

async function headerOk(page, label) {
  await page.waitForSelector('.rw-acct');
  await page.waitForSelector('.rw-cart');
  const vp = page.viewportSize();
  const scroll = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth
  }));
  ok(scroll.sw <= scroll.cw + 1, label + ' no horizontal scroll (' + scroll.sw + '<=' + scroll.cw + ')');
  const acct = await page.locator('.rw-acct').boundingBox();
  const cart = await page.locator('.rw-cart').boundingBox();
  const nav = await page.locator('header .nav').boundingBox();
  ok(!!acct && !!cart && !!nav, label + ' corner controls are in the header');
  if (!acct || !cart || !nav) return;
  ok(acct.y < 100, label + ' Log in / My account is in the top row (y=' + Math.round(acct.y) + ')');
  ok(acct.x >= 0 && acct.x + acct.width <= vp.width + 1, label + ' account button stays inside the screen');
  ok(cart.x >= 0 && cart.x + cart.width <= vp.width + 1, label + ' checkout control stays inside the screen');
  ok(cart.x + cart.width <= acct.x + 2, label + ' checkout sits left of the account button');
  ok(Math.abs((acct.x + acct.width) - (nav.x + nav.width)) < 30, label + ' account button is at the right edge of the header');
  const links = page.locator('header .nav > a.l');
  const n = await links.count();
  let hit = false;
  for (let i = 0; i < n; i++) {
    const b = await links.nth(i).boundingBox();
    if (!b) continue;
    const left = Math.min(cart.x, acct.x);
    const right = Math.max(cart.x + cart.width, acct.x + acct.width);
    const top = Math.min(cart.y, acct.y);
    const bottom = Math.max(cart.y + cart.height, acct.y + acct.height);
    const overlap = b.x < right - 1 && b.x + b.width > left + 1 && b.y < bottom - 1 && b.y + b.height > top + 1;
    if (overlap) hit = true;
  }
  ok(!hit, label + ' menu links do not cover the corner buttons');
}

async function shot(page, name) {
  const file = path.join(shots, name + '.png');
  await page.screenshot({path: file, fullPage: false});
  console.log('SHOT ' + file);
}

async function openPage(browser, viewport, state, url, init, opts) {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
    deviceScaleFactor: viewport.width < 500 ? 2 : 1
  });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  await mockApi(page, state);
  const nav = page.goto(origin + url, {waitUntil: 'domcontentloaded'}).catch(() => {});
  if (opts && opts.settle) {
    await page.waitForURL(opts.settle, {timeout: 8000});
  } else {
    await nav;
    await page.waitForSelector('.rw-acct');
  }
  return {context, page};
}

const phone = {width: 390, height: 844};
const desk = {width: 1280, height: 800};

async function run(browser, browserName) {
  const views = [['phone', phone], ['desktop', desk]];
  for (const [vname, viewport] of views) {
    const label = browserName + ' ' + vname;

    {
      const {context, page} = await openPage(browser, viewport, {open: false, kind: 'out'}, '/index.html');
      await headerOk(page, label + ' logged out');
      ok((await page.locator('.rw-acct').innerText()) === 'Log in', label + ' corner says Log in');
      ok((await page.locator('.rw-cart').getAttribute('href')) === '/pricing.html', label + ' checkout goes to pricing');
      const src = await page.locator('script[src*="rw.js"]').getAttribute('src');
      const css = await page.locator('link[href*="member.css"]').getAttribute('href');
      ok(src.includes('?v=20261114b'), label + ' rw.js is cache-busted (' + src + ')');
      ok(css.includes('?v=20261114'), label + ' member.css is cache-busted');
      if (browserName === 'webkit' && vname === 'phone') await shot(page, 'phone-header-logged-out');
      if (browserName === 'chromium' && vname === 'desktop') await shot(page, 'desktop-header-logged-out');
      await context.close();
    }

    {
      const {context, page} = await openPage(browser, viewport, {open: false, kind: 'in'}, '/index.html');
      await headerOk(page, label + ' logged in');
      ok((await page.locator('.rw-acct').innerText()) === 'My account', label + ' corner says My account');
      if (browserName === 'webkit' && vname === 'phone') await shot(page, 'phone-header-logged-in');
      if (browserName === 'chromium' && vname === 'desktop') await shot(page, 'desktop-header-logged-in');
      await context.close();
    }

    {
      const {context, page} = await openPage(browser, viewport, {open: false, kind: 'pass'}, '/pricing.html');
      await page.waitForFunction(() => {
        const el = document.querySelector('#fullpass [data-rw-sale="fullpass"]');
        return el && el.textContent.includes('You have the Full Pass');
      });
      await headerOk(page, label + ' full pass');
      const line = page.locator('[data-rw-state]');
      ok(await line.isHidden(), label + ' full pass hides the checkout-closed line');
      ok((await page.locator('#fullpass [data-rw-sale="fullpass"]').innerText()).includes('You have the Full Pass'), label + ' full pass button names the pass');
      await page.locator('#fullpass [data-rw-sale="fullpass"]').scrollIntoViewIfNeeded();
      if (browserName === 'webkit' && vname === 'phone') await shot(page, 'phone-header-full-pass');
      if (browserName === 'chromium' && vname === 'desktop') await shot(page, 'desktop-header-full-pass');
      const postsBefore = page._posts.length;
      await page.locator('#fullpass [data-rw-sale="fullpass"]').click();
      await page.waitForURL('**/account.html');
      ok(page._posts.length === postsBefore, label + ' full pass tap does not post checkout');
      ok((await page.locator('body').innerText()).includes('hunter@example.com'), label + ' account page shows the member');
      await context.close();
    }

    {
      const {context, page} = await openPage(browser, viewport, {open: false, kind: 'out'}, '/pricing.html');
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-rw-state]');
        return el && !el.hidden && el.textContent.trim() === 'Checkout is not open.';
      });
      ok((await page.locator('#fullpass [data-rw-sale="fullpass"]').innerText()).includes('Join the waitlist'), label + ' closed checkout keeps the waitlist label');
      const before = page._posts.length;
      await page.locator('#fullpass [data-rw-sale="fullpass"]').click();
      await page.waitForTimeout(300);
      ok(page._posts.length === before, label + ' closed tap does not post /api/checkout');
      ok(await page.locator('.rw-sale-note').innerText() === 'Checkout is not open.', label + ' closed tap says checkout is not open');
      await page.locator('#fullpass [data-rw-sale="fullpass"]').scrollIntoViewIfNeeded();
      if (browserName === 'webkit' && vname === 'phone') await shot(page, 'phone-pricing-closed');
      if (browserName === 'chromium' && vname === 'desktop') await shot(page, 'desktop-pricing-closed');
      await context.close();
    }

    {
      const {context, page} = await openPage(browser, viewport, {open: true, kind: 'out'}, '/pricing.html');
      await page.waitForFunction(() => {
        const el = document.querySelector('#fullpass [data-rw-sale="fullpass"]');
        return el && el.textContent.includes('Get the Full Pass');
      });
      ok(await page.locator('[data-rw-state]').isHidden(), label + ' open checkout hides the closed line');
      await page.locator('#fullpass [data-rw-sale="fullpass"]').scrollIntoViewIfNeeded();
      if (browserName === 'webkit' && vname === 'phone') await shot(page, 'phone-pricing-open');
      if (browserName === 'chromium' && vname === 'desktop') await shot(page, 'desktop-pricing-open');
      await page.locator('#fullpass [data-rw-sale="fullpass"]').click();
      await page.waitForURL('**/login.html**');
      ok(page.url().includes('next=') && decodeURIComponent(page.url()).includes('buy=fullpass'), label + ' logged-out buy goes to login with next');
      ok(page._posts.length === 0, label + ' logged-out buy does not post yet');
      await context.close();
    }

    {
      const {context, page} = await openPage(browser, viewport, {open: true, kind: 'in'}, '/pricing.html');
      await page.waitForFunction(() => {
        const el = document.querySelector('#fullpass [data-rw-sale="fullpass"]');
        return el && el.textContent.includes('Get the Full Pass');
      });
      await page.locator('#fullpass [data-rw-sale="fullpass"]').click();
      await page.waitForURL('**/checkout.stripe.com/**');
      ok(page._posts.length === 1 && page._posts[0].includes('"product":"fullpass"'), label + ' logged-in buy posts /api/checkout for the Full Pass');
      await context.close();
    }
  }

  // Tap before the catalog reply. The old button was a waitlist link until that reply landed.
  {
    const {context, page} = await openPage(browser, phone, {open: true, kind: 'in', delayCatalog: 900}, '/pricing.html');
    await page.locator('#fullpass [data-rw-sale="fullpass"]').click();
    await page.waitForURL('**/checkout.stripe.com/**', {timeout: 8000});
    ok(page._posts.some(p => p.includes('"product":"fullpass"')), browserName + ' early tap still posts checkout');
    await context.close();
  }

  {
    const {context, page} = await openPage(browser, phone, {open: true, kind: 'in'}, '/packages.html');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-rw-founding]');
      return el && el.textContent.includes('Get the Founding Hunter price');
    });
    await page.locator('[data-rw-founding]').click();
    await page.waitForURL('**/checkout.stripe.com/**');
    ok(page._posts.some(p => p.includes('"product":"fullpass"')), browserName + ' Founders button posts checkout');
    await context.close();
  }

  {
    const {context, page} = await openPage(browser, phone, {open: true, kind: 'in'}, '/login.html?next=' + encodeURIComponent('/account.html'));
    await page.waitForURL('**/account.html');
    await page.waitForFunction(() => document.body.innerText.includes('hunter@example.com'));
    ok(!page.url().includes('login.html'), browserName + ' login forwards a member who is already in');
    if (browserName === 'webkit') await shot(page, 'phone-login-forward');
    await context.close();
  }

  {
    const {context, page} = await openPage(browser, phone, {open: true, kind: 'in'}, '/login.html?next=' + encodeURIComponent('/pricing.html?buy=fullpass#fullpass'), null, {settle: '**/checkout.stripe.com/**'});
    ok(page._posts.some(p => p.includes('"product":"fullpass"')), browserName + ' login next resumes the Full Pass checkout');
    await context.close();
  }

  {
    const init = () => sessionStorage.setItem('rw-buy', JSON.stringify({product: 'fullpass', href: '/pricing.html?buy=fullpass#fullpass'}));
    const {context, page} = await openPage(browser, phone, {open: true, kind: 'out'}, '/index.html', init);
    const href = await page.locator('.rw-cart').getAttribute('href');
    ok(href && href.includes('buy=fullpass'), browserName + ' checkout corner resumes a buy in progress (' + href + ')');
    await context.close();
  }
}

let webkitBrowser = null;
try {
  webkitBrowser = await webkit.launch();
} catch (e) {
  console.log('WebKit launch failed: ' + e.message);
}
const chromiumBrowser = await chromium.launch();

if (webkitBrowser) {
  await run(webkitBrowser, 'webkit');
  await webkitBrowser.close();
}
await run(chromiumBrowser, 'chromium');
await chromiumBrowser.close();
server.close();

if (!webkitBrowser) ok(false, 'WebKit was not available');
if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
