(function(){
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const paid=()=>window.RWGate?RWGate.paid():false;
const SPECIES=[['deer','Deer'],['elk','Elk'],['pronghorn','Pronghorn'],['bear','Bear'],['moose','Moose']];
const STATES=[['co','Colorado'],['ut','Utah'],['az','Arizona'],['wy','Wyoming'],['id','Idaho'],['nv','Nevada']];
let S={sp:'deer',sx:'M',w:'R',se:'2',res:'nonres',pts:0,slots:[{state:'co',unit:'60'},{state:'co',unit:'70'}]};
function readUrl(){
  if(Q.get('sp'))S.sp=Q.get('sp');
  if('MFE'.includes(Q.get('sx')||''))S.sx=Q.get('sx');
  if('AMR'.includes(Q.get('w')||'-')||Q.get('w')==='')S.w=Q.get('w')||'';
  if('1234'.includes(Q.get('se')||'-')||Q.get('se')==='')S.se=Q.get('se')==null?'2':Q.get('se');
  if(Q.get('r')==='res'||Q.get('r')==='nonres')S.res=Q.get('r');
  if(Q.get('p')!=null&&Q.get('p')!=='')S.pts=Math.max(0, Math.min(30, +Q.get('p')||0));
  const u=Q.get('u');
  if(u){
    const slots=u.split(',').map(p=>{const [state,unit]=p.split(':');return state&&unit?{state,unit}:null}).filter(Boolean).slice(0,3);
    if(slots.length>=2)S.slots=slots;
  }
}
function stamp(params){if(window.RWGate)RWGate.stamp(params);return params}
function writeUrl(){
  const p=stamp(new URLSearchParams());
  p.set('sp',S.sp);p.set('sx',S.sx);if(S.w)p.set('w',S.w);if(S.se)p.set('se',S.se);
  p.set('r',S.res);p.set('p',S.pts);
  p.set('u',S.slots.map(s=>s.state+':'+s.unit).join(','));
  history.replaceState(null,'','?'+p);
}
function seg(attr, cur, opts){
  return '<div class="seg">'+opts.map(([v,t])=>`<button type="button" data-${attr}="${esc(v)}" class="${cur===v?'on':''}">${esc(t)}</button>`).join('')+'</div>';
}
function formHTML(){
  return `<div class="dox fy">
    <span class="lbl">Species</span>${seg('sp',S.sp,SPECIES)}
    <span class="lbl">Sex</span>${seg('sx',S.sx,[['M','Male'],['F','Female'],['E','Either sex'],['','Any']])}
    <span class="lbl">Weapon</span>${seg('w',S.w,[['R','Rifle'],['A','Archery'],['M','Muzzleloader'],['','Any']])}
    <span class="lbl">Colorado rifle season</span>${seg('se',S.se,[['1','1st'],['2','2nd'],['3','3rd'],['4','4th'],['','Any rifle']])}
    <p class="dq">The rifle season is for Colorado. Other states use the weapon. Private-land-only hunts stay off.</p>
    <span class="lbl">Where do you live?</span>${seg('res',S.res,[['res','In that state'],['nonres','Out of state']])}
    <span class="lbl">Points</span><div class="step"><button type="button" id="pm" aria-label="fewer points">−</button><output id="pv">${S.pts}</output><button type="button" id="pp" aria-label="more points">+</button></div>
    <span class="lbl">Units (2 or 3)</span>
    <div id="slots"></div>
    <button type="button" class="btn" id="addslot">Add a third unit</button>
    <button type="button" class="btn go2" id="go">Compare</button>
  </div><div id="board" aria-live="polite"></div>`;
}
function slotHTML(s,i){
  return `<div class="slot" data-i="${i}"><label>State <select data-k="state">${STATES.map(([v,t])=>`<option value="${v}"${s.state===v?' selected':''}>${t}</option>`).join('')}</select></label>
    <label>Unit <input data-k="unit" list="ul${i}" value="${esc(s.unit)}" autocomplete="off"></label>
    <datalist id="ul${i}"></datalist></div>`;
}
function paintSlots(){
  $('slots').innerHTML=S.slots.map(slotHTML).join('');
  $('addslot').hidden=S.slots.length>=3;
  $('slots').querySelectorAll('.slot').forEach(box=>{
    const i=+box.dataset.i;
    box.querySelector('[data-k=state]').onchange=e=>{S.slots[i].state=e.target.value;fillList(i)};
    box.querySelector('[data-k=unit]').oninput=e=>{S.slots[i].unit=e.target.value.trim()};
    fillList(i);
  });
}
async function fillList(i){
  const s=S.slots[i];
  const list=$('ul'+i);
  if(!list)return;
  try{
    const pack=await RWLoad.loadPack(s.state);
    const units=RWFp.listUnits(s.state, pack, S);
    list.innerHTML=units.map(u=>`<option value="${esc(u)}"></option>`).join('');
  }catch(e){list.innerHTML=''}
}
function wire(){
  document.querySelectorAll('.dox [data-sp],[data-sx],[data-w],[data-se],[data-res]').forEach(b=>{
    b.onclick=()=>{
      if(b.dataset.sp)S.sp=b.dataset.sp;
      if(b.hasAttribute('data-sx'))S.sx=b.dataset.sx;
      if(b.hasAttribute('data-w'))S.w=b.dataset.w;
      if(b.hasAttribute('data-se'))S.se=b.dataset.se;
      if(b.dataset.res)S.res=b.dataset.res;
      document.querySelectorAll('.dox button[data-sp],.dox button[data-sx],.dox button[data-w],.dox button[data-se],.dox button[data-res]').forEach(x=>{
        const on=(x.dataset.sp&&x.dataset.sp===S.sp)||(x.hasAttribute('data-sx')&&x.dataset.sx===S.sx)||(x.hasAttribute('data-w')&&x.dataset.w===S.w)||(x.hasAttribute('data-se')&&x.dataset.se===S.se)||(x.dataset.res&&x.dataset.res===S.res);
        if(x.dataset.sp||x.hasAttribute('data-sx')||x.hasAttribute('data-w')||x.hasAttribute('data-se')||x.dataset.res)x.classList.toggle('on',!!on);
      });
      S.slots.forEach((_,i)=>fillList(i));
    };
  });
  $('pm').onclick=()=>{S.pts=Math.max(0,S.pts-1);$('pv').textContent=S.pts};
  $('pp').onclick=()=>{S.pts=Math.min(30,S.pts+1);$('pv').textContent=S.pts};
  $('addslot').onclick=()=>{if(S.slots.length<3){S.slots.push({state:'co',unit:''});paintSlots()}};
  $('go').onclick=()=>run();
}
function dot(v){
  if(v==null)return '';
  const c=v>=.995?'#263E2C':v>=.75?'#6F7F4F':v>=.25?'#C4B28C':v>=.05?'#D2501F':'#E8E0D2';
  return `<i class="vdot" style="background:${c}"></i>`;
}
function histHTML(h){
  if(!h||h.missing)return `<span class="hym">${esc((h&&h.note)||'History not available')}</span>`;
  const cells=h.rows.map(r=>`<span class="yr"><b>${esc(r.year)}</b><span>${dot(r.v)}${esc(r.word||'')}</span></span>`).join('');
  return `<span class="yrs">${cells}</span>${h.trend?`<div class="tr">${esc(h.trend)}</div>`:''}`;
}
function cell(p, win, body){
  return `<div class="cell${win?' win':''}"><span class="k">${esc(p.label)}</span>${body}</div>`;
}
function row(title, cols, key, html){
  const set=key?cols.marks[key]:null;
  return `<h2>${title}</h2><div class="cmp-cols">${cols.list.map((p,i)=>cell(p, set&&set.has(i), p.empty?`<span class="v">${esc(p.reason)}</span>`:html(p))).join('')}</div>`;
}
function plannerHref(cols){
  const p=new URLSearchParams(location.search);
  if(window.RWGate)RWGate.stamp(p);
  const add=cols.list.filter(x=>x.huntId).map(x=>x.state+':'+x.huntId).join(',');
  if(add)p.set('add', add);
  p.delete('u');
  return 'planner.html?'+p.toString();
}
function board(cols, asked){
  const ban=window.RWGate?RWGate.banner():'';
  const lock=!paid();
  const askedTxt=asked.map(s=>s.unit).join(' and ');
  const lockNote=lock?`<aside class="fpbox"><p class="fpt">Sample comparison</p><p class="fpp">Free shows the two sample units for ${esc(RWFp.STATE_NAME[cols.list[0].state]||'this state')}. ${askedTxt&&askedTxt!==cols.list.map(p=>p.unit).join(' and ')?`You asked for ${esc(askedTxt)}. Those units are in the Full Pass.`:''} Exact percentages are not in the public file.</p></aside>`+(window.RWGate?RWGate.unlock('pricing.html'):''):'';
  const line=RWFp.verdict(cols.list);
  const heads=cols.list.map(p=>cell(p, false, p.empty?`<span class="v">${esc(p.reason)}</span>`:`<span class="v">${esc(p.huntTitle||'')}</span><span class="hym">${esc(p.huntId||'')}</span>`)).join('');
  $('board').innerHTML=ban+lockNote+
    `<p class="verdict">${esc(line)}</p>`+
    `<h2>The hunt used</h2><div class="cmp-cols">${heads}</div>`+
    row('Points likely needed', cols, 'points', p=>`<span class="v">${esc(p.pointsText)}</span>`)+
    row('Draw odds at your points', cols, 'odds', p=>`<span class="v">${dot(p.odds)}${esc(p.oddsWord||'No band')}</span>`)+
    row('Past draws', cols, 'trend', p=>histHTML(p.history))+
    row('Harvest success', cols, 'harvest', p=>`<span class="v">${esc(p.harvestText)}</span>`)+
    row('Public land', cols, 'land', p=>`<span class="v">${esc(p.landText)}</span>`)+
    `<p class="note">The highlighted cell is the better one on that row. Same cutoff words as Find Your Hunt. Odds are a band, not an exact percent. Not a guarantee. Checkout is not open.</p>`+
    `<p class="note">${esc(cols.list.map(p=>p.source).filter(Boolean)[0]||'Same public files as Find Your Hunt.')}</p>`+
    `<p><a class="btn o" href="${plannerHref(cols)}">Open these hunts in the season planner</a></p>`;
}
async function run(){
  S.slots=S.slots.filter(s=>s.state&&String(s.unit).trim()).slice(0,3);
  if(S.slots.length<2){$('board').innerHTML='<p class="dq">Pick at least two units.</p>';return}
  paintSlots();
  writeUrl();
  $('board').innerHTML='<p class="dq">Loading the same draw files Find Your Hunt uses.</p>';
  const asked=S.slots.map(s=>({state:s.state,unit:String(s.unit).trim()}));
  let use=asked;
  if(!paid()){
    const st=asked[0].state;
    const sample=(RWFp.SAMPLE[st]||[]).slice(0,2);
    use=sample.map(unit=>({state:st,unit}));
  }
  try{
    const packs={};
    for(const s of use)packs[s.state]=await RWLoad.loadPack(s.state);
    const list=use.map(s=>RWFp.profile(s.state, packs[s.state], {...S, unit:s.unit}));
    const marks=RWFp.marks(list);
    board({list, marks}, asked);
  }catch(e){
    $('board').innerHTML='<p class="dq">The draw file could not load. Refresh and try again.</p>';
  }
}
readUrl();
$('app').innerHTML=formHTML();
paintSlots();
wire();
run();
})();
