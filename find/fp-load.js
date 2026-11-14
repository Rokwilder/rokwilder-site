// Loads the same public find-page files the comparison, planner, and alerts use.
(function(root){
const PACKS={
  co:{files:['drawodds/lite.js','find/labels.js'],history:'find/history/colorado.json',names:['D','FL']},
  ut:{files:['utah/data.js'],history:'find/history/utah.json',names:['UH','UT_META']},
  az:{files:['arizona/data.js'],history:'find/history/arizona.json',names:['AH','AZ_META']},
  wy:{files:['wyoming/data.js'],history:'find/history/wyoming.json',names:['WH','WY_META']},
  id:{files:['idaho/data.js'],history:'find/history/idaho.json',names:['IH','ID_META']},
  nv:{files:['nevada/data.js'],history:'find/history/nevada.json',names:['NH','NV_META']}
};
const cache={};
async function loadPack(state, opts){
  const wantHist=!(opts&&opts.history===false);
  const key=state+(wantHist?':h':':nh');
  if(cache[key])return cache[key];
  const spec=PACKS[state];
  if(!spec)throw new Error('Unknown state');
  const texts=await Promise.all(spec.files.map(async f=>{
    const r=await fetch(f);
    if(!r.ok)throw new Error(f+' '+r.status);
    return r.text();
  }));
  const bag=new Function(texts.join('\n')+'\nreturn {'+spec.names.join(',')+'};')();
  let history=null;
  if(wantHist){try{const r=await fetch(spec.history);if(r.ok)history=await r.json()}catch(e){}}
  cache[key]=Object.assign({history}, bag);
  return cache[key];
}
function coUnit(k, D, FL){
  const f=FL&&FL[k];
  const raw=f&&f[2]?f[2]:[D[k][1]];
  return raw.length===1?String(+raw[0]===+raw[0]?+raw[0]:raw[0]):raw.map(x=>String(x)).join(', ');
}
function sexWord(sx){return sx==='M'?'buck':sx==='F'?'doe':sx==='E'?'either sex':''}
function record(state, pack, huntId){
  const Cal=root.RWCal;
  if(state==='co'){
    const d=pack.D[huntId];
    if(!d)return null;
    const att=Cal.coAttach(d[0], huntId);
    const unit=coUnit(huntId, pack.D, pack.FL);
    const sx=sexWord('MFE'.includes(huntId[1])?huntId[1]:'');
    const kind=d[0]==='deer'&&huntId.endsWith('O2R')?'co-2nd-rifle':'';
    return {
      key:'co:'+huntId, state, huntId, species:d[0],
      label:'Colorado unit '+unit+(sx?', '+sx:'')+(att.seasonLabel?', '+att.seasonLabel:''),
      flag:kind?'Colorado 2nd rifle':'Colorado '+(att.seasonLabel||unit),
      kind, ranges:att.ranges, also:att.also||[], note:att.note,
      source:Cal.SRC.coStructure, yearLabel:att.ranges.length?'2026':'Dates not attached'
    };
  }
  if(state==='ut'){
    const h=pack.UH[huntId];
    if(!h)return null;
    const ranges=(h.seas||[]).filter(s=>s&&s[0]&&s[1]).map(s=>({start:s[0],end:s[1],label:s[2]||''}));
    const wn=(h.wn||[]).join(', ');
    const general=h.pool==='deer-gen'&&/Any Legal Weapon/i.test(wn)&&!/Early|Restricted/i.test(wn);
    return {
      key:'ut:'+huntId, state, huntId, species:h.sp,
      label:'Utah '+h.name+(general?', general deer':', '+h.sp)+(wn?', '+wn:''),
      flag:general?'Utah general deer':'Utah '+h.name,
      kind:general?'ut-general-deer':'',
      ranges, also:[],
      note:ranges.length?'Season dates are the 2026 dates stored with this hunt from the Utah DWR guidebook. 2027 season dates are not in that file.':'No season dates were stored for this hunt.',
      source:Cal.SRC.utGuide, yearLabel:ranges.length?'2026':'Not in the file'
    };
  }
  if(state==='az'){
    const h=pack.AH[huntId];
    if(!h)return null;
    const ranges=Cal.parseAz(h.d)||[];
    return {
      key:'az:'+huntId, state, huntId, species:h.sp,
      label:'Arizona '+(h.area||huntId)+' '+(h.legal||h.sp)+(h.d?', '+h.d:''),
      flag:'Arizona '+(h.area||huntId),
      kind:'', ranges, also:[],
      note:ranges.length?'Season text is the date string in the Arizona hunt file, from the regulations. 2027 elk, pronghorn, and fall dates are not published yet.':'This hunt has no date string that could be read as a start and end. It is left off the timeline.',
      source:Cal.SRC.azReg, yearLabel:ranges.length?ranges[0].start.slice(0,4):'Not read'
    };
  }
  if(state==='wy'){
    const h=pack.WH[huntId];
    if(!h)return null;
    return {
      key:'wy:'+huntId, state, huntId, species:h.sp,
      label:'Wyoming '+h.sp+' area '+String(+h.area)+(h.desc?', '+h.desc:''),
      flag:'Wyoming '+String(+h.area),
      kind:'', ranges:[], also:[],
      note:'Season dates are not in the WGFD 2026 draw-odds file, so this hunt has no bar. Application windows are listed from the WGFD dates page.',
      source:Cal.SRC.wyDates, yearLabel:'Season dates not in the file'
    };
  }
  if(state==='id'){
    const h=pack.IH[huntId];
    if(!h)return null;
    const ranges=[];
    for(const g of h.seg||[]){
      const a=Cal.parseSlash(g.o), b=Cal.parseSlash(g.c);
      if(a&&b)ranges.push({start:a,end:b,label:(g.s||'')+(g.m?', '+g.m:'')});
    }
    return {
      key:'id:'+huntId, state, huntId, species:h.sp,
      label:'Idaho hunt '+h.n+', area '+h.area,
      flag:'Idaho area '+h.area,
      kind:'', ranges, also:[],
      note:ranges.length?'Season lines are the 2026 rows stored for this hunt number from the IDFG Hunt Planner.':'The Hunt Planner row stored here had no open and close dates, so none are shown.',
      source:{name:'IDFG Hunt Planner',url:'https://idfg.idaho.gov/ifwis/huntplanner/filter/'},
      yearLabel:ranges.length?'2026':'Not in the file'
    };
  }
  if(state==='nv'){
    const h=pack.NH[huntId];
    if(!h)return null;
    const ranges=Cal.parseNv(h.season)||[];
    const src=pack.NV_META&&pack.NV_META.src&&h.src&&pack.NV_META.src[h.src];
    return {
      key:'nv:'+huntId, state, huntId, species:h.sp,
      label:'Nevada units '+h.units+(h.season?', '+h.season:''),
      flag:'Nevada '+h.units,
      kind:'', ranges, also:[],
      note:'These are the 2025 season dates printed on the bonus-point table. 2026 hunt-level season dates are not in this file. 2027 main-draw dates are not in Commission Regulation 26-01.',
      source:src?{name:'NDOW bonus-point table',url:src}:Cal.SRC.nvCr,
      yearLabel:'2025'
    };
  }
  return null;
}
const KEY='rw_fp_saved';
function readSaved(){
  try{const o=JSON.parse(localStorage.getItem(KEY)||'{}');return Array.isArray(o.hunts)?o.hunts:[]}catch(e){return []}
}
function writeSaved(hunts){
  localStorage.setItem(KEY, JSON.stringify({hunts}));
}
function upsert(hunt){
  const hunts=readSaved().filter(h=>h.key!==hunt.key);
  hunts.push(hunt);
  writeSaved(hunts);
  return hunts;
}
root.RWLoad={PACKS,loadPack,record,readSaved,writeSaved,upsert,KEY};
})(typeof window!=='undefined'?window:globalThis);
