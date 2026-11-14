// Unit box for Find Your Hunt. A blank box shows every unit.
// "60" matches unit 60 and a list that includes 60, such as S60.
// "S60" matches S60 only.
(function(){
'use strict';
function clean(q){return String(q==null?'':q).trim().replace(/^unit\s+/i,'')}
function token(s){
  const t=clean(s).toUpperCase().replace(/\s+/g,'');
  const m=t.match(/^([A-Z]*)0*(\d+)$/);
  if(!m)return null;
  return {pref:m[1]||'', num:+m[2]};
}
function hit(units, q){
  const query=clean(q);
  if(!query)return true;
  const list=[].concat(units||[]).map(String).filter(Boolean);
  if(!list.length)return false;
  const qt=token(query);
  if(!qt){
    const n=query.toLowerCase();
    return list.some(u=>u.toLowerCase().indexOf(n)!==-1);
  }
  const re=/([A-Z]*)0*(\d+)/g;
  return list.some(u=>{
    const s=String(u).toUpperCase();
    let m;
    re.lastIndex=0;
    while((m=re.exec(s))){
      const pref=m[1]||'', num=+m[2];
      if(qt.pref){if(pref+String(num)===qt.pref+String(qt.num))return true}
      else if(num===qt.num)return true;
    }
    return false;
  });
}
function sortNum(units){
  let best=Number.MAX_SAFE_INTEGER;
  const re=/(\d+)/g;
  for(const u of [].concat(units||[])){
    const s=String(u);
    let m;
    re.lastIndex=0;
    while((m=re.exec(s))){const n=+m[1]; if(n<best)best=n}
  }
  return best;
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function bind(opts){
  const input=opts.input, clear=opts.clear, list=opts.list;
  function paint(){if(clear)clear.hidden=!clean(input.value)}
  function refresh(){
    if(!list||!opts.getUnits)return;
    const seen=new Set(), items=[];
    for(const u of opts.getUnits()||[]){
      const s=String(u);
      if(!s||seen.has(s))continue;
      seen.add(s);
      items.push(s);
    }
    items.sort((a,b)=>sortNum([a])-sortNum([b])||a.localeCompare(b,undefined,{numeric:true}));
    list.innerHTML=items.map(u=>'<option value="'+esc(u)+'"></option>').join('');
  }
  input.addEventListener('input',()=>{paint(); opts.onChange(clean(input.value))});
  if(clear)clear.addEventListener('click',()=>{input.value=''; paint(); opts.onChange(''); input.focus()});
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&opts.submit){e.preventDefault(); opts.submit()}});
  return {
    set(v){input.value=v||''; paint()},
    refresh,
    paint
  };
}
window.RWUnit={hit, sortNum, bind, clean, token};
})();
