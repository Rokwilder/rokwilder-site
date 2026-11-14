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
const fpBox=()=>(FP||paid())?'':`<aside class="fpbox" aria-label="What the Full Pass adds"><p class="fpt">What the Full Pass adds on top of this list</p><ul><li>Exact draw odds, where we have published them, for every state on the site</li><li>A multi-year look where we have the years</li></ul><p class="fpp">This Nevada page is a 2025 result band, not an exact percentage. Exact percentages are not in the public file. Full Pass: $29.99 a year. Founding Hunter: $19.99 a year for the first 200 members, locked as long as you keep renewing. Not on sale yet. <a href="../pricing.html">See pricing</a></p></aside>`;
const fpLine=()=>(FP||paid())?'':`<p class="fpl">Exact Nevada odds are not on this free file. They come with the Full Pass where we have published them (not on sale yet). <a href="../pricing.html">See pricing</a></p>`;
const SAMPLE_UNITS=new Set(['231','075']);
const isSample=k=>{const u=NH[k]&&NH[k].units;return SAMPLE_UNITS.has(u)};
const bandWord=v=>WORD[v]||(v===0?'NONE DREW':v>0?'UNDER ONE IN TWENTY':'');
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
let S={sp:'elk',sx:'M',live:'res',who:'main',wpn:'alw',pts:0,n:25,focus:''};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const rows=()=>H.filter(([,h])=>h.sp===S.sp&&h.sx===S.sx&&h.live===S.live&&h.who===S.who);
const weaponRows=()=>rows().filter(([,h])=>h.wpn===S.wpn);
function bandAt(h){return Object.prototype.hasOwnProperty.call(h.bp,S.pts)?h.bp[S.pts]:null}
function ranked(){return weaponRows().filter(([,h])=>{const v=bandAt(h);return v!==null&&v>=0.05}).map(([k,h])=>({k,h,v:bandAt(h)})).sort((a,b)=>b.v-a.v||a.h.units.localeCompare(b.h.units,undefined,{numeric:true})||a.h.season.localeCompare(b.h.season))}
const below=()=>weaponRows().filter(([,h])=>{const v=bandAt(h);return v!==null&&v<0.05}).length;
const missing=()=>weaponRows().filter(([,h])=>bandAt(h)===null).length;
const maxPts=()=>{let m=0;for(const [,h] of rows())for(const p of Object.keys(h.bp))m=Math.max(m,Number(p));return m};
const whoWord=()=>S.who==='junior'?'Junior hunt':S.who==='guided'?'Guided nonresident':'Main draw';
const liveWord=()=>S.live==='res'?'Nevada resident':'Out of state';
const sxWord=()=>(SX[S.sp]&&SX[S.sp][S.sx])||'';
const whoLine=()=>`${SP[S.sp]} · ${sxWord()} · ${WPN[S.wpn]||S.wpn} · ${liveWord()} · ${whoWord()} · ${S.pts} bonus point${S.pts===1?'':'s'}`;
function title(h){return `${esc(h.units)} · ${esc(h.wlab)}`}
function nvPlace(text){const key=RWLand.nvKey(text);if(!key)return String(text);const nums=key.split('+').map(n=>+n);
 if(nums.length===1)return 'Unit '+nums[0];const run=nums.every((n,i)=>i===0||n===nums[i-1]+1);if(run)return 'Units '+nums[0]+'–'+nums[nums.length-1];return RWLand.human(nums.map(String),'Unit','Units')}
