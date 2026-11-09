// Find Your Hunt: Idaho controlled hunts.
// Bands are the 2026 historical first-choice result for one residency, from IDFG's drawing-odds table.
// They are not a prediction, not a preference-point ladder, and not an exact percentage.
// The public file has no raw counts. window.RW_FP cannot turn exact Idaho numbers on, and the Full Pass does not include them.
(function(){
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const M=ID_META;
let S={sp:'elk',res:'res',draw:1,sx:'',youth:1,n:25};
const ORDER=['elk','deer','pronghorn','moose','sheep-rm','sheep-ca','goat','bear','turkey'];
const SXN={'':'Any',M:'Antlered',F:'Antlerless',E:'Either sex'};
const VERD=v=>v===1?'ALL DREW':v>=.75?'MOST DREW':v>=.25?'SOME DREW':v>=.05?'FEW DREW':v>0?'UNDER ONE IN TWENTY':v===0?'NONE DREW':'NO RESULT';
const vcolList=[[.995,'#263E2C'],[.75,'#6F7F4F'],[.25,'#C4B28C'],[.05,'#D2501F']];
const vcol=v=>(vcolList.find(c=>v>=c[0])||[0,'#E8E0D2'])[1];
const vdot=v=>`<i class="vdot" style="background:${vcol(v)}"></i>`;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MONTHS=['Jan.','Feb.','Mar.','Apr.','May','June','July','Aug.','Sept.','Oct.','Nov.','Dec.'];
function fmtDate(s){const p=String(s).split('/');if(p.length!==3)return esc(s);const m=+p[0],d=+p[1],y=p[2].length===2?2000+ +p[2]:+p[2];
 if(!m||m>12||!d||!y)return esc(s);return `${MONTHS[m-1]} ${d}, ${y}`}
const spName=sp=>M.species[sp]?M.species[sp].name:sp;
const drawName=()=>S.draw===2?'second drawing':'first drawing';
const resName=()=>S.res==='res'?'Idaho resident':'Out of state';
const who=()=>`${spName(S.sp)} · ${resName()} · 2026 ${drawName()} · first choice${S.sx?' · '+SXN[S.sx].toLowerCase():''}${S.youth?'':' · youth-only hunts hidden'}`;
const oddsURL=h=>`${M.oddsPage}?biggame=${M.species[h.sp].biggame}&yr=${M.year}&draw=${h.draw}`;
const rows=()=>Object.entries(IH).filter(([,h])=>h.sp===S.sp&&h.draw===S.draw);
function split(){const show=[],under=[],none=[],unlabeled=[];
 for(const [k,h] of rows()){
  if(S.sx&&!h.sex){unlabeled.push(k);continue}
  if(!S.youth&&h.youth)continue;
  const v=S.res==='res'?h.res:h.nr;
  if(v==null)none.push(k);
  else if(v>=.05)show.push({k,v});
  else under.push(k);
 }
 show.sort((a,b)=>b.v-a.v||IH[a.k].n.localeCompare(IH[b.k].n,undefined,{numeric:true})||IH[a.k].area.localeCompare(IH[b.k].area));
 return {show,under,none,unlabeled}}
function title(k){const h=IH[k];const bits=[`Hunt ${esc(h.n)}`,`Area ${esc(h.area)}`];
 if(h.sex)bits.push(SXN[h.sex]);
 if(h.game&&h.game!==spName(h.sp))bits.push(esc(h.game));
 if(h.extra)bits.push('extra tag');
 if(h.youth)bits.push('youth only');
 if(h.methods.length)bits.push(esc(h.methods.join(', ')));
 return bits.join(' · ')}
function segHTML(h){if(!h.seg.length)return `<p class="note">The Hunt Planner hunt list had no 2026 open date for this hunt number on ${esc(M.retrieved)}. Weapon, sex and season dates are left off rather than copied from another year.</p>`;
 return `<ul class="ck">`+h.seg.map(g=>`<li><b>${esc(g.s)}</b> · ${esc(g.m)} · ${fmtDate(g.o)} – ${fmtDate(g.c)}</li>`).join('')+'</ul><p class="dq">Season lines are the 2026 rows in the Hunt Planner for this hunt number. A hunt number can change next year.</p>'}
function wordNote(v){if(v===1)return 'Every first-choice person of this residency in that drawing was drawn.';
 if(v>=.75)return 'At least three out of four first-choice people of this residency were drawn. Not every person was drawn.';
 if(v>=.25)return 'At least one out of four first-choice people of this residency were drawn.';
 if(v>=.05)return 'At least one out of twenty first-choice people of this residency were drawn.';
 if(v>0)return 'Somebody was drawn, and the share was under one in twenty. This hunt is left off the main list.';
 if(v===0)return 'People of this residency put the hunt first, and none of them were drawn.';
 return 'IDFG recorded nobody of this residency putting the hunt first, so there is no result to show.'}
const fpBox=()=>`<aside class="fpbox" aria-label="What the Full Pass adds"><p class="fpt">What the Full Pass adds</p><ul><li>Exact draw odds at every point level, for Colorado, Utah and Arizona</li><li>About how many points you need to be sure to draw in those states</li><li>Past draw results: Colorado back to 2021; Utah 2026 by point level plus 2025 totals; Arizona 2026</li></ul><p class="fpp">This Idaho page is a 2026 historical result band, not an exact percentage and not a forecast. Exact Idaho odds are not in the Full Pass. Full Pass: $29.99 a year. Founding Hunter: $19.99 a year for the first 200 members, locked as long as you keep renewing. Not on sale yet. <a href="../pricing.html">See pricing</a></p></aside>`;
const fpLine=()=>`<p class="fpl">Exact Idaho odds are not on this site. The Full Pass (not on sale yet) is exact odds for Colorado, Utah and Arizona. <a href="../pricing.html">See pricing</a></p>`;
function card(x,i){const h=IH[x.k];return `<li><button class="fh" data-k="${esc(x.k)}"><span class="rk">${i+1}</span><span class="fv">${vdot(x.v)}${VERD(x.v)}</span><span class="ft">${title(x.k)}</span><span class="fd">${h.sex?SXN[h.sex]+' · ':''}2026 ${h.draw===2?'second':'first'} drawing · first-choice result · not a forecast</span><span class="fo"><span class="fpn">Historical band, not an exact percentage and not your future chance</span></span></button></li>`}
function showList(sc){const o=$('out');$('detail').hidden=true;o.hidden=false;const {show,under,none,unlabeled}=split();
 const emptySpecies=!rows().length;
 const note=emptySpecies?`<p class="note">IDFG's 2026 drawing-odds table returned no ${esc(drawName())} hunts for ${esc(spName(S.sp))}.</p>`:
  `<p class="note">Each band is the share of ${esc(resName().toLowerCase())} first-choice people who were drawn in IDFG's 2026 ${esc(drawName())}. It is a past result. It is not your chance in a later drawing, and it is not a second-choice result. Hunts under one in twenty aren't shown${under.length?` (${under.length} more with these choices)`:''}.${none.length?` ${none.length} hunt${none.length===1?'':'s'} had nobody of this residency putting them first, so they have no result.`:''}${unlabeled.length?` ${unlabeled.length} hunt${unlabeled.length===1?' is':'s are'} hidden because the 2026 hunt list did not label sex.`:''} Not a guarantee.</p>`;
 o.innerHTML=`<h2 id="lt">${show.length} hunt${show.length===1?'':'s'} at one in twenty or better</h2><p class="dq">${esc(who())}. Highest 2026 result first. Tap a hunt for the rule and the IDFG table.</p>`+fpBox()+
  `<ol class="fl">`+show.slice(0,S.n).map(card).join('')+`</ol>`+(show.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(25,show.length-S.n)} more (${show.length-S.n} left)</button>`:'')+
  (show.length||emptySpecies?'':`<p class="dq">No hunts at one in twenty or better with these choices.</p>`)+note+fpLine();
 o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));
 if($('more'))$('more').onclick=()=>{S.n+=25;showList()};
 if(sc)o.scrollIntoView({behavior:'smooth'})}
function showDetail(k,sc){const h=IH[k];if(!h)return;S.sp=h.sp;S.draw=h.draw;paint();const v=S.res==='res'?h.res:h.nr;const o=$('detail');$('out').hidden=true;o.hidden=false;
 o.innerHTML=`<button class="btn o" id="back">← Back to the list</button><h2>${title(k)}</h2><p class="dq">${esc(who())}</p>`+
  `<div class="fv">${v==null?'':vdot(v)}${VERD(v)}</div><p class="how">${wordNote(v)} ${how()}</p>`+fpBox()+segHTML(h)+
  `<p class="note">Source: <a href="${esc(oddsURL(h))}">IDFG 2026 drawing odds</a> for this species and drawing, first-choice residency columns. Area: <a href="https://idfg.idaho.gov/ifwis/huntplanner/area.aspx?id=${encodeURIComponent(h.areaId)}">Hunt Planner area ${esc(h.areaId)}</a>. Retrieved ${esc(M.retrieved)}. Rules: <a href="${esc(M.rules)}">IDAPA 13.01.04, current chapter retrieved the same day</a>.</p>`;
 $('back').onclick=()=>showList(1);if(sc)o.scrollIntoView({behavior:'smooth'})}
function how(){return `Idaho does not use preference points for this draw. IDFG describes controlled-hunt tags as drawn at random, and IDAPA 13.01.04.330 calls it a hunt-choice drawing: if the first choice is not drawn, the application can go to another choice only when that hunt is not already full. A group is one application. Deer, elk and pronghorn groups are two to four people. Moose, bighorn sheep, mountain goat and black bear groups are two people. A group is not selected when fewer tags remain than the group has people. The band is the share of first-choice people who were drawn, not the chance a group will draw. Nonresident tags are capped. That cap is already inside the 2026 result. This page does not recompute it. The second drawing is a later application for leftover tags. It is not a second choice.`}
function paint(){document.querySelectorAll('[data-sp]').forEach(b=>b.classList.toggle('on',b.dataset.sp===S.sp));
 document.querySelectorAll('[data-res]').forEach(b=>b.classList.toggle('on',b.dataset.res===S.res));
 document.querySelectorAll('[data-draw]').forEach(b=>b.classList.toggle('on',+b.dataset.draw===S.draw));
 document.querySelectorAll('[data-sx]').forEach(b=>b.classList.toggle('on',b.dataset.sx===S.sx));
 const has2=Object.values(IH).some(h=>h.sp===S.sp&&h.draw===2);
 const missing=ORDER.filter(sp=>!Object.values(IH).some(h=>h.sp===sp&&h.draw===2)).map(spName);
 $('d2note').textContent=`IDFG's 2026 odds table has no second-drawing rows for ${missing.join(', ')}.`;
 $('d2note').hidden=has2||S.draw!==2;
 $('ptnote').textContent=`No preference points. The band does not change if you have applied before. ${spName(S.sp)} uses the same random drawing as the other controlled hunts on this page.`;
}
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;paint()});
document.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{S.res=b.dataset.res;paint()});
document.querySelectorAll('[data-draw]').forEach(b=>b.onclick=()=>{S.draw=+b.dataset.draw;paint()});
document.querySelectorAll('[data-sx]').forEach(b=>b.onclick=()=>{S.sx=b.dataset.sx;paint()});
$('youth').onchange=e=>{S.youth=e.target.checked?1:0};
$('go').onclick=()=>{S.n=25;showList(1)};
if(Q.get('sp')&&M.species[Q.get('sp')])S.sp=Q.get('sp');
if(Q.get('res')==='nr')S.res='nr';
if(Q.get('draw')==='2')S.draw=2;
if(Q.get('sx')&&SXN[Q.get('sx')])S.sx=Q.get('sx');
if(Q.get('youth')==='0'){$('youth').checked=false;S.youth=0}
paint();
if(Q.get('go'))showList();
if(Q.get('k')&&IH[Q.get('k')])showDetail(Q.get('k'));
})();
