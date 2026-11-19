// Build find/season-dates.json from the 2026 CPW brochure and the 2026 WGFD
// season chapters. A hunt is included only when a table row names it.
// Run: node scripts/build-season-dates.mjs
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cpwPdf = process.env.CPW_PDF || '/tmp/cpw-2026-biggame.pdf';
const wyDir = process.env.WY_PDF_DIR || '/tmp/wy';

const MON = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)';
const DATE_RE = new RegExp(MONTH+'\\.?\\s*\\d{1,2}(?:\\s*-\\s*(?:'+MONTH+'\\.?\\s*)?\\d{1,2})?', 'gi');
const CODE_RE = /\b([A-Z])-([A-Z])-(\d{3})-([A-Z0-9]{2})-([A-Z])\b/;

function iso(y, m, d){
  if(!y||m<1||m>12||d<1||d>31) return null;
  const dt = new Date(Date.UTC(y, m-1, d));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d) return null;
  return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
function monthOf(word){
  return MON[String(word||'').toLowerCase().replace(/\./g,'').slice(0,4).replace(/^sept$/,'sept')] || MON[String(word||'').toLowerCase().replace(/\./g,'').slice(0,3)] || null;
}
function rangeOf(token, year){
  const raw = String(token).replace(/\u2013/g,'-').replace(/\u2014/g,'-').replace(/\./g,'');
  const m = raw.match(new RegExp('^('+MONTH+')\\s+(\\d{1,2})(?:\\s*-\\s*(?:('+MONTH+')\\s+)?(\\d{1,2}))?$', 'i'));
  if(!m) return null;
  const m1 = monthOf(m[1]);
  const d1 = +m[2];
  const m2 = m[3] ? monthOf(m[3]) : m1;
  const d2 = m[4] ? +m[4] : d1;
  if(!m1||!m2) return null;
  let y2 = year;
  if(m2<m1 || (m2===m1 && d2<d1)) y2 = year+1;
  const start = iso(year, m1, d1), end = iso(y2, m2, d2);
  if(!start||!end||end<start) return null;
  return {start, end};
}
function rangesFrom(text, year){
  const raw = String(text||'').replace(/\u2013/g,'-').replace(/\u2014/g,'-');
  const out = [];
  const seen = new Set();
  for(const token of raw.match(DATE_RE)||[]){
    const hit = rangeOf(token, year);
    if(!hit) continue;
    const key = hit.start+'|'+hit.end;
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

function wordsOf(html){
  const out = [];
  const re = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)<\/word>/g;
  let m;
  while((m = re.exec(html))){
    out.push({x:+m[1], y:+m[2], x2:+m[3], t:m[5].replace(/\u2013/g,'-').replace(/\u2014/g,'-')});
  }
  return out;
}
function clusters(xs){
  const sorted = xs.slice().sort((a,b)=>a-b);
  if(sorted.length<2) return [0, 10000];
  const groups = [[sorted[0]]];
  for(const x of sorted.slice(1)){
    if(x-groups[groups.length-1][groups[groups.length-1].length-1] > 80) groups.push([x]);
    else groups[groups.length-1].push(x);
  }
  const centers = groups.map(g=>g.reduce((a,b)=>a+b,0)/g.length);
  const bounds = [0];
  for(let i=0;i<centers.length-1;i++) bounds.push((centers[i]+centers[i+1])/2);
  bounds.push(10000);
  return bounds;
}

function colorado(pdf){
  const info = execFileSync('pdfinfo', [pdf], {encoding:'utf8'});
  const pages = +(info.match(/Pages:\s+(\d+)/)||[])[1] || 0;
  const hunts = {};
  for(let p=1;p<=pages;p++){
    const html = execFileSync('pdftotext', ['-bbox-layout','-f',String(p),'-l',String(p),pdf,'-'], {encoding:'utf8', maxBuffer:20*1024*1024});
    if(/Brochure Corrections/i.test(html)) continue;
    const words = wordsOf(html);
    if(!words.length) continue;
    const lines = [];
    const ordered = words.slice().sort((a,b)=>a.y-b.y||a.x-b.x);
    for(const w of ordered){
      if(!lines.length || Math.abs(w.y-lines[lines.length-1].y)>2.8) lines.push({y:w.y, words:[w]});
      else lines[lines.length-1].words.push(w);
    }
    const headers = [];
    for(const line of lines){
      const text = line.words.map(w=>w.t).join(' ');
      if(!/Season Dates:/i.test(text) || /see hunt/i.test(text)) continue;
      const ranges = rangesFrom(text, 2026);
      if(ranges.length && ranges.length<=3) headers.push({y:line.y, ranges});
    }
    function headerFor(y){
      let best = null;
      for(const h of headers){
        if(h.y<=y+4 && (!best || h.y>best.y)) best = h;
      }
      return best;
    }
    const codeWords = words.filter(w=>CODE_RE.test(w.t));
    const bounds = clusters(codeWords.map(w=>w.x));
    for(let i=0;i<bounds.length-1;i++){
      const col = words.filter(w=>w.x>=bounds[i]-30 && w.x<bounds[i+1]);
      const codes = col.filter(w=>CODE_RE.test(w.t));
      for(const code of codes){
        const m = code.t.match(CODE_RE);
        if(!m) continue;
        const key = m[1]+m[2]+m[3]+m[4]+m[5];
        const near = col.filter(w=>Math.abs(w.y-code.y)<=16 && w.x<=code.x+4);
        const blob = near.sort((a,b)=>a.y-b.y||a.x-b.x).map(w=>w.t).join(' ');
        let ranges = rangesFrom(blob, 2026);
        if(ranges.length>4){
          const same = col.filter(w=>Math.abs(w.y-code.y)<=3 && w.x<=code.x+4).map(w=>w.t).join(' ');
          ranges = rangesFrom(same, 2026);
        }
        if(!ranges.length){
          const head = headerFor(code.y);
          if(head) ranges = head.ranges;
        }
        if(!ranges.length) continue;
        if(!hunts[key]) hunts[key] = [];
        for(const r of ranges){
          if(!hunts[key].some(x=>x.start===r.start && x.end===r.end)) hunts[key].push(r);
        }
      }
    }
  }
  for(const key of Object.keys(hunts)){
    const rows = hunts[key];
    hunts[key] = rows.filter(r=>!rows.some(o=>o!==r && o.start<=r.start && o.end>=r.end && (o.start<r.start || o.end>r.end)));
  }
  return hunts;
}

function chapterYearOk(pdf){
  const info = execFileSync('pdfinfo', [pdf], {encoding:'utf8'});
  const title = (info.match(/^Title:\s*(.*)$/m)||[])[1]||'';
  return /\b2026\b/.test(title);
}
function pageCols(page){
  for(const line of page.split('\n')){
    const hits = [];
    const re = /Opens|Closes/g;
    let m;
    while((m = re.exec(line))) hits.push(m.index);
    if(hits.length>=4) return hits.slice(0,4);
  }
  return null;
}
function columnKind(col, cols){
  if(!cols || typeof col!=='number') return 'regular';
  const archery = (cols[0]+cols[1])/2;
  const regular = (cols[2]+cols[3])/2;
  return Math.abs(col-archery) < Math.abs(col-regular) ? 'archery' : 'regular';
}
function parseWyText(text){
  const rows = [];
  const monthRe = new RegExp(MONTH+'\\.?', 'i');
  const dateRe = new RegExp('('+MONTH+')\\.?\\s+(\\d{1,2})', 'gi');
  for(const page of text.split('\f')){
    const cols = pageCols(page);
    let cur = null;
    for(const line of page.split('\n')){
      const spaced = line.replace(/\u2013/g,'-').replace(/\u2014/g,'-');
      const raw = spaced.replace(/\s+/g,' ').trim();
      if(!raw || /^(CHAPTER|Section|Hunt|Area|Special|Regular|Opens|Closes)\b/.test(raw) || /^\d+-\d+$/.test(raw)) continue;
      const monthAt = raw.search(monthRe);
      const prefix = monthAt<0 ? raw : raw.slice(0, monthAt).trim();
      const parts = prefix.split(/\s+/).filter(Boolean);
      const typeTok = parts.length ? parts[parts.length-1].replace(/,$/,'') : '';
      const areaToks = parts.slice(0, -1).join(' ');
      const areaOk = /^\d/.test(areaToks) && /^(Gen|\d+)$/.test(typeTok);
      if(!areaOk){
        if(cur) cur.limitation += ' '+raw;
        continue;
      }
      const areas = areaToks.split(/\s*,\s*/).map(s=>s.replace(/\D/g,'')).filter(Boolean).map(s=>String(+s));
      const found = [];
      dateRe.lastIndex = 0;
      let m;
      while((m = dateRe.exec(spaced))){
        const mo = monthOf(m[1]);
        if(mo) found.push({m:mo, d:+m[2], col:m.index});
      }
      const dates = found.length>=4 ? found.slice(0,4) : found.length>=2 ? found.slice(0,2) : [];
      cur = {areas, type: typeTok==='Gen' ? '' : typeTok, dates, cols, limitation:'', line:raw};
      rows.push(cur);
    }
  }
  const parsed = [];
  for(const row of rows){
    const pairs = [];
    for(let i=0;i+1<row.dates.length;i+=2){
      const a = row.dates[i], b = row.dates[i+1];
      // January through March in these fall chapters is the next calendar year.
      const y1 = a.m<=3 ? 2027 : 2026;
      const y2 = b.m<=3 ? 2027 : 2026;
      const start = iso(y1, a.m, a.d), end = iso(y2, b.m, b.d);
      if(start && end && end>=start) pairs.push({start, end, col:a.col});
    }
    if(!pairs.length) continue;
    const archeryOnly = /archery only/i.test(row.line+' '+row.limitation);
    parsed.push({
      areas: row.areas,
      type: row.type,
      seasons: pairs.length===2
        ? [{start:pairs[0].start, end:pairs[0].end, kind:'archery'}, {start:pairs[1].start, end:pairs[1].end, kind:'regular'}]
        : pairs.map(p=>({start:p.start, end:p.end, kind: archeryOnly ? 'archery' : columnKind(p.col, row.cols)})),
      limitation: row.limitation||''
    });
  }
  return {yearOk:true, rows:parsed};
}

function loadWH(){
  const box = {window:{}};
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(root,'wyoming/data.js'),'utf8')+'\nglobalThis.WH=WH;', box);
  return box.WH;
}

