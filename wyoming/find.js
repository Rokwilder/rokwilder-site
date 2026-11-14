// Find Your Hunt: Wyoming. Same verdict words as the Colorado, Utah and Arizona tools.
// Preference-point odds are WGFD's printed 2026 1st-choice success odds.
// Random odds are an estimate: random-draw licenses / 1st-choice applicants in the matching WGFD report, capped at 100%.
// A point holder's chance is printed point-pool odds + (1 - those odds) x the random estimate.
// One point above the highest printed total is treated as a draw when that top group still had licenses left. That step is an estimate.
// Resident elk, deer and pronghorn, cow/calf, doe/fawn, mountain goat and bison are the random estimate only.
// The public file stores verdict bands only (1, .75, .25, .05, .01, 0). Exact quotas, applicant counts and unrounded odds are not in it,
// and the Full Pass does not serve Wyoming exact figures yet. window.RW_FP alone cannot turn exact numbers on unless a record has raw fields.
(function(){
const FP=window.RW_FP===true && typeof WH==='object' && Object.values(WH).some(h=>h&&h.raw);
const fpBox=()=>FP?'':`<aside class="fpbox" aria-label="What the Full Pass adds"><p class="fpt">What the Full Pass adds on top of this list</p><ul><li>Exact draw odds, where we have published them, for every state on the site</li><li>A multi-year look where we have the years</li></ul><p class="fpp">This page shows a verdict band, not an exact percentage. Exact percentages are not in the public file. Full Pass: $29.99 a year. Founding Hunter: $19.99 a year for the first 200 members, locked as long as you keep renewing. Not on sale yet. <a href="../pricing.html">See pricing</a></p></aside>`;
const fpLine=()=>FP?'':`<p class="fpl">Exact percentages are not on this free file. They come with the Full Pass where we have published them (not on sale yet). <a href="../pricing.html">See pricing</a></p>`;
const paid=()=>window.RWGate?RWGate.paid():FP;
const isSample=k=>{const a=WH[k]&&WH[k].area;return a==='100'||a==='102'};
const $=id=>document.getElementById(id);const Q=new URLSearchParams(location.search);
const M=WY_META;
let S={sp:'elk',res:'res',dr:'nr',pts:0,sx:'',unit:'',red:1,gen:1,n:25,focus:''};
let unitCtl=null;
const SP={elk:'Elk',deer:'Deer',pronghorn:'Pronghorn',moose:'Moose',sheep:'Bighorn sheep',goat:'Mountain goat',bison:'Bison'};
const PTSP=new Set(['moose','sheep']);   // residents use points too
const NRPTS=new Set(['elk','deer','pronghorn','moose','sheep']);
const HAS_SPECIAL=new Set(['elk','deer','pronghorn']);
const VERD=v=>v>=.995?"YES, you'll draw":v>=.75?'LIKELY':v>=.25?'MAYBE':v>=.05?'LONG SHOT':'NOT THIS YEAR';
const pct=v=>{const r=Math.round(v*100);return v>0&&r==0?'under 1%':v<1&&r==100?'over 99%':r+'%'};
const vcolList=[[.995,'#263E2C'],[.75,'#6F7F4F'],[.25,'#C4B28C'],[.05,'#D2501F']];
const vcol=v=>(vcolList.find(c=>v>=c[0])||[0,'#E8E0D2'])[1];const vdot=v=>`<i class="vdot" style="background:${vcol(v)}"></i>`;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const WK=Object.keys(WH);
const SXN={'':'Any',M:'Male',F:'Female',E:'Either sex'};
const SXW={elk:{M:'antlered (bull)',F:'antlerless or cow/calf',E:'any elk'},deer:{M:'antlered (buck)',F:'antlerless or doe/fawn',E:'any deer'},pronghorn:{M:'buck',F:'doe/fawn',E:'any pronghorn'},moose:{M:'antlered (bull)',F:'antlerless',E:'any moose'},sheep:{M:'ram',E:'any bighorn sheep'},goat:{E:'any mountain goat'},bison:{F:'female or calf',E:'any bison'}};
const pool=()=>S.res=='res'?'res':(HAS_SPECIAL.has(S.sp)?S.dr:'nr');
const usesPts=()=>S.res=='res'?PTSP.has(S.sp):NRPTS.has(S.sp);
const MAXP=()=>M.maxp[S.sp]||0;
function band(k){const h=WH[k];if(!h)return null;const b=h.od[pool()]||null;if(!b)return null;return b.o[Math.min(S.pts,b.o.length-1)]}
const isGen=h=>h.type==''||/GENERAL/.test(h.desc);
function ok(k){const h=WH[k];if(h.sp!=S.sp)return false;if(S.sx&&h.sx!=S.sx)return false;if(!RWUnit.hit([h.area],S.unit))return false;if(!S.red&&h.cls=='reduced')return false;if(!S.gen&&isGen(h))return false;if(pool()=='nrs'&&h.cls=='reduced')return false;return true}
function ranked(){return WK.filter(k=>{if(!ok(k))return false;const v=band(k);return v!=null&&v>=.05}).map(k=>({k,v:band(k)}))
 .sort((a,b)=>b.v-a.v||RWUnit.sortNum([WH[a.k].area])-RWUnit.sortNum([WH[b.k].area])||String(WH[a.k].type).localeCompare(String(WH[b.k].type))||a.k.localeCompare(b.k))}
const below=()=>WK.filter(k=>ok(k)&&band(k)!=null&&band(k)<.05).length;
const TN={1:'Type 1',2:'Type 2',3:'Type 3',4:'Type 4',5:'Type 5',6:'Type 6',7:'Type 7',8:'Type 8',9:'Type 9',0:'Type 0'};
const cap=s=>s.toLowerCase().replace(/(^|[\s,;(])([a-z])/g,(m,a,b)=>a+b.toUpperCase()).replace(/[;,]\s*$/,'');
function title(k){const h=WH[k];const a=isGen(h)?(h.area=='GEN'?'Nonresident general license':`Nonresident general license, Region ${h.area}`):`Hunt area ${h.area} · ${TN[h.type]||'Type '+h.type}`;
 return `${h.cls=='reduced'?'<b class="sx">Reduced price</b> · ':''}${esc(a)} · ${esc(cap(h.desc))}`}
const ptsWord=()=>usesPts()?`${S.pts} point${S.pts==1?'':'s'}`:'no points used';
const who=()=>`${SP[S.sp]} · ${S.res=='res'?'Wyoming resident':'Out of state'+(HAS_SPECIAL.has(S.sp)?(S.dr=='nrs'?' · special draw':' · regular draw'):'')} · ${ptsWord()}${S.sx?' · '+SXN[S.sx].toLowerCase():''}`;
function oddsHTML(v){if(!FP)return `<div class="fo lk"><span class="fpn">Verdict band, not an exact percentage</span></div>`;return `<div class="fo"><b>${pct(v)}</b> <span>estimated 1st-choice chance with ${ptsWord()} (2026)</span></div>`}
const SRCN={pp_nr:'Nonresident preference point',rand_nr:'Nonresident random',pp_nrs:'Nonresident special preference point',rand_nrs:'Nonresident special random',res:'Resident',cc_res:'Resident reduced price',cc_nr:'Nonresident reduced price',pp_res:'Resident preference point',rand_res:'Resident random',f_res:'Resident female/calf',f_nr:'Nonresident female/calf'};
const rep=n=>n&&M.src[S.sp]&&M.src[S.sp][n]?`<a href="${esc(M.src[S.sp][n].url)}">WGFD 2026 ${SRCN[n]||n} report</a>`:'';
function sourceNames(h){
 const p=pool();const b=h.od[p];if(!b)return [];
 if(b.pts){if(p=='res')return ['pp_res','rand_res'];if(p=='nrs')return ['pp_nrs','rand_nrs'];return ['pp_nr','rand_nr']}
 if(h.cls=='reduced')return [p=='res'?'cc_res':'cc_nr'];
 if(h.sp=='bison'&&h.sx=='F')return [p=='res'?'f_res':'f_nr'];
 if(p=='res')return ['res'];
 return ['rand_nr'];
}
function sourceHTML(h){const links=sourceNames(h).map(rep).filter(Boolean);return links.length?links.join(' · '):`<a href="${esc(M.page)}">WGFD 2026 draw results and odds</a>`}
const EST=' The random part is our estimate, not a percentage WGFD prints: licenses in the random report divided by 1st-choice applicants, capped at 100%. A party that draws can slightly oversubscribe the quota, and 2nd and 3rd choices only receive licenses the 1st choice does not fill.';
function how(h,b){const pp=b&&b.pts;
 if(pp)return `WGFD prints the 1st-choice preference-point odds at each point level. If you miss that pool, you go into the random pool, where points do not count. The verdict uses the printed point-pool odds, then adds the random estimate only for the share the point pool does not draw. One point above the highest total in the 2026 report is treated as a draw when that top group still had licenses left. That extra point is an estimate.`+EST;
 if(S.res=='res'&&!PTSP.has(S.sp)&&!['goat','bison'].includes(S.sp))return 'Wyoming residents draw elk, deer and pronghorn at random. Points are not used.'+EST;
 if(h.cls=='reduced')return 'Reduced-price cow/calf and doe/fawn licenses are drawn at random. Points are not used.'+EST;
 return 'This draw is random. Points are not used.'+EST}
function wyBand(k){const h=WH[k];return RWLand.band('wy',RWLand.wyKey(h.sp,h.area))}
function wyExtra(k,v){if(!paid())return '';const h=WH[k],b=wyBand(k),place=/^\d+$/.test(String(h.area))?`${SP[h.sp]} Hunt Area ${+h.area}`:'';
 return RWLand.extra({band:b,land:b,voice:'forecast',odds:RWLand.oddsKind(v),place,href:place?RWLand.pkgHref('../','wy',h.sp+'-'+String(+h.area)):''})}
function focusBar(){return `<div class="sbar"><span class="lbl">What matters most to you?</span><div class="seg"><button type="button" data-focus="" class="${S.focus?'':'on'}">Draw odds</button><button type="button" data-focus="land" class="${S.focus=='land'?'on':''}">Public land</button></div></div>`}
function orderRows(r){if(S.focus!='land')return r;return [...r].sort((a,b)=>RWLand.rank(wyBand(b.k))-RWLand.rank(wyBand(a.k))||b.v-a.v||a.k.localeCompare(b.k,undefined,{numeric:true}))}
function card(x,i){return `<li><button class="fh" data-k="${esc(x.k)}"><span class="rk">${i+1}</span><span class="fv">${vdot(x.v)}${VERD(x.v)}</span><span class="ft">${title(x.k)}</span><span class="fd">WGFD 2026 draw · 1st choice · estimate where noted</span>${oddsHTML(x.v)}${RWHy(x.k,pool(),usesPts()?S.pts:'')}</button></li>`}
function cardFull(x,i){const bits=RWLand.splitNext(wyExtra(x.k,x.v));return `<li><button class="fh" data-k="${esc(x.k)}"><span class="rk">${i+1}</span><span class="fv">${vdot(x.v)}${VERD(x.v)}</span><span class="ft">${title(x.k)}</span><span class="fd">WGFD 2026 draw · 1st choice · estimate where noted</span>${oddsHTML(x.v)}${RWHy(x.k,pool(),usesPts()?S.pts:'')}${bits.info}</button>${bits.next}</li>`}
function showList(sc){const o=$('out');$('detail').hidden=true;o.hidden=false;const all=ranked(),nb=below();
 const redNote=pool()=='nrs'&&S.red?'<p class="note">Reduced-price cow/calf and doe/fawn licenses are a separate random draw. They are not in the special draw, so they are left off this list. Choose Regular to see them.</p>':'';
 const note=`<p class="note">Point-pool odds are WGFD's printed 2026 1st-choice figures. Random odds, and any verdict that mixes the two, are estimates. Hunts under a 5% estimate aren't shown${nb?` (${nb} more hunt${nb==1?'':'s'} under 5% with these choices)`:''}. Not a guarantee. Check the current WGFD regulations before you apply.</p>`+(paid()?`<p class="note">${RWLand.pageNote('wy')}</p>`:'');
 if(!paid()){const samples=RWGate.takePerUnit(all.filter(x=>isSample(x.k)),x=>WH[x.k]&&WH[x.k].area);
  o.innerHTML=RWGate.freeShell({count:all.length,species:SP[S.sp].toLowerCase(),who:who()+'.',pricing:'../pricing.html',sampleNote:'<b>Sample.</b> Hunt areas 100 and 102 only, up to 3 hunts from each. This is not your whole list.',samplesHtml:samples.length?`<ol class="fl">`+samples.map(card).join('')+'</ol>':''});
  o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));if(sc)o.scrollIntoView({behavior:'smooth'});return}
 const r=orderRows(all);
 const ban=window.RWGate?RWGate.banner():'';
 o.innerHTML=ban+`<h2 id="lt">${r.length} hunt${r.length==1?'':'s'} you can draw</h2>${focusBar()}<p class="dq">${who()}. ${S.focus=='land'?'Mostly public land first.':'Best odds first.'} Tap a hunt for the method and the WGFD report.</p>`+fpBox()+redNote+
  `<ol class="fl">`+r.slice(0,S.n).map(cardFull).join('')+`</ol>`+(r.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(25,r.length-S.n)} more (${r.length-S.n} left)</button>`:'')+
  (r.length?'':'<p class="dq">No hunts at 5% or better with these choices. Try another hunt type, or check back as you build points.</p>')+note+fpLine();
 o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));if($('more'))$('more').onclick=()=>{S.n+=25;showList()};
 o.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>{S.focus=b.dataset.focus;S.n=25;showList()});
 if(sc)o.scrollIntoView({behavior:'smooth'})}
function ladder(b){const mx=Math.min(b.o.length-1,Math.max(S.pts+3,b.o.findIndex(z=>z>=.995)+1||b.o.length-1));
 return `<p class="lh">Estimated chance by points (2026, 1st choice)</p><table class="dt"><tr><th>Points</th><th>Estimate</th></tr>`+[...Array(mx+1).keys()].map(n=>`<tr class="${n==S.pts?'on':''}"><td>${n}</td><td>${pct(b.o[n])}</td></tr>`).join('')+'</table><p class="dq">Printed point-pool odds mixed with the random estimate. Not a WGFD-printed total.</p>'}
function numbers(h){const raw=h.raw&&h.raw[pool()];if(!raw)return '';let t='';
 if(raw.pp){t+=`<p class="lh">Preference point pool: ${raw.pp.quota} licenses</p><table class="dt"><tr><th>Points</th><th>Applicants</th><th>Printed odds</th></tr>`+raw.pp.lv.map(l=>`<tr><td>${l.le?'≤ ':l.lt?'< ':''}${l.pts}</td><td>${l.apps}</td><td>${pct(l.odds)}</td></tr>`).join('')+`</table><p class="dq">These point-pool odds are printed by WGFD. A "&lt; N" row is a party average between whole numbers for elk, deer and pronghorn. Moose and bighorn sheep do not allow parties, so "&lt; N" there means everyone under that point total. Source: ${rep(raw.ppsrc)}.</p>`}
 if(raw.rand){t+=`<p class="lh">${raw.pp?'Random pool':'Random draw'}: ${raw.rand.quota} licenses, ${raw.rand.first.toLocaleString()} 1st-choice applicants</p><p class="dq">Random odds are our estimate, about ${pct(raw.R)} (licenses ÷ 1st-choice applicants, capped at 100%). WGFD prints the counts, not this percentage. Source: ${rep(raw.rsrc)}.</p>`}
 return t}
function showDetail(k,sc){if(!paid()&&!isSample(k)){showList(sc);return}const h=WH[k],v=band(k),o=$('detail'),b=h.od[pool()];if(v==null||!b)return;$('out').hidden=true;o.hidden=false;
 o.innerHTML=`<button class="btn o" id="back">← Back to the list</button><h2>${title(k)}</h2><p class="dq">${who()}</p>`+
 `<div class="fv">${vdot(v)}${VERD(v)}</div>${RWHy(k,pool(),usesPts()?S.pts:'')}`+(FP?`<p class="fo"><b>${pct(v)}</b> <span>estimated 1st-choice chance with ${ptsWord()}</span></p>`:'')+RWQuota.html('wy',k,FP)+wyExtra(k,v)+
 `<p class="how">${how(h,b)}</p>`+(FP?(b.pts?ladder(b):'')+numbers(h):fpBox())+
 (S.res=='nr'?`<p class="note"><b>Nonresidents:</b> if any part of this hunt area is designated wilderness, WGFD says Wyoming law requires a licensed guide or a resident companion with the free non-commercial guide license to hunt big or trophy game there (W.S. 23-2-401). Check the hunt area map before you apply.</p>`:'')+
 `<p class="note">WGFD's printed description: "${esc(h.desc)}". Their reports cut long descriptions short; season dates, weapons and limitations are in the WGFD regulations for this hunt area. Sources: ${sourceHTML(h)}.</p>`;
 $('back').onclick=()=>showList(1);if(sc)o.scrollIntoView({behavior:'smooth'})}
function sxAvail(){const s=new Set();for(const k of WK){const h=WH[k];if(h.sp==S.sp&&h.sx)s.add(h.sx)}return['M','F','E'].filter(x=>s.has(x))}
function paint(){document.querySelectorAll('[data-sp]').forEach(b=>b.classList.toggle('on',b.dataset.sp==S.sp));
 document.querySelectorAll('[data-res]').forEach(b=>b.classList.toggle('on',b.dataset.res==S.res));
 document.querySelectorAll('[data-dr]').forEach(b=>b.classList.toggle('on',b.dataset.dr==S.dr));
 const av=sxAvail();if(S.sx&&!av.includes(S.sx))S.sx='';const w=SXW[S.sp]||{};
 $('sxseg').innerHTML=['',...av].map(x=>`<button data-sx="${x}" class="${S.sx==x?'on':''}">${SXN[x]}</button>`).join('');
 $('sxnote').textContent=av.map(x=>`${SXN[x]} = ${w[x]||SXN[x].toLowerCase()}`).join('. ')+". From the license description in WGFD's reports.";
 $('sxseg').querySelectorAll('button').forEach(b=>b.onclick=()=>{S.sx=b.dataset.sx;paint()});
 $('drawbox').hidden=!(S.res=='nr'&&HAS_SPECIAL.has(S.sp));
 const up=usesPts();$('ptsbox').hidden=!up;if(!up)S.pts=0;S.pts=Math.min(S.pts,MAXP());$('pv').textContent=S.pts;
 const np=$('nopts');np.hidden=up;np.textContent=['goat','bison'].includes(S.sp)?`${SP[S.sp]} is a random draw in Wyoming for everyone. No preference points.`:"Wyoming residents don't use preference points for elk, deer or pronghorn. The resident draw is random, and the verdict is an estimate from the quota and 1st-choice applicants.";
 $('plbl').textContent=`${HAS_SPECIAL.has(S.sp)&&S.res=='nr'?'5':'4'}. How many ${SP[S.sp].toLowerCase()} preference points do you have?`;
 if(unitCtl){unitCtl.refresh();const el=$('unitq');if(el&&el.value!==S.unit)unitCtl.set(S.unit)}}
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;paint()});
document.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{S.res=b.dataset.res;paint()});
document.querySelectorAll('[data-dr]').forEach(b=>b.onclick=()=>{S.dr=b.dataset.dr;paint()});
$('pm').onclick=()=>{S.pts=Math.max(0,S.pts-1);paint()};$('pp').onclick=()=>{S.pts=Math.min(MAXP(),S.pts+1);paint()};
$('redp').onchange=e=>S.red=e.target.checked?1:0;$('genl').onchange=e=>S.gen=e.target.checked?1:0;
$('go').onclick=()=>{S.n=25;showList(1)};
unitCtl=RWUnit.bind({input:$('unitq'),clear:$('unitclr'),list:$('unitlist'),submit:()=>$('go').click(),onChange:v=>{S.unit=v},getUnits(){const s=[];const seen=new Set();for(const k of WK){if(WH[k].sp!=S.sp)continue;const x=String(WH[k].area);if(seen.has(x))continue;seen.add(x);s.push(x)}return s}});
if(Q.get('sp')&&SP[Q.get('sp')])S.sp=Q.get('sp');if(Q.get('res')=='nr')S.res='nr';if(Q.get('dr')=='nrs')S.dr='nrs';if(Q.get('pts'))S.pts=+Q.get('pts')||0;if(Q.get('sx'))S.sx=Q.get('sx');if(Q.get('unit'))S.unit=Q.get('unit');
paint();if(Q.get('go'))showList();if(Q.get('k')&&WH[Q.get('k')])showDetail(Q.get('k'));
})();
