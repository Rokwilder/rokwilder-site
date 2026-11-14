(function(){
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const paid=()=>window.RWGate?RWGate.paid():false;
function today(){
  const d=new Date();
  const p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}
function alertsFor(hunts){
  const items=[];
  const seen=new Set();
  const now=today();
  for(const h of hunts){
    const wins=[];
    for(const w of RWCal.windowsFor(h.state, h.species))if(!wins.includes(w))wins.push(w);
    for(const w of wins){
      const push=(date, kind, title, note)=>{
        if(!date)return;
        const id=h.state+'|'+w.id+'|'+kind+'|'+date;
        if(seen.has(id))return;
        seen.add(id);
        items.push({date, kind, title, note:note||'', past:date<now, waiting:false, source:w.source, yearLabel:w.confirmed===false?(w.yearLabel||'Not reconfirmed'):''});
      };
      push(w.open,'open',w.label+' opens',w.openNote);
      push(w.close,'deadline',w.label+' deadline',w.closeNote);
      push(w.results,'results',w.label+' results',w.resultsNote);
    }
    for(const r of h.ranges||[]){
      items.push({date:r.start, kind:'season', title:h.label+' starts', note:r.label||'', past:r.start<now, waiting:false, source:h.source, yearLabel:h.yearLabel||''});
    }
    for(const r of h.also||[]){
      items.push({date:r.start, kind:'season', title:h.label+' (structure year) starts', note:'From the adopted season structure. The annual brochure for that year was not the source.', past:r.start<now, waiting:false, source:h.source, yearLabel:'Structure date, brochure not checked'});
    }
  }
  for(const st of new Set(hunts.map(h=>h.state))){
    const g=(RWCal.states[st].gaps||[])[0];
    if(g)items.push({date:null, kind:'missing', title:RWCal.states[st].name+' has not posted the next official dates', note:g, past:false, waiting:true, source:null, yearLabel:''});
  }
  items.sort((a,b)=>{
    if(a.waiting&&!b.waiting)return 1;
    if(!a.waiting&&b.waiting)return -1;
    if(!a.date)return 1;
    if(!b.date)return -1;
    return a.date<b.date?-1:a.date>b.date?1:0;
  });
  return items;
}
function itemHTML(a){
  const tag=a.waiting?'Not posted':a.past?'Passed':'Coming up';
  const when=a.date?RWCal.fmt(a.date):'No day published';
  const src=a.source?` <a href="${esc(a.source.url)}">${esc(a.source.name)}</a>`:'';
  return `<li class="${a.waiting?'wait':a.past?'past':'soon'}"><span class="k">${tag}</span><b>${esc(a.title)}</b><span class="when">${esc(when)}</span>${a.note?`<span class="hym">${esc(a.note)}</span>`:''}${a.yearLabel?`<span class="hym">${esc(a.yearLabel)}</span>`:''}${src}</li>`;
}
function paint(hunts, sample){
  const items=alertsFor(hunts);
  const ban=window.RWGate?RWGate.banner():'';
  const lock=!paid();
  $('list').innerHTML=ban+
    (lock?(window.RWGate?RWGate.unlock('pricing.html'):'')+'<p class="note"><span class="samp">SAMPLE</span> Two saved hunts, so you can see the list. Your own saved hunts are the Full Pass.</p>':'')+
    (sample?'':'')+
    (hunts.length?`<ul class="al">${items.map(itemHTML).join('')}</ul>`:'<p class="dq">No saved hunts yet. Add them on the season planner.</p>')+
    '<h2>Saved hunts</h2>'+
    (hunts.length?`<ul class="ck">${hunts.map(h=>`<li><b>${esc(h.label)}</b> <span class="hym">${esc(h.yearLabel||'')}</span>${paid()?` <button type="button" class="btn o" data-rm="${esc(h.key)}">Remove</button>`:''}</li>`).join('')}</ul>`:'')+
    '<h2>Email reminders</h2><p>A later version can mail this same list: application opening, deadline, draw results, season start, and a note when a state posts dates that are missing here.</p><label class="cb">Email <input type="email" disabled value="" placeholder="Not sent in this preview"></label><p class="note">Nothing is emailed from this preview. The box is off on purpose.</p>'+
    '<h2>Where saved hunts live</h2><p>There is no member login on the public site yet, so this preview keeps saved hunts in this browser only. They are not sent to api.rokwilder.com.</p><p>The member worker would store them in D1 for the logged-in Full Pass account: a saved_hunts table with the account id, state, hunt id, species, and label. It would read the same official date file and build this list. A scheduled job could send the email above. This preview does not call that worker and does not send mail.</p>'+
    '<p><a class="btn o" href="planner.html'+esc(location.search)+'">Season planner</a> <a class="btn o" href="compare.html">Compare units</a></p>';
  $('list').querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{
    const next=RWLoad.readSaved().filter(h=>h.key!==b.dataset.rm);
    RWLoad.writeSaved(next);
    paint(next, false);
  });
}
async function demoHunts(){
  const ut=await RWLoad.loadPack('ut',{history:false});
  const co=await RWLoad.loadPack('co',{history:false});
  return [RWLoad.record('ut', ut, 'DB1531'), RWLoad.record('co', co, 'DM060O2R')].filter(Boolean);
}
async function init(){
  $('list').innerHTML='<p class="dq">Loading saved hunts.</p>';
  try{
    if(!paid()){
      paint(await demoHunts(), true);
      return;
    }
    if(Q.get('demo')==='1'){
      for(const h of await demoHunts())RWLoad.upsert(h);
    }
    paint(RWLoad.readSaved(), false);
  }catch(e){
    $('list').innerHTML='<p class="dq">The hunt files could not load.</p>';
  }
}
init();
})();