function wyoming(){
  const files = {
    elk: '33695.pdf',
    deer: '33694.pdf',
    pronghorn: '33693.pdf',
    moose: '33696.pdf',
    sheep: '33697.pdf',
    goat: '33697.pdf',
    bison: '33700.pdf'
  };
  const bySpecies = {};
  const notes = {};
  function textOf(file){
    const full = path.join(wyDir, file);
    if(!fs.existsSync(full)) return {missing:true, text:''};
    if(file==='33700.pdf' || !chapterYearOk(full)) return {skip:true, text:''};
    return {text: execFileSync('pdftotext', ['-layout', full, '-'], {encoding:'utf8', maxBuffer:8*1024*1024})};
  }
  for(const [sp, file] of Object.entries(files)){
    if(sp==='sheep' || sp==='goat') continue;
    const got = textOf(file);
    if(got.missing){ notes[sp]='PDF missing'; bySpecies[sp]=[]; continue; }
    if(got.skip){
      notes[sp] = sp==='bison'
        ? 'The regulations index links Chapter 15, and that file is titled as the April 22, 2025 revision, not a 2026 season table. Bison dates are not copied from it.'
        : 'The chapter file is not marked 2026, so its dates were not used.';
      bySpecies[sp]=[];
      continue;
    }
    bySpecies[sp] = parseWyText(got.text).rows;
  }
  const shared = textOf('33697.pdf');
  if(shared.text){
    const cut = shared.text.search(/Section 7\.\s+Mountain Goat Hunting Seasons/i);
    bySpecies.sheep = parseWyText(cut>0 ? shared.text.slice(0, cut) : shared.text).rows;
    bySpecies.goat = parseWyText(cut>0 ? shared.text.slice(cut) : '').rows;
  }else{
    notes.sheep = notes.goat = 'The 2026 sheep and goat chapter was not used.';
    bySpecies.sheep = [];
    bySpecies.goat = [];
  }
  const WH = loadWH();
  const hunts = {};
  const why = {matched:0, ambiguous:0, noArea:0, noRow:0, general:0};
  for(const [key, h] of Object.entries(WH)){
    if(!/^\d+$/.test(String(h.area))){
      why.general++;
      continue;
    }
    const area = String(+h.area);
    const type = h.type===undefined||h.type===null ? '' : String(h.type);
    const rows = (bySpecies[h.sp]||[]).filter(r=>r.areas.includes(area) && String(r.type)===type);
    if(!rows.length){ why.noRow++; continue; }
    const seasons = [];
    for(const r of rows){
      for(const s of r.seasons){
        if(!seasons.some(x=>x.start===s.start && x.end===s.end && x.kind===s.kind)) seasons.push(s);
      }
    }
    if(!seasons.length){ why.noRow++; continue; }
    hunts[key] = seasons;
    why.matched++;
  }
  return {hunts, why, notes, rows: Object.fromEntries(Object.entries(bySpecies).map(([k,v])=>[k, v.length]))};
}

