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
function sexHit(huntSex, pick){
  const sx=huntSex==null?'':String(huntSex);
  if(!pick)return true;
  if(sx===pick)return true;
  return (sx==='E'||sx==='')&&pick!=='E';
}
function sexWords(sp){
  const s=String(sp||'').toLowerCase();
  const animal={elk:'elk',deer:'deer',pronghorn:'pronghorn',antelope:'pronghorn',moose:'moose',bison:'bison',sheep:'bighorn sheep',dsheep:'desert bighorn',bighorn:'bighorn sheep',goat:'mountain goat',bear:'bear',turkey:'turkey'}[s]||(s||'this animal');
  const male={elk:'Bulls',deer:'Bucks',pronghorn:'Bucks',antelope:'Bucks',moose:'Bulls',sheep:'Rams',dsheep:'Rams',bighorn:'Rams',goat:'Billys',bison:'Bulls',bear:'Males',turkey:'Toms'};
  const female={elk:'Cows',deer:'Does',pronghorn:'Does',antelope:'Does',moose:'Cows',sheep:'Ewes',dsheep:'Ewes',bighorn:'Ewes',goat:'Nannies',bison:'Cows',bear:'Females',turkey:'Hens'};
  const maleOne={elk:'bull',deer:'buck',pronghorn:'buck',antelope:'buck',moose:'bull',sheep:'ram',dsheep:'ram',bighorn:'ram',goat:'billy',bison:'bull',bear:'male',turkey:'tom'};
  const femaleOne={elk:'cow',deer:'doe',pronghorn:'doe',antelope:'doe',moose:'cow',sheep:'ewe',dsheep:'ewe',bighorn:'ewe',goat:'nanny',bison:'cow',bear:'female',turkey:'hen'};
  const any={elk:'any-elk',deer:'any-deer',pronghorn:'any-pronghorn',antelope:'any-pronghorn',moose:'any-moose',sheep:'any-sheep',dsheep:'any-desert bighorn',bighorn:'any-sheep',bison:'any-bison',turkey:'any-turkey',bear:'any-bear',goat:'any-goat'};
  return {animal, male:male[s]||'Males', female:female[s]||'Females', maleOne:maleOne[s]||'male', femaleOne:femaleOne[s]||'female', any:any[s]||('any-'+animal), all:'Show me all '+animal+' tags'};
}
function sexLabel(sp, code){
  const w=sexWords(sp);
  if(!code||code==='E')return w.all;
  if(code==='M')return w.male;
  if(code==='F')return w.female;
  return code;
}
function sexNote(sp, codes){
  const list=codes||[];
  if(!list.includes('E'))return '';
  const w=sexWords(sp);
  const name=w.any;
  return name.charAt(0).toUpperCase()+name.slice(1)+' tags let you take a '+w.maleOne+' or a '+w.femaleOne+', so they show up under both.';
}
function sexParam(sx){
  const v=String(sx==null?'':sx);
  if(!v||v==='E'||v==='e'||v==='any-only'||v==='anyonly'||v==='any_only')return '';
  return v;
}
function sexSplit(codes){
  const s=new Set(codes||[]);
  return s.has('M')&&s.has('F');
}
function sexButtons(sp, sx, codes){
  const shown=sexSplit(codes);
  const pick=shown?sexParam(sx):'';
  const opts=shown?[...['M','F'].filter(c=>(codes||[]).includes(c)),'']:[];
  const html=opts.map(x=>'<button type="button" data-sx="'+x+'" class="'+(pick===x?'on':'')+'">'+sexLabel(sp,x)+'</button>').join('');
  return {shown, sx:pick, html, note:shown?sexNote(sp, codes):''};
}
function vKey(v, mode){
  if(!(typeof v==='number'&&v>0))return '';
  if(mode==='drew'){
    if(v>=1)return 'all';
    if(v>=.75)return 'most';
    if(v>=.25)return 'some';
    if(v>=.05)return 'few';
    return 'long';
  }
  if(v>=.995)return 'yes';
  if(v>=.75)return 'likely';
  if(v>=.25)return 'maybe';
  return 'long';
}
const VLAB={
  yes:{yes:'Yes',likely:'Likely',maybe:'Maybe',long:'Long shot'},
  drew:{all:'All drew',most:'Most drew',some:'Some drew',few:'Few drew',long:'Long shot'}
};
function vBar(rows, active, mode){
  const lab=VLAB[mode==='drew'?'drew':'yes'];
  const c={};
  for(const k of Object.keys(lab))c[k]=0;
  for(const r of rows||[]){const k=vKey(r&&r.v, mode);if(c[k]!=null)c[k]++}
  const bits=Object.keys(lab).filter(k=>c[k]);
  if(!bits.length)return '';
  const btn=(k,text,on)=>`<button type="button" class="vb${on?' on':''}" data-vd="${k}">${text}</button>`;
  return `<div class="vbar" role="group" aria-label="Show hunts by chance">${btn('','All '+(rows||[]).length.toLocaleString(),!active)}`+bits.map(k=>btn(k,lab[k]+' '+c[k].toLocaleString(),active===k)).join('')+'</div>';
}
function applyVd(rows, active, mode){
  if(!active)return rows||[];
  return (rows||[]).filter(r=>vKey(r&&r.v, mode)===active);
}
function wireVd(root, set){
  if(!root)return;
  root.querySelectorAll('[data-vd]').forEach(b=>b.onclick=()=>set(b.dataset.vd||''));
}
window.RWLong={word,inDraw,allLong,bestFirst,banner,head,empty,nextFromHistory,dotColor,pointsWord,rules,sexHit,sexWords,sexLabel,sexNote,sexParam,sexSplit,sexButtons,vKey,vBar,applyVd,wireVd};
})();
