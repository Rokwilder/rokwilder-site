(function(){
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const paid=()=>window.RWGate?RWGate.paid():false;
const COLORS=['#c8792f','#6f7f4f','#2171B5'];
let hunts=[];
function day(iso){const [y,m,d]=iso.split('-').map(Number);return Date.UTC(y,m-1,d)/86400000}
function huntHTML(h,i){
  const span=h.ranges.length?h.ranges.map(r=>RWCal.fmtSpan(r.start,r.end)+(r.label?' ('+r.label+')':'')).join('; '):'No season bar';
  const also=h.also&&h.also.length?' Also in the adopted structure: '+h.also.map(r=>RWCal.fmtSpan(r.start,r.end)).join('; ')+'.':'';
  const src=h.source?`<a href="${esc(h.source.url)}">${esc(h.source.name)}</a>`:'';
  return `<article class="card huntcard"><h3>${esc(h.label)}</h3><p>${esc(span)}. <span class="hym">${esc(h.yearLabel||'')}</span></p><p class="hym">${esc(h.note||'')}${esc(also)}</p><p class="hym">Source: ${src}</p>${paid()?`<button type="button" class="btn o" data-rm="${esc(h.key)}">Remove</button>`:''}</article>`;
}
function timeline(list){
  const ranges=list.flatMap(h=>h.ranges||[]);
  if(!ranges.length)return '<p class="dq">None of these hunts have a published start and end in the files used here, so there is no bar.</p>';
  let min=ranges[0].start, max=ranges[0].end;
  for(const r of ranges){if(r.start<min)min=r.start;if(r.end>max)max=r.end}
  const a=day(min)-7, b=day(max)+7, span=Math.max(1,b-a);
  const months=[];
  let y=+min.slice(0,4), m=+min.slice(5,7);
  const endY=+max.slice(0,4), endM=+max.slice(5,7);
  while(y<endY||(y===endY&&m<=endM)){
    months.push(RWCal.fmt(y+'-'+String(m).padStart(2,'0')+'-01').replace(/ \d+,/,''));
    m++;if(m===13){m=1;y++}
    if(months.length>18)break;
  }
  const bars=list.map((h,i)=>{
    const bits=(h.ranges||[]).map(r=>{
      const left=(day(r.start)-a)/span*100;
      const width=Math.max(1.2,(day(r.end)-day(r.start)+1)/span*100);
      return `<i style="left:${left}%;width:${width}%;background:${COLORS[i%3]}" title="${esc(h.label)}"></i>`;
    }).join('');
    return `<div class="bar" aria-hidden="true"><span>${esc(h.flag)}</span>${bits}</div>`;
  }).join('');
  return `<div class="tl"><div class="tl-months">${months.map(m=>`<span>${esc(m)}</span>`).join('')}</div>${bars}</div>`;
}
function apps(list){
  const states=[...new Set(list.map(h=>h.state))];
  if(!states.length)return '';
  return states.map(st=>{
    const meta=RWCal.states[st];
    const species=[...new Set(list.filter(h=>h.state===st).map(h=>h.species))];
    const wins=[];
    for(const sp of species)for(const w of RWCal.windowsFor(st, sp))if(!wins.includes(w))wins.push(w);
    const rows=wins.map(w=>{
      const bits=[];
      if(w.open)bits.push('Opens '+RWCal.fmt(w.open)+(w.openNote?' ('+w.openNote+')':''));
      if(w.close)bits.push('Deadline '+RWCal.fmt(w.close)+(w.closeNote?' ('+w.closeNote+')':''));
      if(w.results)bits.push('Results '+RWCal.fmt(w.results)+(w.resultsNote?' ('+w.resultsNote+')':''));
      const tag=w.confirmed===false?' <span class="hym">Year not reconfirmed.</span>':'';
      return `<li><b>${esc(w.label)}</b> ${esc(bits.join('. ')||'No day published.')}${w.yearLabel?' <span class="hym">'+esc(w.yearLabel)+'</span>':''}${tag} <a href="${esc(w.source.url)}">${esc(w.source.name)}</a></li>`;
    }).join('');
    const gaps=(meta.gaps||[]).map(g=>`<li>${esc(g)}</li>`).join('');
    return `<h3>${esc(meta.name)}</h3><ul class="ck">${rows}</ul><p class="hym">Left off or not confirmed:</p><ul class="ck">${gaps}</ul>`;
  }).join('');
}
function paint(){
  const lines=RWCal.overlapLines(hunts);
  const flags=lines.length?lines.map(t=>`<p class="flag">${esc(t)}</p>`).join(''):(hunts.length>1?'<p class="note">No overlap in the published season dates for these hunts.</p>':'');
  const lock=!paid();
  $('out').innerHTML=
    (window.RWGate?RWGate.banner():'')+
    (lock?(window.RWGate?RWGate.unlock('pricing.html'):'')+'<p class="note"><span class="samp">SAMPLE</span> This timeline is the sample: Utah general deer and a Colorado 2nd rifle hunt. Adding other hunts is the Full Pass.</p>':'')+
    flags+
    (hunts.length?timeline(hunts)+hunts.map(huntHTML).join('')+'<h2>Application and draw dates</h2>'+apps(hunts):'<p class="dq">Add a hunt to see it on the timeline.</p>')+
    '<h2>Sources by state</h2>'+Object.values(RWCal.states).map(st=>`<h3>${esc(st.name)}</h3><ul class="ck">${(st.windows||[]).map(w=>`<li><a href="${esc(w.source.url)}">${esc(w.source.name)}</a> ${esc(w.label)}</li>`).join('')}${(st.gaps||[]).map(g=>`<li>${esc(g)}</li>`).join('')}</ul>`).join('')+
    '<p class="note">Dates are copied from the state publication named above. A day that publication does not give is left blank. Not a substitute for the brochure.</p>';
  $('out').querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{
    hunts=hunts.filter(h=>h.key!==b.dataset.rm);
    RWLoad.writeSaved(hunts);
    paint();
  });
}
function optionsFor(pack, state, sp, text){
  const q=text.toLowerCase();
  const rows=[];
  const push=(id, label)=>{if(!q||label.toLowerCase().includes(q)||id.toLowerCase().includes(q))rows.push({id,label})};
  if(state==='co')for(const k in pack.D){if(pack.D[k][0]!==sp)continue;push(k, k+' '+pack.D[k][2]+' unit '+pack.D[k][1])}
  else if(state==='ut')for(const k in pack.UH){const h=pack.UH[k];if(h.sp!==sp)continue;push(k, h.name+' '+((h.wn||[]).join(' '))+' '+k)}
  else if(state==='az')for(const k in pack.AH){const h=pack.AH[k];if(h.sp!==sp)continue;push(k, (h.area||'')+' '+(h.legal||'')+' '+(h.d||'')+' '+k)}
  else if(state==='wy')for(const k in pack.WH){const h=pack.WH[k];if(h.sp!==sp)continue;push(k, 'area '+h.area+' '+(h.desc||'')+' '+k)}
  else if(state==='id')for(const k in pack.IH){const h=pack.IH[k];if(h.sp!==sp||h.draw!==1)continue;push(k, 'area '+h.area+' hunt '+h.n+' '+k)}
  else if(state==='nv')for(const k in pack.NH){const h=pack.NH[k];if(h.sp!==sp||h.who!=='main'||h.live!=='res')continue;push(k, h.units+' '+h.season)}
  return rows.slice(0, 30);
}
async function addId(state, id, persist){
  const pack=await RWLoad.loadPack(state,{history:false});
  const rec=RWLoad.record(state, pack, id);
  if(!rec)return;
  if(!hunts.some(h=>h.key===rec.key))hunts.push(rec);
  if(persist)RWLoad.writeSaved(hunts);
}
async function demo(persist){
  await addId('ut','DB1531', persist);
  await addId('co','DM060O2R', persist);
}
async function init(){
  if(!paid()){
    $('addbox').hidden=true;
    hunts=[];
    await demo(false);
    paint();
    return;
  }
  hunts=RWLoad.readSaved();
  if(Q.get('demo')==='1')await demo(true);
  const add=Q.get('add');
  if(add){
    for(const part of add.split(',')){
      const [st,id]=part.split(':');
      if(st&&id)await addId(st, id, true);
    }
  }
  paint();
  $('find').onclick=async()=>{
    $('hits').textContent='Loading hunts.';
    try{
      const pack=await RWLoad.loadPack($('st').value,{history:false});
      const rows=optionsFor(pack, $('st').value, $('sp').value, $('q').value.trim());
      $('hits').innerHTML=rows.length?rows.map(r=>`<button type="button" class="pick" data-id="${esc(r.id)}">${esc(r.label)}</button>`).join(''):'<p class="dq">No hunt matched. Try a unit number or a hunt code.</p>';
      $('hits').querySelectorAll('[data-id]').forEach(b=>b.onclick=async()=>{
        await addId($('st').value, b.dataset.id, true);
        paint();
      });
    }catch(e){$('hits').textContent='The hunt file could not load.'}
  };
}
init();
})();
