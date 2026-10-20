(function(){
const $=id=>document.getElementById(id);let S={sp:'elk',res:'res',pts:0,yo:0};
const NM={elk:'Elk',deer:'Deer',pronghorn:'Pronghorn',bear:'Bear'};
const SXR={antlered:0,'either-sex':1,antlerless:2};
function sexL(d){const x=d[3],sp=d[0];if(sp=='bear')return'';
 if(sp=='turkey')return x=='bearded'?'BEARDED':x=='either-sex'?'EITHER-SEX':x.toUpperCase();
 const big=sp=='elk'||sp=='moose';if(x=='antlered')return big?'BULL':'BUCK';if(x=='antlerless')return(big?'COW':'DOE')+' (antlerless)';if(x=='either-sex')return'EITHER-SEX';return x.toUpperCase()}
const YO=k=>k&&k[5]=='K';
function yInfo(){const nr=S.res=='nonres';return `<p class="note yinfo"><b>Kids 12–17:</b> youth tags cost ${nr?'$130.07 for deer, elk or pronghorn ($64.10 bear, $130.39 turkey)':'$20.30 for deer, elk or pronghorn ($19.93 bear, $20.62 turkey)'}. Hunters ages 12–15 need a mentor in the field who is 18 or older and has hunter ed. Kids can apply at 11 if they turn 12 before the season ends. If a cow or doe tag doesn't get filled, they can keep hunting in later rifle seasons (the extended youth season, see the CPW brochure).</p>`}
function yp(k){const y=typeof Y!='undefined'&&Y[k];return y&&y[S.res]?y[S.res]:null}
function oAt(k,p,n){const q=S.yo&&yp(k);if(!q)return[p.o[n],0];const ok=m=>(q.n[m]||0)>=10&&q.o[m]!=null;if(ok(n))return[q.o[n],1];
 let f=p.o[n];for(let m=0;m<n;m++)if(ok(m))f=Math.max(f,q.o[m]);return[f,2]}
function landS(l){return /^all lands/.test(l)?'':/^private/.test(l)?' · private land':/Ranching/.test(l)?' · Ranching for Wildlife':' · '+l.replace(/ \(see brochure\)/,'')}
function codes(){const u=+$('u').value;if(!u)return[];return Object.keys(D).filter(k=>D[k][0]==S.sp&&D[k][1]==u).sort((a,b)=>(SXR[D[a][3]]??3)-(SXR[D[b][3]]??3)||a.localeCompare(b));}
function seasons(){const c=codes(),sel=$('hc');const keep=sel.value;
 sel.innerHTML=c.length?c.map(k=>`<option value="${k}">${sexL(D[k])?sexL(D[k])+' · ':''}${D[k][2]}${landS(D[k][4])}</option>`).join(''):'<option value="">No hunts found for that unit</option>';
 if(c.includes(keep))sel.value=keep;$('hcw').style.display=$('u').value?'':'none';res();}
function chance(v){if(v>=.995)return'Guaranteed (based on past draws)';if(v<=.005)return'Very unlikely with these points';if(v>=.9)return'Very likely, about '+Math.round(v*100)+'%';
 const n=Math.round(1/v);return n<=10?`About 1 in ${n} chance`:`Long shot, about 1 in ${n}`;}
function yrsLine(p,pts,v){if(v>=.995||p.hi==null||p.cr==null||p.c=='Low')return'';
 if(p.cr>=.8)return '<p class="dq yrs">Don&#39;t have enough? Points needed for this hunt are climbing about as fast as you earn them, so it may take a long time.</p>';
 const t=Math.ceil((p.hi-pts)/(1-p.cr)-1e-9);if(t<1||t>20)return '';
 return `<p class="dq yrs">Don't have enough? You'd likely draw in about <b>${t} year${t==1?'':'s'}</b> if you keep applying.</p>`;}
function list(){const o=$('ans'),pts=S.pts;const r=Object.keys(D).filter(k=>{const d=D[k];if(d[0]!=S.sp||/private/.test(d[4])&&!/public/.test(d[4]))return false;const p=d[5][S.res];if(!p)return false;const m=Math.max(...Object.keys(p.o).map(Number));return oAt(k,p,Math.min(pts,m))[0]>=.9})
 .sort((a,b)=>(D[b][7]??-1)-(D[a][7]??-1)).slice(0,8);
 o.innerHTML=r.length?`<div class="big">Hunts you'd likely draw</div><p class="dq">with ${pts} point${pts==1?'':'s'}. Tap one to see your odds.</p>`+r.map(k=>`<button class="pick" data-k="${k}"><b class="sx">${sexL(D[k])}</b> <b>Unit ${D[k][1]}</b> · ${D[k][2]}${D[k][7]!=null?`<span>${Math.round(D[k][7])}% of hunters got one (2025)</span>`:''}</button>`).join(''):`<div class="big">No sure-thing hunts yet</div><p class="dq">Type a unit number above to see your odds there.</p>`;
 o.querySelectorAll('.pick').forEach(b=>b.onclick=()=>{$('u').value=D[b.dataset.k][1];seasons();$('hc').value=b.dataset.k;res();$('ans').scrollIntoView({behavior:'smooth'})});}
function oneIn(v){if(v>=.995)return'';if(v<.005)return'very unlikely';if(v>=.5){const k=Math.min(9,Math.round(v*10));return `about ${k} in 10`}
 let n=1/v;n=n<20?Math.round(n):n<50?Math.round(n/5)*5:n<200?Math.round(n/10)*10:0;return n?`about 1 in ${n}`:'fewer than 1 in 200'}
function mooseRes(k,d,o){const M=d[8],ys=Object.keys(M).sort(),g=S.pts>=3?'3':String(S.pts),lab=S.pts>=3?'3+ points':`${S.pts} point${S.pts==1?'':'s'}`;
 const row=y=>{const x=(M[y][S.res]||{})[g];return x?{a:x[0],dr:x[1]}:null};const ly=ys[ys.length-1],L=row(ly);
 const tg=`<p class="tg">${sexL(d)?`<b class="sx">${sexL(d)}</b> · `:''}Moose · Unit ${d[1]} · ${d[2]}</p>`;
 if(!L){o.innerHTML=`<div class="yo"><p class="yt">Your odds</p>${tg}<div class="big">No ${S.res=='res'?'resident':'nonresident'} applicants with ${lab} in ${ly}</div><p class="dq">CPW's ${ly} report has no 1st-choice applicants in this group, so we can't give odds.</p></div>`;return}
 const v=L.dr/L.a,pct=Math.round(v*100),pc=v>0&&pct==0?'under 1':pct;
 const vd=v>=.995?"YES, you'll draw":v>=.75?'LIKELY':v>=.25?'MAYBE':v>=.05?'LONG SHOT':'NOT THIS YEAR';
 const lad=ys.slice().reverse().map(y=>{const r=row(y);if(!r)return `<div class="lr"><span class="ln">${y}</span><span class="lb"></span><span class="lz">no apps</span></div>`;const z=r.dr/r.a,zp=Math.round(z*100);
  return `<div class="lr${y==ly?' on':''}"><span class="ln">${y}</span><span class="lb"><i style="width:${Math.max(zp,1)}%"></i></span><span class="lz">${r.dr} of ${r.a}<small>${z>0&&zp==0?'under 1':zp}%${oneIn(z)?' · '+oneIn(z):''}</small></span></div>`}).join('');
 const lot=S.pts>=3?`<p class="dq"><b>Moose is a lottery once you have 3 points.</b> No number of points guarantees a tag. Each year you miss after 3 points adds a weighted point, which helps a little.</p>`:`<p class="dq"><b>Moose is a lottery once you have 3 points.</b> Below 3 points, very few people draw.</p>`;
 o.innerHTML=`<p class="lh">Past draws, applicants with ${lab} <span class="sub">${S.res=='res'?'Colorado resident':'Nonresident'} · 1st choice · actual CPW results</span></p><div class="lad">${lad}</div>
 <div class="yo"><p class="yt">Your odds</p>${tg}<div class="vd">${vd}</div><div class="big">With ${lab}: about ${pc}%${oneIn(v)?` <span class="oi">(${oneIn(v)})</span>`:''} in ${ly}</div>${lot}${/antlered|either/.test(d[3])?'<p class="dq">A bull moose is once in a lifetime in Colorado.</p>':''}${S.yo?'<p class="dq"><b>Kids draw from the same pool as adults here.</b> CPW gives no youth price break for moose.</p>':''}${Object.values(M).some(x=>x.grp)?'<p class="sub">This hunt shares its tags with other hunt codes; numbers are for the group.</p>':''}</div>
 ${S.yo?yInfo():''}<details><summary>More details</summary><p class="note">Hunt code <b>${k}</b> · ${d[4]}. Odds are last year's actual results, not a forecast.</p></details>`}
function ykNote(k,d,q,kid){if(YO(k))return '<p class="dq"><b>Youth-only hunt:</b> only hunters 12–17 can apply.</p>';if(!S.yo)return '';
 if(q&&kid)return `<p class="dq"><b>These are kids' odds.</b> CPW holds at least ${Y[k].pct} of these tags for hunters 12–17, and kids draw first for them.</p>`;
 if(q)return '<p class="dq"><b>Kids may do better.</b> CPW holds some of these tags for hunters 12–17, but fewer than 10 kids applied at this point level last year. Kids get the youth draw plus the regular draw, so their odds are at least this good.</p>';
 return '<p class="dq"><b>Kids draw from the same pool as adults here;</b> perk is the cheaper youth tag.</p>'}
function res(){const k=$('hc').value,o=$('ans');if(!$('u').value){list();return}if(!k){o.innerHTML='<p class="dq">No hunts found for that unit.</p>';return}
 const d=D[k];if(d[0]=='moose'){mooseRes(k,d,o);return}const p=d[5][S.res];if(!p){o.innerHTML='<p class="dq">Not enough past data for this hunt.</p>';return}
 const ks=Object.keys(p.o).map(Number),mx=Math.max(...ks),Oa=n=>oAt(k,p,n),O=n=>Oa(n)[0],me0=Math.min(S.pts,mx),v=O(me0),kid=Oa(me0)[1],q=yp(k);
 const sure=ks.find(n=>O(n)>=.995),top=sure??mx,me=Math.min(S.pts,mx),pct=Math.round(v*100);
 const lad=ks.filter(n=>n<=top).map(n=>{const z=Math.round(O(n)*100);return `<div class="lr${n==me?' on':''}"><span class="ln">${n}${n==mx&&sure==null?'+':''} point${n==1?'':'s'}${Oa(n)[1]==1?' <small class="kd">kids</small>':Oa(n)[1]==2?' <small class="kd al">at least</small>':''}</span><span class="lb"><i style="width:${Math.max(z,1)}%"></i></span><span class="lz">${z}%${oneIn(O(n))?`<small>${oneIn(O(n))}</small>`:""}</span></div>`}).join('');
 const sl=sure!=null?`You need about ${sure} point${sure==1?'':'s'} to be sure to draw.`:`No point level is a sure draw yet.`;
 o.innerHTML=`<p class="lh">Odds by points <span class="sub">${S.res=='res'?'Colorado resident':'Nonresident'}${S.yo?' · kid 12–17':''} · 2027 estimate</span></p><div class="lad" aria-label="Odds by points">${lad}</div>
 <div class="yo"><p class="yt">Your odds</p><p class="tg">${sexL(d)?`<b class="sx">${sexL(d)}</b> · `:""}Unit ${d[1]} · ${d[2]}</p><div class="vd">${v>=.995?"YES, you'll draw":v>=.75?"LIKELY":v>=.25?"MAYBE":v>=.05?"LONG SHOT":"NOT THIS YEAR"}</div><div class="big">With ${S.pts} point${S.pts==1?'':'s'}: ${kid==2?'at least':'about'} ${pct}%${oneIn(v)?` <span class="oi">(${oneIn(v)})</span>`:''}</div><p class="dq"><b>${sl}</b></p>${S.yo&&q?'':yrsLine(p,S.pts,v)}${ykNote(k,d,q,kid)}</div>${S.yo?yInfo():''}
 <details><summary>More details</summary><p class="note">Hunt code <b>${k}</b> · ${d[4]} · our estimate is <b>${p.c.toLowerCase()}</b> confidence.</p>
 <p class="note">Past years (1st choice):</p>${d[6].map(h=>`<div class="yr"><b>${h[0]}</b><span>${h[1]??'–'} tags · ${h[2]??'–'} applied</span><span>Drew out at: ${(S.res=='res'?h[3]:h[4])||'–'}</span></div>`).join('')}
 ${d[7]!=null?`<p class="note">Hunter success in 2025: ${d[7].toFixed(0)}%</p>`:''}</details>`;}
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;document.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('on',x==b));seasons()});
document.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{S.res=b.dataset.res;document.querySelectorAll('[data-res]').forEach(x=>x.classList.toggle('on',x==b));res()});
document.querySelectorAll('[data-yo]').forEach(b=>b.onclick=()=>{S.yo=+b.dataset.yo;document.querySelectorAll('[data-yo]').forEach(x=>x.classList.toggle('on',x==b));res()});
const sp=d=>{S.pts=Math.max(0,Math.min(30,S.pts+d));$('pv').textContent=S.pts;res()};$('pm').onclick=()=>sp(-1);$('pp').onclick=()=>sp(1);
$('u').oninput=seasons;$('hc').onchange=res;seasons();
})();
