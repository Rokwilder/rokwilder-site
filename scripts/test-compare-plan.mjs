// Full Pass comparison and season planner.
// Stubs /api/account and /api/fullpass/data/{co,ut}.js with sample counts.
// Those counts are mocks, not agency reports. The page labels them mock.
// Run: node scripts/test-compare-plan.mjs
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
const {chromium} = pwMod.chromium ? pwMod : pwMod.default;

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

function inside(band) {
  if (band >= 0.995) return 1;
  if (band >= 0.75) return 0.82;
  if (band >= 0.25) return 0.4;
  if (band >= 0.05) return 0.12;
  return 0.02;
}
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const coBands = {
  EE012O1A: {2024: 0.75, 2025: 0.25, 2026: 0.25},
  EE083O3R: {2024: 0.25, 2025: 0.25, 2026: 0.75}
};
function exactHunts(bands) {
  const hunts = {};
  for (const [k, years] of Object.entries(bands)) {
    const res = {};
    for (const [y, band] of Object.entries(years)) res[y] = {0: inside(band)};
    hunts[k] = {res};
  }
  return hunts;
}
const coPatch = `
window.RWHyExact={hunts:${JSON.stringify(exactHunts(coBands))}};
window.RWQ={co:{years:[2024,2025,2026],hunts:{
  EE012O1A:{2024:{quota:20,apps:180},2025:{quota:18,apps:210},2026:{quota:16,apps:240}},
  EE083O3R:{2024:{quota:30,apps:90},2025:{quota:28,apps:70},2026:{quota:32,apps:60}}
}}};
D.EE012O1A[7]=18; D.EE083O3R[7]=22;
if(typeof FL!=='undefined'){ if(FL.EE012O1A) FL.EE012O1A[1]=80; if(FL.EE083O3R) FL.EE083O3R[1]=140; }
D.EE012O1A[6]=[[2024,20,180],[2025,18,210],[2026,16,240]];
D.EE083O3R[6]=[[2024,30,90],[2025,28,70],[2026,32,60]];
`;
const coStub = 'window.RW_FP=true;window.RW_MOCK=true;\n'
  + ['drawodds/lite.js','drawodds/youth.js','find/labels.js','drawodds/oial.js'].map(read).join('\n')
  + '\n' + coPatch;

const utHist = JSON.parse(read('find/history/utah.json'));
const utYears = (utHist.hunts.EB3039 && utHist.hunts.EB3039.res && utHist.hunts.EB3039.res.y) || {};
const utExact = {};
for (const [y, row] of Object.entries(utYears)) {
  if (row && typeof row['0'] === 'number') utExact[y] = {0: inside(row['0'])};
}
const utPatch = `
window.RWHyExact={hunts:{EB3039:{res:${JSON.stringify(utExact)}}}};
window.RWQ={ut:{years:[2023,2024,2025],hunts:{EB3039:{2025:{quota:8,apps:40}}}}};
if(UH.EB3039){
  UH.EB3039.hv=[null,40,null,62];
  const fill=side=>{if(!side)return; side.raw={"0":[40,8,4,4,0]}; side.q=8; side.mp=4; side.rg=4;};
  fill(UH.EB3039.d&&UH.EB3039.d.res);
  fill(UH.EB3039.d&&UH.EB3039.d.nonres);
}
`;
const utStub = 'window.RW_FP=true;window.RW_MOCK=true;\n' + read('utah/data.js') + '\n' + utPatch;
const stubs = {co: coStub, ut: utStub};

