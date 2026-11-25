// Hunt advisor UI. Talks to the preview worker only when preview=advisor or preview=advisor-free.
// Does not call the live member API.
(function(){
'use strict';
const PREVIEW_API='https://rokwilder-api-advisor-preview.rokwilder.workers.dev';
const API=(location.hostname==='localhost'||location.hostname==='127.0.0.1')?'':PREVIEW_API;
const STATES=[['co','Colorado'],['ut','Utah'],['az','Arizona'],['wy','Wyoming'],['id','Idaho'],['nv','Nevada'],['mt','Montana'],['nm','New Mexico']];
const SPECIES=['elk','deer','pronghorn','bear','moose','bighorn sheep','desert bighorn','goat','bison','turkey'];
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function mode(){return window.RWGate&&RWGate.advisorMode?RWGate.advisorMode():null}
function prefix(){
  const parts=location.pathname.split('/').filter(Boolean);
  return parts.length>1?'../':'';
}
function here(){
  const path=location.pathname;
  if(/\/utah\//.test(path)) return 'ut';
  if(/\/arizona\//.test(path)) return 'az';
  if(/\/wyoming\//.test(path)) return 'wy';
  if(/\/idaho\//.test(path)) return 'id';
  if(/\/nevada\//.test(path)) return 'nv';
  if(/\/montana\//.test(path)) return 'mt';
  if(/\/newmexico\//.test(path)) return 'nm';
  return 'co';
}
function mapSex(v){
  const t=String(v||'').toLowerCase();
  if(t==='m'||t==='antlered'||t==='bull'||t==='buck'||t==='male') return 'antlered';
  if(t==='f'||t==='antlerless'||t==='cow'||t==='doe'||t==='female') return 'antlerless';
  if(t==='e'||t==='either'||t==='either-sex'||t==='eithersex') return 'either';
  return '';
}
function sexRows(species){
  const sp=String(species||'elk').toLowerCase();
  if(sp==='deer'||sp==='pronghorn') return [['','Please choose'],['antlered','Buck'],['antlerless','Doe'],['either','Either']];
  if(sp==='elk'||sp==='moose') return [['','Please choose'],['antlered','Bull'],['antlerless','Cow'],['either','Either']];
  return null;
}
function sexFromHunt(key, title){
  const t=String(title||'').toLowerCase();
  if(/\bbull\b|\bbuck\b|\bantlered\b/.test(t) && !/\bcow\b|\bdoe\b|\beither\b/.test(t)) return 'antlered';
  if(/\bcow\b|\bdoe\b|\bantlerless\b/.test(t) && !/\bbull\b|\bbuck\b|\beither\b/.test(t)) return 'antlerless';
  if(/\beither\b/.test(t)) return 'either';
  const k=String(key||'');
  if(/^[A-Z]M/.test(k) || /^E[BD]/.test(k)) return 'antlered';
  if(/^[A-Z]F/.test(k) || /^E[A]/.test(k)) return 'antlerless';
  if(/^[A-Z]E/.test(k)) return 'either';
  return '';
}
function pageFilters(){
  const q=new URLSearchParams(location.search);
  const w=q.get('w');
  return {
    state: here(),
    species: q.get('sp')||'elk',
    residency: q.get('r')==='nonres'||q.get('r')==='nr'?'nonres':'res',
    points: q.get('p')!=null&&q.get('p')!==''?Number(q.get('p')):0,
    weapon: !w?'any':w==='A'?'archery':w==='M'?'muzzleloader':w==='R'?'rifle':'any',
    sex: mapSex(q.get('sx')||q.get('sex')||'')
  };
}
function savedHunts(){
  try{
    const raw=JSON.parse(localStorage.getItem('rw_hunt_picks')||'{}');
    const picks=Array.isArray(raw.picks)?raw.picks:[];
    return picks.map(p=>{
      const id=String(p.id||'');
      const parts=id.split(':');
      const state=p.snap&&p.snap.state||parts[0];
      const key=p.snap&&(p.snap.key||p.snap.huntKey)||parts.slice(1).join(':');
      return {state, key, residency: p.snap&&p.snap.residency, points: p.snap&&p.snap.pts};
    }).filter(h=>h.state&&h.key);
  }catch(e){return []}
}
async function api(path, body){
  const opts={credentials:'include', cache:'no-store', headers:{}};
  if(body!==undefined){
    opts.method='POST';
    opts.headers['Content-Type']='application/json';
    opts.body=JSON.stringify(body);
  }
  const r=await fetch(API+path, opts);
  let j=null;
  try{j=await r.json()}catch(e){j=null}
  return {ok:r.ok, status:r.status, j:j||{}};
}
let sessionReady=null;
function ensureSession(){
  if(sessionReady) return sessionReady;
  const m=mode();
  if(!m) return Promise.resolve(null);
  sessionReady=api('/api/preview/session',{role:m==='member'?'member':'free'}).then(r=>r.j).catch(()=>null);
  return sessionReady;
}
function usageLine(usage){
  if(!usage) return '';
  return usage.remaining+' of '+usage.limit+' questions left this month.';
}
function huntLinks(list){
  if(!list||!list.length) return '';
  return list.map(h=>{
    const href=prefix()+(h.href||'find.html');
    const y=h.draw&&h.draw.year;
    const w=h.draw&&h.draw.word||'';
    let draw='';
    if(y && (/you(?:'ll| will) draw/i.test(w) || w==="YES, you'll draw")) draw='In the '+y+' draw, you would have drawn';
    else if(y && /not this year/i.test(w)) draw='In the '+y+' draw, you would not have drawn';
    else if(y && w) draw='In the '+y+' draw: '+w;
    else if(w) draw=w;
    const land=h.land&&h.land.text?esc(h.land.text):'';
    const harv=h.harvest&&h.harvest.pct!=null?esc(Math.round(h.harvest.pct)+'% hunter success'):'';
    const bits=[draw?esc(draw):'', harv, land].filter(Boolean).join('. ');
    return '<a class="adv-hunt" href="'+esc(href)+'"><span class="adv-ht">'+esc(h.stateName||'')+' · '+esc(h.title)+'</span><span class="adv-hk">Hunt code '+esc(h.key)+'</span>'+(bits?'<span class="adv-hd">'+bits+'</span>':'')+'</a>';
  }).join('');
}
function renderAnswer(box, data){
  const host=box.querySelector('.adv-out');
  if(!host) return;
  if(data&&data.kind==='limit'){
    host.innerHTML='<div class="adv-ans"><p>'+esc(data.error||data.j&&data.j.error)+'</p><p class="remain">'+esc(usageLine(data.usage||data.j&&data.j.usage))+'</p></div>';
    return;
  }
  const j=data.j||data;
  if((j.kind==='need_sex' || (j.result&&j.result.kind==='need_sex'))){
    const opts=(j.result&&j.result.sexOptions)||j.sexOptions||[];
    const buttons=opts.map(o=>'<button type="button" data-adv-sex-pick="'+esc(o.value)+'">'+esc(o.label)+'</button>').join('');
    host.innerHTML='<div class="adv-ans"><p>'+esc(j.text||j.reason||j.result&&j.result.reason||'')+'</p><div class="suggestions adv-sexes">'+buttons+'</div></div>';
    host.querySelectorAll('[data-adv-sex-pick]').forEach(b=>{
      b.onclick=()=>{
        const val=b.getAttribute('data-adv-sex-pick');
        const sel=box.querySelector('[data-adv=sex]');
        if(sel) sel.value=val;
        const prev=Object.assign({}, box._lastPayload||payloadFrom(box,null));
        prev.sex=val;
        send(box, prev);
      };
    });
    return;
  }
  const text=j.text||j.error||"I don't know.";
  const hunts=(j.result&&(j.result.picks||(j.result.caution?[j.result.caution]:null)))||null;
  const extra=j.result&&j.result.caution&&j.result.picks? [j.result.caution] : [];
  const links=huntLinks([].concat(j.result&&j.result.picks||[], j.result&&j.result.hunts||[], extra).filter((h,i,a)=>h&&a.findIndex(x=>x.key===h.key)===i));
  host.innerHTML='<div class="adv-ans"><p>'+esc(text)+'</p>'+links+'<p class="remain">'+esc(usageLine(j.usage))+'</p></div>';
}
function formValues(box){
  const f=pageFilters();
  const st=(box.querySelector('[data-adv=state]')||{}).value||f.state;
  const sp=(box.querySelector('[data-adv=species]')||{}).value||f.species;
  const res=(box.querySelector('[data-adv=res]')||{}).value||f.residency;
  const ptsEl=box.querySelector('[data-adv=points]');
  const points=ptsEl&&ptsEl.value!==''?Number(ptsEl.value):f.points;
  const weapon=(box.querySelector('[data-adv=weapon]')||{}).value||f.weapon;
  const question=(box.querySelector('[data-adv=q]')||{}).value||'';
  const sexEl=box.querySelector('[data-adv=sex]');
  const sex=mapSex((sexEl&&sexEl.value)||box.getAttribute('data-adv-sex')||f.sex||'');
  return {state:st, species:sp, residency:res, points, weapon, sex, question};
}
async function send(box, payload){
  const msg=box.querySelector('.adv-msg');
  const btn=box.querySelector('[data-adv=send]');
  const out=box.querySelector('.adv-out');
  if(out) out.innerHTML='';
  if(msg) msg.textContent='Working on your answer…';
  if(btn) btn.disabled=true;
  box._lastPayload=payload;
  try{
    await ensureSession();
    const r=await api('/api/fullpass/advisor/ask', payload);
    if(r.status===402){
      box.outerHTML=lockedHTML();
      return;
    }
    if(r.status===429){
      renderAnswer(box, {kind:'limit', error:r.j.error, usage:r.j.usage});
      return;
    }
    if(!r.ok){
      if(msg) msg.textContent=(r.j&&r.j.error)||'Something went wrong. Please try again.';
      return;
    }
    renderAnswer(box, r);
    if(msg) msg.textContent='';
  }catch(e){
    if(msg) msg.textContent='Something went wrong. Please try again.';
  }finally{
    if(btn) btn.disabled=false;
    if(msg&&msg.textContent==='Working on your answer…') msg.textContent='';
  }
}
function lockedHTML(){
  return '<div class="askbox lockbox" id="advisor"><h2>Ask the hunt advisor</h2><p>The hunt advisor is part of the Full Pass. It can suggest where to put in with your points, and compare hunts you save.</p><p><a class="btn" href="'+esc(prefix()+'pricing.html#fullpass')+'">Get the Full Pass</a></p><p class="renew">Renews every year at the same price until you cancel. You can cancel anytime from your account.</p><p class="renew">Renews every year at $19.99. That price stays locked as long as you keep renewing. You can cancel anytime from your account.</p></div>';
}
function plannerHTML(filters){
  const f=filters||pageFilters();
  const opts=(rows,cur)=>rows.map(([v,l])=>'<option value="'+esc(v)+'"'+(String(cur)===String(v)?' selected':'')+'>'+esc(l)+'</option>').join('');
  const species=SPECIES.map(s=>[s,s[0].toUpperCase()+s.slice(1)]);
  const weapons=[['any','Any weapon'],['rifle','Rifle'],['archery','Archery'],['muzzleloader','Muzzleloader']];
  const res=[['res','Resident'],['nonres','Nonresident']];
  return '<div class="askbox" id="advisor">'+
    '<h2>Ask the hunt advisor</h2>'+
    '<p class="ctx">Preview only. Answers come from official draw, harvest, and public-land files already on this site. This is not a forecast for the next draw.</p>'+
    '<div class="adv-grid">'+
    '<label>State<select data-adv="state">'+opts(STATES,f.state)+'</select></label>'+
    '<label>Species<select data-adv="species">'+opts(species,f.species)+'</select></label>'+
    '<label>Residency<select data-adv="res">'+opts(res,f.residency)+'</select></label>'+
    '<label>Points<input data-adv="points" type="number" min="0" max="40" step="1" value="'+esc(f.points)+'"></label>'+
    '<label>Weapon<select data-adv="weapon">'+opts(weapons,f.weapon)+'</select></label>'+
    (function(){
      const rows=sexRows(f.species);
      if(!rows) return '';
      return '<label>Sex<select data-adv="sex">'+opts(rows,f.sex||'')+'</select></label>';
    }())+
    '</div>'+
    '<div class="suggestions">'+
    '<button type="button" data-adv-sug="putin">Where should I put in with my points?</button>'+
    '<button type="button" data-adv-sug="compare">Compare with my saved hunts</button>'+
    '</div>'+
    '<label>Your question<textarea data-adv="q" rows="3" maxlength="1200" placeholder="I have 6 elk points in Colorado. Where should I put in?"></textarea></label>'+
    '<button type="button" class="btn" data-adv="send">Ask</button>'+
    '<p class="adv-msg" role="status"></p>'+
    '<div class="adv-out"></div>'+
    '</div>';
}
function cardHTML(key, filters){
  const f=filters||pageFilters();
  const title=cardTitle(key)||('this hunt ('+key+')');
  const who=[f.residency==='nonres'?'a nonresident':'a resident', (f.points||0)+' point'+(Number(f.points)===1?'':'s'), f.weapon!=='any'?f.weapon:''].filter(Boolean).join(', ');
  const sex=f.sex||sexFromHunt(key, title);
  return '<div class="askbox adv-card" data-adv-card="'+esc(key)+'"'+(sex?' data-adv-sex="'+esc(sex)+'"':'')+'>'+
    '<h3>Ask about this hunt</h3>'+
    '<p class="ctx">This question is about '+esc(title)+'. We already have you as '+esc(who)+'.</p>'+
    '<div class="suggestions">'+
    '<button type="button" data-adv-sug="odds">What are my odds with my points?</button>'+
    '<button type="button" data-adv-sug="compare">Compare with my saved hunts</button>'+
    '<button type="button" data-adv-sug="first">Should I put this first?</button>'+
    '</div>'+
    '<label>Your question<textarea data-adv="q" rows="3" maxlength="1200" placeholder="Ask a question about this hunt"></textarea></label>'+
    '<button type="button" class="btn" data-adv="send">Ask</button>'+
    '<p class="adv-msg" role="status"></p>'+
    '<div class="adv-out"></div>'+
    '</div>';
}
function cardTitle(key){
  let el=null;
  document.querySelectorAll('button.fh[data-k]').forEach(b=>{if(!el&&b.getAttribute('data-k')===key)el=b});
  const t=el&&el.querySelector('.ft');
  if(t&&t.textContent.trim()) return t.textContent.replace(/\s+/g,' ').trim();
  const det=document.getElementById('detail');
  if(det&&!det.hidden){
    const tg=det.querySelector('.tg');
    if(tg&&tg.textContent.trim()) return tg.textContent.replace(/\s+/g,' ').trim();
  }
  return '';
}
function payloadFrom(box, sug){
  const f=formValues(box);
  const key=box.getAttribute('data-adv-card');
  const hunt=key?{state:here(), key}:null;
  const hunts=savedHunts();
  if(sug==='compare'){
    return {job:'compare', question:f.question||'Compare with my saved hunts', residency:f.residency, points:f.points, hunt, hunts, sex:f.sex};
  }
  if(sug==='odds'){
    return {job:'lookup', question:f.question||'What are my odds with my points?', state:f.state, species:f.species, residency:f.residency, points:f.points, weapon:f.weapon, hunt, sex:f.sex||sexFromHunt(key, cardTitle(key))};
  }
  if(sug==='first'){
    return {job:'recommend', question:f.question||'Should I put this first?', state:f.state, species:f.species, residency:f.residency, points:f.points, weapon:f.weapon, hunt, hunts, sex:f.sex||sexFromHunt(key, cardTitle(key))};
  }
  if(sug==='putin'){
    return {job:'recommend', question:f.question||'Where should I put in with my points?', state:f.state, species:f.species, residency:f.residency, points:f.points, weapon:f.weapon, hunt, hunts, sex:f.sex||sexFromHunt(key, cardTitle(key))};
  }
  const question=f.question||'Where should I put in with my points?';
  if(!f.question){
    return {job:'recommend', question, state:f.state, species:f.species, residency:f.residency, points:f.points, weapon:f.weapon, hunt, hunts, sex:f.sex||sexFromHunt(key, cardTitle(key))};
  }
  return {job:'auto', question, state:f.state, species:f.species, residency:f.residency, points:f.points, weapon:f.weapon, hunt, hunts, sex:f.sex||sexFromHunt(key, cardTitle(key))};
}
function wire(box){
  if(!box||box.getAttribute('data-wired')) return;
  box.setAttribute('data-wired','1');
  box.querySelectorAll('[data-adv-sug]').forEach(b=>{
    b.onclick=()=>{
      const q=box.querySelector('[data-adv=q]');
      if(q&&!q.value) q.value=b.textContent.trim();
      send(box, payloadFrom(box, b.getAttribute('data-adv-sug')));
    };
  });
  const go=box.querySelector('[data-adv=send]');
  if(go) go.onclick=()=>send(box, payloadFrom(box, null));
  const sp=box.querySelector('[data-adv=species]');
  if(sp) sp.addEventListener('change', ()=>refreshSexSelect(box));
  refreshSexSelect(box);
}
function refreshSexSelect(box){
  const sel=box.querySelector('[data-adv=sex]');
  const sp=(box.querySelector('[data-adv=species]')||{}).value||pageFilters().species;
  const rows=sexRows(sp);
  if(!sel) return;
  const cur=sel.value;
  if(!rows){ sel.closest('label').hidden=true; return; }
  sel.closest('label').hidden=false;
  sel.innerHTML=rows.map(([v,l])=>'<option value="'+esc(v)+'"'+(cur===v?' selected':'')+'>'+esc(l)+'</option>').join('');
}
function paintPlanner(){
  const m=mode();
  if(!m) return;
  const tools=$('rwtools')||$('planner')||document.querySelector('main');
  if(!tools) return;
  if(tools.querySelector('#advisor, .askbox.lockbox')){
    tools.querySelectorAll('.askbox').forEach(wire);
    return;
  }
  const html=m==='member'?plannerHTML():lockedHTML();
  const wrap=document.createElement('div');
  wrap.innerHTML=html;
  const el=wrap.firstElementChild;
  tools.insertBefore(el, tools.firstChild);
  wire(el);
  ensureSession();
}
function paintCards(root){
  const m=mode();
  if(m!=='member') return;
  const scope=root||document;
  scope.querySelectorAll('button.fh[data-k]').forEach(btn=>{
    const li=btn.closest('li')||btn.parentElement;
    if(!li) return;
    const key=btn.getAttribute('data-k');
    if(li.querySelector('[data-adv-card="'+key+'"]')) return;
    const bar=li.querySelector('.pkbar');
    const wrap=document.createElement('div');
    wrap.innerHTML=cardHTML(key);
    const el=wrap.firstElementChild;
    if(bar&&bar.parentNode===li) bar.insertAdjacentElement('afterend', el);
    else li.appendChild(el);
    wire(el);
  });
  const det=$('detail');
  if(det&&!det.hidden){
    const key=new URLSearchParams(location.search).get('h')||new URLSearchParams(location.search).get('k');
    if(key&&!det.querySelector('[data-adv-card]')){
      const wrap=document.createElement('div');
      wrap.innerHTML=cardHTML(key);
      const el=wrap.firstElementChild;
      const after=det.querySelector('.yo')||det.querySelector('.pkbar');
      if(after) after.insertAdjacentElement('afterend', el);
      else det.appendChild(el);
      wire(el);
    }
  }
}
function boot(){
  if(!mode()) return;
  ensureSession();
  if(document.body&&document.body.getAttribute('data-page')==='hunt-planner') paintPlanner();
  paintCards(document);
}
window.RWAdvisor={API,mode,paintPlanner,paintCards,boot,ensureSession};
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
