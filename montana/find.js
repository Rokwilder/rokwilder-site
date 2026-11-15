// Montana limited draws. 2026 first choice.
// Bonus points are squared and one is added for this year's application.
// A stored band is the result at that exact point level. A missing level is not filled in.
// Exact percents render only when the Full Pass file adds raw and window.RW_FP is set.
(function(){
const FP=window.RW_FP===true && typeof MH==='object' && Object.values(MH).some(h=>h&&h.raw);
const pct=v=>{const r=Math.round(v*100);return v>0&&r===0?'under 1%':v<1&&r===100?'over 99%':r+'%'};
const paid=()=>window.RWGate?RWGate.paid():FP;
const SAMPLES=new Set((MT_META.samples||[]).map(String));
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const H=Object.entries(MH);
const SP={elk:'Elk',deer:'Deer',antelope:'Antelope',moose:'Moose',sheep:'Bighorn sheep',goat:'Mountain goat',bison:'Bison',bear:'Black bear'};
const CLS={permit:'Permit',B:'B license',archery:'Archery',license:'License'};
const SXN={M:'Antlered',F:'Antlerless',E:'Either sex','':'Any'};
const WORD={1:'ALL DREW',0.75:'MOST DREW',0.25:'SOME DREW',0.05:'FEW DREW',0.01:'UNDER ONE IN TWENTY',0:'NONE DREW'};
const COL={1:'#263E2C',0.75:'#6F7F4F',0.25:'#C4B28C',0.05:'#D2501F'};
const MC={all:'#263E2C',most:'#6F7F4F',some:'#C4B28C',few:'#D2501F',none:'#E8E0D2',line:'#1E1E1C',sel:'#E8E0D2'};
let S={sp:'elk',cls:'',sx:'',wpn:'',res:'res',pts:0,unit:'',youth:true,n:25,focus:'',ord:'',tab:'list',ol:''};
let unitCtl=null;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const usesPts=()=>S.sp!=='bison';
function sideOf(h){return h.od&&h.od[S.res]}
function bandAt(h){
  const side=sideOf(h);if(!side)return null;
  if(!h.pts)return side.band==null?null:side.band;
  if(Object.prototype.hasOwnProperty.call(side.bp,S.pts))return side.bp[S.pts];
  if(Object.prototype.hasOwnProperty.call(side.bp,String(S.pts)))return side.bp[String(S.pts)];
  return null;
}
function rawLv(h){
  const raw=h.raw&&h.raw[S.res];if(!raw)return null;
  if(!h.pts)return raw.rate1==null?null:raw;
  const lv=raw.lv;if(!lv)return null;
  return lv[S.pts]!=null?lv[S.pts]:lv[String(S.pts)];
}
function chanceAt(h,pts){
  const side=h.od&&h.od[S.res];if(!side)return null;
  if(!h.pts){
    if(FP&&h.raw&&h.raw[S.res]&&typeof h.raw[S.res].rate1==='number')return h.raw[S.res].rate1;
    return side.band==null?null:side.band;
  }
  const key=Object.prototype.hasOwnProperty.call(side.bp,pts)?pts:String(pts);
  if(!Object.prototype.hasOwnProperty.call(side.bp,key))return null;
  if(FP&&h.raw&&h.raw[S.res]&&h.raw[S.res].lv){
    const row=h.raw[S.res].lv[pts]!=null?h.raw[S.res].lv[pts]:h.raw[S.res].lv[String(pts)];
    if(row&&typeof row.rate1==='number')return row.rate1;
  }
  return side.bp[key];
}
function word(h,v){
  if(v==null)return 'NO ROW AT THIS POINT LEVEL';
  if(h.unl&&v===1)return 'UNLIMITED';
  return WORD[v]||(v>0?'UNDER ONE IN TWENTY':'NONE DREW');
}
function oddsHTML(h){
  if(!FP)return '';
  const row=rawLv(h);
  if(!row||typeof row.rate1!=='number')return '<span class="fo"><span class="fpn">No 2026 first-choice count at this point level</span></span>';
  const n=(typeof row.s1==='number'&&typeof row.a1==='number'&&row.a1>0)?`, ${row.s1.toLocaleString()} drawn of ${row.a1.toLocaleString()}`:'';
  const label=h.pts?`2026 first choice at ${S.pts} bonus point${S.pts===1?'':'s'}`:'2026 first choice';
  return `<div class="fo"><b>${pct(row.rate1)}</b> <span>${label}${n}</span></div>`;
}
function passes(h){
  if(h.sp!==S.sp||!sideOf(h))return false;
  if(S.cls&&h.cls!==S.cls)return false;
  if(S.sx&&h.sx!==S.sx)return false;
  if(S.wpn&&h.wpn!==S.wpn)return false;
  if(!S.youth&&h.youth)return false;
  return true;
}
function pool(){return H.filter(([,h])=>passes(h))}
function tie(a,b){
  const d=RWUnit.sortNum([a.h.area])-RWUnit.sortNum([b.h.area]);
  if(d)return d;
  return String(a.h.lpt).localeCompare(String(b.h.lpt),undefined,{numeric:true});
}
function rowMeasure(x){return RWDraw.measure(p=>chanceAt(x.h,p), usesPts()?S.pts:0)}
function ranked(){
  return pool().filter(([k,h])=>RWUnit.hit([h.area],S.unit)&&bandAt(h)!=null&&bandAt(h)>=0.05).map(([k,h])=>({k,h,v:bandAt(h)})).sort((a,b)=>b.v-a.v||tie(a,b));
}
function rowsInOrder(all){
  if(S.ord==='hard'||S.ord==='easy')return RWDraw.order(all,S.ord,rowMeasure,tie);
  if(S.focus==='land')return all.slice().sort((a,b)=>RWLand.rank(mtBand(b.h))-RWLand.rank(mtBand(a.h))||b.v-a.v||tie(a,b));
  return all;
}
const below=()=>pool().filter(([,h])=>{const v=bandAt(h);return v!=null&&v<0.05}).length;
const missing=()=>pool().filter(([,h])=>bandAt(h)==null).length;
function maxPts(){return usesPts()?(MT_META.maxp[S.sp]||0):0}
function whoLine(){
  const bits=[SP[S.sp]];
  if(S.cls)bits.push(CLS[S.cls]||S.cls);
  if(S.sx)bits.push(SXN[S.sx]);
  if(S.wpn)bits.push(S.wpn==='bow'?'Archery only':'Any legal weapon');
  bits.push(S.res==='res'?'Montana resident':'Out of state');
  if(usesPts())bits.push(S.pts+' bonus point'+(S.pts===1?'':'s'));
  return bits.join(' · ');
}
function title(h){
  const name=h.name&&h.name.length<48?` · ${esc(h.name)}`:'';
  return `HD ${esc(h.area)} · ${esc(h.lpt)}${name}`;
}
function mtBand(h){return RWLand.band('mt', RWLand.mtKey(h.sp, h.area))}
function landExtra(h,v){
  if(!paid())return '';
  if(h.privateOnly)return RWLand.extra({privateOnly:true,place:'HD '+h.area,href:RWLand.pkgHref('../','mt',h.area)});
  const b=mtBand(h);
  if(!b)return '';
  return RWLand.extra({band:b,land:b,voice:'history',odds:RWLand.oddsKind(v),place:'HD '+h.area,href:RWLand.pkgHref('../','mt',h.area)});
}
function card(x,i,full){
  const bits=full?RWLand.splitNext(landExtra(x.h,x.v)):{info:'',next:''};
  const trophy=full&&window.RWTrophy?RWTrophy.chip(x.k):'';
  return `<li><button class="fh" data-k="${esc(x.k)}"><span class="rk">${i+1}</span><span class="fv"><i class="vdot" style="background:${COL[x.v]||'#E8E0D2'}"></i>${word(x.h,x.v)}</span><span class="ft">${title(x.h)}</span><span class="fd">${esc(x.h.desc)}</span><span class="fd">${esc(x.h.wlab)} · 2026 first choice · historical result</span>${oddsHTML(x.h)}${RWHy(x.k,S.res,usesPts()?S.pts:null)}${trophy}${bits.info}</button>${bits.next}</li>`;
}
function focusBar(){return `<div class="sbar"><span class="lbl">What matters most to you?</span><div class="seg"><button type="button" data-focus="" class="${S.focus?'':'on'}">Draw result</button><button type="button" data-focus="land" class="${S.focus==='land'?'on':''}">Public land</button></div></div>`}
function showList(sc){
  const o=$('out');$('detail').hidden=true;o.hidden=false;
  if(LM&&S.tab!=='map'){LM.remove();LM=null}
  const all=ranked(), nb=below(), nm=missing();
  const note=`<p class="note">Bands are the 2026 first-choice result at this bonus-point level. They are not a chance in a future draw. Under one in twenty stays off the list${nb?` (${nb} hunt${nb===1?'':'s'} in that group)`:''}. ${nm?`${nm} hunt${nm===1?' has':'s have'} no first-choice row at ${S.pts} point${S.pts===1?'':'s'}.`:''} Not a guarantee. Check the current FWP regulation before you apply.</p>`+(paid()?`<p class="note">${RWLand.pageNote('mt')}</p>`:'');
  if(!paid()){
    const samples=RWGate.takePerUnit(all.filter(x=>SAMPLES.has(String(x.h.area))), x=>x.h.area);
    const who=SAMPLES.size?`Districts ${[...SAMPLES].join(' and ')}`:'the sample districts';
    o.innerHTML=RWGate.freeShell({count:all.length,species:(SP[S.sp]||'hunt').toLowerCase(),who:esc(whoLine())+'.',pricing:'../pricing.html',sampleNote:`<b>Sample.</b> ${who} only, up to 3 hunts from each. This is not your whole list.`,samplesHtml:samples.length?`<ol class="fl">`+samples.map((x,i)=>card(x,i,false)).join('')+'</ol>':''});
    o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));
    if(sc)o.scrollIntoView({behavior:'smooth'});
    return;
  }
  const ordered=rowsInOrder(all);
  const list=window.RWTrophy?RWTrophy.refine(ordered):ordered;
  const ban=window.RWGate?RWGate.banner():'';
  const lead=(window.RWTrophy&&RWTrophy.sortNote())||(S.ord==='hard'?'Hardest to draw first.':S.ord==='easy'?'Easiest to draw first.':(S.focus==='land'?'Mostly public land first.':'Strongest 2026 result first.'));
  const tabs=mapTabs();
  if(S.tab==='map'){
    o.innerHTML=ban+`<h2 id="lt">${list.length} hunt${list.length===1?'':'s'} at this point level</h2>`+tabs+`<p class="dq">${esc(whoLine())}. Colored districts have at least one hunt at one in twenty or better. The color is the best 2026 result in that district.</p>`+mapKey()+`<div id="map" class="gmap" aria-label="Map of Montana hunting districts"></div><div id="mpanel" hidden></div>`+mapCred()+note;
    o.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;showList()});
    drawMap(list);if(sc)o.scrollIntoView({behavior:'smooth'});return;
  }
  o.innerHTML=ban+`<h2 id="lt">${list.length} hunt${list.length===1?'':'s'} at this point level</h2>`+tabs+focusBar()+RWDraw.bar(S.ord,usesPts())+(window.RWTrophy?RWTrophy.bar(S.sp):'')+`<p class="dq">${esc(whoLine())}. ${lead} Tap a hunt for the other point levels.</p><ol class="fl">`+list.slice(0,S.n).map((x,i)=>card(x,i,true)).join('')+`</ol>`+(list.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(25,list.length-S.n)} more (${list.length-S.n} left)</button>`:'')+(list.length?'':`<p class="dq">No 2026 first-choice row at this point level reached one in twenty. Try another license type, another point level, or the other residency.</p>`)+note;
  o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));
  o.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;S.n=25;showList()});
  o.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>{S.focus=b.dataset.focus;S.n=25;showList()});
  RWDraw.wire(o,v=>{S.ord=v;S.n=25;showList()});
  if(window.RWTrophy)RWTrophy.wire(o,()=>{S.n=25;showList()});
  if($('more'))$('more').onclick=()=>{S.n+=25;showList()};
  if(sc)o.scrollIntoView({behavior:'smooth'});
}
function ladder(h){
  if(!h.pts){
    const row=FP?rawLv(h):null;
    if(row&&typeof row.rate1==='number')return `<p class="lh">2026 first-choice result</p><p class="dq">${pct(row.rate1)}${typeof row.s1==='number'?`, ${row.s1.toLocaleString()} drawn of ${row.a1.toLocaleString()}`:''}. There is no bonus-point ladder in the 2026 bison report.</p>`;
    const v=bandAt(h);
    return `<p class="lh">2026 first-choice result</p><p class="dq">${word(h,v)}. FWP did not publish a bison bonus-point report for 2026.</p>`;
  }
  if(FP&&h.raw&&h.raw[S.res]&&h.raw[S.res].lv){
    const lv=h.raw[S.res].lv;
    const pts=Object.keys(lv).map(Number).filter(n=>!Number.isNaN(n)).sort((a,b)=>a-b);
    const quota=h.raw[S.res].quota!=null?`<p class="dq">Quota in the 2026 drawing statistics: ${h.raw[S.res].quota==='UNL'?'unlimited':Number(h.raw[S.res].quota).toLocaleString()}.</p>`:'';
    return `<p class="lh">2026 first-choice result by bonus-point level</p>${quota}<table class="dt"><tr><th>Bonus points</th><th>Chances</th><th>1st choice</th></tr>`+pts.map(n=>{
      const row=lv[n]!=null?lv[n]:lv[String(n)];
      const first=row&&typeof row.rate1==='number'?`${pct(row.rate1)}${typeof row.s1==='number'?` (${row.s1.toLocaleString()} of ${row.a1.toLocaleString()})`:''}`:'';
      return `<tr class="${n===S.pts?'on':''}"><td>${n}</td><td>${n*n+1}</td><td>${first}</td></tr>`;
    }).join('')+'</table><p class="dq">Chances are the squared points plus one for this application. They are not a success rate. A level is listed when the file has a row.</p>';
  }
  const bp=(sideOf(h)||{}).bp||{};
  const pts=Object.keys(bp).map(Number).sort((a,b)=>a-b);
  return `<p class="lh">2026 first-choice result by bonus-point level</p><table class="dt"><tr><th>Bonus points</th><th>Result</th></tr>`+pts.map(n=>`<tr class="${n===S.pts?'on':''}"><td>${n}</td><td>${word(h,bp[n])}</td></tr>`).join('')+'</table><p class="dq">Words only. A blank level is not a zero.</p>';
}
function harvestHTML(h){
  const root=(typeof MT_HARV!=='undefined'?MT_HARV:window.MT_HARV);
  const bag=root&&root[h.sp]&&root[h.sp][h.area];
  if(!bag)return '<h3>Harvest</h3><p class="dq">Not published for this district in the 2023 to 2025 FWP harvest estimates. 2026 harvest is not published yet.</p>';
  if(h.sp==='deer'){
    const kinds=[['md','Mule deer'],['wt','White-tailed deer']].filter(([k])=>bag[k]);
    if(!kinds.length)return '<h3>Harvest</h3><p class="dq">Not published for this district.</p>';
    return '<h3>Harvest</h3><p class="dq">FWP harvest estimates for the whole district, not this license only. 2026 harvest is not published yet.</p>'+kinds.map(([k,lab])=>{
      const years=bag[k];
      return `<p class="lh">${lab}</p><table class="dt"><tr><th>Year</th><th>Harvest</th><th>4 or more points</th><th>Success</th></tr>`+Object.keys(years).sort().map(y=>{
        const c=years[y];
        const bucks=(c.lt4||0)+(c.ge4||0);
        const four=bucks?`${c.ge4} of ${bucks} classed bucks`:'not published';
        const suc=c.success==null?'not published':pct(c.success);
        return `<tr><td>${y}</td><td>${c.harvest}</td><td>${four}</td><td>${suc}</td></tr>`;
      }).join('')+'</table>';
    }).join('');
  }
  const years=bag;
  const male=h.sp==='elk'?'6 or more points':h.sp==='antelope'?'Bucks':h.sp==='sheep'?'Rams':h.sp==='goat'?'Billies':'Males';
  return '<h3>Harvest</h3><p class="dq">FWP harvest estimates for the whole district, not this license only. 2026 harvest is not published yet.'+(h.sp==='elk'?' The 2025 elk file has harvest filled and hunter counts at zero for most districts, so 2025 success is not shown.':'')+'</p><table class="dt"><tr><th>Year</th><th>Harvest</th><th>'+male+'</th><th>Success</th></tr>'+Object.keys(years).sort().map(y=>{
    const c=years[y];
    let mid='';
    if(h.sp==='elk'){
      const classed=(c.spike||0)+(c.lt6||0)+(c.ge6||0);
      mid=classed?`${c.ge6} of ${classed} classed bulls`:'not published';
    }else mid=String(c.males!=null?c.males:(c.m!=null?c.m:''));
    const suc=(h.sp==='elk'&&y==='2025')||c.success==null?'not published':pct(c.success);
    return `<tr><td>${y}</td><td>${c.harvest}</td><td>${mid}</td><td>${suc}</td></tr>`;
  }).join('')+'</table>';
}
function loHTML(h){
  if(!FP||!h.raw||!h.raw.lo)return '';
  const side=S.res==='res'?'res':'nr';
  const bag=h.raw.lo[side];
  if(!bag||!bag.lv)return '';
  const pts=Object.keys(bag.lv).map(Number).sort((a,b)=>a-b);
  return `<h3>Landowner preference</h3><p class="dq">Landowner applicants are drawn first. These rows are not the regular ${S.res==='res'?'resident':'nonresident'} odds above.</p><table class="dt"><tr><th>Bonus points</th><th>1st choice</th></tr>`+pts.map(n=>{
    const row=bag.lv[n];
    return `<tr><td>${n}</td><td>${pct(row.rate1)} (${row.s1.toLocaleString()} of ${row.a1.toLocaleString()})</td></tr>`;
  }).join('')+'</table>';
}
async function showDetail(k,sc){
  if(!paid()&&!(MH[k]&&SAMPLES.has(String(MH[k].area)))){showList(sc);return}
  const h=MH[k];if(!h)return;
  const v=bandAt(h);const o=$('detail');$('out').hidden=true;o.hidden=false;
  if(LM){LM.remove();LM=null}
  const chances=h.pts?`<p class="how">At ${S.pts} bonus point${S.pts===1?'':'s'}, FWP's formula is ${S.pts} squared plus 1, which is ${S.pts*S.pts+1} chances. That is not a success rate.</p>`:'';
  let where='';
  if(MAPS[h.sp]){
    where=`<h3>Where this hunt is</h3><p class="dq">Hunting district ${esc(h.area)}. A license that covers only part of a district, or more than one district, is still drawn on the whole district boundary.</p><div id="dmap" class="gmap dm" data-area="${esc(h.area)}" aria-label="Map of this hunting district"></div>${mapCred()}`;
  }
  o.innerHTML=`<button class="btn o" id="back">Back to the list</button><h2>${title(h)}</h2><p class="dq">${esc(whoLine())}</p><div class="fv"><i class="vdot" style="background:${COL[v]||'#E8E0D2'}"></i>${word(h,v)}</div>${oddsHTML(h)}${RWHy(k,S.res,usesPts()?S.pts:null)}${window.RWTrophy?RWTrophy.block(k):''}<p class="how">${esc(h.desc)}. ${esc(h.season)}${h.note&&h.note.split(/\s+/).length>=8?` ${esc(h.note)}.` :''} ${h.firstOnly?'The 2026 report says this is first choice only.':''} This is a 2026 result, not a forecast.</p>${chances}${harvestHTML(h)}${landExtra(h,v)}${where}${ladder(h)}${loHTML(h)}<p class="note">Source: <a href="${esc(MT_META.pages.stats)}">FWP 2026 drawing statistics</a>. Regulations: <a href="${esc(h.sp==='moose'||h.sp==='sheep'||h.sp==='goat'||h.sp==='bison'?MT_META.pages.msgb:MT_META.pages.regs)}">2026 FWP regulations</a>. Harvest: <a href="${esc(MT_META.pages.harvest)}">FWP harvest estimates</a>.</p>`;
  $('back').onclick=()=>showList(1);
  if($('dmap'))drawDetailMap(k);
  if(sc)o.scrollIntoView({behavior:'smooth'});
}
function seg(id,attr,cur,pairs){
  const box=$(id);box.innerHTML=pairs.map(x=>`<button data-${attr}="${x[0]}" class="${cur===x[0]?'on':''}">${x[1]}</button>`).join('');
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>{S[attr]=b.dataset[attr];if(attr==='res'||attr==='cls')S.pts=Math.min(S.pts,maxPts());paint()});
}
function options(pred, field){
  const seen=[];
  for(const [,h] of H){if(!pred(h))continue;const v=h[field]||'';if(!seen.includes(v))seen.push(v)}
  return seen;
}
function paint(){
  document.querySelectorAll('[data-sp]').forEach(b=>b.classList.toggle('on',b.dataset.sp===S.sp));
  const classes=options(h=>h.sp===S.sp,'cls').filter(Boolean);
  $('clsbox').hidden=classes.length<2;
  if(S.cls&&!classes.includes(S.cls))S.cls='';
  seg('clsseg','cls',S.cls,[['', 'Any']].concat(classes.map(c=>[c,CLS[c]||c])));
  const sexes=options(h=>h.sp===S.sp&&(!S.cls||h.cls===S.cls),'sx').filter(Boolean);
  $('sxbox').hidden=sexes.length<2;
  if(S.sx&&!sexes.includes(S.sx))S.sx='';
  seg('sxseg','sx',S.sx,[['', 'Any']].concat(sexes.map(x=>[x,SXN[x]||x])));
  $('sxnote').textContent='The class is the wording on the 2026 regulation line or the drawing report. A blank class was not named there.';
  const wpns=options(h=>passes(Object.assign({},h))|| (h.sp===S.sp&&(!S.cls||h.cls===S.cls)&&(!S.sx||h.sx===S.sx)),'wpn').filter(Boolean);
  const wset=[];
  for(const [,h] of H){if(h.sp!==S.sp)continue;if(S.cls&&h.cls!==S.cls)continue;if(S.sx&&h.sx!==S.sx)continue;if(!wset.includes(h.wpn))wset.push(h.wpn)}
  $('wpnbox').hidden=wset.length<2;
  if(S.wpn&&!wset.includes(S.wpn))S.wpn='';
  seg('wpnseg','wpn',S.wpn,[['', 'Any']].concat(wset.map(w=>[w,w==='bow'?'Archery only':'Any legal weapon'])));
  document.querySelectorAll('[data-res]').forEach(b=>b.classList.toggle('on',b.dataset.res===S.res));
  const mx=maxPts();
  $('ptsbox').hidden=!usesPts();
  $('bisonnote').hidden=usesPts();
  if(!usesPts())S.pts=0;
  S.pts=Math.max(0,Math.min(S.pts,mx));
  $('pv').textContent=S.pts;
  $('ptnote').textContent=mx?`The stepper stops at ${mx}, the highest total in the 2026 tables for ${SP[S.sp].toLowerCase()}. There is no legal maximum. A missing level is not a zero.`:'This species has no 2026 bonus-point table for these choices.';
  const n=pool().length;
  $('empty').hidden=n>0;
  $('empty').textContent=n?'':`The 2026 reports used here have no ${S.res==='res'?'resident':'nonresident'} table for these choices.`;
  if(unitCtl){unitCtl.refresh();const el=$('unitq');if(el&&el.value!==S.unit)unitCtl.set(S.unit)}
}
const MAPS={
  elk:{file:'elk.json'},deer:{file:'deer.json'},antelope:{file:'antelope.json'},
  moose:{file:'moose.json'},sheep:{file:'sheep.json'},goat:{file:'goat.json'},bison:{file:'bison.json'}
};
function mapTabs(){return `<div class="tabs" role="tablist"><button type="button" class="tb${S.tab==='list'?' on':''}" data-tab="list">List</button><button type="button" class="tb${S.tab==='map'?' on':''}" data-tab="map">Map</button></div>`}
function mapCred(){return `<p class="mapcred"><b>Hunting district boundaries: Montana Fish, Wildlife and Parks.</b> The layer is the 2026 and 2027 season boundary. Lines are simplified. <a href="${esc(MT_META.pages.legal)}">2026 and 2027 legal descriptions</a>. The written boundary is the one that counts. A license for only part of a district is not given its own shape.</p>`}
function mapKey(){
  const items=[['all','All drew',MC.all],['most','Most drew',MC.most],['some','Some drew',MC.some],['few','Few drew',MC.few],['none','No hunt at one in twenty',MC.none]];
  return `<div class="mkey" id="mkey" role="group" aria-label="Map key"><p class="mkh">Map key: the color is the best 2026 result in that district</p><ul>`+items.map(([b,w,c])=>`<li data-b="${b}"><i class="sw" style="background:${c}" aria-hidden="true"></i><span class="mkt"><b>${w}</b><span class="mkn"></span></span></li>`).join('')+'</ul></div>';
}
function fillKey(cnt){document.querySelectorAll('#mkey li[data-b]').forEach(li=>{const n=cnt[li.dataset.b]||0,s=li.querySelector('.mkn');li.classList.toggle('zero',!n);s.textContent=n?` · ${n} district${n===1?'':'s'}`:' · none'})}
const bucket=v=>v>=1?'all':v>=0.75?'most':v>=0.25?'some':v>=0.05?'few':'none';
let LM=null,DM=null,GJ=null;const GJS={};
const loadJS=src=>new Promise((ok,no)=>{const e=document.createElement('script');e.src=src;e.onload=ok;e.onerror=no;document.head.appendChild(e)});
async function ensureMap(){
  if(!MAPS[S.sp])throw new Error('no map');
  if(!window.L){const c=document.createElement('link');c.rel='stylesheet';c.href='../find/vendor/leaflet.css';document.head.appendChild(c);await loadJS('../find/vendor/leaflet.js')}
  if(!window.topojson)await loadJS('../find/vendor/topojson-client.min.js');
  const f=MAPS[S.sp].file;
  if(!GJS[f]){const t=await(await fetch(f)).json();GJS[f]=topojson.feature(t,t.objects.area)}
  GJ=GJS[f];
}
function byArea(rows){const m={};rows.forEach(x=>{const a=String(x.h.area);(m[a]=m[a]||[]).push(x)});return m}
async function drawMap(rows){
  const el=$('map');if(!el)return;
  if(!MAPS[S.sp]){el.innerHTML='<p class="dq">FWP\'s 2026 and 2027 district layer used here does not include a separate black bear boundary. Use the list.</p>';return}
  try{await ensureMap()}catch(e){el.innerHTML='<p class="dq">The map could not load. Use the List tab.</p>';return}
  if(!el.isConnected)return;if(LM){LM.remove();LM=null}
  LM=L.map(el,{zoomSnap:.25,minZoom:5,maxZoom:11,scrollWheelZoom:false,tap:true});
  LM.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>').addAttribution('Hunting districts: Montana Fish, Wildlife and Parks');
  const bu=byArea(rows),cnt={};
  const ly=L.geoJSON(GJ,{style:f=>{const a=String(f.properties.u),h=bu[a];return{color:MC.sel,opacity:.45,weight:.7,fillColor:h?COL[h[0].v]||MC.few:MC.none,fillOpacity:h?1:.9}},
    onEachFeature:(f,l)=>{const a=String(f.properties.u),h=bu[a];if(!h){l.options.interactive=false;return}l.bindTooltip('HD '+a,{sticky:true,direction:'top'});l.on('click',()=>{S.unit=a;if(unitCtl)unitCtl.set(a);S.tab='list';showList(1)})}}).addTo(LM);
  const seen=new Set();GJ.features.forEach(f=>{const a=String(f.properties.u);if(seen.has(a))return;seen.add(a);const h=bu[a];const b=h?bucket(h[0].v):'none';cnt[b]=(cnt[b]||0)+1});
  fillKey(cnt);LM.fitBounds(ly.getBounds(),{padding:[4,4]});
}
async function drawDetailMap(){
  const el=$('dmap');if(!el)return;
  try{await ensureMap()}catch(e){return}
  if(!el.isConnected)return;if(DM){DM.remove();DM=null}
  const id=String(el.dataset.area);
  DM=L.map(el,{zoomSnap:.25,minZoom:5,maxZoom:11,scrollWheelZoom:false,dragging:true,tap:false});
  DM.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>').addAttribution('Hunting districts: Montana Fish, Wildlife and Parks');
  const on=[];
  L.geoJSON(GJ,{interactive:false,style:f=>String(f.properties.u)===id?{color:MC.sel,weight:2.5,fillColor:MC.most,fillOpacity:.85}:{color:MC.sel,opacity:.3,weight:.5,fillColor:MC.none,fillOpacity:.35},
    onEachFeature:(f,l)=>{if(String(f.properties.u)===id)on.push(l)}}).addTo(DM);
  on.forEach(l=>l.bindTooltip(id,{permanent:true,direction:'center',className:'ulab'}));
  if(on.length)DM.fitBounds(L.featureGroup(on).getBounds(),{padding:[18,18],maxZoom:9});
  else el.insertAdjacentHTML('beforebegin','<p class="dq">This license code is not one numbered district on the 2026 and 2027 boundary layer, so it is not highlighted.</p>');
}
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;S.cls='';S.sx='';S.wpn='';S.pts=0;paint()});
document.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{S.res=b.dataset.res;paint()});
$('pm').onclick=()=>{S.pts=Math.max(0,S.pts-1);paint()};
$('pp').onclick=()=>{S.pts=Math.min(maxPts(),S.pts+1);paint()};
$('youth').onchange=e=>{S.youth=e.target.checked};
$('go').onclick=()=>{S.n=25;showList(1)};
unitCtl=RWUnit.bind({input:$('unitq'),clear:$('unitclr'),list:$('unitlist'),submit:()=>$('go').click(),onChange:v=>{S.unit=v},getUnits(){const s=[];const seen=new Set();for(const [,h] of H){if(h.sp!==S.sp)continue;const x=String(h.area);if(seen.has(x))continue;seen.add(x);s.push(x)}return s}});
if(Q.get('sp')&&SP[Q.get('sp')])S.sp=Q.get('sp');
if(Q.get('res')==='nr'||Q.get('res')==='res')S.res=Q.get('res');
if(Q.get('cls'))S.cls=Q.get('cls');
if(Q.get('sx'))S.sx=Q.get('sx');
if(Q.get('wpn'))S.wpn=Q.get('wpn');
if(Q.get('pts'))S.pts=+Q.get('pts')||0;
if(Q.get('unit'))S.unit=Q.get('unit');
if(Q.get('ord')==='hard'||Q.get('ord')==='easy')S.ord=Q.get('ord');
if(Q.get('tab')==='map')S.tab='map';
paint();
if(Q.get('go'))showList();
if(Q.get('k')&&MH[Q.get('k')]){const h=MH[Q.get('k')];S.sp=h.sp;S.cls='';S.sx='';S.wpn='';S.res=Q.get('res')==='nr'?'nr':'res';if(Q.get('pts'))S.pts=+Q.get('pts')||0;paint();showDetail(Q.get('k'))}
window.__DRAW={
  pointsMatter:usesPts,
  contexts(){
    const seen=new Set();const out=[];
    for(const [,h] of H){
      const id=[h.sp,h.cls,h.sx||'',h.wpn||''].join('|');
      if(seen.has(id+'|res'))continue;
      for(const res of ['res','nr']){
        const idr=id+'|'+res;if(seen.has(idr))continue;seen.add(idr);
        if(!Object.values(MH).some(x=>x.sp===h.sp&&x.cls===h.cls&&(x.sx||'')===(h.sx||'')&&(x.wpn||'')===(h.wpn||'')&&x.od&&x.od[res]))continue;
        out.push({id:idr,apply(){Object.assign(S,{sp:h.sp,cls:h.cls,sx:h.sx||'',wpn:h.wpn||'',res,unit:'',youth:true,focus:'',ord:'',tab:'list'})}});
      }
    }
    return out;
  },
  maxFor(){return maxPts()},
  setPts(p){S.pts=p},
  list(){return ranked()},
  ordered(dir){const prev=S.ord;S.ord=dir;try{return rowsInOrder(ranked())}finally{S.ord=prev}},
  measure:rowMeasure,
  tie
};
})();
