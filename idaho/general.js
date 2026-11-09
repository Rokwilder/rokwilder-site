// Idaho general season and the nonresident deer/elk tag draw.
// Season rows are where a general tag is valid. They are not draw results.
// 2026 bands are first-choice results. 2027 rows have no result because that drawing had not been held.
(function(){
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const M=IG.meta;
let S={mode:'seasons',year:'2026',sp:'elk',q:'',n:25};
const VERD=v=>v===1?'ALL DREW':v>=.75?'MOST DREW':v>=.25?'SOME DREW':v>=.05?'FEW DREW':v>0?'UNDER ONE IN TWENTY':v===0?'NONE DREW':'NO FIRST-CHOICE RESULT';
const vcolList=[[.995,'#263E2C'],[.75,'#6F7F4F'],[.25,'#C4B28C'],[.05,'#D2501F']];
const vcol=v=>(vcolList.find(c=>v>=c[0])||[0,'#E8E0D2'])[1];
const vdot=v=>`<i class="vdot" style="background:${vcol(v)}"></i>`;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MONTHS=['Jan.','Feb.','Mar.','Apr.','May','June','July','Aug.','Sept.','Oct.','Nov.','Dec.'];
function fmtDate(s){const p=String(s).split('/');if(p.length!==3)return esc(s);const m=+p[0],d=+p[1],y=p[2].length===2?2000+ +p[2]:+p[2];
 if(!m||m>12||!d||!y)return esc(s);return `${MONTHS[m-1]} ${d}, ${y}`}
const hit=s=>!S.q||String(s).toLowerCase().includes(S.q);
function seasonRows(){
 return IG.seasons.filter(row=>{
  if(S.sp==='elk'&&row.g!=='Elk')return false;
  if(S.sp==='deer'&&row.g==='Elk')return false;
  return hit([row.g,row.area,row.season,row.method,row.sex,row.tag].join(' '));
 });
}
function drawRows(){
 return IG.draw2026.filter(row=>row.sp===S.sp&&hit([row.place,row.tag,row.kind].join(' ')))
  .slice().sort((a,b)=>(b.band??-1)-(a.band??-1)||a.place.localeCompare(b.place,undefined,{numeric:true})||a.tag.localeCompare(b.tag));
}
function choiceRows(){
 return IG.choices2027.filter(row=>row.sp===S.sp&&hit([row.code,row.place,row.units,row.tag,row.kind].join(' ')))
  .slice().sort((a,b)=>String(a.code).localeCompare(String(b.code),undefined,{numeric:true}));
}
function seasonCard(row,i){
 return `<li><div class="oh"><span class="rk">${i+1}</span><span class="ov">Season window</span><span class="ft">${esc(row.g)} · ${esc(row.area)}</span><span class="fd">${esc(row.season)} · ${esc(row.method)} · ${esc(row.sex)}</span><span class="fd">${fmtDate(row.o)} – ${fmtDate(row.c)} · ${esc(row.tag)}</span><span class="fo"><span class="fpn">Where a general-season tag is valid. Not a draw result and not a harvest rate.</span></span>${RWHyNone('History not available. A general-season window is not a draw result.')}</div></li>`;
}
function word(v){if(v==null)return 'Nobody put this first in 2026, so there is no first-choice result.';
 if(v===1)return 'Every person who put this first was drawn.';
 if(v>=.75)return 'At least three out of four people who put this first were drawn.';
 if(v>=.25)return 'At least one out of four people who put this first were drawn.';
 if(v>=.05)return 'At least one out of twenty people who put this first were drawn.';
 if(v>0)return 'Somebody who put this first was drawn, and the share was under one in twenty.';
 return 'People put this first, and none of them were drawn.';
}
function drawCard(row,i){
 const name=row.kind.startsWith('dav')?`${esc(row.place)} DAV ${row.sp}`:`${esc(row.place)} ${esc(row.tag)}`;
 const later=row.later?' <span class="fd">A later choice also received tags in 2026. That is a different result from this first-choice band.</span>':'';
 return `<li><div class="oh"><span class="rk">${i+1}</span><span class="fv">${row.band==null?'':vdot(row.band)}${VERD(row.band)}</span><span class="ft">${name}</span><span class="fd">2026 nonresident draw · first choice · not a forecast</span>${later}<span class="fo"><span class="fpn">${word(row.band)}</span></span>${RWHy(row.k,'nr')}</div></li>`;
}
function choiceCard(row,i){
 const cap=row.capped?' · capped elk zone':'';
 const limit=row.limit==null?'DAV code, no separate tag limit in this table':`2027 nonresident tag limit ${row.limit.toLocaleString()}. This is how many tags are offered, not how many people drew.`;
 return `<li><div class="oh"><span class="rk">${i+1}</span><span class="ov">No result yet</span><span class="ft">${esc(row.code)} · ${esc(row.place)} ${esc(row.tag)}</span><span class="fd">${esc(row.units||'')}${cap}</span><span class="fo"><span class="fpn">${limit} The 2027 drawing had not been held on November 8, 2026.</span></span></div></li>`;
}
const paid=()=>window.RWGate?RWGate.paid():false;
function show(sc){
 const o=$('out');o.hidden=false;
 if(S.mode==='draw'&&!paid()){
  const all=S.year==='2026'?drawRows().filter(row=>row.band!=null&&row.band>=.05):choiceRows();
  const samples=RWGate.takePerUnit(all.filter(row=>['Lolo','Pioneer','Bannock','55'].includes(row.place)),row=>row.place);
  const cards=S.year==='2026'?drawCard:choiceCard;
  o.innerHTML=RWGate.freeShell({count:all.length,species:S.sp==='elk'?'elk':'deer',who:'Nonresident '+S.sp+' · '+(S.year==='2026'?'2026 first choice':'2027 choices, no result yet')+'.',pricing:'../pricing.html',sampleNote:'<b>Sample.</b> Lolo, Pioneer, Bannock and unit 55, up to 3 hunts from each, when they match these choices. This is not your whole list. Season dates stay on General-Season Hunts.',samplesHtml:samples.length?`<ol class="fl">`+samples.map(cards).join('')+'</ol>':''});
  if(sc)o.scrollIntoView({behavior:'smooth'});
  return;
 }
 const ban=window.RWGate?RWGate.banner():'';
 let rows, cards, title, note;
 if(S.mode==='seasons'){
  rows=seasonRows(); cards=seasonCard;
  title=`${rows.length} general-season window${rows.length===1?'':'s'}`;
  note='These rows are the 2026 general-season dates in the Hunt Planner. Residents buy a general deer tag, and an elk tag in an uncapped zone, over the counter. That sale is not a draw. Capped elk zones also limit resident tags. Nonresidents do not use this list to get a deer or elk tag. Their tag comes from the Nonresident Tag Draws button. This list does not say whether a tag is still for sale, and it is not a harvest rate.';
 }else if(S.year==='2026'){
  rows=drawRows();
  const shown=rows.filter(row=>row.band!=null&&row.band>=.05);
  const under=rows.filter(row=>row.band!=null&&row.band<.05).length;
  const none=rows.filter(row=>row.band==null).length;
  rows=shown; cards=drawCard;
  title=`${shown.length} nonresident first-choice result${shown.length===1?'':'s'} at one in twenty or better`;
  note=`Nonresidents only. Each band is the share of nonresidents who put that zone or unit first and were drawn in 2026. Residents did not enter this draw for general deer or uncapped elk. It is a past result, not a 2027 chance.${under?` ${under} more with these choices were under one in twenty.`:''}${none?` ${none} had nobody putting them first, so they have no first-choice result.`:''} Outfitter-allocated tags are not in this table. IDFG's single statewide figure is not a zone or unit result, and it is not shown.`;
 }else{
  rows=choiceRows(); cards=choiceCard;
  title='2027 nonresident results are not released';
  note=`IDFG has published the December 5–15, 2026 application period and the hunt codes below. It has not published 2027 draw results. These ${rows.length} rows are application choices and tag limits, not success bands. Season dates for 2027 were not set yet. Junior mentored hunters draw only for a capped elk zone. Their deer tags and uncapped elk tags are sold over the counter in late March.`;
 }
 const who=S.mode==='seasons'?(S.sp==='elk'?'Elk':'Deer')+' · 2026 general season · residents over the counter · nonresidents use the draw':
  S.year==='2026'?(S.sp==='elk'?'Elk':'Deer')+' · nonresidents · 2026 first choice · not a resident draw':
  (S.sp==='elk'?'Elk':'Deer')+' · nonresidents · 2027 choices · no result yet';
 o.innerHTML=ban+`<h2 id="lt">${title}</h2><p class="dq">${esc(who)}${S.q?' · matching “'+esc(S.q)+'”':''}</p>`+
  `<ol class="fl">`+rows.slice(0,S.n).map(cards).join('')+`</ol>`+
  (rows.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(25,rows.length-S.n)} more (${rows.length-S.n} left)</button>`:'')+
  (rows.length?'':`<p class="dq">Nothing matches these choices.</p>`)+
  `<p class="note">${note}</p>`+
  `<p class="fpl">Exact percentages are not in this public file. Full Pass: $29.99 a year. Not on sale yet. <a href="../pricing.html">See pricing</a></p>`;
 if($('more'))$('more').onclick=()=>{S.n+=25;show()};
 if(sc)o.scrollIntoView({behavior:'smooth'});
}
function paint(){
 const draw=S.mode==='draw';
 $('secSeasons').classList.toggle('on',!draw);
 $('secDraw').classList.toggle('on',draw);
 if(!draw)$('secSeasons').setAttribute('aria-current','page'); else $('secSeasons').removeAttribute('aria-current');
 if(draw)$('secDraw').setAttribute('aria-current','page'); else $('secDraw').removeAttribute('aria-current');
 $('yearBox').hidden=!draw;
 document.querySelectorAll('[data-year]').forEach(b=>b.classList.toggle('on',b.dataset.year===S.year));
 document.querySelectorAll('[data-sp]').forEach(b=>b.classList.toggle('on',b.dataset.sp===S.sp));
 $('lead').textContent=draw?'Nonresident tag draws are only for nonresident deer and elk tags. Residents are not in this drawing. 2026 results are published. 2027 results are not.':'General-season hunts are 2026 dates and places. Residents buy most of these tags over the counter. Nonresidents still have to draw the deer or elk tag.';
 $('yearNote').textContent=S.year==='2026'?'2026 results are the first-choice history from IDFG\'s draw description. They are not a forecast.':'2027 results are not released. The list below is the published application choices and tag limits, with no success band.';
 $('modeNote').textContent=draw?'There is no preference-point system in this draw.':'A season window is not a draw chance and not a harvest rate.';
}
const refresh=()=>{paint();if(!$('out').hidden)show()};
document.querySelectorAll('[data-year]').forEach(b=>b.onclick=()=>{S.year=b.dataset.year;S.n=25;refresh()});
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;refresh()});
$('q').oninput=e=>{S.q=e.target.value.trim().toLowerCase()};
$('go').onclick=()=>{S.n=25;show(1)};
if(Q.get('mode')==='draw'||Q.get('mode')==='choices')S.mode='draw';
if(Q.get('mode')==='choices'||Q.get('year')==='2027')S.year='2027';
if(Q.get('sp')==='deer')S.sp='deer';
if(Q.get('q')){$('q').value=Q.get('q');S.q=Q.get('q').trim().toLowerCase()}
paint();
if(Q.get('go'))show();
})();
