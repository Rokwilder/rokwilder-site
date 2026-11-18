// History window: last year, 2-year average, 3-year average. Bands only. No percents.
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const store = new Map();
const context = {
  localStorage: {
    getItem: k => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v))
  },
  document: {
    currentScript: {dataset: {}},
    documentElement: {},
    getElementById(){ return null; },
    querySelector(){ return null; },
    querySelectorAll(){ return []; }
  }
};
context.window = context;
vm.createContext(context);
vm.runInContext(readFileSync(join(root, 'find/history-ui.js'), 'utf8'), context, {filename: 'find/history-ui.js'});
const H = context.RWHy;
const say = v => ({1:'YES', 0.75:'LIKELY', 0.25:'MAYBE', 0.05:'LONG SHOT', 0.01:'RARE', 0:'NONE'}[v] || 'WORD');

ok(H.span() === 1, 'last year is the default');
ok(H.setSpan('3') === 3 && H.span() === 3, 'the choice is stored');
ok(H.setSpan('nope') === 1 && H.span() === 1, 'a bad stored value falls back to last year');
H.setSpan('2');
ok(H.span() === 2, '2-year average is remembered');
store.clear();

const three = {years:{2024:0.25, 2025:0.25, 2026:0.05}, avg:0.25, n:3};
ok(H.windowOf(three, 1).label === '2026 draw' && H.windowOf(three, 1).band === 0.05, 'last year is the newest year on the hunt');
ok(H.windowOf(three, 3).label === '3-yr avg' && H.windowOf(three, 3).band === 0.25, 'three published years keep that average');
ok(H.windowOf(three, 2).band == null && /not published/.test(H.windowOf(three, 2).label), 'a 2-year average is not invented when the years differ');

const matched = {years:{2024:0.75, 2025:0.25, 2026:0.25}, avg:0.25, n:3};
ok(H.windowOf(matched, 2).label === '2-yr avg' && H.windowOf(matched, 2).band === 0.25, 'two years in one band are that band');

const two = {years:{2025:0.75, 2026:0.05}, avg:0.25, n:2};
const short = H.windowOf(two, 3);
ok(short.band === 0.25 && short.label === '2-yr avg (only 2 years available)', 'two years are labeled when a 3-year average was asked for');
ok(H.windowOf(two, 1).year === '2026', 'last year on a short hunt is still the newest year');

const one = {years:{2026:0.75}, avg:null, n:1};
ok(H.windowOf(one, 1).label === '2026 draw' && H.windowOf(one, 3).label === '2026 draw (only 1 year available)', 'one year is not called an average');

const later = {years:{2024:0.25, 2025:0.25, 2026:0.05, 2027:1}, avg:null, n:0};
ok(H.windowOf(later, 1).label === '2027 draw' && H.windowOf(later, 1).band === 1, 'a newer year in the file becomes last year without a code change');

const fourSame = {years:{2023:0.75, 2024:0.75, 2025:0.75, 2026:0.75}, avg:0.75, n:4};
ok(H.windowOf(fourSame, 3).label === '3-yr avg' && H.windowOf(fourSame, 3).band === 0.75, 'three matching years inside a longer file are a 3-year average');
const fourMix = {years:{2023:1, 2024:0.25, 2025:0.75, 2026:0.05}, avg:0.25, n:4};
const wide = H.windowOf(fourMix, 3);
ok(wide.band == null && /not published/.test(wide.label) && /4 years/.test(wide.label), 'four different years are not relabeled as a 3-year average');

const head = H.windowOf(three, 1);
const avg = H.windowOf(three, 3);
ok(H.hintText(head, avg, head) === 'Harder to draw than the 3-yr average', 'a worse last year says harder');
ok(H.hintText(H.windowOf({years:{2026:1}, n:1}, 1), H.windowOf({years:{2024:0.25,2025:0.25,2026:1}, avg:0.75, n:3}, 3), H.windowOf({years:{2026:1}, n:1}, 1)) === 'Easier than the 3-yr average', 'a better last year says easier');
ok(H.hintText(avg, avg, head) === 'Last year was harder to draw than this average', 'when the average is the headline, the hint names last year');
ok(H.hintText(head, head, head) === '', 'the same band has no trend hint');
ok(H.hintText(head, short, head) === '', 'a short average does not get the 3-year hint');

