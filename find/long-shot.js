// Long-shot cutoff for states with a random draw.
// A stored chance above 0 and under 5% is a long shot. A true zero stays off the list.
// This file does not change how odds are calculated.
(function(){
'use strict';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function pointsWord(n){const x=Number(n);return x+' point'+(x===1?'':'s');}
function word(v){
  if(v==null||!Number.isFinite(Number(v)))return '';
  if(v>=.995)return "YES, you'll draw";
  if(v>=.75)return 'LIKELY';
  if(v>=.25)return 'MAYBE';
  if(v>0)return 'LONG SHOT';
  return 'NOT THIS YEAR';
}
function inDraw(v){return v!=null&&Number(v)>0;}
function allLong(rows){return !!(rows&&rows.length)&&rows.every(r=>r&&r.v!=null&&r.v>0&&r.v<.05);}
function bestFirst(rows){return [...rows].sort((a,b)=>(b.v??-1)-(a.v??-1)||String(a.k).localeCompare(String(b.k)));}
function nextHtml(o){
  if(!o||!o.next)return '';
  if(o.member)return `<p><b>Next points needed:</b> ${esc(o.next.name)} drew at ${pointsWord(o.next.points)} in ${esc(o.next.year)}.</p>`;
  return '<p><b>Next points needed:</b> the point level where a hunt drew is in the Full Pass.</p>';
}
function banner(o){
  const at=o&&o.points!=null&&o.points!==''?` at ${pointsWord(o.points)}`:'';
  return `<div class="lsbox"><p class="lshead"><b>No guaranteed draws${esc(at)}, but you can still draw.</b></p><p>${esc(o.rule||'')}</p><p><b>Your best chances:</b> these long shots are sorted best first.</p>${nextHtml(o)}</div>`;
}
function head(list, o){
  if(allLong(list))return banner(o)+'<h2 id="lt">Long shots you could still draw</h2>';
  if(!list||!list.length)return '';
  const n=list.length;
  return `<h2 id="lt">${n} hunt${n===1?'':'s'} you can draw</h2>`;
}
function empty(o){
  const at=o&&o.points!=null&&o.points!==''?` at ${pointsWord(o.points)}`:'';
  return `<p class="dq"><b>No hunts you can draw${esc(at)}.</b> Odds are zero for your residency on the hunts that match.</p>${nextHtml(o)}`;
}
function nextFromHistory(keys, side, points, nameOf){
  if(typeof window.RWHy==='undefined'||typeof RWHy.abovePoints!=='function')return null;
  let best=null;
  for(const k of keys){
    const hit=RWHy.abovePoints(k, side, points);
    if(!hit)continue;
    const row={name:nameOf(k), points:hit.points, year:hit.year};
    if(!best||row.points<best.points||(row.points===best.points&&Number(row.year)>Number(best.year)))best=row;
  }
  return best;
}
function dotColor(v, none){
  if(v>0&&v<.05)return '#D2501F';
  if(v>=.995)return '#263E2C';
  if(v>=.75)return '#6F7F4F';
  if(v>=.25)return '#C4B28C';
  if(v>=.05)return '#D2501F';
  return none||'#E8E0D2';
}
const rules={
  utBonus:'Utah gives half of the tags to a random drawing, so every hunt below is a long shot you could still pull.',
  utLottery:'Utah draws these tags at random, so every hunt below is a long shot you could still pull.',
  utPref:'Utah draws people with the same preference points together. Any odds above zero are a long shot you could still pull.',
  az:'Arizona draws up to 20% of the tags by bonus points, then draws the rest at random, so every hunt below is a long shot you could still pull.',
  nv:'Nevada squares bonus points and then draws at random, so every hunt below is a long shot you could still pull.',
  mt:'Montana squares bonus points, adds one for this year\'s application, and then draws at random, so every hunt below is a long shot you could still pull.',
  wy:'Wyoming draws part of these licenses at random, including the resident elk, deer and pronghorn draw and the nonresident random pool, so every hunt below is a long shot you could still pull.',
  id:'Idaho draws controlled-hunt tags at random, so every hunt below is a long shot you could still pull.',
  nm:'New Mexico draws these tags at random, with no preference points, so every hunt below is a long shot you could still pull.',
  co:'Colorado puts applicants with 5 or more points into a hybrid draw on qualifying hunts, so every hunt below is a long shot you could still pull.'
};
window.RWLong={word,inDraw,allLong,bestFirst,banner,head,empty,nextFromHistory,dotColor,pointsWord,rules};
})();
