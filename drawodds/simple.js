(function(){
const $=id=>document.getElementById(id);let S={sp:'elk',res:'res',pts:0};
const NM={elk:'Elk',deer:'Deer',pronghorn:'Pronghorn',bear:'Bear'};
function codes(){const u=+$('u').value;if(!u)return[];return Object.keys(D).filter(k=>D[k][0]==S.sp&&D[k][1]==u).sort();}
function seasons(){const c=codes(),sel=$('hc');const keep=sel.value;
 sel.innerHTML=c.length?c.map(k=>`<option value="${k}">${D[k][2]} · ${D[k][3]}${/private/.test(D[k][4])&&!/public/.test(D[k][4])?' · private land':''}</option>`).join(''):'<option value="">No hunts found for that unit</option>';
 if(c.includes(keep))sel.value=keep;$('hcw').style.display=$('u').value?'':'none';res();}
function chance(v){if(v>=.995)return'Guaranteed (based on past draws)';if(v<=.005)return'Very unlikely with these points';if(v>=.9)return'Very likely, about '+Math.round(v*100)+'%';
 const n=Math.round(1/v);return n<=10?`About 1 in ${n} chance`:`Long shot, about 1 in ${n}`;}
function yrsLine(p,pts,v){if(v>=.995||p.hi==null||p.cr==null||p.c=='Low')return'';
 if(p.cr>=.8)return '<p class="dq yrs">Don&#39;t have enough? Points needed for this hunt are climbing about as fast as you earn them, so it may take a long time.</p>';
 const t=Math.ceil((p.hi-pts)/(1-p.cr)-1e-9);if(t<1||t>20)return '';
 return `<p class="dq yrs">Don't have enough? You'd likely draw in about <b>${t} year${t==1?'':'s'}</b> if you keep applying.</p>`;}
function list(){const o=$('ans'),pts=S.pts;const r=Object.keys(D).filter(k=>{const d=D[k];if(d[0]!=S.sp||/private/.test(d[4])&&!/public/.test(d[4]))return false;const p=d[5][S.res];if(!p)return false;const m=Math.max(...Object.keys(p.o).map(Number));return p.o[Math.min(pts,m)]>=.9})
 .sort((a,b)=>(D[b][7]??-1)-(D[a][7]??-1)).slice(0,8);
 o.innerHTML=r.length?`<div class="big">Hunts you'd likely draw</div><p class="dq">with ${pts} point${pts==1?'':'s'}. Tap one to see your odds.</p>`+r.map(k=>`<button class="pick" data-k="${k}"><b>Unit ${D[k][1]}</b> · ${D[k][2]} · ${D[k][3]}${D[k][7]!=null?`<span>${Math.round(D[k][7])}% of hunters got one (2025)</span>`:''}</button>`).join(''):`<div class="big">No sure-thing hunts yet</div><p class="dq">Type a unit number above to see your odds there.</p>`;
 o.querySelectorAll('.pick').forEach(b=>b.onclick=()=>{$('u').value=D[b.dataset.k][1];seasons();$('hc').value=b.dataset.k;res();$('ans').scrollIntoView({behavior:'smooth'})});}
function oneIn(v){if(v>=.995)return'';if(v<.005)return'very unlikely';if(v>=.5){const k=Math.min(9,Math.round(v*10));return `about ${k} in 10`}
 let n=1/v;n=n<20?Math.round(n):n<50?Math.round(n/5)*5:n<200?Math.round(n/10)*10:0;return n?`about 1 in ${n}`:'fewer than 1 in 200'}
function res(){const k=$('hc').value,o=$('ans');if(!$('u').value){list();return}if(!k){o.innerHTML='<p class="dq">No hunts found for that unit.</p>';return}
 const d=D[k],p=d[5][S.res];if(!p){o.innerHTML='<p class="dq">Not enough past data for this hunt.</p>';return}
 const ks=Object.keys(p.o).map(Number),mx=Math.max(...ks),v=p.o[Math.min(S.pts,mx)];
 const sure=ks.find(n=>p.o[n]>=.995),top=sure??mx,me=Math.min(S.pts,mx),pct=Math.round(v*100);
 const lad=ks.filter(n=>n<=top).map(n=>{const z=Math.round(p.o[n]*100);return `<div class="lr${n==me?' on':''}"><span class="ln">${n}${n==mx&&sure==null?'+':''} point${n==1?'':'s'}</span><span class="lb"><i style="width:${Math.max(z,1)}%"></i></span><span class="lz">${z}%${oneIn(p.o[n])?`<small>${oneIn(p.o[n])}</small>`:""}</span></div>`}).join('');
 const sl=sure!=null?`You need about ${sure} point${sure==1?'':'s'} to be sure to draw.`:`No point level is a sure draw yet.`;
 o.innerHTML=`<p class="lh">Odds by points <span class="sub">${S.res=='res'?'Colorado resident':'Nonresident'} · 2027 estimate</span></p><div class="lad" aria-label="Odds by points">${lad}</div>
 <div class="yo"><p class="yt">Your odds</p><div class="vd">${v>=.995?"YES, you'll draw":v>=.75?"LIKELY":v>=.25?"MAYBE":v>=.05?"LONG SHOT":"NOT THIS YEAR"}</div><div class="big">With ${S.pts} point${S.pts==1?'':'s'}: about ${pct}%${oneIn(v)?` <span class="oi">(${oneIn(v)})</span>`:''}</div><p class="dq"><b>${sl}</b></p>${yrsLine(p,S.pts,v)}</div>
 <details><summary>More details</summary><p class="note">Hunt code <b>${k}</b> · ${d[4]} · our estimate is <b>${p.c.toLowerCase()}</b> confidence.</p>
 <p class="note">Past years (1st choice):</p>${d[6].map(h=>`<div class="yr"><b>${h[0]}</b><span>${h[1]??'–'} tags · ${h[2]??'–'} applied</span><span>Drew out at: ${(S.res=='res'?h[3]:h[4])||'–'}</span></div>`).join('')}
 ${d[7]!=null?`<p class="note">Hunter success in 2025: ${d[7].toFixed(0)}%</p>`:''}</details>`;}
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;document.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('on',x==b));seasons()});
document.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{S.res=b.dataset.res;document.querySelectorAll('[data-res]').forEach(x=>x.classList.toggle('on',x==b));res()});
const sp=d=>{S.pts=Math.max(0,Math.min(30,S.pts+d));$('pv').textContent=S.pts;res()};$('pm').onclick=()=>sp(-1);$('pp').onclick=()=>sp(1);
$('u').oninput=seasons;$('hc').onchange=res;seasons();
})();
