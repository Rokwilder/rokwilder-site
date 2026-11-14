// Unit comparison built from the same public find-page files.
// Bands and point levels only. Exact percentages stay out of this preview.
(function(root){
const YES=v=>v>=.995?"YES, you'll draw":v>=.75?'LIKELY':v>=.25?'MAYBE':v>=.05?'LONG SHOT':'NOT THIS YEAR';
const DREW=v=>v===1?'ALL DREW':v>=.75?'MOST DREW':v>=.25?'SOME DREW':v>=.05?'FEW DREW':v>0?'UNDER ONE IN TWENTY':v===0?'NONE DREW':'NO RESULT';
const LAND={pub:'Mostly public (70%+)',mix:'Mixed public/private (40-70%)',priv:'Mostly private (under 40%)'};
const HB=p=>p==null?null:p>=50?'High':p>=30?'Good':p>=15?'Fair':'Low';
const HBN={High:'50% or more',Good:'30 to 49%',Fair:'15 to 29%',Low:'Under 15%'};
const HR={High:4,Good:3,Fair:2,Low:1};
const LR={pub:3,mix:2,priv:1};
const TR={'Getting easier':3,'Holding steady':2,'Up and down':1,'One year stood out':1,'Getting harder':0};

const SAMPLE={
  co:['12','2'],
  ut:['Manti','La Sal Mtns'],
  az:['7','1'],
  wy:['100','102'],
  id:['31','37'],
  nv:['231','075']
};
const STATE_NAME={co:'Colorado',ut:'Utah',az:'Arizona',wy:'Wyoming',id:'Idaho',nv:'Nevada'};

function landOf(state, key){
  const L=root.RWLand;
  if(!L||!key)return null;
  const b=L.band(state, key);
  return b==='pub'||b==='mix'||b==='priv'?b:null;
}
function word(v, voice){
  if(v==null||v==='')return null;
  return voice==='history'?DREW(v):YES(v);
}
function oddsAtKeys(map, pts){
  if(!map)return {v:null, max:null};
  const keys=Object.keys(map).map(Number).filter(n=>!Number.isNaN(n)).sort((a,b)=>a-b);
  if(!keys.length)return {v:null, max:null};
  const max=keys[keys.length-1];
  const n=Math.min(pts, max);
  const hit=Object.prototype.hasOwnProperty.call(map, String(n))?map[String(n)]:null;
  return {v:hit, max, keys};
}
function likelyFrom(map){
  if(!map)return {pts:null, top:null};
  const keys=Object.keys(map).map(Number).filter(n=>!Number.isNaN(n)).sort((a,b)=>a-b);
  for(const n of keys)if(map[String(n)]>=.75)return {pts:n, top:keys[keys.length-1]};
  return {pts:null, top:keys.length?keys[keys.length-1]:null};
}
function likelyFromArr(arr){
  if(!arr)return {pts:null, top:null};
  for(let i=0;i<arr.length;i++)if(arr[i]>=.75)return {pts:i, top:arr.length-1};
  return {pts:null, top:arr.length?arr.length-1:null};
}
function histSide(hunt, side){
  if(!hunt)return null;
  if(hunt.y)return hunt;
  if(side&&hunt[side]&&hunt[side].y)return hunt[side];
  if(hunt.res&&hunt.res.y)return hunt.res;
  return null;
}
function historyOf(hist, huntId, side, pts, voice){
  if(!hist)return {missing:true, note:''};
  if(hist.hunts&&Object.keys(hist.hunts).length===0)return {missing:true, note:hist.note||'History not available'};
  const hunt=hist.hunts&&hist.hunts[huntId];
  const rec=histSide(hunt, side);
  if(!rec)return {missing:true, note:hist.note||'History not available'};
  const sample=Object.values(rec.y).find(v=>v!=null);
  const pointed=sample&&typeof sample==='object';
  let years=rec.y, trend=rec.t||null, n=rec.n||0;
  if(pointed){
    const key=String(pts);
    years={};
    for(const [yr,map] of Object.entries(rec.y)){
      if(map&&Object.prototype.hasOwnProperty.call(map, key))years[yr]=map[key];
    }
    n=rec.n&&rec.n[key]||0;
    trend=rec.t&&rec.t[key]||null;
  }
  const rows=Object.keys(years).sort().map(yr=>({year:yr, v:years[yr], word:word(years[yr], hist.words==='drew'||voice==='history'?'history':voice)}));
  if(!rows.length)return {missing:true, note:'History not available at this point level', pointed};
  return {missing:false, rows, trend:typeof trend==='string'?trend:null, n, note:hist.note||'', pointed};
}

function blank(state, unit, reason){
  return {state, unit, short:String(unit), label:STATE_NAME[state]+' '+unit, empty:true, reason,
    pointsLikely:null, odds:null, trend:null, harvest:null, land:null, history:{missing:true, rows:[], trend:null}};
}

function coUnits(k, D, FL){
  const f=FL&&FL[k];
  const raw=f&&f[2]?f[2]:[D[k][1]];
  return raw.map(x=>String(+x===+x?+x:x));
}
function coPriv(d){const l=d[4]||'';return /private/.test(l)&&!/public/.test(l)}
function coSea(k, sp){
  if(k.at(-1)!=='R')return null;
  const t=k[5], n=k[6];
  if(['deer','elk','pronghorn'].includes(sp)&&t==='O'&&'1234'.includes(n))return n;
  return null;
}
function coSex(k){return 'MFE'.includes(k[1])?k[1]:null}
function pickBest(cands, pts){
  const scored=cands.map(c=>{
    const o=c.oddsAt(pts);
    return {c, v:o==null?-1:o, hv:c.harvest==null?-1:c.harvest, lk:c.likely==null?999:c.likely};
  }).sort((a,b)=>b.v-a.v||b.hv-a.hv||a.lk-b.lk||String(a.c.id).localeCompare(String(b.c.id)));
  return scored.length?scored[0].c:null;
}

function profileCo(pack, q){
  const D=pack.D, FL=pack.FL, unit=String(+q.unit===+q.unit?+q.unit:q.unit);
  const hits=[];
  for(const k in D){
    const d=D[k];
    if(d[0]!==q.sp)continue;
    if(q.sx&&coSex(k)!==q.sx)continue;
    if(q.w&&k.at(-1)!==q.w)continue;
    if(q.se&&coSea(k, d[0])!==q.se)continue;
    if(!q.priv&&coPriv(d))continue;
    const us=coUnits(k, D, FL);
    if(!us.includes(unit))continue;
    if(us.length!==1)continue;
    const side=q.res==='nonres'?'nonres':'res';
    const map=d[5]&&d[5][side]&&d[5][side].o;
    const lk=likelyFrom(map);
    const hv=d[7]==null?null:+d[7];
    hits.push({
      id:k, season:d[2], likely:lk.pts, top:lk.top, harvest:hv,
      oddsAt:pts=>oddsAtKeys(map, pts).v,
      map
    });
  }
  if(!hits.length)return blank('co', unit, 'No matching hunt for this unit in the public file.');
  const best=pickBest(hits, q.pts);
  const got=oddsAtKeys(best.map, q.pts);
  const L=root.RWLand;
  const landKey=L?L.coKey(q.sp, [unit]):null;
  const hist=historyOf(pack.history, best.id, q.res==='nonres'?'nonres':'res', q.pts, 'forecast');
  const many=hits.length>1;
  return finish({
    state:'co', unit, short:unit,
    label:'Colorado '+unit,
    huntId:best.id,
    huntTitle:(q.sx==='M'?'Buck':q.sx==='F'?'Doe':q.sx==='E'?'Either sex':'Deer')+' · '+best.season+(many?' · easiest of '+hits.length+' hunts':''),
    pointsLikely:best.likely, pointsTop:best.top,
    odds:got.v, voice:'forecast',
    trend:hist.trend, history:hist,
    harvest:HB(best.harvest), harvestRaw:best.harvest,
    land:landOf('co', landKey),
    source:'CPW draw and harvest reports, same file as Find Your Hunt'
  });
}

function utSex(h){
  const x=(h.sex||'').toUpperCase();
  if(/^(BULL|BUCK|RAM|BEARDED)$/.test(x))return 'M';
  if(/^(COW|DOE|EWE)$/.test(x))return 'F';
  if(/HUNTER/.test(x))return 'E';
  return null;
}
function profileUt(pack, q){
  const UH=pack.UH, unit=String(q.unit);
  const hits=[];
  for(const k in UH){
    const h=UH[k];
    if(h.sp!==q.sp)continue;
    if(h.name!==unit)continue;
    if(h.cw&&!q.priv)continue;
    if(q.sx&&utSex(h)!==q.sx)continue;
    if(q.w&&!(h.w||'').includes(q.w))continue;
    const side=q.res==='nonres'?'nonres':'res';
    const arr=h.d&&h.d[side]&&h.d[side].o;
    const map={};
    if(arr)arr.forEach((v,i)=>{map[String(i)]=v});
    const lk=likelyFromArr(arr);
    const hv=h.hv?h.hv[3]:null;
    hits.push({id:k, season:(h.wn||[]).filter(x=>x!=='No Weapon').join(', ')||h.w, likely:lk.pts, top:lk.top, harvest:hv, oddsAt:pts=>{const i=Math.min(pts, arr?arr.length-1:0);return arr?arr[i]:null}, map, b:h.b, pool:h.pool});
  }
  if(!hits.length)return blank('ut', unit, 'No matching hunt for this unit in the public file.');
  const best=pickBest(hits, q.pts);
  const hist=historyOf(pack.history, best.id, q.res==='nonres'?'nonres':'res', q.pts, 'forecast');
  const L=root.RWLand;
  return finish({
    state:'ut', unit, short:unit, label:'Utah '+unit,
    huntId:best.id, huntTitle:best.season+(hits.length>1?' · easiest of '+hits.length+' hunts':''),
    pointsLikely:best.likely, pointsTop:best.top,
    odds:best.oddsAt(q.pts), voice:'forecast',
    trend:hist.trend, history:hist,
    harvest:HB(best.harvest==null?null:+best.harvest),
    land:landOf('ut', L?L.utKey(best.b):null),
    source:'Utah DWR draw reports, same file as Find Your Hunt'
  });
}

function azSex(h){
  const l=h.legal||'';
  if(/^(Bull elk|Buck pronghorn|Any antlered deer|Antlered (mule|whitetail) deer|Any ram|Bearded turkey)/.test(l))return 'M';
  if(/^(Antlerless )/.test(l))return 'F';
  if(/^Any /.test(l))return 'E';
  return null;
}
function profileAz(pack, q){
  const AH=pack.AH, unit=String(q.unit);
  const hits=[];
  for(const k in AH){
    const h=AH[k];
    if(h.sp!==q.sp)continue;
    const us=(h.u||[]).map(String);
    if(!us.includes(unit))continue;
    if(us.length!==1)continue;
    if(q.sx&&azSex(h)!==q.sx)continue;
    if(q.w&&h.w!==q.w)continue;
    const side=q.res==='nonres'?'nonres':'res';
    const arr=h.od&&h.od[side]&&h.od[side].o;
    const lk=likelyFromArr(arr);
    const hv=h.hv?h.hv[3]:null;
    hits.push({id:k, season:h.d||h.legal, likely:lk.pts, top:lk.top, harvest:hv, oddsAt:pts=>arr?arr[Math.min(pts, arr.length-1)]:null});
  }
  if(!hits.length)return blank('az', unit, 'No matching hunt for this unit in the public file.');
  const best=pickBest(hits, q.pts);
  const hist=historyOf(pack.history, best.id, q.res, q.pts, 'forecast');
  return finish({
    state:'az', unit, short:unit, label:'Arizona '+unit,
    huntId:best.id, huntTitle:best.season,
    pointsLikely:best.likely, pointsTop:best.top,
    odds:best.oddsAt(q.pts), voice:'forecast',
    trend:hist.trend, history:hist,
    harvest:HB(best.harvest==null?null:+best.harvest),
    land:null, landNote:'Arizona is not in the public-land file.',
    source:'AZGFD draw reports, same file as Find Your Hunt'
  });
}

function wyPool(q){return q.res==='nonres'?'nr':'res'}
function profileWy(pack, q){
  const WH=pack.WH;
  const area=String(+q.unit);
  const areaKey=String(area).padStart(3,'0');
  const hits=[];
  for(const k in WH){
    const h=WH[k];
    if(h.sp!==q.sp)continue;
    if(String(+h.area)!==area)continue;
    if(q.sx&&h.sx!==q.sx)continue;
    const b=h.od&&h.od[wyPool(q)];
    if(!b)continue;
    const lk=likelyFromArr(b.o);
    hits.push({id:k, season:(h.desc||'')+' '+(h.type? 'type '+h.type:''), likely:b.pts?lk.pts:null, top:b.pts?lk.top:null, noLadder:!b.pts, harvest:null, oddsAt:pts=>b.o[Math.min(pts, b.o.length-1)]});
  }
  if(!hits.length)return blank('wy', areaKey, 'No matching hunt for this area in the public file.');
  const best=pickBest(hits, q.pts);
  const hist=historyOf(pack.history, best.id, wyPool(q), q.pts, 'forecast');
  const L=root.RWLand;
  return finish({
    state:'wy', unit:areaKey, short:String(+area), label:'Wyoming '+String(+area),
    huntId:best.id, huntTitle:best.season.trim(),
    pointsLikely:best.noLadder?null:best.likely, pointsTop:best.top,
    pointsNote:best.noLadder?'Resident elk, deer, and pronghorn on this page are not a point ladder.':null,
    odds:best.oddsAt(q.pts), voice:'forecast',
    trend:hist.trend, history:hist,
    harvest:null, harvestNote:'Harvest is not in the Wyoming file.',
    land:landOf('wy', L?L.wyKey(q.sp, area):null),
    source:'WGFD 2026 draw odds, same file as Find Your Hunt'
  });
}

function profileId(pack, q){
  const IH=pack.IH, unit=String(q.unit).toUpperCase();
  const hits=[];
  for(const k in IH){
    const h=IH[k];
    if(h.sp!==q.sp)continue;
    if(String(h.area).toUpperCase()!==unit)continue;
    if(q.sx&&h.sex&&h.sex!==q.sx)continue;
    if(h.draw&&h.draw!==1)continue;
    const v=q.res==='nonres'?h.nr:h.res;
    const methods=(h.methods||[]).join(', ');
    if(q.w==='A'&&!/Archery/i.test(methods))continue;
    if(q.w==='M'&&!/Muzzle/i.test(methods))continue;
    if(q.w==='R'&&methods&&!/Any Weapon|Rifle/i.test(methods))continue;
    hits.push({id:k, season:methods||('Hunt '+h.n), likely:null, harvest:null, oddsAt:()=>v, v});
  }
  if(!hits.length)return blank('id', unit, 'No matching controlled hunt for this area in the public file.');
  const best=pickBest(hits, q.pts);
  const hist=historyOf(pack.history, best.id, q.res==='nonres'?'nonres':'res', q.pts, 'history');
  const L=root.RWLand;
  return finish({
    state:'id', unit, short:unit, label:'Idaho '+unit,
    huntId:best.id, huntTitle:best.season,
    pointsLikely:null, pointsNote:'Idaho controlled hunts on this page are not a point ladder. The band is the 2026 first-choice result.',
    odds:best.v, voice:'history',
    trend:hist.trend, history:hist,
    harvest:null, harvestNote:'Harvest is not in the Idaho controlled-hunt file.',
    land:landOf('id', L?L.idKey(unit):null),
    source:'IDFG 2026 drawing odds, same file as Find Your Hunt'
  });
}

function nvNorm(text){
  const L=root.RWLand;
  if(L){const key=L.nvKey(text);if(key)return key}
  return String(text||'').replace(/\s+/g,'');
}
function profileNv(pack, q){
  const NH=pack.NH, want=String(q.unit);
  const hits=[];
  for(const k in NH){
    const h=NH[k];
    if(h.sp!==q.sp)continue;
    if(q.sx&&h.sx!==q.sx)continue;
    if(h.live!==(q.res==='nonres'?'nr':'res'))continue;
    if(h.who&&h.who!=='main')continue;
    if(q.w==='A'&&h.wpn!=='bow')continue;
    if(q.w==='M'&&h.wpn!=='muz')continue;
    if(q.w==='R'&&h.wpn!=='alw')continue;
    const key=nvNorm(h.units);
    const ids=key?key.split('+'):[];
    const one=String(+want===+want?String(+want).padStart(3,'0'):want);
    if(ids.length!==1||ids[0]!==one)continue;
    const lk=likelyFrom(h.bp);
    const v=Object.prototype.hasOwnProperty.call(h.bp, String(q.pts))?h.bp[String(q.pts)]:null;
    hits.push({id:k, season:h.season, likely:lk.pts, top:lk.top, harvest:null, oddsAt:()=>v, v, units:h.units});
  }
  if(!hits.length)return blank('nv', want, 'No matching 2025 main-draw row for this unit in the public file.');
  const best=pickBest(hits, q.pts);
  const hist=historyOf(pack.history, best.id, null, q.pts, 'history');
  const L=root.RWLand;
  return finish({
    state:'nv', unit:want, short:String(+want||want), label:'Nevada '+String(+want||want),
    huntId:best.id, huntTitle:best.season,
    pointsLikely:best.likely, pointsTop:best.top,
    pointsNote:'Lowest published bonus-point level at MOST DREW or better. Missing levels are not filled in.',
    odds:best.v, voice:'history',
    oddsNote:best.v==null?'No 1st-choice row at this bonus-point level.':null,
    trend:hist.trend, history:hist,
    harvest:null, harvestNote:'Harvest is not in the Nevada file.',
    land:landOf('nv', L?L.nvKey(best.units):null),
    source:'NDOW 2025 main-draw tables, same file as Find Your Hunt'
  });
}

function finish(p){
  p.empty=false;
  p.oddsWord=p.oddsNote||word(p.odds, p.voice);
  p.pointsText=p.pointsNote?p.pointsNote:(p.pointsLikely==null?(p.pointsTop==null?'Not in the file':'Not likely in the published point table'):'Likely at '+p.pointsLikely+' point'+(p.pointsLikely===1?'':'s'));
  p.harvestText=p.harvest?p.harvest+' ('+HBN[p.harvest]+')':(p.harvestNote||'No harvest number');
  p.landText=p.land?LAND[p.land]:(p.landNote||'No public-land band');
  p.trendText=p.trend||(p.history&&p.history.missing?'No trend':(p.history&&p.history.trend)||'No trend');
  if(!p.trend)p.trend=p.history&&p.history.trend||null;
  return p;
}

const PROFILES={co:profileCo,ut:profileUt,az:profileAz,wy:profileWy,id:profileId,nv:profileNv};
function profile(state, pack, q){
  const fn=PROFILES[state];
  if(!fn)return blank(state, q.unit, 'That state is not on the site.');
  return fn(pack, q);
}

function listUnits(state, pack, q){
  const out=new Set();
  if(state==='co'){
    for(const k in pack.D){
      const d=pack.D[k];
      if(d[0]!==q.sp)continue;
      if(q.sx&&coSex(k)!==q.sx)continue;
      if(q.w&&k.at(-1)!==q.w)continue;
      if(!q.priv&&coPriv(d))continue;
      const us=coUnits(k, pack.D, pack.FL);
      if(us.length===1)out.add(us[0]);
    }
  }else if(state==='ut'){
    for(const k in pack.UH){
      const h=pack.UH[k];
      if(h.sp!==q.sp||(h.cw&&!q.priv))continue;
      if(q.sx&&utSex(h)!==q.sx)continue;
      if(q.w&&!(h.w||'').includes(q.w))continue;
      if(h.name)out.add(h.name);
    }
  }else if(state==='az'){
    for(const k in pack.AH){
      const h=pack.AH[k];
      if(h.sp!==q.sp)continue;
      if(q.sx&&azSex(h)!==q.sx)continue;
      if(q.w&&h.w!==q.w)continue;
      const us=(h.u||[]).map(String);
      if(us.length===1)out.add(us[0]);
    }
  }else if(state==='wy'){
    for(const k in pack.WH){
      const h=pack.WH[k];
      if(h.sp!==q.sp)continue;
      if(q.sx&&h.sx!==q.sx)continue;
      out.add(String(+h.area));
    }
  }else if(state==='id'){
    for(const k in pack.IH){
      const h=pack.IH[k];
      if(h.sp!==q.sp||h.draw!==1)continue;
      if(q.sx&&h.sex&&h.sex!==q.sx)continue;
      out.add(String(h.area));
    }
  }else if(state==='nv'){
    for(const k in pack.NH){
      const h=pack.NH[k];
      if(h.sp!==q.sp||h.who!=='main')continue;
      if(q.sx&&h.sx!==q.sx)continue;
      if(h.live!==(q.res==='nonres'?'nr':'res'))continue;
      const key=nvNorm(h.units);
      const ids=key?key.split('+'):[];
      if(ids.length===1)out.add(String(+ids[0]));
    }
  }
  return [...out].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}

function scoreDraw(p){
  if(p.empty)return [9999, 1];
  const pts=p.pointsLikely==null?500:p.pointsLikely;
  const odds=p.odds==null?-1:p.odds;
  return [pts, -odds];
}
function cmpPair(a,b){return a[0]-b[0]||a[1]-b[1]}
function winners(cols, score, better){
  const live=cols.filter(c=>!c.empty);
  if(live.length<2)return [];
  let best=null;
  for(const c of live){
    const s=score(c);
    if(s==null)continue;
    if(best==null||better(s, best.s))best={s, cols:[c]};
    else if(!better(best.s, s)&&!better(s, best.s))best.cols.push(c);
  }
  if(!best||best.cols.length===live.length)return [];
  return best.cols;
}
function drawWinners(cols){
  return winners(cols, scoreDraw, (a,b)=>cmpPair(a,b)<0);
}
function rankWinners(cols, rankOf){
  return winners(cols, c=>{const r=rankOf(c);return r==null?null:r}, (a,b)=>a>b);
}
function names(cols){
  if(cols.length===1)return cols[0].short;
  if(cols.length===2)return cols[0].short+' and '+cols[1].short;
  return cols.slice(0,-1).map(c=>c.short).join(', ')+', and '+cols[cols.length-1].short;
}
function same(ws, cols){return ws.length===1&&cols.length===1&&ws[0].short===cols[0].short}
function verdict(cols){
  const live=cols.filter(c=>!c.empty);
  if(live.length<2){
    if(!live.length)return 'These units have no matching hunt in the public file.';
    return 'Only '+live.map(c=>c.short).join(' and ')+' has a matching hunt for these choices, so there is no side-by-side winner.';
  }
  const d=drawWinners(live), l=rankWinners(live, c=>c.land?LR[c.land]:null), h=rankWinners(live, c=>c.harvest?HR[c.harvest]:null);
  if(live.length===2&&d.length===1&&l.length===1&&h.length===1&&same(d,l)&&!same(d,h))
    return d[0].short+' is easier to draw and has more public land, but '+h[0].short+' has better harvest.';
  if(live.length===2&&d.length===1&&l.length===1&&h.length===1&&same(l,h)&&!same(d,h))
    return d[0].short+' is easier to draw, but '+h[0].short+' has more public land and better harvest.';
  if(live.length===2&&d.length===1&&l.length===1&&h.length===1&&same(d,l)&&same(d,h))
    return d[0].short+' is easier to draw, with more public land and better harvest.';
  const bits=[];
  if(d.length===1)bits.push(d[0].short+' is easier to draw');
  else if(d.length)bits.push(names(d)+' are easier to draw');
  else bits.push('These units tie on how hard they are to draw');
  if(l.length===1)bits.push(l[0].short+' has more public land');
  else if(!l.length)bits.push('public land is a tie or missing');
  if(h.length===1)bits.push(h[0].short+' has better harvest');
  else if(!h.length&&live.some(c=>c.harvest))bits.push('harvest is a tie or missing');
  let s=bits[0];
  if(bits.length===2)s+=', and '+bits[1];
  else if(bits.length>2)s+=', '+bits.slice(1,-1).join(', ')+', and '+bits[bits.length-1];
  if(!/[.]$/.test(s))s+='.';
  return s.charAt(0).toUpperCase()+s.slice(1);
}
function marks(cols){
  const tag=(ws)=>new Set(ws.map(c=>cols.indexOf(c)));
  return {
    points:tag(winners(cols, c=>c.empty||c.pointsLikely==null?null:c.pointsLikely, (a,b)=>a<b)),
    odds:tag(winners(cols, c=>c.empty||c.odds==null?null:c.odds, (a,b)=>a>b)),
    trend:tag(winners(cols, c=>{const r=TR[c.trend];return r==null||r===1?null:r}, (a,b)=>a>b)),
    harvest:tag(rankWinners(cols, c=>c.harvest?HR[c.harvest]:null)),
    land:tag(rankWinners(cols, c=>c.land?LR[c.land]:null))
  };
}

function isSample(state, unit){
  const list=SAMPLE[state]||[];
  return list.includes(String(unit));
}

const api={YES,DREW,LAND,SAMPLE,STATE_NAME,profile,listUnits,verdict,marks,historyOf,isSample,word,HB};
root.RWFp=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
