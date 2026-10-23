// Find Your Hunt: the one draw-odds lookup on the site.
// Free shows the verdict word; exact % is Full Pass. FP is only ever true in a local preview (localhost + ?preview=fullpass).
(function(){
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
// ===== LAUNCH SWITCH =====
// false = everyone sees exact draw-odds % (same as the live site today).
// true  = free users see only the verdict word; exact % is Full Pass (flip at Full Pass launch).
const FULLPASS_GATING=false;
// ==========================
const FP=!FULLPASS_GATING||(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&Q.get('preview')=='fullpass');
let S={sp:'elk',res:'res',pts:0,w:'',yo:0,priv:0,n:25};
// Weapon = 5th character of the hunt code (CPW brochure): A archery, M muzzleloader, R rifle and associated methods.
// X = season choice (one license good in archery, muzzleloader and rifle seasons), so it matches every weapon choice.
const WN={'':'Any weapon',A:'Archery',M:'Muzzleloader',R:'Rifle'};const wOK=k=>!S.w||S.sp=='turkey'||k.at(-1)==S.w||k.at(-1)=='X';
const SP={elk:'Elk',deer:'Deer',pronghorn:'Pronghorn',bear:'Bear',moose:'Moose',turkey:'Turkey'};
function sexL(d){const x=d[3],sp=d[0];if(sp=='bear')return'';if(sp=='turkey')return x=='bearded'?'BEARDED':x.toUpperCase();
 const big=sp=='elk'||sp=='moose';if(x=='antlered')return big?'BULL':'BUCK';if(x=='antlerless')return big?'COW':'DOE';if(x=='either-sex')return'EITHER-SEX';return x.toUpperCase()}
const yp=k=>{const y=typeof Y!='undefined'&&Y[k];return y&&y[S.res]?y[S.res]:null};
function oAt(k,p,n){const q=S.yo&&yp(k);if(!q)return[p.o[n],0];const ok=m=>(q.n[m]||0)>=10&&q.o[m]!=null;if(ok(n))return[q.o[n],1];
 let f=p.o[n];for(let m=0;m<n;m++)if(ok(m))f=Math.max(f,q.o[m]);return[f,2]}
function mooseRow(d){const M=d[8];if(!M)return null;const ys=Object.keys(M).sort(),ly=ys.at(-1),g=S.pts>=3?'3':String(S.pts),x=(M[ly][S.res]||{})[g];return x&&x[0]?{v:x[1]/x[0],a:x[0],dr:x[1],y:ly}:null}
function odds(k){const d=D[k];if(d[0]=='moose'){const r=mooseRow(d);return r?r.v:null}
 const p=d[5][S.res];if(!p)return null;const m=Math.max(...Object.keys(p.o).map(Number));return oAt(k,p,Math.min(S.pts,m))[0]}
const verdict=v=>v>=.995?"YES, you'll draw":v>=.75?'LIKELY':v>=.25?'MAYBE':v>=.05?'LONG SHOT':'NOT THIS YEAR';
const pct=v=>{const r=Math.round(v*100);return v>0&&r==0?'under 1%':r+'%'};
const priv=d=>/private/.test(d[4])&&!/public/.test(d[4]);
function landS(l){return /^all lands/.test(l)?'Public and private land':/^private/.test(l)?'Private land only':/Ranching/.test(l)?'Ranching for Wildlife (private ranch)':'Special land rules (CPW land code '+(l.match(/^(?:land code )?([A-Z])/)||[,'?'])[1]+'), see the CPW brochure'}
function lab(k){const f=typeof FL!='undefined'&&FL[k];if(f&&f[0]==1)return'New hunt, no data';if(D[k][7]==null||(f&&f[0]==2))return'No data';return''}
const hunters=k=>{const f=typeof FL!='undefined'&&FL[k];return f?f[1]:null};
function succHTML(k,cls){const d=D[k],l=lab(k);if(l)return `<div class="${cls}"><b>${l}</b> <span>for hunter success</span></div>`;
 const n=hunters(k);return `<div class="${cls}"><b>${Math.round(d[7])}%</b> <span>of hunters got one (CPW, 2025)${n!=null?` · ${n.toLocaleString()} hunters`:''}${n!=null&&n<30?' · <em class="ss">SMALL SAMPLE</em>':''}</span></div>`}
function oddsHTML(v,cls){return FP?`<div class="${cls}"><b>${pct(v)}</b> <span>draw odds with ${S.pts} point${S.pts==1?'':'s'}</span></div>`:`<div class="${cls} lk"><span>Exact draw odds: <a href="unitiq.html">Full Pass</a></span></div>`}
function ranked(){return Object.keys(D).filter(k=>{const d=D[k];if(d[0]!=S.sp)return false;if(typeof EXCL!='undefined'&&EXCL.has(k))return false;if(priv(d)&&!S.priv)return false;if(!wOK(k))return false;const v=odds(k);return v!=null&&v>=.05})
 .map(k=>({k,v:odds(k)})).sort((a,b)=>b.v-a.v||(D[b.k][7]??-1)-(D[a.k][7]??-1)||a.k.localeCompare(b.k))}
const seas=k=>k.at(-1)=='X'?'season choice (archery, muzzleloader or rifle)':D[k][2];
const units=k=>{const f=typeof FL!='undefined'&&FL[k];return f&&f[2]?f[2]:[D[k][1]]};
function uL(k,full){const u=units(k);if(u.length==1)return 'Unit '+u[0];return full||u.length<=4?'Units '+u.join(', '):`Units ${u.slice(0,3).join(', ')} +${u.length-3} more`}
function title(k,full){const d=D[k],sx=sexL(d);return `${sx?`<b class="sx">${sx}</b> · `:''}${uL(k,full)} · ${seas(k)}`}
function showList(){const r=ranked(),o=$('out');
 $('detail').hidden=true;o.hidden=false;
 const who=`${SP[S.sp]} · ${S.res=='res'?'Colorado resident':'Out of state'} · ${S.pts} point${S.pts==1?'':'s'} · ${S.sp=='turkey'?'any weapon':WN[S.w].toLowerCase()}${S.yo?' · kid 12–17':''}`;
 o.innerHTML=`<h2 id="lt">${r.length} hunt${r.length==1?'':'s'} you can draw</h2><p class="dq">${who}. Best odds first, down to long shots. Tap a hunt for details.</p>`+
  (S.sp=='elk'?`<p class="note"><b>No points needed:</b> ${S.res=='res'?'Colorado residents can buy an over-the-counter elk license for many units.':'Out-of-state hunters can buy over-the-counter rifle elk; OTC archery elk for nonresidents is east of I-25 only.'} <a href="https://cpw.state.co.us/activities/hunting/big-game/over-counter-otc-licenses">CPW over-the-counter licenses</a></p>`:'')+
  `<ol class="fl">`+r.slice(0,S.n).map((x,i)=>`<li><button class="fh" data-k="${x.k}"><span class="rk">${i+1}</span><span class="fv">${verdict(x.v)}</span><span class="ft">${title(x.k)}</span><span class="fd">${landS(D[x.k][4])}</span>${oddsHTML(x.v,'fo')}${succHTML(x.k,'fs')}</button></li>`).join('')+`</ol>`+
  (r.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(25,r.length-S.n)} more (${r.length-S.n} left)</button>`:'')+
  (r.length?'':'<p class="dq">No hunts at 5% or better with these points. Try fewer filters, or check back as you build points.</p>')+
  `<p class="note">Odds are estimates for 2027 from CPW's past draws (1st choice). Hunts under 5% aren't listed${S.priv?'':', and private-land-only hunts are hidden (turn them on under More options)'}. Not a guarantee. Always check the CPW big game brochure before you apply.</p>`;
 o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>openHunt(b.dataset.k));
 if($('more'))$('more').onclick=()=>{S.n+=25;history.replaceState(st('list'),'',url());showList()};}
function showDetail(k){const d=D[k],v=odds(k),o=$('detail');$('out').hidden=true;o.hidden=false;
 let lad='';if(FP&&d[0]!='moose'){const p=d[5][S.res],ks=Object.keys(p.o).map(Number);lad=`<p class="lh">Odds by points (Full Pass)</p><div class="lad">`+ks.map(n=>{const z=oAt(k,p,n)[0];return `<div class="lr${n==Math.min(S.pts,Math.max(...ks))?' on':''}"><span class="ln">${n} pts</span><span class="lb"><i style="width:${Math.max(Math.round(z*100),1)}%"></i></span><span class="lz">${pct(z)}</span></div>`}).join('')+'</div>'}
 let sure='';if(d[0]!='moose'){const p=d[5][S.res],ks=Object.keys(p.o).map(Number).sort((a,b)=>a-b),s=ks.find(n=>oAt(k,p,n)[0]>=.995);sure=`<p class="dq"><b>${s!=null?`You need about ${s} point${s==1?'':'s'} to be sure to draw.`:'No point level is a sure draw yet.'}</b></p>`}
 else sure='<p class="dq"><b>Moose is a lottery once you have 3 points.</b> No number of points guarantees a tag.</p>';
 o.innerHTML=`<button class="btn big2" id="back">← Back to my list</button>
 <div class="yo"><p class="yt">Your odds</p><p class="tg">${title(k,1)}</p><div class="vd">${verdict(v)}</div>${oddsHTML(v,'fo')}${sure}${succHTML(k,'fs')}
 <p class="dq">${landS(d[4])}</p></div>${lad}
 ${d[6]?`<h3>Past draws (1st choice, CPW)</h3>`+d[6].map(h=>`<div class="yr"><b>${h[0]}</b><span>${h[1]??'–'} tags · ${h[2]??'–'} applied</span><span>Drew out at: ${(S.res=='res'?h[3]:h[4])||'–'}</span></div>`).join(''):''}
 <p class="note">Hunt code <b>${k}</b>. Estimates from CPW's past draw and harvest reports, not a guarantee. Check the CPW brochure before you apply.</p>
 <p><a class="btn" href="packages.html">Scouting help for this hunt</a></p>
 <button class="btn o big2" id="back2">← Back to my list</button>`;
 $('back').onclick=$('back2').onclick=goBack;top2(o)}
const top2=e=>{const h=document.querySelector('header');scrollTo({top:e.getBoundingClientRect().top+scrollY-((h&&getComputedStyle(h).position=='sticky')?h.offsetHeight:0)-12,behavior:'instant'})};
const st=(v,k)=>({v,k,sp:S.sp,res:S.res,pts:S.pts,w:S.w,yo:S.yo,priv:S.priv,n:S.n,y:v=='list'?scrollY:0});
const url=k=>{const u=new URLSearchParams({sp:S.sp,r:S.res,p:S.pts});if(S.w)u.set('w',S.w);if(S.yo)u.set('kid',1);if(S.priv)u.set('priv',1);if(k)u.set('h',k);if(FULLPASS_GATING&&FP)u.set('preview','fullpass');return '?'+u+'#'+(k?'hunt':'list')};
let fromList=false;
function openHunt(k){history.replaceState(st('list'),'',url());history.pushState(st('detail',k),'',url(k));fromList=true;showDetail(k)}
function goBack(){if(fromList)history.back();else{history.replaceState(st('list'),'',url());showList();top2($('out'))}}
function apply(s){Object.assign(S,{sp:s.sp,res:s.res,pts:+s.pts,w:s.w||'',yo:+s.yo||0,priv:+s.priv||0,n:+s.n||25});sync()}
function sync(){document.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('on',x.dataset.sp==S.sp));document.querySelectorAll('[data-res]').forEach(x=>x.classList.toggle('on',x.dataset.res==S.res));
 document.querySelectorAll('[data-yo]').forEach(x=>x.classList.toggle('on',+x.dataset.yo==S.yo));$('pv').textContent=S.pts;$('priv').checked=!!S.priv;
 document.querySelectorAll('[data-w]').forEach(x=>{x.classList.toggle('on',x.dataset.w==S.w);x.disabled=S.sp=='turkey'});$('wnote').hidden=S.sp!='turkey'}
addEventListener('popstate',e=>{const s=e.state;if(!s){$('out').hidden=true;$('detail').hidden=true;return}apply(s);
 if(s.v=='detail'){fromList=false;showDetail(s.k)}else{showList();requestAnimationFrame(()=>scrollTo(0,s.y||0))}});
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;sync()});
document.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{S.res=b.dataset.res;sync()});
document.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{S.w=b.dataset.w;sync()});
document.querySelectorAll('[data-yo]').forEach(b=>b.onclick=()=>{S.yo=+b.dataset.yo;sync()});
$('priv').onchange=()=>{S.priv=$('priv').checked?1:0};
const step=x=>{S.pts=Math.max(0,Math.min(30,S.pts+x));$('pv').textContent=S.pts};$('pm').onclick=()=>step(-1);$('pp').onclick=()=>step(1);
$('go').onclick=()=>{S.n=25;history.pushState(st('list'),'',url());showList();top2($('out'))};
// open straight from a shared/bookmarked link
if(Q.get('sp')&&D){apply({sp:SP[Q.get('sp')]?Q.get('sp'):'elk',res:Q.get('r')=='nonres'?'nonres':'res',pts:Math.max(0,Math.min(30,+Q.get('p')||0)),w:'AMR'.includes(Q.get('w')||'-')?Q.get('w'):'',yo:Q.get('kid')?1:0,priv:Q.get('priv')?1:0,n:25});
 const h=Q.get('h');history.replaceState(st('list'),'',url());if(h&&D[h]&&D[h][0]==S.sp&&!(typeof EXCL!='undefined'&&EXCL.has(h))){history.pushState(st('detail',h),'',url(h));fromList=true;showDetail(h)}else showList()}
sync();
window.__FY={ranked,odds,S,FULLPASS_GATING};
})();