function loadD(){
  const box = {window:{}};
  vm.createContext(box);
  vm.runInContext(fs.readFileSync(path.join(root,'drawodds/lite.js'),'utf8')+'\nglobalThis.D=D;', box);
  return box.D;
}

const co = colorado(cpwPdf);
const D = loadD();
const coStats = {archery:0, archeryDated:0, muzzle:0, muzzleDated:0, other:0, otherDated:0};
for(const [k,d] of Object.entries(D)){
  const w = k.at(-1);
  const bucket = w==='A' ? 'archery' : w==='M' ? 'muzzle' : 'other';
  coStats[bucket]++;
  if(co[k] && co[k].length) coStats[bucket+'Dated']++;
}
const wy = wyoming();
const out = {
  built: '2026-11-19',
  co: {
    source: {
      title: '2026 Colorado Big Game Hunting Brochure',
      url: 'https://cpw.widen.net/s/5wvx7rggrd/colorado-big-game-hunting-brochure',
      page: 'https://cpw.state.co.us/activities/hunting/big-game'
    },
    note: 'Dates are the 2026 rows in the brochure hunt tables. A table header that prints one season for that method is used only when the hunt row does not print a different date. Ranch, private-land, early, and late rows keep the date printed on that row.',
    hunts: co
  },
  wy: {
    sources: [
      {species:'elk', title:'2026 Elk Hunting Seasons, Chapter 7', url:'https://wgfd.wyo.gov/media/33695/download?inline', page:'https://wgfd.wyo.gov/Regulations/Big-Game-Regulations/Elk-Hunting-Seasons'},
      {species:'deer', title:'2026 Deer Hunting Seasons, Chapter 6', url:'https://wgfd.wyo.gov/media/33694/download?inline', page:'https://wgfd.wyo.gov/Regulations/Big-Game-Regulations/Deer-Hunting-Seasons'},
      {species:'pronghorn', title:'2026 Antelope Hunting Seasons, Chapter 5', url:'https://wgfd.wyo.gov/media/33693/download?inline', page:'https://wgfd.wyo.gov/Regulations/Big-Game-Regulations/Antelope-Hunting-Seasons'},
      {species:'moose', title:'2026 Moose Hunting Seasons, Chapter 8', url:'https://wgfd.wyo.gov/media/33696/download?inline', page:'https://wgfd.wyo.gov/Regulations/Big-Game-Regulations/Moose-Hunting-Seasons'},
      {species:'sheep and goat', title:'2026 Bighorn Sheep and Mountain Goat Hunting Seasons, Chapter 9', url:'https://wgfd.wyo.gov/media/33697/download?inline', page:'https://wgfd.wyo.gov/Regulations/Big-Game-Regulations/Bighorn-Sheep-Hunting-Seasons'},
      {species:'bison', title:'Wild bison recreational hunting seasons, Chapter 15', url:'https://wgfd.wyo.gov/media/33700/download?inline', page:'https://wgfd.wyo.gov/regulations'}
    ],
    note: 'A hunt gets every 2026 archery and regular date the chapter prints for that hunt area and type. General and region licenses are not a numbered hunt area in these tables.',
    why: wy.why,
    notes: wy.notes,
    rowCounts: wy.rows,
    hunts: wy.hunts
  }
};
const dest = path.join(root, 'find/season-dates.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log('CO', coStats, 'codes', Object.keys(co).length);
console.log('WY', wy.why, wy.notes, wy.rows, 'hunts', Object.keys(wy.hunts).length);
console.log('wrote', dest, fs.statSync(dest).size);
