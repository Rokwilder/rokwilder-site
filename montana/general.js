// Montana resident general seasons and the nonresident combination drawing.
// Season rows are dates. They are not draw results.
// Combination bands are 2026 preference-point results. Exact percents need the Full Pass file.
(function(){
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const FP=window.RW_FP===true && MC&&MC.hunts&&Object.values(MC.hunts).some(h=>h.groups&&h.groups.some(g=>typeof g.rate==='number'));
let S={mode:'seasons',sp:'elk',q:'',pts:0,n:40,ord:''};
const VERD=v=>v===1?'ALL DREW':v>=.75?'MOST DREW':v>=.25?'SOME DREW':v>=.05?'FEW DREW':v>0?'UNDER ONE IN TWENTY':v===0?'NONE DREW':'NO RESULT';
const COL={1:'#263E2C',0.75:'#6F7F4F',0.25:'#C4B28C',0.05:'#D2501F',0:'#E8E0D2'};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=v=>{const n=Math.round(v*10000)/100;return (Number.isInteger(n)?String(n):n.toFixed(2))+'%'};
const paid=()=>window.RWGate?RWGate.paid():FP;
const hit=s=>!S.q||String(s).toLowerCase().includes(S.q);
function seasonRows(){
  return MG.seasons.filter(row=>row.sp===S.sp&&hit([row.hd,row.name,row.opp,row.dates.join(' ')].join(' ')));
}
function otcRows(){
  return (MG.otc||[]).filter(row=>(row.sp===S.sp||row.sp==='')&&hit([row.hd,row.lpt,row.opp,row.note].join(' ')));
}
function groupAt(hunt,pts){
  return (hunt.groups||[]).find(g=>g.p===pts)||null;
}
function rateAt(hunt,pts){
  const g=groupAt(hunt,pts);if(!g)return null;
  if(typeof g.rate==='number')return g.rate;
  return g.band;
}
function seasonCard(row,i){
  const dates=row.dates&&row.dates.length?row.dates.join('; '):'Dates are in the 2026 regulations for this district. They were not read as a single labeled season on this line.';
  return `<li><div class="oh"><span class="rk">${i+1}</span><span class="ft">HD ${esc(row.hd)}${row.name?' · '+esc(row.name):''}</span><span class="ov">Season window</span><span class="fd">${esc(row.opp)}</span><span class="fd">${esc(dates)}</span><span class="fo"><span class="fpn">Where a resident general ${esc(row.sp)} license is valid in 2026. Not a draw result and not a harvest rate.</span></span>${RWHyNone('History not available. A general-season window is not a draw result.')}</div></li>`;
}
function otcCard(row,i){
  const dates=row.dates&&row.dates.length?row.dates.join('; '):'See the 2026 regulations for the dates.';
  return `<li><div class="oh"><span class="rk">${i+1}</span><span class="ft">${esc(row.lpt)} · HD ${esc(row.hd)}</span><span class="ov">Over the counter</span><span class="fd">${esc(row.opp)}</span><span class="fd">${esc(dates)}</span><span class="fo"><span class="fpn">${esc(row.note||'The 2026 regulation line says June 15 or OTC. This is not a limited-draw band, and it does not say the license is still for sale.')}</span></span></div></li>`;
}
function comboCard(k, hunt){
  const g=groupAt(hunt,S.pts);
  if(!g)return '';
  const exact=paid()&&typeof g.rate==='number';
  const count=exact&&typeof g.apps==='number'?`, ${g.succ.toLocaleString()} drawn of ${g.apps.toLocaleString()}`:'';
  const share=exact?`<div class="fo"><b>${pct(g.rate)}</b> <span>2026 primary drawing${count}</span></div>`:'<span class="fo"><span class="fpn">Exact percent is in the Full Pass. The word is the 2026 result band.</span></span>';
  const groupNote=g.exactGroup?'This is the row for that exact point total.':`The 2026 report groups this with ${esc(g.label)}. A party average in that range is in the same row. The applications in that row are not all people with exactly ${S.pts} point${S.pts===1?'':'s'}.`;
  return `<li><div class="oh"><span class="rk">${S.pts}</span><span class="ft">${esc(hunt.name)}</span><span class="fv"><i class="vdot" style="background:${COL[g.band]||'#E8E0D2'}"></i>${VERD(g.band)}</span><span class="fd">${S.pts} preference point${S.pts===1?'':'s'} · ${esc(g.label)} · 2026 primary drawing · not a forecast</span>${share}<span class="fd">${groupNote}</span><span class="fd">${esc(hunt.quotaText||'')}</span>${typeof RWHy==='function'?RWHy(k,'nr',S.pts):''}</div></li>`;
}
function comboList(){
  const rows=Object.entries(MC.hunts).filter(([,h])=>S.sp==='both'||h.sp===S.sp).map(([k,h])=>({k,h,v:rateAt(h,S.pts)}));
  if(S.ord==='hard'||S.ord==='easy'){
    return RWDraw.order(rows,S.ord,x=>RWDraw.measure(p=>p===S.pts?rateAt(x.h,p):null,S.pts),(a,b)=>a.h.sp.localeCompare(b.h.sp));
  }
  return rows;
}
function show(sc){
  const o=$('out');o.hidden=false;
  const ban=window.RWGate?RWGate.banner():'';
  if(S.mode==='combo'){
    const rows=comboList();
    const hunt=rows[0]&&rows[0].h;
    o.innerHTML=ban+`<h2 id="lt">Combination result at ${S.pts} preference point${S.pts===1?'':'s'}</h2>`+RWDraw.bar(S.ord,true)+`<p class="dq">Nonresidents only. Preference points, maximum 3. 75 percent of the licenses go in point order. 25 percent go at random to people with zero points. In 2026, zero elk-combination points drew and one point did not.</p><ol class="fl">`+rows.map(r=>comboCard(r.k,r.h)).join('')+`</ol><p class="note">The words are the 2026 primary-drawing result for the group that contains this point total. They are not a 2027 forecast. Landowner priority pool results are a separate drawing and are not this table.</p>`;
    RWDraw.wire(o,v=>{S.ord=v;show()});
    if(sc)o.scrollIntoView({behavior:'smooth'});
    return;
  }
  const seasons=seasonRows();
  const otc=otcRows();
  const cards=seasons.slice(0,S.n).map(seasonCard).join('')+otc.map(otcCard).join('');
  o.innerHTML=ban+`<h2 id="lt">${seasons.length} general-season window${seasons.length===1?'':'s'}</h2><p class="dq">${S.sp==='elk'?'Elk':'Deer'} · 2026 general license · residents over the counter${S.q?' · matching '+esc(S.q):''}</p><ol class="fl">`+cards+`</ol>`+(seasons.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(40,seasons.length-S.n)} more</button>`:'')+(otc.length?`<p class="note">${otc.length} over-the-counter B license${otc.length===1?'':'s'} matched the search. A June 15 line is not a draw result.</p>`:'')+`<p class="note">These rows are 2026 regulation dates. Nonresidents use the Nonresident combination button for the deer or elk license itself. Limited permits are the other button.</p>`;
  if($('more'))$('more').onclick=()=>{S.n+=40;show()};
  if(sc)o.scrollIntoView({behavior:'smooth'});
}
function paint(){
  const combo=S.mode==='combo';
  $('secSeasons').classList.toggle('on',!combo);
  $('secCombo').classList.toggle('on',combo);
  if(!combo)$('secSeasons').setAttribute('aria-current','page'); else $('secSeasons').removeAttribute('aria-current');
  if(combo)$('secCombo').setAttribute('aria-current','page'); else $('secCombo').removeAttribute('aria-current');
  $('ptsBox').hidden=!combo;
  $('pv').textContent=S.pts;
  document.querySelectorAll('[data-sp]').forEach(b=>b.classList.toggle('on',b.dataset.sp===S.sp));
  $('lead').textContent=combo?'The nonresident combination drawing uses preference points. Zero points are the random quarter of the licenses. One point is not in that quarter.':'Resident general licenses are 2026 dates and places. They are not a draw. Nonresidents still need a combination license.';
  $('modeNote').textContent=combo?'There is no bonus-point square on this drawing. The stepper is preference points, 0 to 3.':'A season window is not a draw chance and not a harvest rate.';
  $('spLbl').textContent=combo?'Which combination?':'Elk or deer?';
}
$('pm').onclick=()=>{S.pts=Math.max(0,S.pts-1);paint();if(!$('out').hidden)show()};
$('pp').onclick=()=>{S.pts=Math.min(3,S.pts+1);paint();if(!$('out').hidden)show()};
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;paint();if(!$('out').hidden)show()});
$('q').oninput=e=>{S.q=e.target.value.trim().toLowerCase()};
$('go').onclick=()=>{S.n=40;show(1)};
if(Q.get('mode')==='combo')S.mode='combo';
if(Q.get('sp')==='deer')S.sp='deer';
if(Q.get('pts'))S.pts=Math.max(0,Math.min(3,+Q.get('pts')||0));
if(Q.get('q')){$('q').value=Q.get('q');S.q=Q.get('q').trim().toLowerCase()}
if(Q.get('ord')==='hard'||Q.get('ord')==='easy')S.ord=Q.get('ord');
paint();
if(Q.get('go'))show();
window.__DRAW={
  pointsMatter:()=>S.mode==='combo',
  contexts(){return [{id:'combo both',apply(){Object.assign(S,{mode:'combo',sp:'both',ord:''})}}]},
  maxFor(){return 3},
  setPts(p){S.pts=p},
  list(){return comboList()},
  ordered(dir){const prev=S.ord;S.ord=dir;try{return comboList()}finally{S.ord=prev}},
  measure(x){return RWDraw.measure(p=>p===S.pts?rateAt(x.h,p):null,S.pts)},
  tie:(a,b)=>String(a.h.sp).localeCompare(String(b.h.sp))
};
})();
