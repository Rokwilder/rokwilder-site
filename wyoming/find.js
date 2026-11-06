// Find Your Hunt: Wyoming. Same look and verdict cutoffs as the Colorado, Utah and Arizona tools.
// Odds come from WGFD's own 2026 drawing odds / demand reports (1st choice) and Wyoming's draw rules (WGFD Chapter 44):
//  - preference point pool: WGFD prints the 1st-choice success odds at each point level; used as printed.
//  - random pool: WGFD prints the random quota and 1st-choice applicants (everyone not drawn in the point pool is in it),
//    so random odds = random quota / 1st-choice applicants, capped at 100% (our estimate).
//  - a point holder's chance = point-pool odds + (1 - point-pool odds) x random odds.
//  - resident elk, deer and pronghorn, all cow/calf and doe/fawn, mountain goat and bison: random only, no points.
// Free shows the verdict word. Exact numbers (odds, odds by points, quotas, applicants) are Full Pass only and are not in the
// public data file (band values only). Built by /workspace/hunt/wyoming/tools/build_wy.py.
(function(){
const FP=window.RW_FP===true;
const FPN='<span class="fpn">Exact odds: Full Pass</span>';
const fpBox=()=>FP?'':`<aside class="fpbox" aria-label="What the Full Pass adds"><p class="fpt">What the Full Pass adds</p><ul><li>Exact draw odds at every point level</li><li>About how many points you need to be sure to draw</li><li>Past draw results: Colorado back to 2021; Utah 2026 by point level plus 2025 totals; Arizona 2026; Wyoming 2026</li><li>For Colorado, Utah, Arizona and Wyoming</li></ul><p class="fpp">Full Pass: $29.99 a year. Founding Hunter: $19.99 a year for the first 200 members, locked as long as you keep renewing. Not on sale yet. <a href="../pricing.html">See pricing</a></p></aside>`;
const fpLine=()=>FP?'':`<p class="fpl">Exact odds and past draws for every hunt come with the Full Pass (not on sale yet). <a href="../pricing.html">See pricing</a></p>`;
const $=id=>document.getElementById(id);const Q=new URLSearchParams(location.search);
const M=WY_META;
let S={sp:'elk',res:'res',dr:'nr',pts:0,sx:'',red:1,gen:1,n:25};
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
function od(k){const h=WH[k],b=h.od[pool()]||(pool()=='nrs'&&h.cls=='reduced'?h.od.nr:null);if(!b)return null;return b.o[Math.min(S.pts,b.o.length-1)]}
const isGen=h=>h.type==''||/GENERAL/.test(h.desc);
function ok(k){const h=WH[k];if(h.sp!=S.sp)return false;if(S.sx&&h.sx!=S.sx)return false;if(!S.red&&h.cls=='reduced')return false;if(!S.gen&&isGen(h))return false;return true}
function ranked(){return WK.filter(k=>{if(!ok(k))return false;const v=od(k);return v!=null&&v>=.05}).map(k=>({k,v:od(k)}))
 .sort((a,b)=>b.v-a.v||a.k.localeCompare(b.k,undefined,{numeric:true}))}
const below=()=>WK.filter(k=>ok(k)&&od(k)!=null&&od(k)<.05).length;
// Plain name for WGFD's (sometimes cut-off) hunt description
const TN={1:'Type 1',2:'Type 2',3:'Type 3',4:'Type 4',5:'Type 5',6:'Type 6',7:'Type 7',8:'Type 8',9:'Type 9',0:'Type 0'};
const cap=s=>s.toLowerCase().replace(/(^|[\s,;(])([a-z])/g,(m,a,b)=>a+b.toUpperCase()).replace(/[;,]\s*$/,'');
function title(k){const h=WH[k];const a=isGen(h)?(h.area=='GEN'?'Nonresident general license':`Nonresident general license, Region ${h.area}`):`Hunt area ${h.area} · ${TN[h.type]||'Type '+h.type}`;
 return `${h.cls=='reduced'?'<b class="sx">Reduced price</b> · ':''}${esc(a)} · ${esc(cap(h.desc))}`}
const ptsWord=()=>usesPts()?`${S.pts} point${S.pts==1?'':'s'}`:'no points used';
const who=()=>`${SP[S.sp]} · ${S.res=='res'?'Wyoming resident':'Out of state'+(HAS_SPECIAL.has(S.sp)?(S.dr=='nrs'?' · special draw':' · regular draw'):'')} · ${ptsWord()}${S.sx?' · '+SXN[S.sx].toLowerCase():''}`;
function oddsHTML(v){if(!FP)return `<div class="fo lk">${FPN}</div>`;return `<div class="fo"><b>${pct(v)}</b> <span>draw odds with ${ptsWord()} (from the 2026 draw, 1st choice)</span></div>`}
const SRCN={pp_nr:'Nonresident preference point',rand_nr:'Nonresident random',pp_nrs:'Nonresident special preference point',rand_nrs:'Nonresident special random',res:'Resident',cc_res:'Resident reduced price',cc_nr:'Nonresident reduced price',pp_res:'Resident preference point',rand_res:'Resident random',f_res:'Resident female/calf',f_nr:'Nonresident female/calf'};
const rep=n=>n&&M.src[S.sp]&&M.src[S.sp][n]?`<a href="${M.src[S.sp][n].url}">WGFD 2026 ${SRCN[n]||n} report</a>`:'';
function how(h,b){const p=pool();const pp=b&&b.pts;
 if(pp)return `${S.res=='res'?'Residents':'Nonresidents'} who apply with more points draw first in the preference point pool (about 75% of the licenses). If you don't draw there, you go into the random pool (about 25%), where points don't matter. Your verdict counts both.`;
 if(S.res=='res'&&!PTSP.has(S.sp)&&!['goat','bison'].includes(S.sp))return 'Wyoming residents draw elk, deer and pronghorn licenses at random. Points are not used.';
 if(h.cls=='reduced')return 'Reduced-price cow/calf and doe/fawn licenses are drawn at random for residents and nonresidents. Points are not used.';
 return 'This draw is random. Points are not used.'}
function card(x,i){const h=WH[x.k];return `<li><button class="fh" data-k="${x.k}"><span class="rk">${i+1}</span><span class="fv">${vdot(x.v)}${VERD(x.v)}</span><span class="ft">${title(x.k)}</span><span class="fd">WGFD 2026 draw · 1st choice</span>${oddsHTML(x.v)}</button></li>`}
function showList(sc){const o=$('out');$('detail').hidden=true;o.hidden=false;const r=ranked(),nb=below();
 const note=`<p class="note">Verdicts come from WGFD's 2026 drawing odds reports (1st choice only) and Wyoming's draw rules; how we figure them is under each hunt. Hunts under 5% aren't shown${nb?` (${nb} more hunt${nb==1?'':'s'} under 5% with these choices)`:''}. Not a guarantee. Always check the WGFD regulations before you apply.</p>`;
 o.innerHTML=`<h2 id="lt">${r.length} hunt${r.length==1?'':'s'} you can draw</h2><p class="dq">${who()}. Best odds first. Tap a hunt for details.</p>`+fpBox()+
  `<ol class="fl">`+r.slice(0,S.n).map(card).join('')+`</ol>`+(r.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(25,r.length-S.n)} more (${r.length-S.n} left)</button>`:'')+
  (r.length?'':'<p class="dq">No hunts at 5% or better with these choices. Try another hunt type, or check back as you build points.</p>')+note+fpLine();
 o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>showDetail(b.dataset.k,1));if($('more'))$('more').onclick=()=>{S.n+=25;showList()};
 if(sc)o.scrollIntoView({behavior:'smooth'})}
function ladder(b){const mx=Math.min(b.o.length-1,Math.max(S.pts+3,b.o.findIndex(z=>z>=.995)+1||b.o.length-1));
 return `<p class="lh">Odds by points (2026 draw, 1st choice)</p><table class="dt"><tr><th>Points</th><th>Odds</th></tr>`+[...Array(mx+1).keys()].map(n=>`<tr class="${n==S.pts?'on':''}"><td>${n}</td><td>${pct(b.o[n])}</td></tr>`).join('')+'</table>'}
function numbers(h){const raw=h.raw&&h.raw[pool()];if(!raw)return '';let t='';
 if(raw.pp){t+=`<p class="lh">Preference point pool: ${raw.pp.quota} licenses</p><table class="dt"><tr><th>Points</th><th>Applicants</th><th>Odds</th></tr>`+raw.pp.lv.map(l=>`<tr><td>${l.le?'≤ ':l.lt?'< ':''}${l.pts}</td><td>${l.apps}</td><td>${pct(l.odds)}</td></tr>`).join('')+`</table><p class="dq">"&lt; N" rows are party applications whose averaged points fall between whole numbers, as WGFD prints them. Source: ${rep(raw.ppsrc)}.</p>`}
 if(raw.rand){t+=`<p class="lh">${raw.pp?'Random pool':'Random draw'}: ${raw.rand.quota} licenses, ${raw.rand.first.toLocaleString()} 1st-choice applicants</p><p class="dq">Random odds about ${pct(raw.R)} (licenses ÷ 1st-choice applicants). Source: ${rep(raw.rsrc)}.</p>`}
 return t}
function showDetail(k,sc){const h=WH[k],v=od(k),o=$('detail'),b=h.od[pool()]||h.od.nr;$('out').hidden=true;o.hidden=false;
 o.innerHTML=`<button class="btn o" id="back">← Back to the list</button><h2>${title(k)}</h2><p class="dq">${who()}</p>`+
 `<div class="fv">${vdot(v)}${VERD(v)}</div>`+(FP?`<p class="fo"><b>${pct(v)}</b> <span>with ${ptsWord()}</span></p>`:'')+
 `<p class="how">${how(h,b)}</p>`+(FP?(b&&b.pts?ladder(b):'')+numbers(h):fpBox())+
 (S.res=='nr'?`<p class="note"><b>Nonresidents:</b> if any part of this hunt area is designated wilderness, Wyoming law requires a licensed professional guide or a resident guide to hunt big game there (W.S. 23-2-401). Check the WGFD hunt area map before you apply.</p>`:'')+
 `<p class="note">WGFD's printed description: "${esc(h.desc)}". Their reports cut long descriptions short; season dates, weapons and limitations are in the WGFD regulations for this hunt area. Sources: ${[...new Set(Object.values(h.raw||{}).flatMap(r=>[r.ppsrc,r.rsrc]).filter(Boolean))].map(rep).join(' · ')||`<a href="${M.page}">WGFD 2026 draw results and odds</a>`}.</p>`;
 $('back').onclick=()=>showList(1);if(sc)o.scrollIntoView({behavior:'smooth'})}
// ----- form -----
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
 const np=$('nopts');np.hidden=up;np.textContent=['goat','bison'].includes(S.sp)?`${SP[S.sp]} is a random draw in Wyoming for everyone. No preference points.`:"Wyoming residents don't use preference points for elk, deer or pronghorn. The resident draw is random.";
 $('plbl').textContent=`${HAS_SPECIAL.has(S.sp)&&S.res=='nr'?'5':'4'}. How many ${SP[S.sp].toLowerCase()} preference points do you have?`}
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;paint()});
document.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{S.res=b.dataset.res;paint()});
document.querySelectorAll('[data-dr]').forEach(b=>b.onclick=()=>{S.dr=b.dataset.dr;paint()});
$('pm').onclick=()=>{S.pts=Math.max(0,S.pts-1);paint()};$('pp').onclick=()=>{S.pts=Math.min(MAXP(),S.pts+1);paint()};
$('redp').onchange=e=>S.red=e.target.checked?1:0;$('genl').onchange=e=>S.gen=e.target.checked?1:0;
$('go').onclick=()=>{S.n=25;showList(1)};
if(Q.get('sp')&&SP[Q.get('sp')])S.sp=Q.get('sp');if(Q.get('res')=='nr')S.res='nr';if(Q.get('dr')=='nrs')S.dr='nrs';if(Q.get('pts'))S.pts=+Q.get('pts')||0;if(Q.get('sx'))S.sx=Q.get('sx');
paint();if(Q.get('go'))showList();if(Q.get('k')&&WH[Q.get('k')]){showDetail(Q.get('k'))}
})();
