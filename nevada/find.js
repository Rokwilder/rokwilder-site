// Nevada Find Your Hunt. 2025 Big Game Main Draw, 1st choice.
// Bonus points are squared and the application is added, then the draw is random.
// A stored band is what happened at that exact point level. A missing level is not filled in.
// The public file has no counts. Exact percents render only when a Full Pass file adds raw.lv[points].rate1
// (2025 1st choice) and window.RW_FP is set by that file. rate1 is from 0 to 1.
(function(){
const FP=window.RW_FP===true && typeof NH==='object' && Object.values(NH).some(h=>h&&h.raw&&h.raw.lv);
const pct=v=>{const r=Math.round(v*100);return v>0&&r===0?'under 1%':v<1&&r===100?'over 99%':r+'%'};
function lvRaw(h){const lv=h&&h.raw&&h.raw.lv;if(!lv)return null;return lv[S.pts]!=null?lv[S.pts]:lv[String(S.pts)]}
function oddsHTML(h){
 if(!FP)return '';
 const row=lvRaw(h);
 if(!row||typeof row.rate1!=='number'||!(row.rate1>=0)||row.rate1>1)return `<span class="fo"><span class="fpn">No 2025 1st-choice count at this point level</span></span>`;
 const n=(typeof row.s1==='number'&&typeof row.a1==='number'&&row.a1>0)?`, ${row.s1.toLocaleString()} drawn of ${row.a1.toLocaleString()}`:'';
 return `<div class="fo"><b>${pct(row.rate1)}</b> <span>2025 1st-choice result${n}</span></div>`}
const paid=()=>window.RWGate?RWGate.paid():FP;
const fpBox=()=>(FP||paid()||window.RW_FP===true)?'':`<aside class="fpbox rw-fp-cta" aria-label="What the Full Pass adds"><p class="fpt">What the Full Pass adds on top of this list</p><ul><li>Exact draw odds, where we have published them, for every state on the site</li><li>A multi-year look where we have the years</li></ul><p class="fpp">This Nevada page is a 2025 result band, not an exact percentage. Exact percentages are not in the public file. Full Pass: $29.99 a year. Founding Hunter: $19.99 a year for the first 200 members, locked as long as you keep renewing.<span class="rw-offer" data-pricing="../pricing.html" data-kind="aside"></span></p><p class="renew">Renews every year at the same price until you cancel. You can cancel anytime from your account.</p><p class="renew">Renews every year at $19.99. That price stays locked as long as you keep renewing. You can cancel anytime from your account.</p></aside>`;
const fpLine=()=>(FP||paid()||window.RW_FP===true)?'':`<p class="fpl rw-fp-cta">Exact Nevada odds are not on this free file. They come with the Full Pass where we have published them<span class="rw-offer" data-pricing="../pricing.html" data-kind="paren"></span></p>`;
const SAMPLE_UNITS=new Set(['231','075']);
const isSample=k=>{const u=NH[k]&&NH[k].units;return SAMPLE_UNITS.has(u)};
const bandWord=v=>WORD[v]||(v===0?'NONE DREW':v>0?'LONG SHOT':'');
function verdictLine(v){const word=bandWord(v);if(!word)return '';return window.RWSeason?RWSeason.label(NV_META.year,'result',word):word}
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
const H=Object.entries(NH);
const SP={elk:'Elk',deer:'Mule deer',antelope:'Antelope',dsheep:'Desert bighorn',csheep:'California bighorn',rsheep:'Rocky Mountain bighorn',goat:'Mountain goat',moose:'Moose',bear:'Black bear'};
const SX={
  elk:{M:'Antlered',F:'Antlerless',S:'Spike'},
  deer:{M:'Antlered'},
  antelope:{M:'Horns longer than ears',F:'Horns shorter than ears'},
  dsheep:{M:'Any ram',F:'Any ewe'},
  csheep:{M:'Any ram'},
  rsheep:{M:'Any ram'},
  goat:{E:'Either sex'},
  moose:{M:'Antlered'},
  bear:{E:'Either sex'}
};
const WPN={alw:'Any legal weapon',bow:'Archery',muz:'Muzzleloader',classic:'Classic',shotgun:'Shotgun or bow only',prim:'Primitive'};
const WORD={1:'ALL DREW',0.75:'MOST DREW',0.25:'SOME DREW',0.05:'FEW DREW'};
const COL={1:'#263E2C',0.75:'#6F7F4F',0.25:'#C4B28C',0.05:'#D2501F'};
let S={sp:'elk',sx:'M',live:'res',who:'main',wpn:'alw',pts:0,unit:'',n:25,focus:'',ord:'',tab:'list'};
let unitCtl=null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rows=()=>H.filter(([,h])=>h.sp===S.sp&&h.sx===S.sx&&h.live===S.live&&h.who===S.who);
const weaponRows=()=>rows().filter(([,h])=>!S.wpn||h.wpn===S.wpn);
const WPN_ORDER=['alw','bow','muz','classic','shotgun','prim'];
function weaponChoices(){
  const seen=new Set();
  const wpns=[];
  for(const [,h] of rows())if(!seen.has(h.wpn)){seen.add(h.wpn);wpns.push(h.wpn)}
  wpns.sort((a,b)=>WPN_ORDER.indexOf(a)-WPN_ORDER.indexOf(b));
  return wpns;
}
function seaBar(){
  const items=[['', 'All']].concat(weaponChoices().map(w=>[w, WPN[w]||w]));
  return `<div class="vbar" role="group" aria-label="Season">${items.map(([k,w])=>`<button type="button" class="vb${S.wpn===k?' on':''}" data-nvsea="${k}">${w}</button>`).join('')}</div><p class="dq">2025 seasons from the NDOW bonus point table. The button is the weapon printed on that hunt. The dates are on each hunt. NDOW did not print an early or late name on these rows.</p>`;
}
function stampWpn(){
  const u=new URL(location.href);
  u.searchParams.set('wpn', S.wpn||'all');
  history.replaceState(null,'',u.pathname+u.search+u.hash);
}
function bandAt(h){return Object.prototype.hasOwnProperty.call(h.bp,S.pts)?h.bp[S.pts]:null}
function tie(a,b){const d=RWUnit.sortNum([a.h.units])-RWUnit.sortNum([b.h.units]);if(d)return d;const s=a.h.season.localeCompare(b.h.season);return s||a.k.localeCompare(b.k)}
function nvChance(h,pts){const prev=S.pts;S.pts=pts;try{if(FP){const row=lvRaw(h);if(row&&typeof row.rate1==='number'&&row.rate1>=0&&row.rate1<=1)return row.rate1}return bandAt(h)}finally{S.pts=prev}}
function rowMeasure(x){return RWDraw.measure(p=>nvChance(x.h,p),S.pts)}
function ranked(){const rows=weaponRows().filter(([,h])=>{if(!RWUnit.hit([h.units],S.unit))return false;const v=bandAt(h);return v!==null&&v>0}).map(([k,h])=>({k,h,v:bandAt(h)}));return RWDraw.byDraw(rows,row=>RWDraw.spanBand(row.k,null,S.pts),row=>row.v,tie)}
function rowsInOrder(all){if(S.ord==='hard'||S.ord==='easy')return RWDraw.order(all,S.ord,rowMeasure,tie);if(S.focus=='land')return all.slice().sort((a,b)=>RWLand.rank(nvBand(b.h))-RWLand.rank(nvBand(a.h))||b.v-a.v||a.h.units.localeCompare(b.h.units,undefined,{numeric:true}));return all}
const below=()=>weaponRows().filter(([,h])=>bandAt(h)===0).length;
const missing=()=>weaponRows().filter(([,h])=>bandAt(h)===null).length;
const maxPts=()=>{let m=0;for(const [,h] of rows())for(const p of Object.keys(h.bp))m=Math.max(m,Number(p));return m};
const whoWord=()=>S.who==='junior'?'Junior hunt':S.who==='guided'?'Guided nonresident':'Main draw';
const liveWord=()=>S.live==='res'?'Nevada resident':'Out of state';
const sxWord=()=>(SX[S.sp]&&SX[S.sp][S.sx])||'';
const whoLine=()=>`${SP[S.sp]} · ${sxWord()} · ${S.wpn?(WPN[S.wpn]||S.wpn):'Any weapon'} · ${liveWord()} · ${whoWord()} · ${S.pts} bonus point${S.pts===1?'':'s'}`;
function title(h){return `${esc(h.units)} · ${esc(h.wlab)}`}
function nvPlace(text){const key=RWLand.nvKey(text);if(!key)return String(text);const nums=key.split('+').map(n=>+n);
 if(nums.length===1)return 'Unit '+nums[0];const run=nums.every((n,i)=>i===0||n===nums[i-1]+1);if(run)return 'Units '+nums[0]+'–'+nums[nums.length-1];return RWLand.human(nums.map(String),'Unit','Units')}
function nvBand(h){return RWLand.band('nv',RWLand.nvKey(h.units))}
function nvSaleUnit(text){const key=RWLand.nvKey(text);if(!key||key.indexOf('+')>=0)return '';return key}
function nvExtra(h,v){if(!paid())return '';const b=nvBand(h),place=nvPlace(h.units),unit=nvSaleUnit(h.units),sp=h.sp==='antelope'?'pronghorn':h.sp;
 return RWLand.extra({band:b,land:b,voice:'history',odds:RWLand.oddsKind(v),place,href:RWLand.pkgHref('../','nv',unit,sp)})}
function focusBar(){return `<div class="sbar"><span class="lbl">What matters most to you?</span><div class="seg"><button type="button" data-focus="" class="${S.focus?'':'on'}">Draw result</button><button type="button" data-focus="land" class="${S.focus=='land'?'on':''}">Public land</button></div></div>`}
function card(x,i){return `<li><button class="fh" data-k="${esc(x.k)}"><span class="rk">${i+1}</span><span class="ft">${title(x.h)}</span><span class="fv"><i class="vdot" style="background:${COL[x.v]||'#E8E0D2'}"></i>${verdictLine(x.v)}</span><span class="fd">${esc(x.h.season)}</span><span class="fd">2025 main draw · 1st choice · historical result</span>${oddsHTML(x.h)}${RWHy(x.k,null,S.pts)}</button></li>`}
function cardFull(x,i){const bits=RWLand.splitNext(nvExtra(x.h,x.v));return `<li><button class="fh" data-k="${esc(x.k)}"><span class="rk">${i+1}</span><span class="ft">${title(x.h)}</span><span class="fv"><i class="vdot" style="background:${COL[x.v]||'#E8E0D2'}"></i>${verdictLine(x.v)}</span><span class="fd">${esc(x.h.season)}</span><span class="fd">2025 main draw · 1st choice · historical result</span>${oddsHTML(x.h)}${RWHy(x.k,null,S.pts)}${window.RWTrophy?RWTrophy.chip(x.k):''}${bits.info}</button>${bits.next}</li>`}
function sampleRows(){return weaponRows().filter(([k,h])=>isSample(k)&&bandAt(h)!=null).map(([k,h])=>({k,h,v:bandAt(h)}))}
function ladder(h){
  if(FP&&h.raw&&h.raw.lv){
    const pts=Object.keys(h.raw.lv).map(Number).filter(n=>!Number.isNaN(n)).sort((a,b)=>a-b);
    const quota=(typeof h.raw.quota==='number')?`<p class="dq">Quota printed on the 2025 table: ${h.raw.quota.toLocaleString()}.</p>`:'';
    return `<p class="lh">2025 1st-choice result by bonus-point level</p>${quota}<table class="dt"><tr><th>Bonus points</th><th>1st choice</th><th>All choices</th></tr>`+pts.map(n=>{
      const row=h.raw.lv[n]!=null?h.raw.lv[n]:h.raw.lv[String(n)];
      const first=row&&typeof row.rate1==='number'?`${pct(row.rate1)}${typeof row.s1==='number'&&typeof row.a1==='number'?` (${row.s1.toLocaleString()} of ${row.a1.toLocaleString()})`:''}`:'';
      const all=row&&typeof row.s==='number'&&typeof row.a==='number'?`${row.s.toLocaleString()} of ${row.a.toLocaleString()}`:'';
      return `<tr class="${n===S.pts?'on':''}"><td>${n}</td><td>${first}</td><td>${all}</td></tr>`;
    }).join('')+'</table><p class="dq">1st choice is the percent on this page. All choices adds the other choices on that 2025 row. A level is listed when the file has a row. This is not a forecast.</p>';
  }
  const pts=Object.keys(h.bp).map(Number).sort((a,b)=>a-b);
  return `<p class="lh">2025 1st-choice result by bonus-point level</p><table class="dt"><tr><th>Bonus points</th><th>Result</th></tr>`+pts.map(n=>{const v=h.bp[n];const word=WORD[v]||(v===0?'None drew':v>0?'Long shot':'');return `<tr class="${n===S.pts?'on':''}"><td>${n}</td><td>${word}</td></tr>`}).join('')+'</table><p class="dq">Words only. A level is listed when that table had a 1st-choice row. A blank level is not a zero, and a higher level is not filled in from a lower one.</p>';
}
function nvKeys(){return weaponRows().filter(([,h])=>RWUnit.hit([h.units],S.unit)).map(([k])=>k)}
function nvOpts(member){return {points:S.pts,rule:window.RWLong?RWLong.rules.nv:'',member:!!member,next:window.RWLong?RWLong.nextFromHistory(nvKeys(),null,S.pts,k=>'Unit '+(NH[k].units||k)):null}}
function lsHead(rows,member){if(window.RWLong)return RWLong.head(rows,nvOpts(member));const n=rows.length;return n?`<h2 id="lt">${n} hunt${n===1?'':'s'} you can draw</h2>`:''}
function lsOrder(rows){if(!(window.RWLong&&RWLong.allLong(rows)))return rows;if(S.ord==='hard'||S.ord==='easy'||S.focus==='land')return rows;return RWLong.bestFirst(rows)}
function showList(sc){
  const o=$('out');$('detail').hidden=true;o.hidden=false;$('empty').hidden=true;if(LM&&S.tab!=='map'){LM.remove();LM=null}if(DM){DM.remove();DM=null}
  const all=lsOrder(ranked()),nb=below(),nm=missing();
  const note=`<p class="note">Bands are the 2025 main-draw result for 1st choice at this bonus-point level. They are not a chance in a future draw. Odds above 0 and under one in twenty are long shots. Hunts where none drew stay off the list${nb?` (${nb} hunt${nb===1?'':'s'} in that group)`:''}. ${nm?`${nm} hunt${nm===1?' has':'s have'} no 1st-choice row at ${S.pts} point${S.pts===1?'':'s'}.`:''} Not a guarantee. Check the current NDOW regulation before you apply.</p>`+(paid()?`<p class="note">${RWLand.pageNote('nv')}</p>`:'');
  if(!paid()){
    if(window.RWLong&&RWLong.allLong(all)){
      const best=RWLong.bestFirst(all);
      o.innerHTML=RWLong.banner(nvOpts(false))+`<h2 id="lt">Long shots you could still draw</h2><p class="dq">${esc(whoLine())}. Words only on the free page.</p>`+RWGate.unlock('../pricing.html')+`<ol class="fl">`+best.map(card).join('')+`</ol>`+note;
      o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));if(sc)o.scrollIntoView({behavior:'smooth'});return}
    const samples=RWGate.takePerUnit(sampleRows(),x=>x.h.units);
    o.innerHTML=RWGate.freeShell({count:all.length,species:(SP[S.sp]||S.sp).toLowerCase(),who:esc(whoLine())+'.',pricing:'../pricing.html',sampleNote:'<b>Sample.</b> Units 231 and 075 only, up to 3 hunts from each. These are the default elk filters: antlered, resident, any legal weapon, main draw, 0 bonus points. This is not your whole list.',samplesHtml:samples.length?`<ol class="fl">`+samples.map(card).join('')+'</ol>':''});
    o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));if(sc)o.scrollIntoView({behavior:'smooth'});return}
  const r=rowsInOrder(all);
  const list=lsOrder(window.RWTrophy?RWTrophy.refine(r):r);
  const ban=window.RWGate?RWGate.banner():'';
  const tNote=window.RWTrophy?RWTrophy.sortNote():'';
  const lead=tNote||(S.ord==='hard'?'Hardest to draw first.':S.ord==='easy'?'Easiest to draw first.':(S.focus=='land'?'Mostly public land first.':'Strongest 2025 result first.'));
  const tabs=mapTabs();
  if(S.tab==='map'){
    o.innerHTML=ban+lsHead(list,true)+tabs+`<p class="dq">${esc(whoLine())}. Colored units have at least one hunt you can draw. The color is the best 2025 result among hunts that include that unit. Orange is a long shot when the share was above 0 and under one in twenty. Tap a unit to see its hunts.</p>`+mapKey()+`<div id="map" class="gmap" aria-label="Map of Nevada hunt units"></div>`+mapCred()+note+fpLine();
    o.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;if(S.tab==='list')S.n=25;showList()});
    drawMap(list);if(sc)o.scrollIntoView({behavior:'smooth'});return}
  o.innerHTML=ban+lsHead(list,true)+seaBar()+tabs+`${focusBar()}${RWDraw.bar(S.ord,true)}${window.RWTrophy?RWTrophy.bar(S.sp):''}<p class="dq">${esc(whoLine())}. ${lead} Tap a hunt for the other point levels.</p>`+fpBox()+
    `<ol class="fl">`+list.slice(0,S.n).map(cardFull).join('')+`</ol>`+(list.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(25,list.length-S.n)} more (${list.length-S.n} left)</button>`:'')+
    (list.length?'':(window.RWTrophy?RWTrophy.emptyNote(r.length,list.length):'')||(window.RWLong?RWLong.empty(nvOpts(true)):`<p class="dq">No hunts you can draw at this point level.</p>`))+note+fpLine();
  o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));
  o.querySelectorAll('[data-nvsea]').forEach(b=>b.onclick=()=>{S.wpn=b.dataset.nvsea||'';S.vd='';S.n=25;stampWpn();paint();showList()});
  o.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;if(S.tab==='list')S.n=25;showList()});
  RWDraw.wire(o,v=>{S.ord=v;S.n=25;showList()});
  if(window.RWTrophy)RWTrophy.wire(o,()=>{S.n=25;showList()});
  o.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>{S.focus=b.dataset.focus;S.n=25;showList()});
  if($('more'))$('more').onclick=()=>{S.n+=25;showList()};
  if(sc)o.scrollIntoView({behavior:'smooth'});
}
function nvTags(h){
  if(!window.RWTags)return '';
  if(!paid())return RWTags.locked('../pricing.html');
  const lv=FP&&h.raw&&h.raw.lv;
  if(!lv)return RWTags.missing('The Nevada file on this page has a result band for each point level. It does not list how many people applied or drew.');
  const rows=Object.keys(lv).map(Number).filter(n=>!Number.isNaN(n)).sort((a,b)=>b-a).map(n=>{const row=lv[n]!=null?lv[n]:lv[String(n)];return {points:String(n),applied:typeof row.a1==='number'?row.a1:null,drew:typeof row.s1==='number'?row.s1:null,how:'Random draw'}}).filter(r=>r.applied!=null||r.drew!=null);
  return RWTags.show({paid:true,year:2025,rows,sentence:'Nevada squares bonus points and then draws at random.'});
}
async function showDetail(k,sc){
  if(!paid()&&!isSample(k)){showList(sc);return}
  const h=NH[k];if(!h)return;const v=bandAt(h);const o=$('detail');$('out').hidden=true;o.hidden=false;if(LM){LM.remove();LM=null}if(DM){DM.remove();DM=null}
  let ids=[];try{await ensureMap();ids=unitIds(h.units)}catch(e){ids=[]}
  const where=ids.length?`<h3>Where this hunt is</h3><p class="dq">${esc(whereCopy(h,ids))}</p><div id="dmap" class="gmap dm" data-units="${esc(ids.join(','))}" aria-label="Map of this hunt unit"></div>${mapCred()}`:`<h3>Where this hunt is</h3><p class="dq">${esc(whereCopy(h,ids))}</p>`;
  const word=v===null?'No 1st-choice row at this point level':verdictLine(v);
  const src=NV_META.src[h.src];
  const bk=S.tab==='map'?'← Back to the map':'← Back to the list';
  o.innerHTML=`<button class="btn big2" id="back">${bk}</button><h2>${title(h)}</h2><p class="dq">${esc(whoLine())}</p><div class="fv"><i class="vdot" style="background:${COL[v]||'#E8E0D2'}"></i>${word}</div>${oddsHTML(h)}${RWHy(k,null,S.pts)}${window.RWTrophy?RWTrophy.block(k):''}<p class="how">This is the 2025 main-draw result for people who put this hunt first and had this many bonus points. It is not a forecast. Nevada squares the bonus points and adds one for the application, then assigns that many random numbers. The lowest number is the one that competes. More points mean more numbers. They do not hold a place in line. A party is averaged before that step, and the 2025 table does not say which rows were parties. Second through fifth choice are not banded.</p>`+nvTags(h)+RWQuota.html('nv',k,FP)+nvExtra(h,v)+
    (v===null?'':ladder(h))+where+fpBox()+
    `<p class="note">Season dates are the dates printed on the 2025 table: ${esc(h.season)}. They are not a 2026 or 2027 season. Source: <a href="${esc(src)}">NDOW 2025 bonus-point table</a>.</p>`;
  $('back').onclick=()=>showList(1);
  if($('dmap'))drawDetailMap(v);
  if(sc)o.scrollIntoView({behavior:'smooth'});
}
function seg(html,attr,cur,fn){
  const box=$(html);box.innerHTML=fn.map(x=>`<button data-${attr}="${x[0]}" class="${cur===x[0]?'on':''}">${x[1]}</button>`).join('');
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>{S[attr]=b.dataset[attr];if(attr==='sx'||attr==='live'||attr==='who')S.pts=0;paint()});
}
const MC={all:'#263E2C',most:'#6F7F4F',some:'#C4B28C',few:'#D2501F',long:'#D2501F',none:'#E8E0D2',line:'#1E1E1C',sel:'#E8E0D2'};
let LM=null,DM=null,GJ=null;
const loadJS=src=>new Promise((ok,no)=>{const e=document.createElement('script');e.src=src;e.onload=ok;e.onerror=no;document.head.appendChild(e)});
function mapTabs(){return `<div class="tabs" role="tablist"><button type="button" class="tb${S.tab==='list'?' on':''}" data-tab="list">List</button><button type="button" class="tb${S.tab==='map'?' on':''}" data-tab="map">Map</button></div>`}
function mapCred(){return `<p class="mapcred"><b>Hunt unit boundaries: Nevada Department of Wildlife.</b> Lines are simplified. These are the active NDOW hunt units with a three-digit name. <a href="https://www.arcgis.com/home/item.html?id=63f5d9da297f4422a646cd8bdf8cd9a5">NDOW hunt units</a>. Parks, refuges and ranges in that layer are not hunt units and are left off. A hunt that names only part of a unit is not given that whole unit's shape. The written boundary in the regulations is the one that counts.</p>`}
function mapKey(){
  const items=[['all','All drew',MC.all],['most','Most drew',MC.most],['some','Some drew',MC.some],['few','Few drew',MC.few],['long','Long shot',MC.long],['none','Nobody drew',MC.none]];
  return `<div class="mkey" id="mkey" role="group" aria-label="Map key"><p class="mkh">Map key: the color is the best 2025 result among hunts that include that unit</p><ul>`+items.map(([b,w,c])=>`<li data-b="${b}"><i class="sw" style="background:${c}" aria-hidden="true"></i><span class="mkt"><b>${w}</b><span class="mkn"></span></span></li>`).join('')+'</ul></div>';
}
function fillKey(cnt){document.querySelectorAll('#mkey li[data-b]').forEach(li=>{const n=cnt[li.dataset.b]||0,s=li.querySelector('.mkn');li.classList.toggle('zero',!n);s.textContent=n?` · ${n} unit${n===1?'':'s'}`:' · none'})}
const bucket=v=>v>=1?'all':v>=0.75?'most':v>=0.25?'some':v>=0.05?'few':v>0?'long':'none';
async function ensureMap(){
  if(!window.L){const c=document.createElement('link');c.rel='stylesheet';c.href='../find/vendor/leaflet.css';document.head.appendChild(c);await loadJS('../find/vendor/leaflet.js')}
  if(!window.topojson)await loadJS('../find/vendor/topojson-client.min.js');
  if(!GJ){const t=await(await fetch('units.json')).json();GJ=topojson.feature(t,t.objects.area);GJ.features.sort((a,b)=>(b.properties.a||0)-(a.properties.a||0))}
}
function unitIds(text){
  if(!window.RWLand||!GJ)return [];
  const key=RWLand.nvKey(text);if(!key)return [];
  const have=new Set(GJ.features.map(f=>String(f.properties.u)));
  const ids=key.split('+');
  if(ids.some(id=>!have.has(id)))return [];
  return ids;
}
function whereCopy(h,ids){
  if(!ids.length)return 'This hunt names part of a unit, or a place this layer does not draw as its own polygon, so it is not highlighted.';
  const place=nvPlace(h.units);
  if(ids.length===1)return place+', highlighted on the hunt unit map.';
  return place+'. A hunt named for more than one unit is drawn for the whole group. The color is that result.';
}
function byUnit(rows){
  const m={};
  rows.forEach(x=>{unitIds(x.h.units).forEach(u=>{const cur=m[u];if(!cur||x.v>cur.v)m[u]=x})});
  return m;
}
async function drawMap(rows){
  const el=$('map');if(!el)return;
  try{await ensureMap()}catch(e){el.innerHTML='<p class="dq">The map could not load. Use the List tab.</p>';return}
  if(!el.isConnected)return;if(LM){LM.remove();LM=null}
  LM=L.map(el,{zoomSnap:.25,minZoom:5,maxZoom:11,scrollWheelZoom:false,tap:true});
  LM.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>').addAttribution('Hunt units: Nevada Department of Wildlife');
  const bu=byUnit(rows),cnt={};
  const ly=L.geoJSON(GJ,{style:f=>{const u=String(f.properties.u),h=bu[u];return RWMap.fillStyle({hunt:h,fill:h?(COL[h.v]||MC.few):null,none:MC.none,line:MC.sel,odds:h?h.v:null})},
    onEachFeature:(f,l)=>{const u=String(f.properties.u),h=bu[u];if(!h){l.options.interactive=false;return}l.bindTooltip('Unit '+u,{sticky:true,direction:'top'});l.on('click',()=>{S.unit=u;if(unitCtl)unitCtl.set(u);S.tab='list';showList(1)})}}).addTo(LM);
  const seen=new Set();GJ.features.forEach(f=>{const u=String(f.properties.u);if(seen.has(u))return;seen.add(u);const h=bu[u];const b=h?bucket(h.v):'none';cnt[b]=(cnt[b]||0)+1});
  fillKey(cnt);LM.fitBounds(ly.getBounds(),{padding:[4,4]});
}
async function drawDetailMap(v){
  const el=$('dmap');if(!el)return;
  try{await ensureMap()}catch(e){return}
  if(!el.isConnected)return;if(DM){DM.remove();DM=null}
  const ids=new Set(String(el.dataset.units||'').split(',').filter(Boolean));
  const fill=COL[v]||MC.few;
  DM=L.map(el,{zoomSnap:.25,minZoom:5,maxZoom:11,scrollWheelZoom:false,dragging:true,tap:false});
  DM.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>').addAttribution('Hunt units: Nevada Department of Wildlife');
  const on=[];
  L.geoJSON(GJ,{interactive:false,style:f=>RWMap.detailStyle(ids.has(String(f.properties.u)),fill,MC.sel),
    onEachFeature:(f,l)=>{if(ids.has(String(f.properties.u)))on.push(l)}}).addTo(DM);
  on.forEach(l=>l.bindTooltip(String(l.feature.properties.u),{permanent:true,direction:'center',className:'ulab'}));
  if(on.length)DM.fitBounds(L.featureGroup(on).getBounds(),{padding:[18,18],maxZoom:9});
}
function paint(){
  document.querySelectorAll('[data-sp]').forEach(b=>b.classList.toggle('on',b.dataset.sp===S.sp));
  const sxOrder=Object.keys(SX[S.sp]);
  if(!sxOrder.includes(S.sx))S.sx=sxOrder[0];
  seg('sxseg','sx',S.sx,sxOrder.map(x=>[x,SX[S.sp][x]]));
  $('sxnote').textContent=S.sp==='elk'?'Antlered, antlerless and spike are separate bonus-point categories.':S.sp==='antelope'?'Horns longer than ears and horns shorter than ears are separate bonus-point categories.':S.sp==='dsheep'?'Any ram and any ewe are separate bonus-point categories.':'This is the category NDOW used on the 2025 table.';
  const liveOk=[['res','Nevada'],['nr','Out of state']];
  seg('liveseg','live',S.live,liveOk);
  const programs=[['main','Main draw']];
  if(S.live==='res'&&((S.sp==='deer'&&S.sx==='M')||(S.sp==='antelope'&&S.sx==='F')))programs.push(['junior','Junior hunt']);
  if(S.live==='nr'&&S.sp==='deer'&&S.sx==='M')programs.push(['guided','Guided nonresident']);
  if(!programs.some(p=>p[0]===S.who))S.who='main';
  $('progbox').hidden=programs.length<2;
  seg('progseg','who',S.who,programs);
  const wpns=weaponChoices();
  if(S.wpn&&!wpns.includes(S.wpn))S.wpn=wpns[0]||'alw';
  $('wpnbox').hidden=wpns.length<2;
  seg('wpnseg','wpn',S.wpn,[['', 'Any']].concat(wpns.map(w=>[w,WPN[w]||w])));
  const mx=maxPts();S.pts=Math.max(0,Math.min(S.pts,mx));$('pv').textContent=S.pts;
  $('ptnote').textContent=mx?`The stepper stops at ${mx}, the highest level in the 2025 tables for this category. A higher total is not treated as a draw.`:'This category has no 2025 table for these choices.';
  $('empty').hidden=rows().length>0;
  $('empty').textContent=rows().length?'':`The 2025 bonus-point page has no ${liveWord().toLowerCase()} table for this category. That is not a finding that the hunt was closed.`;
 if(unitCtl){unitCtl.refresh();const el=$('unitq');if(el&&el.value!==S.unit)unitCtl.set(S.unit)}
}
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;S.who='main';S.pts=0;paint()});
$('pm').onclick=()=>{S.pts=Math.max(0,S.pts-1);paint()};
$('pp').onclick=()=>{S.pts=Math.min(maxPts(),S.pts+1);paint()};
$('go').onclick=()=>{S.n=25;if(!rows().length){$('out').hidden=true;$('detail').hidden=true;$('empty').hidden=false;$('empty').scrollIntoView({behavior:'smooth'});return}showList(1)};
unitCtl=RWUnit.bind({input:$('unitq'),clear:$('unitclr'),list:$('unitlist'),submit:()=>$('go').click(),onChange:v=>{S.unit=v},getUnits(){const s=[];const seen=new Set();for(const [,h] of H){if(h.sp!==S.sp)continue;const x=String(h.units);if(seen.has(x))continue;seen.add(x);s.push(x)}return s}});
if(Q.get('sp')&&SP[Q.get('sp')])S.sp=Q.get('sp');
if(Q.get('unit'))S.unit=Q.get('unit');
if(Q.get('sx'))S.sx=Q.get('sx');
if(Q.get('live')==='nr'||Q.get('live')==='res')S.live=Q.get('live');
if(Q.get('who'))S.who=Q.get('who');
if(Q.get('wpn')==='all')S.wpn='';
else if(Q.get('wpn'))S.wpn=Q.get('wpn');
if(Q.get('pts'))S.pts=+Q.get('pts')||0;
if(Q.get('ord')==='hard'||Q.get('ord')==='easy')S.ord=Q.get('ord');
if(Q.get('tab')==='map')S.tab='map';
paint();
if(Q.get('go'))showList();
if(Q.get('k')&&NH[Q.get('k')]){const h=NH[Q.get('k')];S.sp=h.sp;S.sx=h.sx;S.live=h.live;S.who=h.who;S.wpn=h.wpn;if(Q.get('pts'))S.pts=+Q.get('pts')||0;paint();showDetail(Q.get('k'))}
window.RWFindRefresh=function(){const det=$('detail'),out=$('out');if(det&&!det.hidden)return;if(out&&!out.hidden)showList()};
window.__NV={S, FP};
window.__DRAW={pointsMatter:()=>true,contexts(){const out=[];const seen=new Set();for(const [,h] of H){const id=[h.sp,h.sx,h.live,h.who,h.wpn].join(' ');if(seen.has(id))continue;seen.add(id);out.push({id,apply(){Object.assign(S,{sp:h.sp,sx:h.sx,live:h.live,who:h.who,wpn:h.wpn,unit:'',focus:'',ord:''})}})}return out},maxFor(){return maxPts()},setPts(p){S.pts=p},list(){return ranked()},ordered(dir){const prev=S.ord;S.ord=dir;try{return rowsInOrder(ranked())}finally{S.ord=prev}},measure:rowMeasure,tie};
})();
