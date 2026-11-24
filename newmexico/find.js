// New Mexico public draws. 2026 first choice. There is no point ladder.
// A stored band is the first-choice result in that pool. A missing pool is not filled in.
// Exact percents render only when the Full Pass file adds raw and window.RW_FP is set.
(function(){
const FP=window.RW_FP===true && typeof NH==='object' && Object.values(NH).some(h=>h&&h.raw);
const pct=v=>{const r=Math.round(v*100);return v>0&&r===0?'under 1%':v<1&&r===100?'over 99%':r+'%'};
const paid=()=>window.RWGate?RWGate.paid():FP;
const SAMPLES=new Set((NM_META.samples||[]).map(String));
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const H=Object.entries(NH);
const SP={elk:'Elk',deer:'Deer',pronghorn:'Pronghorn',oryx:'Oryx',barbary:'Barbary sheep',javelina:'Javelina',ibex:'Ibex',bighorn:'Bighorn sheep',bear:'Bear',turkey:'Turkey'};
const WORD={1:'ALL DREW',0.75:'MOST DREW',0.25:'SOME DREW',0.05:'FEW DREW',0.01:'LONG SHOT',0:'NONE DREW'};
const COL={1:'#263E2C',0.75:'#6F7F4F',0.25:'#C4B28C',0.05:'#D2501F'};
const MC={all:'#263E2C',most:'#6F7F4F',some:'#C4B28C',few:'#D2501F',long:'#D2501F',none:'#E8E0D2',line:'#1E1E1C',sel:'#E8E0D2'};
const POOL={res:'New Mexico resident',nr:'Nonresident',out:'Outfitter pool'};
let S={sp:'elk',wpn:'',bag:'',pool:'res',unit:'',youth:true,n:25,focus:'',ord:'',tab:'list'};
let unitCtl=null;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function usesRate(){return S.sp!=='bear'&&S.sp!=='turkey'}
function bandAt(h){
  if(!h.od||!Object.prototype.hasOwnProperty.call(h.od,S.pool))return null;
  return h.od[S.pool];
}
function chanceAt(h){
  if(!h.drawn)return null;
  if(FP&&h.raw&&h.raw[S.pool]&&typeof h.raw[S.pool].rate1==='number')return h.raw[S.pool].rate1;
  return bandAt(h);
}
function word(h,v){
  if(!h.drawn)return 'NOT PUBLISHED';
  if(v==null)return 'NO FIRST-CHOICE APPLICANTS';
  return WORD[v]||(v>0?'LONG SHOT':'NONE DREW');
}
function verdictLine(h,v){const text=word(h,v);if(!h.drawn||v==null)return text;return window.RWSeason?RWSeason.label(NM_META.year,'result',text):text}
function num(n){return typeof n==='number'?n.toLocaleString():'not published'}
function oddsHTML(h){
  if(!FP)return '';
  const raw=h.raw&&h.raw[S.pool];
  if(!h.drawn)return '<span class="fo"><span>First-choice drawn count was not published for 2026</span></span>';
  if(!raw||typeof raw.rate1!=='number')return '<span class="fo"><span>No 2026 first-choice applicants in this pool</span></span>';
  const n=(typeof raw.s1==='number'&&typeof raw.a1==='number')?`, ${raw.s1.toLocaleString()} drawn of ${raw.a1.toLocaleString()}`:'';
  return `<div class="fo"><b>${pct(raw.rate1)}</b> <span>2026 first choice${n}</span></div>`;
}
function passes(h){
  if(h.sp!==S.sp)return false;
  if(S.wpn&&h.wpn!==S.wpn)return false;
  if(S.bag&&h.bag!==S.bag)return false;
  if(!S.youth&&h.youth)return false;
  return true;
}
function pool(){return H.filter(([,h])=>passes(h))}
function tie(a,b){
  const au=a.h.units&&a.h.units.length?a.h.units:[a.h.area];
  const bu=b.h.units&&b.h.units.length?b.h.units:[b.h.area];
  const d=RWUnit.sortNum(au)-RWUnit.sortNum(bu);
  if(d)return d;
  return String(a.h.code).localeCompare(String(b.h.code),undefined,{numeric:true});
}
function rowMeasure(x){
  if(!x.h.drawn)return {need:0,rate:0};
  return RWDraw.measure(()=>chanceAt(x.h),0);
}
function listed(){
  return pool().filter(([,h])=>RWUnit.hit(h.units&&h.units.length?h.units:[h.area],S.unit)&&(h.drawn?bandAt(h)!=null&&bandAt(h)>0:true)).map(([k,h])=>({k,h,v:h.drawn?bandAt(h):null}));
}
function rowsInOrder(all){
  if(!usesRate())return all.slice().sort(tie);
  if(S.ord==='hard'||S.ord==='easy')return RWDraw.order(all,S.ord,rowMeasure,tie);
  if(S.focus==='land')return all.slice().sort((a,b)=>RWLand.rank(nmBand(b.h))-RWLand.rank(nmBand(a.h))||(b.v||0)-(a.v||0)||tie(a,b));
  return RWDraw.byDraw(all,row=>RWDraw.spanBand(row.k,S.pool,null),row=>row.v||0,tie);
}
function whoLine(){
  const bits=[SP[S.sp],S.wpn?(S.wpn==='bow'?'Bow':S.wpn==='muzzle'?'Muzzleloader':'Any legal sporting arm'):null,S.bag||null,POOL[S.pool]];
  return bits.filter(Boolean).join(' · ');
}
function place(h){
  const ids=(h.units||[]).slice();
  if(h.unmapped&&h.unmapped.length)ids.push.apply(ids,h.unmapped.map(u=>u+' (not a 2026 map polygon)'));
  if(!ids.length)return h.area||h.code;
  return ids.length===1?'GMU '+ids[0]:'GMUs '+ids.join(', ');
}
function title(h){return `${esc(place(h))} · ${esc(h.code)}`}
function nmBand(h){
  if(!window.RWLand||h.privateOnly||h.wmaOnly||h.partial||h.areaChoice||(h.unmapped&&h.unmapped.length)||!h.units||!h.units.length)return null;
  return RWLand.band('nm', RWLand.nmKey(h.units));
}
function latestHarvest(h){
  const root=(typeof NM_HARV!=='undefined'?NM_HARV:window.NM_HARV);
  const bag=root&&root[h.code];
  if(!bag)return null;
  return bag['2025-26']&&bag['2025-26'].success!=null?bag['2025-26'].success*100:null;
}
function nmSaleUnit(h){
  const u=h.units&&h.units[0];
  if(u)return String(u);
  const m=h.unmapped&&h.unmapped[0];
  if(m&&/^[0-9]+[A-Z]?$/.test(String(m)))return String(m);
  return '';
}
function landExtra(h,v){
  if(!paid())return '';
  const label=place(h);
  const sale=nmSaleUnit(h);
  const sp=h.sp==='elk'||h.sp==='deer'||h.sp==='pronghorn'?h.sp:'';
  if(h.privateOnly)return RWLand.extra({privateOnly:true,place:label,href:sale?RWLand.pkgHref('../','nm',sale,sp):''});
  const b=nmBand(h);
  if(!b){
    let why='';
    if(h.wmaOnly)why='This hunt is only on a wildlife management area, so the whole-unit share is not shown.';
    else if(h.partial)why='The 2026 report limits this hunt to part of a unit, so a whole-unit share is not shown.';
    else if(h.areaChoice)why='Odds are for the hunt code. The hunter picks an area, so one public-land share is not shown.';
    else if(h.unmapped&&h.unmapped.length)why='The report names unit '+h.unmapped.join(', ')+'. The 2026 map has no polygon with that name, so a share is not shown.';
    else if(!h.units||!h.units.length)why='The 2026 report did not name a game management unit for this hunt.';
    return why?'<p class="dq">'+esc(why)+'</p>':'';
  }
  return RWLand.extra({band:b,land:b,voice:'history',odds:RWLand.oddsKind(v),harvest:latestHarvest(h),place:label,href:sale?RWLand.pkgHref('../','nm',sale,sp):''});
}
function card(x,i,full){
  const bits=full?RWLand.splitNext(landExtra(x.h,x.v)):{info:'',next:''};
  const tags=[x.h.wlab,x.h.blab,x.h.resOnly?'Resident only':'',x.h.youth?'Youth only':'',x.h.privateOnly?'Private land only':'',x.h.season?('2026-27 season: '+x.h.season):'2026-27 season not published'].filter(Boolean).join(' · ');
  return `<li><button class="fh" data-k="${esc(x.k)}"><span class="rk">${i+1}</span><span class="fv"><i class="vdot" style="background:${COL[x.v]||'#E8E0D2'}"></i>${verdictLine(x.h,x.v)}</span><span class="ft">${title(x.h)}</span><span class="fd">${esc(x.h.area)}</span><span class="fd">${esc(tags)}</span>${oddsHTML(x.h)}${RWHy(x.k,S.pool,null)}${bits.info}</button>${bits.next}</li>`;
}
function focusBar(){return usesRate()?`<div class="sbar"><span class="lbl">What matters most to you?</span><div class="seg"><button type="button" data-focus="" class="${S.focus?'':'on'}">Draw result</button><button type="button" data-focus="land" class="${S.focus==='land'?'on':''}">Public land</button></div></div>`:''}
function nmOpts(){return {points:null,rule:window.RWLong?RWLong.rules.nm:'',member:false,next:null}}
function lsHead(rows){if(window.RWLong)return RWLong.head(rows,nmOpts());const n=rows.length;return n?`<h2 id="lt">${n} hunt${n===1?'':'s'} you can draw</h2>`:''}
function lsOrder(rows){if(!(window.RWLong&&RWLong.allLong(rows)))return rows;if(S.ord==='hard'||S.ord==='easy'||S.focus==='land')return rows;return RWLong.bestFirst(rows)}
function showList(sc){
  const o=$('out');$('detail').hidden=true;o.hidden=false;
  if(LM&&S.tab!=='map'){LM.remove();LM=null}
  const all=lsOrder(listed());
  const hidden=pool().filter(([,h])=>h.resOnly&&bandAt(h)==null).length;
  const note=`<p class="note">${usesRate()?'Bands are the 2026 first-choice result in this pool. They are not a chance in a future draw. Odds above 0 and under one in twenty are long shots. Hunts where none drew stay off the list.':`The 2026 ${SP[S.sp].toLowerCase()} report lists applicants and licenses issued. It does not say how many were drawn on the first choice, so there is no result band.`}${hidden&&S.pool!=='res'?` ${hidden} resident-only hunt${hidden===1?' is':'s are'} not given a result in this pool.`:''} Not a guarantee. Check the current regulation before you apply.</p>`+(paid()?`<p class="note">${RWLand.pageNote('nm')}</p>`:'');
  if(!paid()){
    if(usesRate()&&window.RWLong&&RWLong.allLong(all)){
      const best=RWLong.bestFirst(all);
      o.innerHTML=RWLong.banner(nmOpts())+`<h2 id="lt">Long shots you could still draw</h2><p class="dq">${esc(whoLine())}. Words only on the free page.</p>`+RWGate.unlock('../pricing.html')+`<ol class="fl">`+best.map((x,i)=>card(x,i,false)).join('')+`</ol>`+note;
      o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));
      if(sc)o.scrollIntoView({behavior:'smooth'});
      return;
    }
    const samples=RWGate.takePerUnit(all.filter(x=>(x.h.units||[]).some(u=>SAMPLES.has(u))), x=>(x.h.units||[]).filter(u=>SAMPLES.has(u)));
    const who=`Units ${[...SAMPLES].join(' and ')}`;
    const tabs=mapTabs();
    const wire=()=>o.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;showList()});
    if(S.tab==='map'){
      o.innerHTML=`<h2 id="lt">You could draw ${all.length} ${(SP[S.sp]||'hunt').toLowerCase()} hunt${all.length===1?'':'s'}</h2>`+tabs+`<p class="dq">${esc(whoLine())}. This map colors only sample units ${[...SAMPLES].join(' and ')}. The full map is the Full Pass.</p>`+(usesRate()?mapKey():'')+`<div id="map" class="gmap" aria-label="Map of New Mexico game management units"></div>`+mapCred()+note;
      wire();
      drawMap(samples);
      if(sc)o.scrollIntoView({behavior:'smooth'});
      return;
    }
    const lead=usesRate()?null:`The 2026 report did not publish a first-choice drawn count for ${SP[S.sp].toLowerCase()}, so these hunts are not given a result word.`;
    o.innerHTML=RWGate.freeShell({count:all.length,species:(SP[S.sp]||'hunt').toLowerCase()+(usesRate()?'':' draw'),who:esc(whoLine())+'.'+(lead?' '+lead:''),pricing:'../pricing.html',sampleNote:`<b>Sample.</b> ${who} only, up to 3 hunts from each. This is not your whole list.`,samplesHtml:samples.length?`<ol class="fl">`+samples.map((x,i)=>card(x,i,false)).join('')+'</ol>':''});
    const head=o.querySelector('h2');
    if(head)head.insertAdjacentHTML('afterend', tabs);
    wire();
    o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));
    if(sc)o.scrollIntoView({behavior:'smooth'});
    return;
  }
  const list=lsOrder(rowsInOrder(all));
  const ban=window.RWGate?RWGate.banner():'';
  const lead=S.ord==='hard'?'Hardest to draw first.':S.ord==='easy'?'Easiest to draw first.':(S.focus==='land'?'Mostly public land first.':(usesRate()?'Strongest 2026 result first.':'Listed by game management unit. The first-choice rate was not published.'));
  const tabs=mapTabs();
  if(S.tab==='map'){
    o.innerHTML=ban+lsHead(list)+tabs+`<p class="dq">${esc(whoLine())}. ${usesRate()?'Colored units have at least one hunt you can draw. The color is the best 2026 result among hunts that name that unit. Orange is a long shot when the share was above 0 and under one in twenty. A hunt in more than one unit uses the result for the whole hunt code.':'The 2026 report did not publish a first-choice rate, so units are not colored by a result.'}</p>`+(usesRate()?mapKey():'')+`<div id="map" class="gmap" aria-label="Map of New Mexico game management units"></div>`+mapCred()+note;
    o.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;showList()});
    drawMap(list);if(sc)o.scrollIntoView({behavior:'smooth'});return;
  }
  o.innerHTML=ban+lsHead(list)+tabs+focusBar()+(usesRate()?RWDraw.bar(S.ord,false):'<p class="dnote">Points are not used in New Mexico. First-choice drawn counts were not published for this species, so the list stays in unit order.</p>')+`<p class="dq">${esc(whoLine())}. ${lead} Tap a hunt for the other choices.</p><ol class="fl">`+list.slice(0,S.n).map((x,i)=>card(x,i,true)).join('')+`</ol>`+(list.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(25,list.length-S.n)} more (${list.length-S.n} left)</button>`:'')+(list.length?'':(window.RWLong?RWLong.empty(nmOpts()):`<p class="dq">No hunts you can draw in this pool.</p>`))+note;
  o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));
  o.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;S.n=25;showList()});
  o.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>{S.focus=b.dataset.focus;S.n=25;showList()});
  RWDraw.wire(o,v=>{S.ord=v;S.n=25;showList()});
  if($('more'))$('more').onclick=()=>{S.n+=25;showList()};
  if(sc)o.scrollIntoView({behavior:'smooth'});
}
function choiceTable(h){
  const raw=FP&&h.raw&&h.raw[S.pool];
  if(!h.drawn){
    if(!raw)return '<h3>Choices</h3><p class="dq">First-choice drawn counts were not published. Applicant counts are in the Full Pass file.</p>';
    const rows=[['1st',raw.a1],['2nd',raw.a2],['3rd',raw.a3]];
    return `<h3>Applicants by choice</h3><p class="dq">The 2026 bear and turkey report published applicants. It did not publish how many were drawn on each choice. Licenses issued to this pool: ${num(raw.issued)}.</p><table class="dt"><tr><th>Choice</th><th>Applicants</th><th>Drawn</th></tr>`+rows.map(([lab,n])=>`<tr><td>${lab}</td><td>${num(n)}</td><td>not published</td></tr>`).join('')+'</table>';
  }
  if(!raw){
    const v=bandAt(h);
    return `<h3>2026 first choice</h3><p class="dq">${word(h,v)}. Second and third choice counts are in the Full Pass.</p>`;
  }
  const rows=[['1st',raw.a1,raw.s1],['2nd',raw.a2,raw.s2],['3rd',raw.a3,raw.s3]];
  if(Object.prototype.hasOwnProperty.call(raw,'s4'))rows.push(['4th','not in the applicant columns',raw.s4]);
  const quota=h.raw.quota!=null?`<p class="dq">Licenses in the 2026 report: ${num(h.raw.quota)}. Issued to this pool: ${num(raw.issued)}.</p>`:'';
  return `<h3>2026 applicants and drawn, this pool</h3>${quota}<table class="dt"><tr><th>Choice</th><th>Applicants</th><th>Drawn</th></tr>`+rows.map(([lab,a,s])=>`<tr class="${lab==='1st'?'on':''}"><td>${lab}</td><td>${typeof a==='number'?num(a):esc(a)}</td><td>${num(s)}</td></tr>`).join('')+'</table><p class="dq">Fourth choice, for deer and elk, is a quadrant of the state. It is not this hunt code. The first-choice rate above does not include it.</p>';
}
function harvestHTML(h){
  const root=(typeof NM_HARV!=='undefined'?NM_HARV:window.NM_HARV);
  const bag=root&&root[h.code];
  if(!bag)return '<h3>Harvest</h3><p class="dq">Not published for this hunt code in the 2023-24, 2024-25, or 2025-26 harvest reports. 2026-27 harvest is not published yet. Bear mortality is published by zone, not by these draw codes. Turkey reports used here are not a hunt-code success table.</p>';
  const years=Object.keys(bag).sort();
  return '<h3>Harvest</h3><p class="dq">Hunt-code row from the Department harvest report for that license year. When the same code is printed twice, the first row is shown. This is not the 2026-27 season. That harvest is not published yet.</p>'+years.map(y=>{
    const c=bag[y];
    const suc=c.success==null?'success not published':pct(c.success)+' success';
    const males=c.males==null?'males not published':num(c.males)+' males';
    const females=c.females==null?'females not published':num(c.females)+' females';
    const sold=c.sold==null?'licenses sold not published':num(c.sold)+' licenses sold';
    return `<p class="lh">${esc(y)}</p><p class="dq">${sold}. ${males}. ${females}. ${suc}.</p>`;
  }).join('');
}
function areaHTML(h){
  if(!h.areaChoice||!h.areas||!h.areas.length)return '';
  return '<h3>Hunt areas in the 2026-27 booklet</h3><p class="dq">The odds above are for the whole hunt code. They are not a separate result for one area.</p><ul class="nvr">'+h.areas.map(a=>`<li>${esc(a)}</li>`).join('')+'</ul>';
}
function nmTags(h){
  if(!window.RWTags)return '';
  if(!paid())return RWTags.locked('../pricing.html');
  const raw=FP&&h.raw&&h.raw[S.pool];
  if(!raw||typeof raw.a1!=='number')return RWTags.missing('The New Mexico file on this page has a result band for the pool. It does not list a point-by-point count. New Mexico does not use preference points.');
  return RWTags.show({paid:true,year:2026,rows:[{points:'No points',applied:raw.a1,drew:typeof raw.s1==='number'?raw.s1:null,how:'Random draw'}],sentence:'New Mexico draws these tags at random. There is no point level.'});
}
async function showDetail(k,sc){
  const h=NH[k];if(!h)return;
  if(!paid()&&!(h.units||[]).some(u=>SAMPLES.has(String(u)))){showList(sc);return}
  const v=bandAt(h);const o=$('detail');$('out').hidden=true;o.hidden=false;
  if(LM){LM.remove();LM=null}
  const where=(h.units&&h.units.length)?`<h3>Where this hunt is</h3><p class="dq">${esc(place(h))}. ${h.areaChoice?'The highlighted units are areas a hunter can choose under this code. The color is the code-level result, not an area-level result.':h.units.length>1?'A hunt named in more than one unit is drawn for the whole hunt code.':''} ${h.unmapped&&h.unmapped.length?'Unit '+esc(h.unmapped.join(', '))+' is named in the report and is not a polygon on the 2026 map.':''}</p><div id="dmap" class="gmap dm" data-units="${esc(h.units.join(','))}" aria-label="Map of this game management unit"></div>${mapCred()}`:'<h3>Where this hunt is</h3><p class="dq">The 2026 unit map used here does not have a polygon for '+esc(h.area||'this hunt')+'.</p>';
  o.innerHTML=`<button class="btn o" id="back">Back to the list</button><h2>${title(h)}</h2><p class="dq">${esc(whoLine())}</p><div class="fv"><i class="vdot" style="background:${COL[v]||'#E8E0D2'}"></i>${verdictLine(h,v)}</div>${oddsHTML(h)}${RWHy(k,S.pool,null)}<p class="how">${esc(h.area)}. ${esc(h.blab)}. ${esc(h.wlab)}. ${h.season?'2026-27 season: '+esc(h.season)+'.':'2026-27 season dates were not matched from the booklet for this code.'} ${h.fee?'Fee type in the 2026-27 booklet: '+esc(h.fee)+'.':''} ${h.why?esc(h.why):''} This is a 2026 result, not a forecast.</p>${harvestHTML(h)}${landExtra(h,v)}${nmTags(h)}${where}${areaHTML(h)}${choiceTable(h)}<p class="note">Source: <a href="${esc(h.sp==='bear'||h.sp==='turkey'?NM_META.src.bear2026:NM_META.src.complete2026)}">${h.sp==='bear'||h.sp==='turkey'?'2026 Bear and Turkey Draw Odds Report':'2026 Big Game Drawing Odds Complete Report'}</a>. Booklet: <a href="${esc(NM_META.pages.booklet)}">2026-2027 Hunting Rules and Information</a>. Harvest: <a href="${esc(NM_META.pages.harvest)}">NMDGF harvest reports</a>.</p>`;
  $('back').onclick=()=>showList(1);
  if($('dmap'))drawDetailMap(v);
  if(sc)o.scrollIntoView({behavior:'smooth'});
}
function seg(id,attr,cur,pairs){
  const box=$(id);box.innerHTML=pairs.map(x=>`<button data-${attr}="${esc(x[0])}" class="${cur===x[0]?'on':''}">${esc(x[1])}</button>`).join('');
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>{S[attr]=b.dataset[attr];paint()});
}
function paint(){
  document.querySelectorAll('[data-sp]').forEach(b=>b.classList.toggle('on',b.dataset.sp===S.sp));
  document.querySelectorAll('[data-pool]').forEach(b=>b.classList.toggle('on',b.dataset.pool===S.pool));
  const wpns=[];
  for(const [,h] of H){if(h.sp!==S.sp)continue;if(h.wpn&&!wpns.includes(h.wpn))wpns.push(h.wpn)}
  $('wpnbox').hidden=wpns.length<2;
  if(S.wpn&&!wpns.includes(S.wpn))S.wpn='';
  seg('wpnseg','wpn',S.wpn,[['', 'Any']].concat(wpns.map(w=>[w,w==='bow'?'Bow':w==='muzzle'?'Muzzleloader':'Any legal sporting arm'])));
  const bags=[];
  for(const [,h] of H){if(h.sp!==S.sp)continue;if(S.wpn&&h.wpn!==S.wpn)continue;if(h.bag&&!bags.includes(h.bag))bags.push(h.bag)}
  $('bagbox').hidden=bags.length<2;
  if(S.bag&&!bags.includes(S.bag))S.bag='';
  const label=code=>{const h=H.find(([,x])=>x.sp===S.sp&&x.bag===code);return h?h[1].blab:code};
  seg('bagseg','bag',S.bag,[['', 'Any']].concat(bags.map(b=>[b,label(b)])));
  const n=pool().length;
  $('empty').hidden=n>0;
  $('empty').textContent=n?'':`The 2026 reports used here have no ${SP[S.sp].toLowerCase()} row for these choices.`;
  if(unitCtl){unitCtl.refresh();const el=$('unitq');if(el&&el.value!==S.unit)unitCtl.set(S.unit)}
}
function mapTabs(){return `<div class="tabs" role="tablist"><button type="button" class="tb${S.tab==='list'?' on':''}" data-tab="list">List</button><button type="button" class="tb${S.tab==='map'?' on':''}" data-tab="map">Map</button></div>`}
function mapCred(){return `<p class="mapcred"><b>Game management unit boundaries: New Mexico Department of Wildlife.</b> The layer was updated August 31, 2026. Lines are simplified. <a href="https://wildlife.dgf.nm.gov/hunting/maps/big-game-unit-maps-pdfs/">Unit map page</a>. The written boundary is the one that counts. There is no polygon named 2, 5, 6, 16, 21, 51, or 55 in this layer. Lettered units such as 2A and 16B are separate.</p>`}
function mapKey(){
  const items=[['all','All drew',MC.all],['most','Most drew',MC.most],['some','Some drew',MC.some],['few','Few drew',MC.few],['long','Long shot',MC.long],['none','Nobody drew',MC.none]];
  return `<div class="mkey" id="mkey" role="group" aria-label="Map key"><p class="mkh">Map key: the color is the best 2026 result among hunts that name that unit</p><ul>`+items.map(([b,w,c])=>`<li data-b="${b}"><i class="sw" style="background:${c}" aria-hidden="true"></i><span class="mkt"><b>${w}</b><span class="mkn"></span></span></li>`).join('')+'</ul></div>';
}
function fillKey(cnt){document.querySelectorAll('#mkey li[data-b]').forEach(li=>{const n=cnt[li.dataset.b]||0,s=li.querySelector('.mkn');li.classList.toggle('zero',!n);s.textContent=n?` · ${n} unit${n===1?'':'s'}`:' · none'})}
const bucket=v=>v>=1?'all':v>=0.75?'most':v>=0.25?'some':v>=0.05?'few':v>0?'long':'none';
let LM=null,DM=null,GJ=null;
const loadJS=src=>new Promise((ok,no)=>{const e=document.createElement('script');e.src=src;e.onload=ok;e.onerror=no;document.head.appendChild(e)});
async function ensureMap(){
  if(!window.L){const c=document.createElement('link');c.rel='stylesheet';c.href='../find/vendor/leaflet.css';document.head.appendChild(c);await loadJS('../find/vendor/leaflet.js')}
  if(!window.topojson)await loadJS('../find/vendor/topojson-client.min.js');
  if(!GJ){const t=await(await fetch('gmu.json')).json();GJ=topojson.feature(t,t.objects.area)}
}
function byUnit(rows){
  const m={};
  rows.forEach(x=>{
    if(!x.h.drawn||x.h.areaChoice)return;
    (x.h.units||[]).forEach(u=>{
      const cur=m[u];
      if(!cur||x.v>cur.v)m[u]=x;
    });
  });
  return m;
}
async function drawMap(rows){
  const el=$('map');if(!el)return;
  try{await ensureMap()}catch(e){el.innerHTML='<p class="dq">The map could not load. Use the List tab.</p>';return}
  if(!el.isConnected)return;if(LM){LM.remove();LM=null}
  LM=L.map(el,{zoomSnap:.25,minZoom:5,maxZoom:11,scrollWheelZoom:false,tap:true});
  LM.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>').addAttribution('Game management units: New Mexico Department of Wildlife');
  const bu=byUnit(rows),cnt={};
  const ly=L.geoJSON(GJ,{style:f=>{const u=String(f.properties.u),h=bu[u];return RWMap.fillStyle({hunt:h,fill:h?(COL[h.v]||MC.few):null,none:MC.none,line:MC.sel,odds:h?h.v:null})},
    onEachFeature:(f,l)=>{const u=String(f.properties.u),h=bu[u];if(!h){l.options.interactive=false;return}l.bindTooltip('GMU '+u,{sticky:true,direction:'top'});l.on('click',()=>{S.unit=u;if(unitCtl)unitCtl.set(u);S.tab='list';showList(1)})}}).addTo(LM);
  const seen=new Set();GJ.features.forEach(f=>{const u=String(f.properties.u);if(seen.has(u))return;seen.add(u);const h=bu[u];const b=h?bucket(h.v):'none';cnt[b]=(cnt[b]||0)+1});
  fillKey(cnt);LM.fitBounds(ly.getBounds(),{padding:[4,4]});
}
async function drawDetailMap(v){
  const el=$('dmap');if(!el)return;
  try{await ensureMap()}catch(e){return}
  if(!el.isConnected)return;if(DM){DM.remove();DM=null}
  const ids=new Set(String(el.dataset.units||'').split(',').filter(Boolean));
  const fill=COL[v]||MC.few;
  DM=L.map(el,{zoomSnap:.25,minZoom:5,maxZoom:11,scrollWheelZoom:false,dragging:true,tap:false});
  DM.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>').addAttribution('Game management units: New Mexico Department of Wildlife');
  const on=[];
  L.geoJSON(GJ,{interactive:false,style:f=>RWMap.detailStyle(ids.has(String(f.properties.u)),fill,MC.sel),
    onEachFeature:(f,l)=>{if(ids.has(String(f.properties.u)))on.push(l)}}).addTo(DM);
  on.forEach(l=>l.bindTooltip(l.feature.properties.u,{permanent:true,direction:'center',className:'ulab'}));
  if(on.length)DM.fitBounds(L.featureGroup(on).getBounds(),{padding:[18,18],maxZoom:9});
}
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;S.wpn='';S.bag='';paint()});
document.querySelectorAll('[data-pool]').forEach(b=>b.onclick=()=>{S.pool=b.dataset.pool;paint()});
$('youth').onchange=e=>{S.youth=e.target.checked};
$('go').onclick=()=>{S.n=25;showList(1)};
unitCtl=RWUnit.bind({input:$('unitq'),clear:$('unitclr'),list:$('unitlist'),submit:()=>$('go').click(),onChange:v=>{S.unit=v},getUnits(){const s=[];const seen=new Set();for(const [,h] of H){if(h.sp!==S.sp)continue;(h.units||[]).forEach(u=>{if(!seen.has(u)){seen.add(u);s.push(u)}})}return s}});
if(Q.get('sp')&&SP[Q.get('sp')])S.sp=Q.get('sp');
if(Q.get('pool')==='nr'||Q.get('pool')==='out'||Q.get('pool')==='res')S.pool=Q.get('pool');
if(Q.get('wpn'))S.wpn=Q.get('wpn');
if(Q.get('bag'))S.bag=Q.get('bag');
if(Q.get('unit'))S.unit=Q.get('unit');
if(Q.get('ord')==='hard'||Q.get('ord')==='easy')S.ord=Q.get('ord');
if(Q.get('tab')==='map')S.tab='map';
paint();
if(Q.get('go'))showList();
if(Q.get('k')&&NH[Q.get('k')]){const h=NH[Q.get('k')];S.sp=h.sp;S.wpn='';S.bag='';if(Q.get('pool')==='nr'||Q.get('pool')==='out'||Q.get('pool')==='res')S.pool=Q.get('pool');paint();showDetail(Q.get('k'))}
window.RWFindRefresh=function(){const det=$('detail'),out=$('out');if(det&&!det.hidden)return;if(out&&!out.hidden)showList()};
window.__NM={S, FP};
window.__DRAW={
  pointsMatter(){return false},
  contexts(){
    const seen=new Set();const out=[];
    for(const sp of Object.keys(SP)){
      for(const pool of ['res','nr','out']){
        const id=sp+'|'+pool;
        if(seen.has(id))continue;
        if(!Object.values(NH).some(x=>x.sp===sp))continue;
        seen.add(id);
        out.push({id,apply(){Object.assign(S,{sp,pool,wpn:'',bag:'',unit:'',youth:true,focus:'',ord:'',tab:'list'})}});
      }
    }
    return out;
  },
  maxFor(){return 0},
  setPts(){},
  list(){const prev=S.ord;S.ord='';try{return rowsInOrder(listed())}finally{S.ord=prev}},
  ordered(dir){const prev=S.ord;S.ord=dir;try{return rowsInOrder(listed())}finally{S.ord=prev}},
  measure:rowMeasure,
  tie
};
})();
