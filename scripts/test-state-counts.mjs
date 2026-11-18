// Official tag and applicant files stay off the public site.
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const history = readFileSync(join(root, 'find/history-ui.js'), 'utf8');
ok(!history.includes('colorado-counts.json') && !/function loadCounts/.test(history), 'the hunt card does not fetch a counts file');

const dir = join(root, 'find/history');
const lists = readdirSync(dir).filter(name => name.endsWith('-counts.sources.json'));
ok(lists.length >= 3, 'source lists exist for the states that got counts');
for (const name of lists) {
  const text = readFileSync(join(dir, name), 'utf8');
  const data = JSON.parse(text);
  ok(data.counts === 'not in this file' && !data.hunts, name + ' has no counts');
  ok(!/–|—/.test(text), name + ' has no em dash or en dash');
  ok((data.sources || []).every(s => [s.page, s.pdf, s.url].some(v => typeof v === 'string' && /^https:\/\//.test(v))), name + ' sources are https');
}
ok(!existsSync(join(root, 'find/member/colorado-counts.json')), 'no public Colorado counts file');

function loadPrivate(file, code) {
  const path = join(root, 'private/fullpass', file);
  if (!existsSync(path)) {
    console.log('SKIP ' + file + ' is not in this checkout');
    return null;
  }
  const box = {RWQ: {}};
  box.window = box;
  vm.createContext(box);
  vm.runInContext(readFileSync(path, 'utf8'), box);
  return box.RWQ[code];
}

const ut = loadPrivate('ut-counts.js', 'ut');
if (ut) {
  const hunt = ut.hunts.EB3003;
  ok(hunt['2024'].quota === 13 && hunt['2024'].apps === 24, 'Meadowville 2024 matches the printed totals');
  ok(hunt['2025'].quota === 11 && hunt['2025'].apps === 26, 'Meadowville 2025 matches the printed totals');
}
const id = loadPrivate('id-counts.js', 'id');
if (id) {
  const hunt = id.hunts['elk-2001-1'];
  ok(hunt['2025'].quota === 40 && hunt['2025'].apps === 764, 'Idaho elk 2001 matches the 2025 API row');
  ok(hunt['2026'].quota === 40 && hunt['2026'].apps === 833, 'Idaho elk 2001 2026 quota stayed 40');
}
const nv = loadPrivate('nv-counts.js', 'nv');
if (nv) {
  const hunt = nv.hunts['deer|M|alw|main|res|011-013|oct-05-2025-nov-05-2025'];
  ok(hunt && hunt['2025'].quota === 40 && hunt['2025'].apps === 704, 'Nevada deer 011-013 matches the printed quota and first-choice total');
}

if (fails) { console.error(fails + ' failed'); process.exit(1); }
console.log('state counts passed');
