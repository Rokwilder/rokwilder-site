// Full Pass hunt comparison and season-date planner.
// One saved list, on this device, shared by Find Your Hunt and the UnitIQ app.
// Exact percents are shown only when the member file loaded them.
(function(){
'use strict';
const KEY='rw_hunt_picks';
const MAX=4;
const me=document.currentScript;
const ROOT=me&&me.src?me.src.replace(/find\/tools\.js(\?.*)?$/,''):'';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clean=s=>String(s==null?'':s).replace(/\u2013/g,' to ').replace(/\u2014/g,', ');
const NAMES={co:'Colorado',ut:'Utah',az:'Arizona',wy:'Wyoming',id:'Idaho',nv:'Nevada',mt:'Montana',nm:'New Mexico'};
const COUNT_STATES={co:1,ut:1,id:1,nv:1};
const COLORS=['#c8792f','#6f7f4f','#8a6a4a','#d2501f'];
let dates=null;
let tab='compare';
let note='';

function paid(){
  return window.RWGate?RWGate.paid():window.RW_FP===true;
}
function prefix(){
  const parts=location.pathname.split('/').filter(Boolean);
  return parts.length>1?'../':'';
}
function mockOn(){return window.RW_MOCK===true}
function loadPicks(){
  try{
    const raw=JSON.parse(localStorage.getItem(KEY)||'{}');
    const picks=Array.isArray(raw.picks)?raw.picks.filter(p=>p&&p.id&&p.snap):[];
    return picks.slice(0,MAX);
  }catch(e){return []}
}
function savePicks(picks){
  localStorage.setItem(KEY, JSON.stringify({v:1, picks:picks.slice(0,MAX)}));
}
function here(){
  if(typeof UT_META!=='undefined') return 'ut';
  if(typeof AZ_META!=='undefined') return 'az';
  if(typeof WY_META!=='undefined') return 'wy';
  if(typeof ID_META!=='undefined') return 'id';
  if(typeof NV_META!=='undefined') return 'nv';
  if(typeof MT_META!=='undefined') return 'mt';
  if(typeof NM_META!=='undefined') return 'nm';
  if(typeof D!=='undefined') return 'co';
  return '';
}
function cardTitle(key){
  let el=null;
  document.querySelectorAll('button.fh[data-k]').forEach(b=>{if(!el && b.getAttribute('data-k')===key) el=b});
  const t=el&&el.querySelector('.ft');
  return t?t.textContent.replace(/\s+/g,' ').trim():'';
}
function plainTitle(html){
  const d=document.createElement('div');
  d.innerHTML=html;
  return d.textContent.replace(/\s+/g,' ').trim();
}
function harvestOf(pct, exact, hunters, mark){
  if(pct==null||pct==='') return {text:'Not published', value:null, kind:null};
  if(!exact){
    const kind=window.RWLand?RWLand.harvestKind(pct):null;
    const label={high:'High (50% or more)',good:'Good (30 to 49%)',fair:'Fair (15 to 29%)',low:'Low (under 15%)'}[kind];
    const rank={high:4,good:3,fair:2,low:1}[kind]||null;
    return {text:label||'Not published', value:rank, kind:rank?'band':null};
  }
  const n=Math.round(pct);
  let text=n+'% of hunters';
  if(typeof hunters==='number') text+=' ('+hunters.toLocaleString()+' hunters)';
  if(mark) text+=' (mock)';
  return {text, value:n, kind:'exact'};
}
function landOf(band, privateOnly){
  if(privateOnly && !band) return {text:'Private land only', rank:0};
  if(!band||!window.RWLand||!RWLand.LABEL[band]) return {text:'Not published', rank:null};
  return {text:clean(RWLand.LABEL[band]), rank:RWLand.rank(band)};
}
function combinedOf(o){
  if(!window.RWLand) return 'Not published';
  const s=clean(RWLand.combined(o));
  return s||'Not published';
}
function pointsOf(value, text){
  if(typeof value==='number') return {text:text, value:value};
  return {text:text||'Not published', value:null};
}
function surePoints(levels){
  const xs=(levels||[]).filter(x=>x&&typeof x.v==='number').sort((a,b)=>a.p-b.p);
  if(!xs.length) return pointsOf(null,'Not published');
  const hit=xs.find(x=>x.v>=0.995);
  if(!hit) return pointsOf(null,'No point level is a sure draw in the published odds.');
  const word=hit.p===1?'About 1 point to be sure to draw':'About '+hit.p+' points to be sure to draw';
  return pointsOf(hit.p, word);
}
function countText(rows){
  const list=(rows||[]).filter(r=>r&&(typeof r.tags==='number'||typeof r.apps==='number'));
  list.sort((a,b)=>b.year-a.year);
  if(!list.length) return 'Not published';
  const line=list.map(r=>{
    const bits=[];
    bits.push(typeof r.tags==='number'?r.tags.toLocaleString()+' tags':'Tags: Not published');
    bits.push(typeof r.apps==='number'?r.apps.toLocaleString()+' applicants':'Applicants: Not published');
    return r.year+': '+bits.join(', ');
  }).join('. ');
  return mockOn()?line+' (mock)':line;
}
function rqRows(state, key){
  const rec=window.RWQ&&RWQ[state]&&RWQ[state].hunts&&RWQ[state].hunts[key];
  if(!rec) return [];
  const rows=[];
  Object.keys(rec).forEach(y=>{
    if(!/^\d{4}$/.test(y)||!rec[y]) return;
    const tags=typeof rec[y].quota==='number'?rec[y].quota:null;
    const apps=typeof rec[y].apps==='number'?rec[y].apps:(typeof rec[y].applicants==='number'?rec[y].applicants:null);
    if(tags==null&&apps==null) return;
    rows.push({year:+y, tags, apps});
  });
  return rows;
}
function oddsPack(key, side, pts){
  if(!window.RWHy||typeof RWHy.pack!=='function') return {headline:'Not published', line:'Not published', value:null, kind:null, exact:false};
  const pack=RWHy.pack(key, side, pts);
  if(!pack) return {headline:'Not published', line:'Not published', value:null, kind:null, exact:false};
  if(pack.exact&&mockOn()){pack.headline=pack.headline+' (mock)'; pack.line=pack.line+' (mock)'}
  return pack;
}
function season(start, end, label){
  if(!start||!end) return null;
  return {start, end, label:label||'Season'};
}
function looseSeasons(text, year, label){
  if(!window.RWPlan) return [];
  const explicit=explicitRanges(text);
  const rows=explicit.length?explicit:RWPlan.parseMany(text, year);
  return rows.map(r=>season(r.start, r.end, label)).filter(Boolean);
}
function explicitRanges(text){
  if(!window.RWPlan) return [];
  const raw=String(text||'').replace(/[\u2013\u2014]/g,'-');
  const re=/([A-Za-z]{3,}\.?)\s+(\d{1,2}),?\s+(20\d{2})/g;
  const hits=[];
  let m;
  while((m=re.exec(raw))){
    const mo=RWPlan.monthOf(m[1]);
    const day=RWPlan.iso(+m[3], mo, +m[2]);
    if(day) hits.push(day);
  }
  const out=[];
  for(let i=0;i+1<hits.length;i+=2){
    const a=hits[i], b=hits[i+1];
    if(a&&b&&a<=b) out.push({start:a, end:b});
  }
  return out;
}
let seasonPack=null;
function tableSeasons(state, key){
  const bag=seasonPack&&seasonPack[state]&&seasonPack[state].hunts&&seasonPack[state].hunts[key];
  if(!bag||!bag.length) return null;
  return bag.map(r=>{
    const label=state==='wy'
      ?(r.kind==='archery'?'2026 WGFD archery season':'2026 WGFD regular season')
      :'2026 CPW big game brochure';
    return season(r.start, r.end, label);
  }).filter(Boolean);
}
function coSeasons(k){
  const mapped=tableSeasons('co', k);
  if(mapped&&mapped.length) return mapped;
  const d=D[k];
  const sp=d[0], name=String(d[2]||'');
  const rifle={
    '1st rifle':['2026-10-14','2026-10-18'],
    '2nd rifle':['2026-10-24','2026-11-01'],
    '3rd rifle':['2026-11-07','2026-11-15'],
    '4th rifle':['2026-11-18','2026-11-22']
  };
  if((sp==='elk'||sp==='deer'||sp==='pronghorn') && rifle[name]){
    return [season(rifle[name][0], rifle[name][1], '2026 CPW regular rifle season')];
  }
  return looseSeasons(name, 2026, '2026 season name on this hunt');
}
function utSeasons(k){
  const h=UH[k];
  return (h.seas||[]).map(s=>{
    const a=RWPlan.parseIso(s[0]), b=RWPlan.parseIso(s[1]);
    return season(a, b, (s[2]||'Season')+' · dates on this hunt');
  }).filter(Boolean);
}
function idSeasons(k){
  const h=IH[k];
  return (h.seg||[]).map(g=>{
    const a=RWPlan.mdY(g.o), b=RWPlan.mdY(g.c);
    return season(a, b, (g.s||'Season')+' · 2026 Hunt Planner dates');
  }).filter(Boolean);
}
function snapCo(key){
  const fy=window.__FY;
  if(!fy||!D[key]) return null;
  const d=D[key], v=fy.odds(key);
  const exact=fy.FP===true;
  const title=cardTitle(key)||('Unit '+d[1]+' · '+d[2]);
  const side=fy.S.yo?(fy.S.res==='res'?'yres':'ynonres'):fy.S.res;
  let points=pointsOf(null,'Not published');
  if(exact && d[0]!=='dsheep' && d[0]!=='moose' && d[0]!=='sheep' && d[0]!=='goat'){
    const bag=d[5]&&d[5][fy.S.res];
    const levels=bag?Object.keys(bag.o).map(n=>({p:+n, v:fy.oddsAt(key, fy.S.res, +n, fy.S.yo)})):[];
    points=surePoints(levels);
  }
  const rows=[];
  if(exact && Array.isArray(d[6])){
    d[6].forEach(h=>{if(h) rows.push({year:+h[0], tags:typeof h[1]==='number'?h[1]:null, apps:typeof h[2]==='number'?h[2]:null})});
  }
  if(!rows.length) rows.push.apply(rows, rqRows('co', key));
  const hunters=typeof FL!=='undefined'&&FL[key]?FL[key][1]:null;
  const band=window.RWLand&&/^all lands/.test(d[4]||'')?RWLand.band('co', RWLand.coKey(d[0], (typeof FL!=='undefined'&&FL[key]&&FL[key][2])||[d[1]])):null;
  const privateOnly=(/private/.test(d[4]||'')&&!/public/.test(d[4]||''))||/Ranching|ranch|Access Program/i.test(d[4]||'');
  const land=landOf(band, privateOnly);
  return base('co', key, title, fy.S.res==='res'?'Colorado resident':'Out of state', fy.S.pts, points, oddsPack(key, side, fy.S.pts), countText(rows), harvestOf(d[7], exact, typeof hunters==='number'?hunters:null, mockOn()), land, combinedOf({land:band, odds:RWLand.oddsKind(v), harvest:RWLand.harvestKind(d[7]), voice:'forecast', privateOnly}), coSeasons(key));
}
function snapUt(key){
  const ut=window.__UT;
  if(!ut||!UH[key]) return null;
  const h=UH[key], v=ut.odds(key), exact=ut.FP===true;
  const title=cardTitle(key)||plainTitle(h.name||key);
  const side=ut.S.yo?(ut.S.res==='res'?'yres':'ynonres'):ut.S.res;
  let points=pointsOf(null,'Not published');
  if(exact && h.pt!=='lottery'){
    const levels=[];
    for(let p=0;p<=33;p++){const z=ut.oddsAt(key, ut.S.res, p, ut.S.yo); if(typeof z==='number') levels.push({p, v:z})}
    points=surePoints(levels);
  }
  const hv=h.hv, pct=hv?hv[3]:null, hunters=hv&&typeof hv[1]==='number'?hv[1]:null;
  const b=window.RWLand?RWLand.band('ut', RWLand.utKey(h.b)) : null;
  const land=landOf(b, !b&&!!h.cw);
  return base('ut', key, title, ut.S.res==='res'?'Utah resident':'Out of state', ut.S.pts, points, oddsPack(key, side, ut.S.pts), countText(rqRows('ut', key)), harvestOf(pct, exact, hunters, mockOn()), land, combinedOf({land:b, odds:RWLand.oddsKind(v), harvest:RWLand.harvestKind(pct), voice:'forecast', privateOnly:!b&&!!h.cw}), utSeasons(key));
}
function snapAz(key){
  const az=window.__AZ;
  if(!az||!AH[key]) return null;
  const h=AH[key], v=az.odds(key), exact=az.FP===true;
  const title=cardTitle(key)||(h.legal+' · '+h.area);
  let points=pointsOf(null,'Not published');
  if(exact && h.od && h.od[az.S.res]){
    const levels=Object.keys(h.od[az.S.res].o||{}).map(n=>({p:+n, v:az.oddsAt(key, az.S.res, +n, az.S.yo)}));
    points=surePoints(levels);
  }
  const hv=h.hv, pct=hv?hv[3]:null, hunters=hv&&typeof hv[1]==='number'?hv[1]:null;
  const yearHit=String(h.d||'').match(/\b(20\d{2})\b/);
  return base('az', key, title, az.S.res==='res'?'Arizona resident':'Out of state', az.S.pts, points, oddsPack(key, az.S.res, az.S.pts), 'Not published', harvestOf(pct, exact, hunters, mockOn()), landOf(null, false), 'Not published', looseSeasons(h.d, yearHit?+yearHit[1]:null, 'Dates printed on this hunt'));
}
function snapWy(key){
  const w=window.__WY;
  if(!w||!WH[key]) return null;
  const h=WH[key], exact=w.FP===true;
  const v=w.odds(key);
  const title=cardTitle(key)||('Hunt area '+h.area);
  let points=pointsOf(null,'Not published');
  if(exact && w.usesPts()){
    const b=h.od[w.pool()];
    const levels=b&&b.o?b.o.map((val,i)=>({p:i, v:typeof val==='number'?val:null})).filter(x=>x.v!=null):[];
    points=surePoints(levels);
  }
  const band=window.RWLand?RWLand.band('wy', RWLand.wyKey(h.sp, h.area)):null;
  const land=landOf(band, false);
  const side=w.pool();
  return base('wy', key, title, w.S.res==='res'?'Wyoming resident':'Out of state', w.usesPts()?w.S.pts:0, points, oddsPack(key, side, w.usesPts()?w.S.pts:''), 'Not published', {text:'Not published', value:null, kind:null}, land, combinedOf({land:band, odds:RWLand.oddsKind(v), voice:'forecast'}), tableSeasons('wy', key)||[]);
}
function snapId(key){
  const id=window.__ID;
  if(!id||!IH[key]) return null;
  const h=IH[key], exact=id.FP===true;
  let v=id.S.res==='res'?h.res:h.nr;
  if(exact && h.raw){
    const raw=id.S.res==='res'?h.raw.res:h.raw.nr;
    if(raw && typeof raw.rate==='number') v=raw.rate;
  }
  const title=cardTitle(key)||('Hunt '+h.n+' · Area '+h.area);
  const rows=[];
  if(exact && h.raw){
    const raw=id.S.res==='res'?h.raw.res:h.raw.nr;
    if(raw && (typeof raw.quota==='number'||typeof raw.apps==='number')) rows.push({year:2026, tags:typeof raw.quota==='number'?raw.quota:null, apps:typeof raw.apps==='number'?raw.apps:null});
  }
  if(!rows.length) rows.push.apply(rows, rqRows('id', key));
  const band=window.RWLand?RWLand.band('id', RWLand.idKey(h.area)):null;
  const land=landOf(band, false);
  return base('id', key, title, id.S.res==='res'?'Idaho resident':'Out of state', 0, pointsOf(null,'Not published'), oddsPack(key, id.S.res, null), countText(rows), {text:'Not published', value:null, kind:null}, land, combinedOf({land:band, odds:RWLand.oddsKind(v), voice:'history'}), idSeasons(key));
}
function snapNv(key){
  const nv=window.__NV;
  if(!nv||!NH[key]) return null;
  const h=NH[key], exact=nv.FP===true;
  let v=Object.prototype.hasOwnProperty.call(h.bp, nv.S.pts)?h.bp[nv.S.pts]:null;
  const rows=[];
  if(exact && h.raw){
    const lv=h.raw.lv&&(h.raw.lv[nv.S.pts]!=null?h.raw.lv[nv.S.pts]:h.raw.lv[String(nv.S.pts)]);
    if(lv && typeof lv.rate1==='number') v=lv.rate1;
    const tags=typeof h.raw.quota==='number'?h.raw.quota:null;
    const apps=lv&&typeof lv.a1==='number'?lv.a1:null;
    if(tags!=null||apps!=null) rows.push({year:2025, tags, apps});
  }
  if(!rows.length) rows.push.apply(rows, rqRows('nv', key));
  let points=pointsOf(null,'Not published');
  if(exact && h.bp){
    const levels=Object.keys(h.bp).map(n=>({p:+n, v:h.bp[n]}));
    points=surePoints(levels);
  }
  const band=window.RWLand?RWLand.band('nv', RWLand.nvKey(h.units)):null;
  const title=cardTitle(key)||String(h.units||key);
  return base('nv', key, title, nv.S.live==='res'?'Nevada resident':'Out of state', nv.S.pts, points, oddsPack(key, null, nv.S.pts), countText(rows), {text:'Not published', value:null, kind:null}, landOf(band, false), combinedOf({land:band, odds:RWLand.oddsKind(v), voice:'history'}), looseSeasons(h.season, null, 'Dates printed on the draw table'));
}
function snapMt(key){
  const mt=window.__MT;
  if(!mt||!MH[key]) return null;
  const h=MH[key], exact=mt.FP===true;
  let v=null;
  const side=h.od&&h.od[mt.S.res];
  if(side){
    if(!h.pts) v=side.band;
    else v=Object.prototype.hasOwnProperty.call(side.bp, mt.S.pts)?side.bp[mt.S.pts]:(side.bp[String(mt.S.pts)]!=null?side.bp[String(mt.S.pts)]:null);
  }
  if(exact && h.raw && h.raw[mt.S.res]){
    const raw=h.raw[mt.S.res];
    if(!h.pts && typeof raw.rate1==='number') v=raw.rate1;
    if(h.pts && raw.lv){
      const row=raw.lv[mt.S.pts]!=null?raw.lv[mt.S.pts]:raw.lv[String(mt.S.pts)];
      if(row && typeof row.rate1==='number') v=row.rate1;
    }
  }
  let points=pointsOf(null,'Not published');
  if(exact && h.pts && side && side.bp){
    points=surePoints(Object.keys(side.bp).map(n=>({p:+n, v:side.bp[n]})));
  }
  const band=window.RWLand?RWLand.band('mt', RWLand.mtKey(h.sp, h.area)):null;
  const harv=mtHarvest(h);
  const title=cardTitle(key)||('HD '+h.area);
  const year=String(h.season||'').match(/20\d{2}/);
  return base('mt', key, title, mt.S.res==='res'?'Montana resident':'Out of state', h.pts?mt.S.pts:0, points, oddsPack(key, mt.S.res, h.pts?mt.S.pts:null), 'Not published', harv, h.privateOnly?landOf(null, true):landOf(band, false), h.privateOnly?combinedOf({privateOnly:true}):combinedOf({land:band, odds:RWLand.oddsKind(v), voice:'history'}), looseSeasons(h.season, year?+year[0]:2026, 'Dates printed on the regulation line'));
}
function successYear(years, sp){
  if(!years) return null;
  const keys=Object.keys(years).filter(y=>years[y]&&years[y].success!=null&&!(sp==='elk'&&y==='2025')).sort();
  if(!keys.length) return null;
  const y=keys[keys.length-1];
  return {year:y, cell:years[y]};
}
function mtHarvest(h){
  const root=typeof MT_HARV!=='undefined'?MT_HARV:window.MT_HARV;
  const bag=root&&root[h.sp]&&root[h.sp][h.area];
  if(!bag) return {text:'Not published', value:null, kind:null};
  if(h.sp==='deer'){
    const parts=['md','wt'].map(k=>{
      const hit=successYear(bag[k], h.sp);
      if(!hit) return null;
      const pct=hit.cell.success<=1?hit.cell.success*100:hit.cell.success;
      return (k==='md'?'Mule deer ':'White-tailed deer ')+hit.year+': '+Math.round(pct)+'%';
    }).filter(Boolean);
    if(!parts.length) return {text:'Not published', value:null, kind:null};
    return {text:parts.join('. '), value:null, kind:null};
  }
  const hit=successYear(bag, h.sp);
  if(!hit) return {text:'Not published', value:null, kind:null};
  const pct=hit.cell.success<=1?hit.cell.success*100:hit.cell.success;
  const out=harvestOf(pct, true, hit.cell.hunters, false);
  out.text=hit.year+': '+out.text;
  return out;
}
function nmHarvest(h){
  const root=typeof NM_HARV!=='undefined'?NM_HARV:window.NM_HARV;
  const bag=root&&root[h.code];
  const cell=bag&&bag['2025-26'];
  if(!cell||cell.success==null) return {text:'Not published', value:null, kind:null};
  const out=harvestOf(cell.success*100, true, null, false);
  out.text='2025-26: '+out.text;
  return out;
}
function snapNm(key){
  const nm=window.__NM;
  if(!nm||!NH[key]) return null;
  const h=NH[key], exact=nm.FP===true;
  let v=h.od&&Object.prototype.hasOwnProperty.call(h.od, nm.S.pool)?h.od[nm.S.pool]:null;
  if(exact && h.raw && h.raw[nm.S.pool] && typeof h.raw[nm.S.pool].rate1==='number') v=h.raw[nm.S.pool].rate1;
  const band=window.RWLand&&!h.privateOnly&&!h.wmaOnly&&!h.partial&&!h.areaChoice&&!(h.unmapped&&h.unmapped.length)&&h.units&&h.units.length?RWLand.band('nm', RWLand.nmKey(h.units)):null;
  const harv=nmHarvest(h);
  const title=cardTitle(key)||(h.code||key);
  const who={res:'New Mexico resident',nr:'Nonresident',out:'Outfitter pool'}[nm.S.pool]||'';
  let seasons=looseSeasons(h.season, 2026, '2026-27 booklet dates');
  if(h.season && !/20\d{2}|'\d{2}/.test(h.season)){
    seasons=seasons.map(s=>{
      const month=+String(s.start).slice(5,7);
      if(month<1||month>7) return s;
      const shift=day=>String(+String(day).slice(0,4)+1)+String(day).slice(4);
      return season(shift(s.start), shift(s.end), s.label);
    }).filter(Boolean);
  }
  return base('nm', key, title, who, 0, pointsOf(null,'Not published'), oddsPack(key, nm.S.pool, null), 'Not published', harv, h.privateOnly?landOf(null, true):landOf(band, false), h.privateOnly?combinedOf({privateOnly:true}):combinedOf({land:band, odds:RWLand.oddsKind(v), harvest:harv.kind==='exact'?harv.value:null, voice:'history'}), seasons);
}
function base(state, key, title, who, pts, points, odds, counts, harvest, land, combined, seasons){
  if(!COUNT_STATES[state]) counts='Not published';
  return {
    state, stateName:NAMES[state]||state, key,
    title:title||key,
    who:who+(typeof pts==='number'&&pts>0?' · '+pts+' point'+(pts===1?'':'s'):''),
    points, odds, counts, harvest, land, combined,
    seasons:(seasons||[]).filter(Boolean),
    mock:mockOn()
  };
}
function snap(key){
  const st=here();
  if(st==='co') return snapCo(key);
  if(st==='ut') return snapUt(key);
  if(st==='az') return snapAz(key);
  if(st==='wy') return snapWy(key);
  if(st==='id') return snapId(key);
  if(st==='nv') return snapNv(key);
  if(st==='mt') return snapMt(key);
  if(st==='nm') return snapNm(key);
  return null;
}
function mount(){
  if($('rwtools')) return;
  const out=$('out');
  if(!out||!out.parentNode) return;
  const sec=document.createElement('section');
  sec.id='rwtools';
  sec.setAttribute('aria-label','Compare hunts and season dates');
  out.parentNode.insertBefore(sec, out);
}
function saleLink(){
  const open=window.RW&&RW.saleState&&RW.saleState.open===true;
  const href=prefix()+(open?'pricing.html#fullpass':'pricing.html');
  const label=open?'Get the Full Pass':'See pricing';
  return '<a class="btn" href="'+esc(href)+'">'+label+'</a>';
}
function teaser(){
  return '<aside class="fpbox" id="rwlock" aria-label="Full Pass"><p class="fpt">Compare hunts and plan dates</p><p>Put 2 to 4 hunts side by side, across states, and see their season dates on one calendar. Free visitors get this short look. The comparison and the calendar are the Full Pass.</p><p>'+saleLink()+'</p><p class="renew">Renews every year at the same price until you cancel. You can cancel anytime from your account.</p><p class="renew">Renews every year at $19.99. That price stays locked as long as you keep renewing. You can cancel anytime from your account.</p></aside>';
}
function tabs(){
  return '<div class="seg rwtabs" role="tablist"><button type="button" data-rwt="compare" class="'+(tab==='compare'?'on':'')+'">Compare</button><button type="button" data-rwt="dates" class="'+(tab==='dates'?'on':'')+'">Season dates</button></div>';
}
function cell(text){return '<td>'+esc(clean(text||'Not published'))+'</td>'}
function narrow(){
  return window.matchMedia&&window.matchMedia('(max-width:700px)').matches;
}
function compareCards(picks){
  return picks.map((p,i)=>{
    const s=p.snap;
    const row=(label,val)=>'<p><b>'+label+'.</b> '+esc(clean(val||'Not published'))+'</p>';
    return '<article class="cmpcard" style="border-top:4px solid '+COLORS[i%COLORS.length]+'"><h3>'+esc(s.stateName)+' · '+esc(s.title)+'</h3><p class="mute">'+esc(s.who)+'</p>'+
      row('Points needed', s.points&&s.points.text)+
      row('Draw odds, last year', s.odds&&s.odds.headline)+
      row('Year by year', s.odds&&s.odds.line)+
      row('Tags and applicants', s.counts)+
      row('Harvest success', s.harvest&&s.harvest.text)+
      row('Public land', s.land&&s.land.text)+
      row('Combined verdict', s.combined)+
      '<button type="button" class="pkx" data-rm="'+esc(p.id)+'">Remove</button></article>';
  }).join('');
}
function compareHTML(picks){
  if(!picks.length) return '<p class="dq">No hunts saved yet. On a hunt card, tap Add to compare. You can save 2 to 4 hunts, including hunts from other states.</p>';
  if(narrow()){
    const line=window.RWPlan?RWPlan.oneLine(picks.map(p=>p.snap)):'';
    const need=picks.length<2?'<p class="dq">Add one more hunt to compare them.</p>':'';
    const said=line?'<p class="cmpline">'+esc(clean(line))+'</p>':'<p class="dq">These hunts do not share enough published numbers to say which is easier or which has better success.</p>';
    return compareCards(picks)+need+(picks.length>=2?said:'')+'<p class="note">Last year is the newest year on that hunt. An exact percent is shown only when the Full Pass file has it. Anything else stays a band, or Not published.</p>';
  }
  const heads=picks.map((p,i)=>'<th style="border-top:4px solid '+COLORS[i%COLORS.length]+'">'+esc(p.snap.stateName)+'<br>'+esc(p.snap.title)+'<br><span class="mute">'+esc(p.snap.who)+'</span> <button type="button" class="pkx" data-rm="'+esc(p.id)+'">Remove</button></th>').join('');
  const row=(label, get)=>'<tr><th>'+label+'</th>'+picks.map(p=>cell(get(p.snap))).join('')+'</tr>';
  const line=window.RWPlan?RWPlan.oneLine(picks.map(p=>p.snap)):'';
  const need=picks.length<2?'<p class="dq">Add one more hunt to compare them.</p>':'';
  const said=line?'<p class="cmpline">'+esc(clean(line))+'</p>':'<p class="dq">These hunts do not share enough published numbers to say which is easier or which has better success.</p>';
  return '<div class="cmpscroll"><table class="cmpt"><tr><th></th>'+heads+'</tr>'+
    row('Points needed', s=>s.points&&s.points.text)+
    row('Draw odds, last year', s=>s.odds&&s.odds.headline)+
    row('Year by year', s=>s.odds&&s.odds.line)+
    row('Tags and applicants', s=>s.counts)+
    row('Harvest success', s=>s.harvest&&s.harvest.text)+
    row('Public land', s=>s.land&&s.land.text)+
    row('Combined verdict', s=>s.combined)+
    '</table></div>'+need+(picks.length>=2?said:'')+
    '<p class="note">Last year is the newest year on that hunt. An exact percent is shown only when the Full Pass file has it. Anything else stays a band, or Not published.</p>';
}
function deadlineHTML(){
  if(!dates) return '<p class="dq">Deadline list is loading.</p>';
  const blocks=Object.keys(NAMES).map(code=>{
    const st=dates.states&&dates.states[code];
    if(!st) return '';
    const apply=(st.apply||[]).map(a=>'<li><b>'+esc(a.who)+'.</b> '+esc(a.text)+'</li>').join('');
    const results=(st.results||[]).map(a=>'<li><b>'+esc(a.who)+' results.</b> '+esc(a.text)+'</li>').join('');
    const src='<a href="'+esc(st.source.url)+'">'+esc(st.source.title)+'</a>';
    const also=(st.also||[]).map(a=>'<a href="'+esc(a.url)+'">'+esc(a.title)+'</a>').join(' · ');
    return '<article class="dl"><h3>'+esc(st.name)+'</h3><p class="dq">'+esc(st.label)+'</p><ul>'+apply+results+'</ul><p class="src">Source: '+src+(also?' · '+also:'')+'</p></article>';
  }).join('');
  return blocks;
}
function timelineHTML(picks){
  const items=[];
  picks.forEach((p,i)=>{
    (p.snap.seasons||[]).forEach(s=>{
      items.push({start:s.start, end:s.end, title:p.snap.title, state:p.snap.stateName, label:s.label, color:COLORS[i%COLORS.length], kind:'hunt'});
    });
  });
  if(!items.length) return '<p class="dq">Season dates for the saved hunts are not published in the hunt file. Deadlines for each state are listed below.</p>';
  items.sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:0);
  const pairs=RWPlan.overlappingPairs(picks.map(p=>p.snap));
  const flag=pairs.length?('<p class="overlap"><b>These hunts overlap.</b> '+esc(pairs.map(pair=>pair.a.title+' and '+pair.b.title+' ('+RWPlan.rangeText(pair.hits[0][0].start, pair.hits[0][0].end)+' and '+RWPlan.rangeText(pair.hits[0][1].start, pair.hits[0][1].end)+')').join('. '))+'. </p>'):'<p class="dq">No saved hunts overlap.</p>';
  const months={};
  items.forEach(it=>{
    const key=it.start.slice(0,7);
    (months[key]=months[key]||[]).push(it);
  });
  const body=Object.keys(months).sort().map(key=>{
    const label=RWPlan.pretty(key+'-01').replace(/\s+\d+,/,'');
    const rows=months[key].map(it=>'<div class="tlrow"><i style="background:'+it.color+'"></i><span><b>'+esc(it.state)+' · '+esc(it.title)+'</b> '+esc(RWPlan.rangeText(it.start, it.end))+'<br><span class="mute">'+esc(it.label)+'</span></span></div>').join('');
    return '<div class="tlm"><h3>'+esc(label)+'</h3>'+rows+'</div>';
  }).join('');
  return flag+'<div class="tl">'+body+'</div>';
}
function datesHTML(picks){
  const mine=picks.length?('<ul class="pklist">'+picks.map(p=>'<li><b>'+esc(p.snap.stateName)+'</b> · '+esc(p.snap.title)+(p.snap.seasons&&p.snap.seasons.length?'':' · Season dates: Not published')+'</li>').join('')+'</ul>'):'<p class="dq">Add a hunt from a hunt card to put it on the calendar.</p>';
  return mine+timelineHTML(picks)+'<h3>Application deadlines and draw results</h3>'+deadlineHTML()+'<p class="note">Only dates an agency has published. If next year is not posted, the label stays on the year that is posted.</p>';
}
function render(){
  mount();
  const box=$('rwtools');
  if(!box) return;
  if(!paid()){box.innerHTML=teaser(); paintButtons(); return}
  const picks=loadPicks().map(p=>{
    if(p.state===here()){
      const fresh=snap(p.key);
      if(fresh) p.snap=fresh;
    }
    return p;
  });
  savePicks(picks);
  const banner=picks.some(p=>p.snap&&p.snap.mock)||mockOn()?'<p class="mocktag">Mock numbers. Not an agency report.</p>':'';
  const msg=note?'<p class="dq" role="status">'+esc(note)+'</p>':'';
  box.innerHTML='<h2>Compare and plan</h2><p class="lead">Save up to 4 hunts. The same picks stay on this device in Find Your Hunt and in UnitIQ.</p>'+banner+tabs()+msg+
    '<div id="rwcompare"'+(tab==='compare'?'':' hidden')+'>'+compareHTML(picks)+'</div>'+
    '<div id="rwdates"'+(tab==='dates'?'':' hidden')+'>'+datesHTML(picks)+'</div>';
  box.querySelectorAll('[data-rwt]').forEach(b=>b.onclick=()=>{tab=b.getAttribute('data-rwt'); note=''; render()});
  box.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{remove(b.getAttribute('data-rm'))});
  paintButtons();
}
function paintButtons(){
  const ids=new Set(loadPicks().map(p=>p.id));
  document.querySelectorAll('.pkadd').forEach(b=>{
    const on=ids.has(here()+':'+b.getAttribute('data-k'));
    b.classList.toggle('on', on);
    b.textContent=paid()?(on?'Saved to compare':'Add to compare'):'Compare is Full Pass';
  });
}
function ensureButtons(root){
  if(!root||!root.querySelectorAll) return;
  root.querySelectorAll('button.fh[data-k]').forEach(btn=>{
    const li=btn.parentElement;
    if(!li||li.querySelector('.pkadd')) return;
    const bar=document.createElement('div');
    bar.className='pkbar';
    const b=document.createElement('button');
    b.type='button';
    b.className='pkadd';
    b.setAttribute('data-k', btn.getAttribute('data-k'));
    b.textContent='Add to compare';
    bar.appendChild(b);
    btn.insertAdjacentElement('afterend', bar);
  });
  const det=$('detail');
  if(det && !det.hidden){
    const q=new URLSearchParams(location.search);
    const key=q.get('h')||q.get('k');
    if(key && !det.querySelector('.pkadd')){
      const bar=document.createElement('div');
      bar.className='pkbar';
      const b=document.createElement('button');
      b.type='button';
      b.className='pkadd';
      b.setAttribute('data-k', key);
      b.textContent='Add to compare';
      bar.appendChild(b);
      det.insertBefore(bar, det.firstChild);
    }
  }
  paintButtons();
}
function remove(id){
  savePicks(loadPicks().filter(p=>p.id!==id));
  note='Removed.';
  render();
}
async function addKey(key){
  mount();
  if(!paid()){
    const box=$('rwtools');
    if(box&&box.scrollIntoView) box.scrollIntoView({block:'start'});
    return;
  }
  if(window.RWHy&&RWHy.when){try{await RWHy.when()}catch(e){}}
  const made=snap(key);
  if(!made){note='That hunt is not on this page.'; render(); return}
  const id=made.state+':'+made.key;
  let picks=loadPicks();
  if(picks.some(p=>p.id===id)){
    note='Already saved.';
    tab='compare';
    render();
    const box=$('rwtools');
    if(box&&box.scrollIntoView) box.scrollIntoView({block:'start'});
    return;
  }
  if(picks.length>=MAX){note='Compare holds 4 hunts. Remove one first.'; render(); return}
  picks.push({id, state:made.state, key:made.key, snap:made});
  savePicks(picks);
  note='Saved on this device.';
  tab='compare';
  render();
  const box=$('rwtools');
  if(box&&box.scrollIntoView) box.scrollIntoView({block:'start'});
}
function boot(){
  mount();
  ensureButtons(document);
  render();
  const obs=new MutationObserver(()=>{ensureButtons(document); paintButtons()});
  obs.observe(document.documentElement,{childList:true, subtree:true});
  document.addEventListener('click', ev=>{
    const b=ev.target&&ev.target.closest&&ev.target.closest('.pkadd');
    if(!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    addKey(b.getAttribute('data-k'));
  }, true);
  window.addEventListener('storage', ev=>{if(ev.key===KEY) render()});
  window.addEventListener('resize', ()=>{if(paid()) render()});
  fetch(ROOT+'find/dates.json?v=20261119a').then(r=>r.ok?r.json():null).then(j=>{dates=j; if(paid()&&tab==='dates') render()}).catch(()=>{});
  fetch(ROOT+'find/season-dates.json?v=20261119a').then(r=>r.ok?r.json():null).then(j=>{seasonPack=j; if(paid()) render()}).catch(()=>{});
}
window.RWTools={snap, addKey, render, loadPicks};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
