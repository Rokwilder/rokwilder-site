// Order a Find Your Hunt list by how many points a hunt takes to draw.
// The list is already limited to hunts this point level can draw. This does not add hunts,
// and it does not print a percentage. Default order is left to the page.
(function(){
'use strict';
const BAR=0.05;
function measure(oddsAt, userPts){
  const hi=Math.max(0, userPts|0);
  let need=null, rate=null, any=null;
  for(let p=0;p<=hi;p++){
    let v;
    try{v=oddsAt(p)}catch(e){v=null}
    if(v==null||!(v>=0))continue;
    if(any==null&&v>0)any=p;
    if(need==null&&v>=BAR){need=p;rate=v;break}
  }
  if(need==null){
    let overall=null;
    try{overall=oddsAt(hi)}catch(e){overall=null}
    return {need:any==null?hi:any, rate:overall==null?0:overall};
  }
  return {need, rate};
}
function cmp(a,b,dir){
  const hard=dir==='hard';
  if(a.need!==b.need)return hard?b.need-a.need:a.need-b.need;
  if(a.rate!==b.rate)return hard?a.rate-b.rate:b.rate-a.rate;
  return 0;
}
function order(rows, dir, measureOf, tie){
  if(dir!=='hard'&&dir!=='easy')return rows;
  return rows.slice().sort((a,b)=>{
    const c=cmp(measureOf(a), measureOf(b), dir);
    return c||tie(a,b);
  });
}
function monotonic(rows, dir, measureOf, tie){
  for(let i=1;i<rows.length;i++){
    const c=cmp(measureOf(rows[i-1]), measureOf(rows[i]), dir);
    if(c>0)return {ok:false, i, why:'measure'};
    if(c===0&&tie(rows[i-1], rows[i])>0)return {ok:false, i, why:'tie'};
  }
  return {ok:true};
}
function spanBand(k, side, pts){
  if(!window.RWHy||typeof RWHy.band!=='function')return null;
  let b;
  try{b=RWHy.band(k, side, pts)}catch(e){return null}
  return typeof b==='number'&&b>=0?b:null;
}
// Draw-odds order uses the selected history window when that band is published.
// No band for every row keeps the page's own odds order. Hardest and easiest stay on points.
function byDraw(rows, bandOf, valueOf, tie){
  const base=rows.slice().sort((a,b)=>{
    const va=valueOf(a), vb=valueOf(b);
    if(va!==vb)return (vb||0)-(va||0);
    return tie(a,b);
  });
  let any=false;
  for(const row of base){
    if(bandOf(row)!=null){any=true;break}
  }
  if(!any)return base;
  return base.slice().sort((a,b)=>{
    const ba=bandOf(a), bb=bandOf(b);
    if(ba==null&&bb==null){
      const va=valueOf(a), vb=valueOf(b);
      if(va!==vb)return (vb||0)-(va||0);
      return tie(a,b);
    }
    if(ba==null)return 1;
    if(bb==null)return -1;
    if(ba!==bb)return bb-ba;
    const va=valueOf(a), vb=valueOf(b);
    if(va!==vb)return (vb||0)-(va||0);
    return tie(a,b);
  });
}
function bar(ord, points){
  const note=points?'Hardest = takes the most points to draw.':'Hardest = the lowest chance to draw. Points are not used in this draw.';
  const opts=[['','Default order'],['hard','Hardest to draw first'],['easy','Easiest to draw first']];
  return `<label class="dord">Order<select id="dord" aria-label="Order the list">`+
    opts.map(([v,t])=>`<option value="${v}"${ord===v?' selected':''}>${t}</option>`).join('')+
    `</select></label><p class="dnote">${note}</p>`;
}
function wire(root, on){
  const sel=root.querySelector&&root.querySelector('#dord');
  if(!sel)return;
  sel.onchange=()=>on(sel.value==='hard'||sel.value==='easy'?sel.value:'');
}
const ordOf=v=>v==='hard'||v==='easy'?v:'';
window.RWDraw={BAR, measure, cmp, order, monotonic, bar, wire, ordOf, spanBand, byDraw};
})();