let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const dates = JSON.parse(read('find/dates.json'));
const dateText = read('find/dates.json');
ok(!/[—–]/.test(dateText + read('find/tools.js') + read('find/plan-logic.js')), 'new copy has no em dash or en dash');
for (const code of ['co','ut','az','wy','id','nv','mt','nm']) {
  const st = dates.states[code];
  ok(st && st.source && /^https:\/\//.test(st.source.url), code + ' has an https source');
  ok(st && Array.isArray(st.apply) && st.apply.length > 0, code + ' has an application window');
  ok(st && Array.isArray(st.results), code + ' has a results field');
}

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

function account(pass) {
  return {
    loggedIn: !!pass,
    testMode: false,
    email: pass ? 'hunter@example.com' : '',
    canManageBilling: false,
    packages: [],
    fullpass: pass
      ? {active: true, states: ['ALL'], founding: false, renews: true, ends: 1893456000}
      : {active: false, states: []}
  };
}

async function routeApi(page, pass) {
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
      const code = url.pathname.split('/').pop().replace('.js', '');
      if (pass && stubs[code]) {
        await route.fulfill({status: 200, headers, contentType: 'text/javascript', body: stubs[code]});
        return;
      }
      await route.fulfill({status: 404, headers, contentType: 'text/plain', body: 'missing'});
      return;
    }
    if (url.pathname === '/api/account') {
      await route.fulfill({status: 200, headers, contentType: 'application/json', body: JSON.stringify(account(pass))});
      return;
    }
    if (url.pathname === '/api/catalog' || url.pathname === '/api/health') {
      await route.fulfill({status: 200, headers, contentType: 'application/json', body: JSON.stringify({checkoutOpen: false, testMode: false})});
      return;
    }
    await route.fulfill({status: 404, headers, contentType: 'text/plain', body: 'no'});
  });
}

async function shot(page, name) {
  const file = path.join(shots, name + '.png');
  await page.addStyleTag({content:'header{position:static !important}'}).catch(()=>{});
  const box = page.locator('#rwtools');
  if (await box.count()) {
    await box.scrollIntoViewIfNeeded();
    await box.screenshot({path: file});
  } else await page.screenshot({path: file, fullPage: false});
  return file;
}

async function addHunt(page, url, n) {
  await page.goto(origin + url, {waitUntil: 'domcontentloaded'});
  const btn = page.locator('#detail .pkadd, .pkadd').first();
  await btn.waitFor({timeout: 30000});
  await btn.click();
  await page.waitForFunction(need => {
    const raw = localStorage.getItem('rw_hunt_picks');
    const count = raw ? JSON.parse(raw).picks.length : 0;
    return count >= need;
  }, n, {timeout: 20000});
  await page.locator('#rwtools').waitFor();
}

const desktop = {width: 1280, height: 900};
const phone = {width: 390, height: 844};

async function memberFlow(viewport, tag) {
  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
    deviceScaleFactor: viewport.width < 500 ? 2 : 1
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.stack || String(err)));
  await routeApi(page, true);
  await addHunt(page, '/find.html?sp=elk&h=EE012O1A', 1);
  await addHunt(page, '/find.html?sp=elk&h=EE083O3R', 2);
  await addHunt(page, '/utah/find.html?sp=elk&pl=elk-le&h=EB3039', 3);
  await page.locator('#rwcompare').waitFor();
  const text = await page.locator('#rwtools').innerText();
  ok(/Mock numbers/.test(text), tag + ' labels mock numbers');
  ok(/easier to draw/.test(text), tag + ' says which hunt is easier to draw');
  ok(/Not published/.test(text), tag + ' shows Not published where a field is missing');
  ok(/\(mock\)/.test(text), tag + ' marks a mock percent');
  ok(!/[—–]/.test(text), tag + ' comparison copy has no dash glyph');
  await shot(page, 'finder-compare-' + tag);
  await page.locator('[data-rwt="dates"]').click();
  await page.locator('#rwdates').waitFor();
  const datesText = await page.locator('#rwtools').innerText();
  ok(/These hunts overlap/.test(datesText), tag + ' flags overlapping seasons');
  ok(/2026 dates, 2027 not posted yet/.test(datesText), tag + ' labels the posted year');
  ok(/Not published/.test(datesText), tag + ' season gap stays Not published');
  await shot(page, 'finder-dates-' + tag);
  const picks = await page.evaluate(() => JSON.parse(localStorage.getItem('rw_hunt_picks')).picks.length);
  ok(picks === 3, tag + ' saved 3 picks');

  await page.goto(origin + '/member/app.html?state=co', {waitUntil: 'domcontentloaded'});
  const frame = page.frameLocator('#view');
  await frame.locator('#rwtools').waitFor({timeout: 20000});
  await frame.locator('#rwcompare .cmpt, #rwcompare .cmpcard').first().waitFor({timeout: 20000});
  await frame.locator('#rwtools').evaluate(el => el.scrollIntoView({block:'start'}));
  await page.evaluate(() => { const v = document.getElementById('view'); if (v) v.style.height = '920px'; });
  await page.screenshot({path: path.join(shots, 'app-compare-' + tag + '.png'), fullPage: false});
  const appText = await frame.locator('#rwtools').innerText();
  ok(/easier to draw/.test(appText), tag + ' app shows the same comparison');
  ok(/Mock numbers/.test(appText), tag + ' app still labels mock numbers');
  await frame.locator('[data-rwt="dates"]').click();
  await frame.locator('#rwdates .overlap, #rwdates .dq').first().waitFor();
  await frame.locator('#rwtools').evaluate(el => el.scrollIntoView({block:'start'}));
  await page.screenshot({path: path.join(shots, 'app-dates-' + tag + '.png'), fullPage: false});
  const appDates = await frame.locator('#rwtools').innerText();
  ok(/These hunts overlap/.test(appDates), tag + ' app flags the overlap');
  ok(errors.length === 0, tag + ' has no page errors ' + errors.join(' | '));
  await browser.close();
}

