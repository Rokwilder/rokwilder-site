// Draw-result history. Loads one state's band file after the hunter asks for hunts.
// Bands and trend words only. The averaged percentage is not in the file and is not shown.
(function(){
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const YES=v=>v>=.995?"YES, you'll draw":v>=.75?'LIKELY':v>=.25?'MAYBE':v>=.05?'LONG SHOT':'NOT THIS YEAR';
const DREW=v=>v===1?'ALL DREW':v>=.75?'MOST DREW':v>=.25?'SOME DREW':v>=.05?'FEW DREW':v>0?'UNDER ONE IN TWENTY':v===0?'NONE DREW':'NO RESULT';
const COL=[[.995,'#263E2C'],[.75,'#6F7F4F'],[.25,'#C4B28C'],[.05,'#D2501F']];
const col=v=>(COL.find(c=>v>=c[0])||[0,'#E8E0D2'])[1];
const me=document.currentScript;
const url=me&&me.dataset.history;
let data=null, failed=false, pending=null, scheduled=false;

function word(v){
  if(v==null)return '';
  return data&&data.words==='drew'?DREW(v):YES(v);
}
function dot(v){return `<i class="vdot" style="background:${col(v)}"></i>`}
function recordFor(hunt, side){
  if(!hunt)return null;
  if(hunt.y)return hunt;
  if(side&&hunt[side]&&hunt[side].y)return hunt[side];
  return null;
}
function view(rec, pts){
  const sample=Object.values(rec.y).find(v=>v!=null);
  const pointed=sample&&typeof sample==='object';
  if(!pointed){
    return {years:rec.y, avg:rec.n>=2?rec.a:null, n:rec.n||0, trend:rec.t||null, pointed:false};
  }
  if(pts==null||pts==='')return {years:{}, avg:null, n:0, trend:null, pointed:true, missing:true};
  const key=String(pts);
  const years={};
  for(const [yr,map] of Object.entries(rec.y)){
    if(map&&Object.prototype.hasOwnProperty.call(map, key))years[yr]=map[key];
  }
  const n=rec.n&&rec.n[key]||0;
  return {years, avg:n>=2?rec.a[key]:null, n, trend:rec.t&&rec.t[key]||null, pointed:true};
}
function htmlFor(el){
  if(el.dataset.hist==='none')return `<span class="hym">${esc(el.dataset.why||'History not available')}</span>`;
  if(failed)return `<span class="hym">History not available</span>`;
  if(!data)return `<span class="hym">History loading</span>`;
  const hunt=data.hunts&&data.hunts[el.dataset.hk];
  const rec=recordFor(hunt, el.dataset.side);
  if(!rec)return `<span class="hym">History not available</span>`;
  const pts=el.hasAttribute('data-pts')?el.dataset.pts:null;
  const row=view(rec, pts);
  const years=Object.keys(row.years);
  if(!years.length)return `<span class="hym">${row.pointed&&row.missing?'History not available':'History not available at this point level'}</span>`;
  const cells=years.sort().map(yr=>`<span class="yr"><b>${esc(yr)}</b><span>${dot(row.years[yr])}${esc(word(row.years[yr]))}</span></span>`).join('');
  const avg=row.n===3||row.n===2?`<span class="yr avg"><b>${row.n}-yr average</b><span>${dot(row.avg)}${esc(word(row.avg))}</span></span>`:'';
  const trend=row.trend?`<div class="tr">${esc(row.trend)}</div>`:'';
  return `<span class="yrs">${cells}${avg}</span>${trend}`;
}
function paint(el){
  const html=htmlFor(el);
  if(el.dataset.sig===html)return;
  el.dataset.sig=html;
  el.innerHTML=html;
}
function note(root){
  if(!data||!data.note)return;
  for(const id of ['out','detail']){
    const box=document.getElementById(id);
    if(!box||box.hidden||!box.querySelector('.hy'))continue;
    if(box.querySelector('.hynote'))continue;
    const p=document.createElement('p');
    p.className='hynote';
    p.textContent=data.note;
    const h=box.querySelector('h2');
    if(h)h.insertAdjacentElement('afterend', p);
    else box.prepend(p);
  }
  if(root&&root.classList&&root.classList.contains('mp')&&!root.querySelector('.hynote')&&data.note){
    const p=document.createElement('p');
    p.className='hynote';
    p.textContent=data.note;
    root.prepend(p);
  }
}
function fill(){
  scheduled=false;
  document.querySelectorAll('.hy').forEach(paint);
  note();
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(fill);
}
function load(){
  if(data||failed||pending||!url){if(!url)failed=true;return pending||Promise.resolve()}
  pending=fetch(url).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()}).then(j=>{
    data=j;pending=null;schedule();
  }).catch(()=>{failed=true;pending=null;schedule()});
  return pending;
}
window.RWHy=function(k, side, pts){
  const sideAttr=side==null?'':` data-side="${esc(side)}"`;
  const ptsAttr=pts==null||pts===''?'':` data-pts="${Number(pts)}"`;
  return `<span class="hy" data-hk="${esc(k)}"${sideAttr}${ptsAttr}></span>`;
};
window.RWHyNone=function(why){
  return `<span class="hy" data-hist="none" data-why="${esc(why)}"></span>`;
};
const obs=new MutationObserver(()=>{
  if(document.querySelector('.hy'))load();
  schedule();
});
obs.observe(document.documentElement,{childList:true,subtree:true});
})();