const line = H.formatLine(head, say);
const sub = H.formatLine(avg, say);
ok(line === '2026 draw: LONG SHOT' && sub === '3-yr avg: MAYBE', 'the lines name the year and the average');
ok(!/%/.test(line + sub + wide.label + short.label), 'the public lines have no percent sign');
const Season = context.RWSeason;
ok(Season.maxYear('CPW 2026') + 1 === 2027, 'the estimate year is one year after the brochure year already named');
ok(Season.maxYear('draw2026 and harvest2025') === 2026, 'a year glued to a word still counts');
ok(Season.label(2027, 'estimate', 'MAYBE') === '2027 estimate: MAYBE', 'estimate line names the season and the band');
ok(Season.label(2026, 'result', 'MOST DREW') === '2026 result: MOST DREW', 'a published result is not called an estimate');
ok(Season.label(null, 'estimate', 'MAYBE') === 'MAYBE', 'a missing year leaves the band unlabeled');
ok(!/—|–/.test(Season.label(2027, 'estimate', 'MAYBE')), 'the season label has no em dash or en dash');
const years=[{year:'2026',band:0.25},{year:'2025',band:0.75},{year:'2024',band:0.75}];
const bandSay=v=>({0.25:'MAYBE',0.75:'LIKELY'}[v]);
const listed=H.yearLine(years, bandSay, false, {'2026':0.12,'2025':0.4,'2024':0.55});
ok(listed==='2026: MAYBE, 2025: LIKELY, 2024: LIKELY', 'free year line is bands, newest first');
ok(!/%/.test(listed), 'free year line has no percent even if rates are nearby');
const member=H.yearLine(years, bandSay, true, {'2026':0.12,'2025':0.4,'2024':0.55});
ok(member==='2026: 12%, 2025: 40%, 2024: 55%', 'a member file can show each year as a percent');
ok(H.trendWord('Getting harder')==='Getting harder' && H.trendWord('Holding steady')==='Steady', 'trend words stay plain');
ok(H.trendWord('Up and down')==='' && H.trendWord('One year stood out')==='', 'an unclear trend is left off');
ok(H.reasonText([{year:2025,tags:120},{year:2026,tags:90}])==='Tags cut from 120 to 90', 'a quota drop is named from the counts');
ok(H.reasonText([{year:2025,apps:100},{year:2026,apps:130}])==='Applicants up 30%', 'an applicant change uses the two official counts');
ok(H.reasonText([{year:2026,tags:90}])==='', 'one year is not a reason');
ok(H.reasonText([{year:2025,tags:50,apps:52},{year:2026,tags:50,apps:74}])==='Applicants up 42%', 'unchanged tags leave the applicant change');
const historySrc = readFileSync(join(root, 'find/history-ui.js'), 'utf8');
ok(!historySrc.includes('colorado-counts.json') && !/function loadCounts/.test(historySrc), 'the public page does not fetch a counts file');
ok(!existsSync(join(root, 'find/member/colorado-counts.json')), 'the counts file is not in the public site');
const sources = JSON.parse(readFileSync(join(root, 'find/history/colorado-counts.sources.json'), 'utf8'));
ok(sources.counts === 'not in this file' && !sources.hunts, 'the public source list has no counts');
ok(sources.sources.every(s => /^https:\/\//.test(s.page) && /^https:\/\//.test(s.pdf)), 'count sources are https');
const privateCounts = join(root, 'private/fullpass/co-counts.js');
if (existsSync(privateCounts)) {
  const box = {RWQ: {co: {years: [2023], hunts: {EM039O3R: {'2026': {quota: 1, drawn: 9}}}}}};
  box.window = box;
  vm.createContext(box);
  vm.runInContext(readFileSync(privateCounts, 'utf8'), box);
  const unit39 = box.RWQ.co.hunts.EM039O3R;
  ok(unit39['2026'].quota === 1 && unit39['2026'].drawn === 9 && unit39['2026'].apps === 74, 'a count merge keeps a quota and a drawn count already on the hunt');
  ok(unit39['2024'].quota === 50 && unit39['2024'].apps === 46, 'unit 39 2024 quota and applicants match the recap check');
  ok(unit39['2025'].quota === 50 && unit39['2025'].apps === 52, 'unit 39 2025 quota and applicants match the recap check');
  ok(box.RWQ.co.hunts.BE001O1A['2026'].quota === 5 && box.RWQ.co.hunts.BE001O1A['2026'].apps === 5, 'bear 1 2026 matches the printed 5 tags and 5 first-choice applicants');
} else {
  console.log('SKIP private count file is not in this checkout');
}
ok(!/—|–/.test(readFileSync(join(root, 'find/history-ui.js'), 'utf8') + readFileSync(join(root, 'find/draw-sort.js'), 'utf8')), 'new copy has no em dash or en dash');

const sortSrc = readFileSync(join(root, 'find/draw-sort.js'), 'utf8');
const box = {window: {RWHy: {band(){ return null; }}}};
box.window.window = box.window;
vm.createContext(box.window);
vm.runInContext(sortSrc, box.window, {filename: 'find/draw-sort.js'});
const rows = [{k:'b', v:0.25}, {k:'a', v:0.75}, {k:'c', v:0.25}];
const tie = (a, b) => a.k < b.k ? -1 : a.k > b.k ? 1 : 0;
const plain = box.window.RWDraw.byDraw(rows, () => null, r => r.v, tie);
ok(plain.map(r => r.k).join('') === 'abc', 'with no history band, odds order and the tie stay put');
box.window.RWHy.band = k => ({a:0.05, b:0.75, c:0.75}[k]);
const picked = box.window.RWDraw.byDraw(rows, r => box.window.RWHy.band(r.k), r => r.v, tie);
ok(picked.map(r => r.k).join('') === 'bca', 'the selected window sorts the list, equal bands keep the tie');

if (fails) { console.error(fails + ' FAIL'); process.exit(1); }
console.log('ALL PASS');