function nvBand(h){return RWLand.band('nv',RWLand.nvKey(h.units))}
function nvExtra(h,v){if(!paid())return '';const b=nvBand(h),place=nvPlace(h.units);return RWLand.extra({band:b,land:b,voice:'history',odds:RWLand.oddsKind(v),place,href:RWLand.pkgHref('../','nv',place)})}
function focusBar(){return `<div class="sbar"><span class="lbl">What matters most to you?</span><div class="seg"><button type="button" data-focus="" class="${S.focus?'':'on'}">Draw result</button><button type="button" data-focus="land" class="${S.focus=='land'?'on':''}">Public land</button></div></div>`}
function card(x,i){return `<li><button class="fh" data-k="${esc(x.k)}"><span class="rk">${i+1}</span><span class="fv"><i class="vdot" style="background:${COL[x.v]||'#E8E0D2'}"></i>${bandWord(x.v)}</span><span class="ft">${title(x.h)}</span><span class="fd">${esc(x.h.season)}</span><span class="fd">2025 main draw · 1st choice · historical result</span>${oddsHTML(x.h)}${RWHy(x.k,null,S.pts)}</button></li>`}
function cardFull(x,i){const bits=RWLand.splitNext(nvExtra(x.h,x.v));return `<li><button class="fh" data-k="${esc(x.k)}"><span class="rk">${i+1}</span><span class="fv"><i class="vdot" style="background:${COL[x.v]||'#E8E0D2'}"></i>${bandWord(x.v)}</span><span class="ft">${title(x.h)}</span><span class="fd">${esc(x.h.season)}</span><span class="fd">2025 main draw · 1st choice · historical result</span>${oddsHTML(x.h)}${RWHy(x.k,null,S.pts)}${bits.info}</button>${bits.next}</li>`}
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
  return `<p class="lh">2025 1st-choice result by bonus-point level</p><table class="dt"><tr><th>Bonus points</th><th>Result</th></tr>`+pts.map(n=>{const v=h.bp[n];const word=WORD[v]||(v===0?'None drew':'Under one in twenty');return `<tr class="${n===S.pts?'on':''}"><td>${n}</td><td>${word}</td></tr>`}).join('')+'</table><p class="dq">Words only. A level is listed when that table had a 1st-choice row. A blank level is not a zero, and a higher level is not filled in from a lower one.</p>';
}
function showList(sc){
  const o=$('out');$('detail').hidden=true;o.hidden=false;$('empty').hidden=true;
  const all=ranked(),nb=below(),nm=missing();
  const note=`<p class="note">Bands are the 2025 main-draw result for 1st choice at this bonus-point level. They are not a chance in a future draw. Under one in twenty, and rows where none drew, stay off the list${nb?` (${nb} hunt${nb===1?'':'s'} in that group)`:''}. ${nm?`${nm} hunt${nm===1?' has':'s have'} no 1st-choice row at ${S.pts} point${S.pts===1?'':'s'}.`:''} Not a guarantee. Check the current NDOW regulation before you apply.</p>`+(paid()?`<p class="note">${RWLand.pageNote('nv')}</p>`:'');
  if(!paid()){const samples=RWGate.takePerUnit(sampleRows(),x=>x.h.units);
    o.innerHTML=RWGate.freeShell({count:all.length,species:(SP[S.sp]||S.sp).toLowerCase(),who:esc(whoLine())+'.',pricing:'../pricing.html',sampleNote:'<b>Sample.</b> Units 231 and 075 only, up to 3 hunts from each. These are the default elk filters: antlered, resident, any legal weapon, main draw, 0 bonus points. This is not your whole list.',samplesHtml:samples.length?`<ol class="fl">`+samples.map(card).join('')+'</ol>':''});
    o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));if(sc)o.scrollIntoView({behavior:'smooth'});return}
  const r=(S.focus=='land'?all.slice().sort((a,b)=>RWLand.rank(nvBand(b.h))-RWLand.rank(nvBand(a.h))||b.v-a.v||a.h.units.localeCompare(b.h.units,undefined,{numeric:true})):all);
  const ban=window.RWGate?RWGate.banner():'';
  o.innerHTML=ban+`<h2 id="lt">${r.length} hunt${r.length===1?'':'s'} at this point level</h2>${focusBar()}<p class="dq">${esc(whoLine())}. ${S.focus=='land'?'Mostly public land first.':'Strongest 2025 result first.'} Tap a hunt for the other point levels.</p>`+fpBox()+
    `<ol class="fl">`+r.slice(0,S.n).map(cardFull).join('')+`</ol>`+(r.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(25,r.length-S.n)} more (${r.length-S.n} left)</button>`:'')+
    (r.length?'':`<p class="dq">No 2025 1st-choice row at this point level reached one in twenty. Try another weapon, another point level, or the other residency.</p>`)+note+fpLine();
  o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));
  o.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>{S.focus=b.dataset.focus;S.n=25;showList()});
  if($('more'))$('more').onclick=()=>{S.n+=25;showList()};
  if(sc)o.scrollIntoView({behavior:'smooth'});
}
function showDetail(k,sc){
  if(!paid()&&!isSample(k)){showList(sc);return}
  const h=NH[k];if(!h)return;const v=bandAt(h);const o=$('detail');$('out').hidden=true;o.hidden=false;
  const word=v===null?'No 1st-choice row at this point level':(WORD[v]||(v===0?'NONE DREW':'UNDER ONE IN TWENTY'));
  const src=NV_META.src[h.src];
  o.innerHTML=`<button class="btn o" id="back">← Back to the list</button><h2>${title(h)}</h2><p class="dq">${esc(whoLine())}</p><div class="fv"><i class="vdot" style="background:${COL[v]||'#E8E0D2'}"></i>${word}</div>${oddsHTML(h)}${RWHy(k,null,S.pts)}<p class="how">This is the 2025 main-draw result for people who put this hunt first and had this many bonus points. It is not a forecast. Nevada squares the bonus points and adds one for the application, then assigns that many random numbers. The lowest number is the one that competes. More points mean more numbers. They do not hold a place in line. A party is averaged before that step, and the 2025 table does not say which rows were parties. Second through fifth choice are not banded.</p>`+nvExtra(h,v)+
    (v===null?'':ladder(h))+fpBox()+
    `<p class="note">Season dates are the dates printed on the 2025 table: ${esc(h.season)}. They are not a 2026 or 2027 season. Source: <a href="${esc(src)}">NDOW 2025 bonus-point table</a>.</p>`;
  $('back').onclick=()=>showList(1);
  if(sc)o.scrollIntoView({behavior:'smooth'});
}
function seg(html,attr,cur,fn){
  const box=$(html);box.innerHTML=fn.map(x=>`<button data-${attr}="${x[0]}" class="${cur===x[0]?'on':''}">${x[1]}</button>`).join('');
  box.querySelectorAll('button').forEach(b=>b.onclick=()=>{S[attr]=b.dataset[attr];if(attr==='sx'||attr==='live'||attr==='who')S.pts=0;paint()});
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
  const wpns=[];
  const seen=new Set();
  for(const [,h] of rows())if(!seen.has(h.wpn)){seen.add(h.wpn);wpns.push(h.wpn)}
  const order=['alw','bow','muz','classic','shotgun','prim'];
  wpns.sort((a,b)=>order.indexOf(a)-order.indexOf(b));
  if(!wpns.includes(S.wpn))S.wpn=wpns[0]||'alw';
  $('wpnbox').hidden=wpns.length<2;
  seg('wpnseg','wpn',S.wpn,wpns.map(w=>[w,WPN[w]||w]));
  const mx=maxPts();S.pts=Math.max(0,Math.min(S.pts,mx));$('pv').textContent=S.pts;
  $('ptnote').textContent=mx?`The stepper stops at ${mx}, the highest level in the 2025 tables for this category. A higher total is not treated as a draw.`:'This category has no 2025 table for these choices.';
  $('empty').hidden=rows().length>0;
  $('empty').textContent=rows().length?'':`The 2025 bonus-point page has no ${liveWord().toLowerCase()} table for this category. That is not a finding that the hunt was closed.`;
}
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;S.who='main';S.pts=0;paint()});
$('pm').onclick=()=>{S.pts=Math.max(0,S.pts-1);paint()};
$('pp').onclick=()=>{S.pts=Math.min(maxPts(),S.pts+1);paint()};
$('go').onclick=()=>{S.n=25;if(!rows().length){$('out').hidden=true;$('detail').hidden=true;$('empty').hidden=false;$('empty').scrollIntoView({behavior:'smooth'});return}showList(1)};
if(Q.get('sp')&&SP[Q.get('sp')])S.sp=Q.get('sp');
if(Q.get('sx'))S.sx=Q.get('sx');
if(Q.get('live')==='nr'||Q.get('live')==='res')S.live=Q.get('live');
if(Q.get('who'))S.who=Q.get('who');
if(Q.get('wpn'))S.wpn=Q.get('wpn');
if(Q.get('pts'))S.pts=+Q.get('pts')||0;
paint();
if(Q.get('go'))showList();
if(Q.get('k')&&NH[Q.get('k')]){const h=NH[Q.get('k')];S.sp=h.sp;S.sx=h.sx;S.live=h.live;S.who=h.who;S.wpn=h.wpn;if(Q.get('pts'))S.pts=+Q.get('pts')||0;paint();showDetail(Q.get('k'))}
})();
