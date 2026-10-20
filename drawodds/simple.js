(function(){
const $=id=>document.getElementById(id);let S={sp:'elk',res:'res',pts:0};
const NM={elk:'Elk',deer:'Deer',pronghorn:'Pronghorn',bear:'Bear'};
function codes(){const u=+$('u').value;if(!u)return[];return Object.keys(D).filter(k=>D[k][0]==S.sp&&D[k][1]==u).sort();}
function seasons(){const c=codes(),sel=$('hc');const keep=sel.value;
 sel.innerHTML=c.length?c.map(k=>`<option value="${k}">${D[k][2]} · ${D[k][3]}${/private/.test(D[k][4])&&!/public/.test(D[k][4])?' · private land':''}</option>`).join(''):'<option value="">No hunts found for that unit</option>';
 if(c.includes(keep))sel.value=keep;$('hcw').style.display=$('u').value?'':'none';res();}
function chance(v){if(v>=.995)return'Guaranteed (based on past draws)';if(v<=.005)return'No chance last year';if(v>=.9)return'Very likely, about '+Math.round(v*100)+'%';
 const n=Math.round(1/v);return n<=10?`About 1 in ${n} chance`:`Long shot, about 1 in ${n}`;}
function res(){const k=$('hc').value,o=$('ans');if(!k){o.innerHTML='<p class="dq">Pick a species and type your unit number.</p>';return}
 const d=D[k],p=d[5][S.res];if(!p){o.innerHTML='<p class="dq">Not enough past data for this hunt.</p>';return}
 const ks=Object.keys(p.o).map(Number),mx=Math.max(...ks),v=p.o[Math.min(S.pts,mx)];
 o.innerHTML=`<div class="big">${chance(v)}</div><p class="dq">with ${S.pts}${S.pts>=mx?'+':''} point${S.pts==1?'':'s'} as a ${S.res=='res'?'Colorado resident':'nonresident'}.<br>${p.f!=null?`To be safe, plan on <b>${p.f} point${p.f==1?'':'s'}</b>.`:''}</p>
 <details><summary>More details</summary><p class="note">Hunt code <b>${k}</b> · ${d[4]} · our estimate is <b>${p.c.toLowerCase()}</b> confidence.</p>
 <div class="pc">${ks.map(n=>`<span class="${n==Math.min(S.pts,mx)?'on':''}"><b>${n} pts</b>${Math.round(p.o[n]*100)}%</span>`).join('')}</div>
 <p class="note">Past years (1st choice):</p>${d[6].map(h=>`<div class="yr"><b>${h[0]}</b><span>${h[1]??'–'} tags · ${h[2]??'–'} applied</span><span>Drew out at: ${(S.res=='res'?h[3]:h[4])||'–'}</span></div>`).join('')}
 ${d[7]!=null?`<p class="note">Hunter success in 2025: ${d[7].toFixed(0)}%</p>`:''}</details>`;}
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;document.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('on',x==b));seasons()});
document.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{S.res=b.dataset.res;document.querySelectorAll('[data-res]').forEach(x=>x.classList.toggle('on',x==b));res()});
const sp=d=>{S.pts=Math.max(0,Math.min(30,S.pts+d));$('pv').textContent=S.pts;res()};$('pm').onclick=()=>sp(-1);$('pp').onclick=()=>sp(1);
$('u').oninput=seasons;$('hc').onchange=res;seasons();
})();
