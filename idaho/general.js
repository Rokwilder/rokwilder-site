// Idaho general season and the nonresident deer/elk tag draw.
// Season rows are where a general tag is valid. They are not draw results.
// 2026 bands are first-choice results. 2027 rows have no result because that drawing had not been held.
(function(){
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const M=IG.meta;
let S={mode:'seasons',sp:'elk',q:'',n:25};
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
 return `<li><div class="oh"><span class="rk">${i+1}</span><span class="ov">Season window</span><span class="ft">${esc(row.g)} · ${esc(row.area)}</span><span class="fd">${esc(row.season)} · ${esc(row.method)} · ${esc(row.sex)}</span><span class="fd">${fmtDate(row.o)} – ${fmtDate(row.c)} · ${esc(row.tag)}</span><span class="fo"><span class="fpn">Where a general-season tag is valid. Not a draw result and not a harvest rate.</span></span></div></li>`;
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
 return `<li><div class="oh"><span class="rk">${i+1}</span><span class="fv">${row.band==null?'':vdot(row.band)}${VERD(row.band)}</span><span class="ft">${name}</span><span class="fd">2026 nonresident draw · first choice · not a forecast</span>${later}<span class="fo"><span class="fpn">${word(row.band)}</span></span></div></li>`;
}
function choiceCard(row,i){
 const cap=row.capped?' · capped elk zone':'';
 const limit=row.limit==null?'DAV code, no separate tag limit in this table':`2027 nonresident tag limit ${row.limit.toLocaleString()}. This is how many tags are offered, not how many people drew.`;
 return `<li><div class="oh"><span class="rk">${i+1}</span><span class="ov">No result yet</span><span class="ft">${esc(row.code)} · ${esc(row.place)} ${esc(row.tag)}</span><span class="fd">${esc(row.units||'')}${cap}</span><span class="fo"><span class="fpn">${limit} The 2027 drawing had not been held on November 8, 2026.</span></span></div></li>`;
}
function show(sc){
 const o=$('out');o.hidden=false;
 let rows, cards, title, note;
 if(S.mode==='seasons'){
  rows=seasonRows(); cards=seasonCard;
  title=`${rows.length} general-season window${rows.length===1?'':'s'}`;
  note='These rows are the 2026 general-season dates in the Hunt Planner. A resident general deer tag, and a resident elk tag in an uncapped zone, is bought over the counter. It is not drawn. Capped elk zones also limit resident tags. A nonresident general deer or elk tag is issued through the draw, not by this list. This list does not say whether a tag is still for sale, and it is not a harvest rate.';
 }else if(S.mode==='draw'){
  rows=drawRows(); cards=drawCard;
  const shown=rows.filter(row=>row.band!=null&&row.band>=.05);
  const under=rows.filter(row=>row.band!=null&&row.band<.05).length;
  const none=rows.filter(row=>row.band==null).length;
  rows=shown;
  title=`${shown.length} first-choice result${shown.length===1?'':'s'} at one in twenty or better`;
  note=`Each band is the share of people who put that zone or unit first and were drawn in IDFG's 2026 nonresident draw. It is a past result. It is not your chance in the 2027 drawing.${under?` ${under} more with these choices were under one in twenty.`:''}${none?` ${none} had nobody putting them first, so they have no first-choice result.`:''} Outfitter-allocated tags are not in this table. A statewide figure IDFG prints for the whole drawing is not a zone or unit result, and it is not shown.`;
  cards=(row,i)=>drawCard(row,i);
 }else{
  rows=choiceRows(); cards=choiceCard;
  title=`${rows.length} choice${rows.length===1?'':'s'} for the 2027 draw`;
  note='These are the hunt codes in the 2027 Nonresident Supplement. The drawing had not been held on November 8, 2026, so there is no success band. Season dates for 2027 were not set yet. IDFG says to use the 2026 seasons booklet as a guide and to check the 2027 booklet when it is published in April 2027. Junior mentored hunters do not apply for nonresident deer tags, or for uncapped elk tags. Those tags are sold over the counter in late March.';
 }
 o.innerHTML=`<h2 id="lt">${title}</h2><p class="dq">${esc(S.sp==='elk'?'Elk':'Deer')} · ${S.mode==='seasons'?'2026 general season':S.mode==='draw'?'2026 nonresident draw':'2027 application choices'}${S.q?' · matching “'+esc(S.q)+'”':''}</p>`+
  `<ol class="fl">`+rows.slice(0,S.n).map(cards).join('')+`</ol>`+
  (rows.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(25,rows.length-S.n)} more (${rows.length-S.n} left)</button>`:'')+
  (rows.length?'':`<p class="dq">Nothing matches these choices.</p>`)+
  `<p class="note">${note}</p>`+
  `<p class="fpl">Exact Idaho odds are not on this site and are not in the Full Pass. <a href="../pricing.html">See pricing</a></p>`;
 if($('more'))$('more').onclick=()=>{S.n+=25;show()};
 if(sc)o.scrollIntoView({behavior:'smooth'});
}
function paint(){
 document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===S.mode));
 document.querySelectorAll('[data-sp]').forEach(b=>b.classList.toggle('on',b.dataset.sp===S.sp));
 $('modeNote').textContent=S.mode==='seasons'?'A season window tells you when and where a general tag is valid. It does not tell you the chance of drawing a tag.':
  S.mode==='draw'?'2026 first-choice results for nonresidents. Residents do not draw for general deer or uncapped elk. There is no point system.':
  '2027 choices only. Results are not published because the drawing is still ahead.';
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{S.mode=b.dataset.mode;S.n=25;paint()});
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;paint()});
$('q').oninput=e=>{S.q=e.target.value.trim().toLowerCase()};
$('go').onclick=()=>{S.n=25;show(1)};
if(Q.get('mode')&&['seasons','draw','choices'].includes(Q.get('mode')))S.mode=Q.get('mode');
if(Q.get('sp')==='deer')S.sp='deer';
if(Q.get('q')){$('q').value=Q.get('q');S.q=Q.get('q').trim().toLowerCase()}
paint();
if(Q.get('go'))show();
})();