async function freeFlow(viewport, tag) {
  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
    deviceScaleFactor: viewport.width < 500 ? 2 : 1
  });
  const page = await context.newPage();
  await routeApi(page, false);
  await page.goto(origin + '/find.html?sp=elk', {waitUntil: 'domcontentloaded'});
  await page.locator('#rwlock').waitFor({timeout: 20000});
  const locked = await page.locator('#rwtools').innerText();
  ok(/Full Pass/.test(locked), tag + ' free view is the locked teaser');
  ok(!/82%/.test(locked) && !/Mock numbers/.test(locked), tag + ' free view does not show member numbers');
  const before = await page.evaluate(() => localStorage.getItem('rw_hunt_picks'));
  const card = page.locator('.pkadd').first();
  if (await card.count()) await card.click();
  const after = await page.evaluate(() => localStorage.getItem('rw_hunt_picks'));
  ok(before == null && after == null, tag + ' free add does not save a pick');
  await shot(page, 'free-locked-' + tag);
  await page.goto(origin + '/member/app.html?state=co', {waitUntil: 'domcontentloaded'});
  const frame = page.frameLocator('#view');
  await frame.locator('#rwlock').waitFor({timeout: 20000});
  await page.evaluate(() => { const v = document.getElementById('view'); if (v) v.style.height = '900px'; });
  await page.screenshot({path: path.join(shots, 'app-free-locked-' + tag + '.png'), fullPage: false});
  await browser.close();
}

async function seasonProof(viewport, tag) {
  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
    deviceScaleFactor: viewport.width < 500 ? 2 : 1
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.stack || String(err)));
  await routeApi(page, true);
  async function showDates(fragment) {
    await page.locator('[data-rwt="dates"]').click();
    await page.locator('#rwdates').getByText(fragment).first().waitFor({timeout: 20000});
  }
  await addHunt(page, '/find.html?sp=elk&h=EE012O1A', 1);
  await showDates('Sep 2 to Sep 30, 2026');
  await shot(page, 'co-archery-dates-' + tag);
  await addHunt(page, '/find.html?sp=elk&h=EE083O1M', 2);
  await showDates('Sep 12 to Sep 20, 2026');
  await shot(page, 'co-muzzle-dates-' + tag);
  await addHunt(page, '/wyoming/find.html?sp=elk&k=elk-001-1', 3);
  await showDates('Sep 1 to Sep 30, 2026');
  const text = await page.locator('#rwtools').innerText();
  ok(/Sep 2 to Sep 30, 2026/.test(text) && /Sep 12 to Sep 20, 2026/.test(text), tag + ' Colorado archery and muzzleloader dates are on the timeline');
  ok(/Sep 1 to Sep 30, 2026/.test(text) && /Oct 15, 2026 to Nov 30, 2026/.test(text), tag + ' Wyoming hunt dates are on the timeline');
  ok(/Mock numbers/.test(text), tag + ' mock odds stay labeled');
  ok(!/[—–]/.test(text), tag + ' season timeline has no dash glyph');
  await shot(page, 'co-wy-timeline-' + tag);
  ok(errors.length === 0, tag + ' season proof has no page errors ' + errors.join(' | '));
  await browser.close();
}

await memberFlow(desktop, 'desktop');
await memberFlow(phone, 'phone');
await freeFlow(desktop, 'desktop');
await freeFlow(phone, 'phone');
await seasonProof(desktop, 'desktop');
await seasonProof(phone, 'phone');

server.close();
if (fails) { console.error(fails + ' failed'); process.exit(1); }
console.log('compare and planner passed');
