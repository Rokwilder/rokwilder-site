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
let S={sp:'elk',res:'res',pts:0,w:'',yo:0,priv:0,n:25,tab:'list',mv:null,mu:null,ol:null};
// Weapon = 5th character of the hunt code (CPW brochure): A archery, M muzzleloader, R rifle and associated methods.
// X = season choice (one license good in archery, muzzleloader and rifle seasons), so it matches every weapon choice.
const WN={'':'Any weapon',A:'Archery',M:'Muzzleloader',R:'Rifle'};const wOK=k=>!S.w||S.sp=='turkey'||k.at(-1)==S.w||k.at(-1)=='X';
const SP={elk:'Elk',deer:'Deer',pronghorn:'Pronghorn',bear:'Bear',moose:'Moose',turkey:'Turkey',sheep:'Bighorn sheep',dsheep:'Desert bighorn sheep',goat:'Mountain goat'};
// Lottery species: moose, Rocky Mountain bighorn sheep and mountain goat use weighted preference points; desert bighorn is a pure random draw.
const WT=sp=>sp=='moose'||sp=='sheep'||sp=='dsheep'||sp=='goat';
const OIL=sp=>sp=='sheep'||sp=='dsheep'||sp=='goat';
function sexL(d){const x=d[3],sp=d[0];if(sp=='bear')return'';if(sp=='turkey')return x=='bearded'?'BEARDED':x.toUpperCase();
 if(x=='ram'||x=='ewe')return x.toUpperCase();if(x=='nanny')return'NANNY';if(OIL(sp)&&x=='either-sex')return'EITHER-SEX';
 const big=sp=='elk'||sp=='moose';if(x=='antlered')return big?'BULL':'BUCK';if(x=='antlerless')return big?'COW':'DOE';if(x=='either-sex')return'EITHER-SEX';return x.toUpperCase()}
const yp=k=>{const y=typeof Y!='undefined'&&Y[k];return y&&y[S.res]?y[S.res]:null};
function oAt(k,p,n){const q=S.yo&&yp(k);if(!q)return[p.o[n],0];const ok=m=>(q.n[m]||0)>=10&&q.o[m]!=null;if(ok(n))return[q.o[n],1];
 let f=p.o[n];for(let m=0;m<n;m++)if(ok(m))f=Math.max(f,q.o[m]);return[f,2]}
function mooseRow(d){const M=d[8];if(!M)return null;const ys=Object.keys(M).sort(),ly=ys.at(-1),g=S.pts>=3?'3':String(S.pts),x=(M[ly][S.res]||{})[g];return x&&x[0]?{v:x[1]/x[0],a:x[0],dr:x[1],y:ly}:null}
// ===== Weighted-point model (OI_MODEL) =====
// CPW (2026 brochure): with 3 preference points you also get weighted points; your random draw number is divided by (weighted points + 1),
// and the 3-point group draws first. So at P = 3 + W total points your odds are about t*(W+1), where t is the threshold that hands out
// the quota (solved from CPW draw recaps). Under 3 points you only draw what the 3-point group leaves over.
// Conservative: the lower of (a) a 2027 projection where everyone who failed comes back with one more point and (b) a replay of the
// latest CPW draw; times the backtest shrink OI_K; and never above how often "100%" predictions really drew in backtests (OI_SR ceiling).
const bkt=(sp,P)=>sp=='dsheep'||P<3?'lo':P-3<=2?'a':P-3<=6?'b':P-3<=12?'c':'d';
const pAt=(m,P)=>m.r!=null?m.r:P>=3?(m.t==null?1:Math.min(1,m.t*(P-2))):m.l[P];
function wOdds(d,P,res){const m=d[9]&&d[9][res||S.res];if(!m)return null;const sp=d[0],v=Math.min(pAt(m.p,P),pAt(m.b,P));
 const w=Math.min(1,v*((OI_K[sp]||{})[bkt(sp,P)]??1));return OI_SR[sp]?Math.min(w,OI_SR[sp][P>=3?'hi':'lo']):w}
function odds(k){const d=D[k];if(d[9])return wOdds(d,Math.min(S.pts,30));if(d[0]=='moose'){const r=mooseRow(d);return r?r.v:null}
 const p=d[5][S.res];if(!p)return null;const m=Math.max(...Object.keys(p.o).map(Number));return oAt(k,p,Math.min(S.pts,m))[0]}
const verdict=v=>v>=.995?"YES, you'll draw":v>=.75?'LIKELY':v>=.25?'MAYBE':v>=.05?'LONG SHOT':'NOT THIS YEAR';
const pct=v=>{const r=Math.round(v*100);return v>0&&r==0?'under 1%':r+'%'};
const priv=d=>/private/.test(d[4])&&!/public/.test(d[4]);
function landS(l){if(/^(Bighorn Sheep Access|Chancellor|Part of the unit)/.test(l))return l;if(/^all lands \(public\+private\) · /.test(l))return 'Public and private land · '+l.split(' · ').slice(1).join(' · ');return /^all lands/.test(l)?'Public and private land':/^private/.test(l)?'Private land only':/Ranching/.test(l)?'Ranching for Wildlife (private ranch)':'Special land rules (CPW land code '+(l.match(/^(?:land code )?([A-Z])/)||[,'?'])[1]+'), see the CPW brochure'}
function lab(k){const f=typeof FL!='undefined'&&FL[k];if(f&&f[0]==1)return'New hunt, no data';if(D[k][7]==null||(f&&f[0]==2))return'No data';return''}
const hunters=k=>{const f=typeof FL!='undefined'&&FL[k];return f?f[1]:null};
function succHTML(k,cls){const d=D[k],l=lab(k);if(l)return `<div class="${cls}"><b>${l}</b> <span>for hunter success</span></div>`;
 const n=hunters(k);return `<div class="${cls}"><b>${Math.round(d[7])}%</b> <span>of hunters got one (CPW, 2025)${n!=null?` · ${n.toLocaleString()} hunters`:''}${n!=null&&n<30?' · <em class="ss">SMALL SAMPLE</em>':''}</span></div>`}
function oddsHTML(v,cls){return FP?`<div class="${cls}"><b>${pct(v)}</b> <span>draw odds with ${S.pts} point${S.pts==1?'':'s'}</span></div>`:`<div class="${cls} lk"><span>Exact draw odds: <a href="unitiq.html">Full Pass</a></span></div>`}
function ranked(){return Object.keys(D).filter(k=>{const d=D[k];if(d[0]!=S.sp)return false;if(typeof EXCL!='undefined'&&EXCL.has(k))return false;if(priv(d)&&!S.priv)return false;if(!wOK(k))return false;const v=odds(k);return v!=null&&(WT(S.sp)?v>0:v>=.05)})
 .map(k=>({k,v:odds(k)})).sort((a,b)=>b.v-a.v||(D[b.k][7]??-1)-(D[a.k][7]??-1)||a.k.localeCompare(b.k))}
const seas=k=>k.at(-1)=='X'?'season choice (archery, muzzleloader or rifle)':D[k][2];
const units=k=>{const f=typeof FL!='undefined'&&FL[k];return f&&f[2]?f[2]:[D[k][1]]};
function uL(k,full){const u=units(k);if(u.length==1)return 'Unit '+u[0];return full||u.length<=4?'Units '+u.join(', '):`Units ${u.slice(0,3).join(', ')} +${u.length-3} more`}
function title(k,full){const d=D[k],sx=sexL(d);return `${sx?`<b class="sx">${sx}</b> · `:''}${uL(k,full)} · ${seas(k)}`}
function showList(){const r=ranked(),o=$('out');
 $('detail').hidden=true;o.hidden=false;if(M&&S.tab!='map'){M.remove();M=null}if(DM){DM.remove();DM=null}
 const who=`${SP[S.sp]} · ${S.res=='res'?'Colorado resident':'Out of state'} · ${S.pts} point${S.pts==1?'':'s'} · ${S.sp=='turkey'?'any weapon':WN[S.w].toLowerCase()}${S.yo?' · kid 12–17':''}`;
 const tabs=`<div class="tabs" role="tablist"><button role="tab" class="tb${S.tab=='list'?' on':''}" aria-selected="${S.tab=='list'}" data-tab="list">List</button><button role="tab" class="tb${S.tab=='map'?' on':''}" aria-selected="${S.tab=='map'}" data-tab="map">Map</button></div>`;
 if(S.tab=='map'){o.innerHTML=`<h2 id="lt">${r.length} hunt${r.length==1?'':'s'} you can draw</h2>${tabs}<p class="dq">${who}. Colored units have at least one hunt you can draw; the color is the best odds in that unit. Tap a unit to see its hunts.</p>`+
  wtNote()+(S.sp=='turkey'?'<p class="note">Turkey hunts use the same unit numbers as big game, so they are shown on the same unit map.</p>':'')+
  (OIL(S.sp)?`<p class="note">${S.sp=='goat'?'Mountain goat':'Bighorn sheep'} units are not the big game units: CPW numbers them ${S.sp=='goat'?'G1, G2…':'S1, S2…'}, and this map shows those ${S.sp=='goat'?'goat':'sheep'} units.</p>`:'')+
  mapKey(WT(S.sp)?['Under 5% or no hunt you can draw','(tap a unit to see its hunts under 5%)']:['No hunt you can draw','(or only hunts under 5%, not shown)'],.9)+
  `<div id="map" class="gmap" aria-label="Map of Colorado hunting units"></div><div id="mpanel" class="mp" hidden aria-live="polite"></div>`+
  `<p class="mapcred"><b>Unit boundaries: Colorado Parks and Wildlife.</b> Lines are simplified and approximate. Check the ${bro()} for official unit boundaries before you apply or hunt.</p>`+
  `<p class="note">Odds are estimates for 2027 from CPW's past draws (1st choice). ${WT(S.sp)?'Every hunt with a chance is shown, long shots under 5% included':'Hunts under 5% aren\'t shown'}${S.priv?'':', and private-land-only hunts are hidden (turn them on under More options)'}. Not a guarantee.</p>`+fbA('maps');
  wireTabs(o);drawMap(r);return}
 o.innerHTML=`<h2 id="lt">${r.length} hunt${r.length==1?'':'s'} you can draw</h2>${tabs}<p class="dq">${who}. Best odds first, down to long shots. Tap a hunt for details.</p>`+
  wtNote()+(S.sp=='elk'?`<p class="note"><b>No points needed:</b> ${S.res=='res'?'Colorado residents can buy an over-the-counter elk license for many units.':'Out-of-state hunters can buy over-the-counter rifle elk; OTC archery elk for nonresidents is east of I-25 only.'} <a href="https://cpw.state.co.us/activities/hunting/big-game/over-counter-otc-licenses">CPW over-the-counter licenses</a></p>`:'')+
  `<ol class="fl">`+r.slice(0,S.n).map((x,i)=>`<li><button class="fh" data-k="${x.k}"><span class="rk">${i+1}</span><span class="fv">${vdot(x.v)}${verdict(x.v)}</span><span class="ft">${title(x.k)}</span><span class="fd">${landS(D[x.k][4])}</span>${oddsHTML(x.v,'fo')}${succHTML(x.k,'fs')}</button></li>`).join('')+`</ol>`+
  (r.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(25,r.length-S.n)} more (${r.length-S.n} left)</button>`:'')+
  (r.length?'':`<p class="dq">${WT(S.sp)?'No hunts you can draw with these choices.':'No hunts at 5% or better with these points. Try fewer filters, or check back as you build points.'}</p>`)+
  `<p class="note">Odds are estimates for 2027 from CPW's past draws (1st choice). ${WT(S.sp)?'Every hunt with a chance is listed, long shots included':'Hunts under 5% aren\'t listed'}${S.priv?'':', and private-land-only hunts are hidden (turn them on under More options)'}. Not a guarantee. Always check the ${bro()} before you apply.</p>`+fbA('find');
 wireTabs(o);o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>openHunt(b.dataset.k));
 if($('more'))$('more').onclick=()=>{S.n+=25;history.replaceState(st('list'),'',url());showList()};}
// ===== Map tab (preview) =====
// Same buckets as the verdict words.
// Rokwilder brand palette (BRAND_GUIDE.txt + style.css). Ramp runs dark green -> olive -> tan -> orange:
// each step changes lightness and hue, so the buckets stay apart for red-green colorblind users too.
const MC={yes:'#263E2C',likely:'#6F7F4F',maybe:'#C4B28C',long:'#D2501F',none:'#E8E0D2',line:'#1E1E1C',bg:'#2A2D26',sel:'#E8E0D2'};
const VC=[[.995,MC.yes],[.75,MC.likely],[.25,MC.maybe],[.05,MC.long]];
const vcol=v=>(VC.find(c=>v>=c[0])||[0,MC.none])[1];
const vdot=v=>`<i class="vdot" style="background:${vcol(v)}"></i>`;
const KU='unit';
// ===== Map key =====
// Big swatches with the same verdict words as the hunt cards. The swatches are drawn the way the map draws them
// (same fill colors, same opacity over the map background, same cream outline), so the key matches what you see.
const KEYB=[['yes','Yes','sure to draw (over 99%)'],['likely','Likely','75–99%'],['maybe','Maybe','25–74%'],['long','Long shot','5–24%']];
const bucket=v=>v>=.995?'yes':v>=.75?'likely':v>=.25?'maybe':v>=.05?'long':'none';
const vword=v=>({yes:'Yes',likely:'Likely',maybe:'Maybe',long:'Long shot',none:'Under 5%'})[bucket(v)];
const fillSt=(c,op)=>{const n=parseInt(c.slice(1),16),rgb=[n>>16,n>>8&255,n&255].join(',');return op>=1?`background:${c}`:`background:linear-gradient(rgba(${rgb},${op}),rgba(${rgb},${op})),${MC.bg}`};
function keyHTML(id,title,items){return `<div class="mkey" id="${id}" role="group" aria-label="${title}"><p class="mkh">${title}</p><ul>`+
 items.map(x=>`<li${x.b?` data-b="${x.b}"`:''}${x.cls?` class="${x.cls}"`:''}><i class="sw${x.ring?' ring':''}" style="${x.st||''}" aria-hidden="true"></i><span class="mkt"><b>${x.w}</b>${x.d?` <span class="mkd">${x.d}</span>`:''}<span class="mkn"></span></span></li>`).join('')+'</ul></div>'}
// Statewide map key. noneW: what the light color means on this map; noneOp: its fill opacity there.
function mapKey(noneW,noneOp){const it=KEYB.map(([b,w,d])=>({b,w,d,st:fillSt(MC[b],1)}));
 it.push({b:'none',w:noneW[0],d:noneW[1],st:fillSt(MC.none,noneOp)});
 it.push({w:'Cream outline',d:`the ${KU} you tapped${S.ol?`, and the ${KU}s of the hunt you came from`:''}`,ring:1,st:`background:${MC.bg}`});
 return keyHTML('mkey',`Map key: the color is your best odds in that ${KU}`,it)}
// After the map draws: how many units are in each color. A color with none says so, so a missing color isn't a mystery.
function fillKey(cnt){document.querySelectorAll('#mkey li[data-b]').forEach(li=>{const n=cnt[li.dataset.b]||0,s=li.querySelector('.mkn');
 li.classList.toggle('zero',!n);s.textContent=n?` · ${n} ${KU}${n==1?'':'s'}`:li.dataset.b=='none'?` · none`:` · none on this map with your choices`});
 window.__KEY=cnt}
// Selected-hunt map: this hunt's units in its color (cream border), every other unit dimmed.
function huntKey(v,dimOp,thisW,other){return keyHTML('hkey','Map key',[
 {w:thisW,d:v>=.05?`your odds: ${vword(v)}`:'your odds: under 5% (shown in the light color)',st:fillSt(v>=.05?vcol(v):MC.none,1)+`;border:3px solid ${MC.sel}`},
 {w:other,d:'dimmed: not part of this hunt',st:fillSt(MC.none,dimOp)}])}

// Two-tone outline (charcoal under cream) reads on every fill color.
function halo(m,ls){const g=L.layerGroup().addTo(m);ls.forEach(l=>{g.addLayer(L.geoJSON(l.feature,{interactive:false,style:{fill:false,color:MC.line,weight:7}}));g.addLayer(L.geoJSON(l.feature,{interactive:false,style:{fill:false,color:MC.sel,weight:3}}))});return g}
let M=null,GJ=null,DM=null;const GJS={};
const gfile=sp=>sp=='goat'?'find/goat.json':sp=='sheep'||sp=='dsheep'?'find/sheep.json':'find/gmu.json';
const bro=()=>OIL(S.sp)?'CPW sheep & goat brochure':'CPW big game brochure';
function wireTabs(o){o.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(S.tab==b.dataset.tab)return;S.tab=b.dataset.tab;S.mv=null;S.mu=null;S.ol=null;history.pushState(st('list'),'',url());showList();top2($('out'))})}
const loadJS=src=>new Promise((ok,no)=>{const e=document.createElement('script');e.src=src;e.onload=ok;e.onerror=no;document.head.appendChild(e)});
async function ensureMap(){if(!window.L){const c=document.createElement('link');c.rel='stylesheet';c.href='find/vendor/leaflet.css';document.head.appendChild(c);await loadJS('find/vendor/leaflet.js')}
 if(!window.topojson)await loadJS('find/vendor/topojson-client.min.js');const f=gfile(S.sp);if(!GJS[f]){const t=await(await fetch(f)).json();GJS[f]=topojson.feature(t,t.objects.gmu)}GJ=GJS[f]}
function byUnit(r){const m={};r.forEach(x=>units(x.k).forEach(u=>{u=String(u);(m[u]=m[u]||[]).push(x)}));return m}
function popHTML(u,h){return `<div class="mp"><p class="mpt">Unit ${u} · best odds: ${vdot(h[0].v)}<b>${verdict(h[0].v)}</b></p><p class="mps">${h.length} hunt${h.length==1?'':'s'} you can draw here</p><ul>`+h.map(x=>{const d=D[x.k],sx=sexL(d),n=units(x.k).length;
 return `<li><button class="mh" data-k="${x.k}">${vdot(x.v)}<b>${x.k}</b> · ${verdict(x.v)}${FP?' · '+pct(x.v):''}<span>${sx?sx+' · ':''}${seas(x.k)}${n>1?` · covers ${n} units`:''}</span></button></li>`}).join('')+'</ul></div>'}
let SEL=null,PY=null;
function pick(u,h,l){if(SEL)SEL.remove();SEL=halo(M,[l]);S.mu=String(u);
 const pn=$('mpanel');pn.hidden=false;pn.innerHTML=popHTML(u,h);pn.querySelectorAll('.mh').forEach(b=>b.onclick=()=>openHunt(b.dataset.k));
 const s0=history.state;if(s0&&s0.v=='list')history.replaceState(st('list'),'',url())}
async function drawMap(r){SEL=null;const el=$('map');if(!el)return;try{await ensureMap()}catch(e){el.innerHTML='<p class="dq">The map could not load. Use the List tab.</p>';return}
 if(!el.isConnected)return;if(M){M.remove();M=null}
 M=L.map(el,{zoomSnap:.25,minZoom:5.5,maxZoom:11,scrollWheelZoom:false,tap:true});window.__FY.map=M;
 M.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>').addAttribution('Unit boundaries: Colorado Parks and Wildlife');
 const bu=byUnit(r),cnt={hl:0};
 const ly=L.geoJSON(GJ,{style:f=>{const u=f.properties.u,h=u!=null&&bu[u];return{color:MC.sel,opacity:.45,weight:.7,fillColor:h?vcol(h[0].v):MC.none,fillOpacity:h?1:.9}},
  onEachFeature:(f,l)=>{const u=f.properties.u,h=u!=null&&bu[u];if(!h){l.options.interactive=false;return}if(h[0].v>=.05)cnt.hl++;
   l.bindTooltip('Unit '+u,{sticky:true,direction:'top'});l.on('click',()=>{pick(u,h,l);const pn=$('mpanel'),b=pn.getBoundingClientRect();if(b.top>innerHeight-80)scrollBy({top:b.top-innerHeight*.45,behavior:'instant'})})}}).addTo(M);
 {const kc={},seen=new Set();GJ.features.forEach(f=>{const u=f.properties.u;if(u==null||seen.has(String(u)))return;seen.add(String(u));const h=bu[u];const b=h?bucket(h[0].v):'none';kc[b]=(kc[b]||0)+1});fillKey(kc)}
 window.__FY.hl=cnt.hl;M.setMaxBounds(ly.getBounds().pad(.3));
 if(S.mv)M.setView([S.mv[0],S.mv[1]],S.mv[2]);else M.fitBounds(ly.getBounds(),{padding:[4,4]});
 if(S.ol){const g=[];ly.eachLayer(l=>{if(S.ol.includes(String(l.feature.properties.u)))g.push(l)});halo(M,g).eachLayer(x=>x.eachLayer(y=>y.getElement&&y.getElement()&&y.getElement().classList.add('olh')));window.__FY.ol=g.length;if(g.length&&!S.mv)M.fitBounds(L.featureGroup(g).getBounds().pad(.6),{maxZoom:8})}
 if(S.mu!=null)ly.eachLayer(l=>{if(String(l.feature.properties.u)==String(S.mu)&&bu[S.mu])pick(S.mu,bu[S.mu],l)});if(PY!=null){const y=PY;PY=null;requestAnimationFrame(()=>scrollTo(0,y))}
 M.on('moveend',()=>{const c=M.getCenter();S.mv=[+c.lat.toFixed(4),+c.lng.toFixed(4),M.getZoom()];const s0=history.state;if(s0&&s0.v=='list')history.replaceState(st('list'),'',url())})}
function showDetail(k){const d=D[k],v=odds(k),o=$('detail');$('out').hidden=true;o.hidden=false;
 let lad='';if(FP&&d[9]&&d[0]!='dsheep'){const L=[0,1,2,3,4,5,6,8,10,13,16,20,25,30];if(!L.includes(S.pts))L.push(S.pts);L.sort((a,b)=>a-b);
  lad=`<p class="lh">Odds by points (Full Pass)</p><div class="lad">`+L.map(n=>{const z=wOdds(d,n);return `<div class="lr${n==S.pts?' on':''}"><span class="ln">${n} pts</span><span class="lb"><i style="width:${Math.max(Math.round(z*100),1)}%"></i></span><span class="lz">${pct(z)}</span></div>`}).join('')+'</div>'}
 else if(FP&&!WT(d[0])){const p=d[5][S.res],ks=Object.keys(p.o).map(Number);lad=`<p class="lh">Odds by points (Full Pass)</p><div class="lad">`+ks.map(n=>{const z=oAt(k,p,n)[0];return `<div class="lr${n==Math.min(S.pts,Math.max(...ks))?' on':''}"><span class="ln">${n} pts</span><span class="lb"><i style="width:${Math.max(Math.round(z*100),1)}%"></i></span><span class="lz">${pct(z)}</span></div>`}).join('')+'</div>'}
 let sure='';if(WT(d[0]))sure=wtSure(d);else if(d[0]!='moose'){const p=d[5][S.res],ks=Object.keys(p.o).map(Number).sort((a,b)=>a-b),s=ks.find(n=>oAt(k,p,n)[0]>=.995);sure=`<p class="dq"><b>${s!=null?`You need about ${s} point${s==1?'':'s'} to be sure to draw.`:'No point level is a sure draw yet.'}</b></p>`}
 const bk=S.tab=='map'?'← Back to my map':'← Back to my list';if(M){M.remove();M=null}if(DM){DM.remove();DM=null}
 o.innerHTML=`<button class="btn big2" id="back">${bk}</button>
 <div class="yo"><p class="yt">Your odds</p><p class="tg">${title(k,1)}</p><div class="vd">${vdot(v)}${verdict(v)}</div>${oddsHTML(v,'fo')}${sure}${succHTML(k,'fs')}
 <p class="dq">${landS(d[4])}</p>${d[10]?`<p class="dq">${d[10]}</p>`:''}</div>${lad}${feeHTML(d)}
 ${d[6]&&d[6].length?`<h3>Past draws (1st choice, CPW)</h3>`+d[6].map(h=>`<div class="yr"><b>${h[0]}</b><span>${h[1]??'–'} tags · ${h[2]??'–'} applied</span><span>${WT(d[0])?(S.res=='res'?'Residents':'Nonresidents')+': ':'Drew out at: '}${(S.res=='res'?h[3]:h[4])||'–'}</span></div>`).join(''):''}
 <h3>Where this hunt is</h3><p class="dq">${uL(k,1)}, highlighted on the unit map.</p>${huntKey(v??0,.35,`This hunt's unit${units(k).length==1?'':'s'} (numbered)`,'Other units')}<div id="dmap" class="gmap dm" aria-label="Map of the units in this hunt"></div>
 <p class="mapcred"><b>Unit boundaries: Colorado Parks and Wildlife.</b> Lines are simplified and approximate. Check the ${bro()} for official unit boundaries before you apply or hunt.</p>${OIL(d[0])?`<p class="note">${d[0]=='goat'?'Goat':'Sheep'} units (${d[0]=='goat'?'G':'S'} numbers) are not the big game units.</p>`:''}
 <p><button class="btn o" id="vsm">View on statewide map</button></p>
 <p class="note">Hunt code <b>${k}</b>. Estimates from CPW's past draw and harvest reports, not a guarantee. Check the ${bro()} before you apply.</p>
 <p><a class="btn" href="packages.html">Scouting help for this hunt</a></p>${fbA('find')}
 <button class="btn o big2" id="back2">${bk}</button>`;
 $('back').onclick=$('back2').onclick=goBack;$('vsm').onclick=()=>{S.tab='map';S.mv=null;S.mu=null;S.ol=units(k).map(String);history.pushState(st('list'),'',url());showList();top2($('out'))};
 drawDetailMap(k);top2(o)}
async function drawDetailMap(k){const el=$('dmap');try{await ensureMap()}catch(e){el.innerHTML='<p class="dq">The map could not load.</p>';return}if(!el.isConnected)return;if(DM){DM.remove();DM=null}
 const us=new Set(units(k).map(String));DM=L.map(el,{zoomSnap:.25,minZoom:5.5,maxZoom:11,scrollWheelZoom:false,dragging:!L.Browser.mobile,tap:false});window.__FY.dmap=DM;
 DM.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>').addAttribution('Unit boundaries: Colorado Parks and Wildlife');
 const on=[];L.geoJSON(GJ,{interactive:false,style:f=>{const h=f.properties.u!=null&&us.has(String(f.properties.u));return h?{color:MC.sel,weight:2.5,fillColor:vcol(odds(k)),fillOpacity:1}:{color:MC.sel,opacity:.3,weight:.5,fillColor:MC.none,fillOpacity:.35}},
  onEachFeature:(f,l)=>{if(f.properties.u!=null&&us.has(String(f.properties.u))){on.push(l);l.bindTooltip(String(f.properties.u),{permanent:true,direction:'center',className:'ulab'})}}}).addTo(DM);
 window.__FY.dlab=on.map(l=>String(l.feature.properties.u));if(on.length)DM.fitBounds(L.featureGroup(on).getBounds(),{padding:[18,18],maxZoom:9})}
function wtNote(){const sp=S.sp;if(!WT(sp))return'';
 const once=sp=='moose'?'Bull moose is once in a lifetime: the lifetime limit is one bull (cow moose has no lifetime limit).':sp=='dsheep'?'Desert bighorn sheep is once in a lifetime: once you harvest one, you can\'t enter the desert bighorn draw again.':sp=='sheep'?'Not once in a lifetime: if you harvest a Rocky Mountain bighorn ram, you wait five years before you can apply for a ram again (you can still apply for ewe hunts, but you don\'t earn points).':'Not once in a lifetime: if you harvest a mountain goat, you wait five years before you can apply for goat again.';
 const how=sp=='dsheep'?'<b>Pure lottery:</b> desert bighorn sheep has no preference points, so everyone has the same chance.':'<b>Weighted lottery:</b> enter your preference points plus weighted points. Points max out at 3; after that you earn weighted points, and each one improves your odds but never guarantees a tag.';
 return `<p class="note">${how} ${once}${S.yo?' There is no youth draw preference for this species. Kids 12–17 enter the same draw (an 11-year-old can apply if they turn 12 by the end of the season), and the point fee is waived for youth.':''}</p>`}
function wtSure(d){const sp=d[0];if(sp=='dsheep')return '<p class="dq"><b>Desert bighorn is a random draw.</b> Points don\'t matter and no one is sure to draw.</p>';
 const m=d[9]&&d[9][S.res];let x='';if(m&&m.wmin!=null)x=` In ${m.by}, ${S.res=='res'?'resident':'nonresident'} applicants with ${m.wmin+3} to ${m.wmax+3} points drew (CPW draw recap).`;
 return `<p class="dq"><b>${SP[sp]} is a lottery once you have 3 points.</b> No number of points guarantees a tag.${x}</p>`}
function feeHTML(d){const sp=d[0];if(!WT(sp))return'';const r=S.res=='res';
 const lic=r?'$385.66':'$2,823.53 (license + fishing combo)',app=OIL(sp)?(r?' · application fee $8.93':' · application fee $11.49'):'',pt=sp=='dsheep'?'':` · point fee ${r?'$50':'$100'} if you don't draw or apply for a point (waived for youth)`;
 return `<h3>Cost (CPW 2026)</h3><p class="dq">License ${lic}${app}${pt}. Apply by April 7; results April 23.${OIL(sp)?' Every sheep and goat harvest must be checked in person by CPW within 5 business days.':''}</p>`}
const fbA=about=>`<p class="fbk"><a class="fbl" href="feedback.html?about=${about}" data-about="${about}">Something off? Tell us</a></p>`;
const top2=e=>{const h=document.querySelector('header');scrollTo({top:e.getBoundingClientRect().top+scrollY-((h&&getComputedStyle(h).position=='sticky')?h.offsetHeight:0)-12,behavior:'instant'})};
const st=(v,k)=>({v,k,sp:S.sp,res:S.res,pts:S.pts,w:S.w,yo:S.yo,priv:S.priv,n:S.n,tab:S.tab,mv:S.mv,mu:S.mu,ol:S.ol,y:v=='list'?scrollY:0});
const url=k=>{const u=new URLSearchParams({sp:S.sp,r:S.res,p:S.pts});if(S.w)u.set('w',S.w);if(S.yo)u.set('kid',1);if(S.priv)u.set('priv',1);if(k)u.set('h',k);if(S.tab=='map')u.set('tab','map');if(FULLPASS_GATING&&FP)u.set('preview','fullpass');return '?'+u+'#'+(k?'hunt':S.tab=='map'?'map':'list')};
let fromList=false;
function openHunt(k){history.replaceState(st('list'),'',url());history.pushState(st('detail',k),'',url(k));fromList=true;showDetail(k)}
function goBack(){if(fromList)history.back();else{history.replaceState(st('list'),'',url());showList();top2($('out'))}}
function apply(s){Object.assign(S,{sp:s.sp,res:s.res,pts:+s.pts,w:s.w||'',yo:+s.yo||0,priv:+s.priv||0,n:+s.n||25,tab:s.tab=='map'?'map':'list',mv:s.mv||null,mu:s.mu??null,ol:s.ol||null});sync()}
function sync(){document.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('on',x.dataset.sp==S.sp));document.querySelectorAll('[data-res]').forEach(x=>x.classList.toggle('on',x.dataset.res==S.res));
 document.querySelectorAll('[data-yo]').forEach(x=>x.classList.toggle('on',+x.dataset.yo==S.yo));$('pv').textContent=S.pts;$('priv').checked=!!S.priv;
 document.querySelectorAll('[data-w]').forEach(x=>{x.classList.toggle('on',x.dataset.w==S.w);x.disabled=S.sp=='turkey'});$('wnote').hidden=S.sp!='turkey';if($('pnote'))$('pnote').hidden=!WT(S.sp)||S.sp=='dsheep';if($('dnote'))$('dnote').hidden=S.sp!='dsheep';if($('ynote'))$('ynote').hidden=!S.yo}
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a.fbl');if(a)a.href='feedback.html?about='+a.dataset.about+'&from='+encodeURIComponent(location.href)},true);
addEventListener('popstate',e=>{const s=e.state;if(!s){$('out').hidden=true;$('detail').hidden=true;return}apply(s);
 if(s.v=='detail'){fromList=false;showDetail(s.k)}else{PY=s.tab=='map'?s.y||0:null;showList();requestAnimationFrame(()=>scrollTo(0,s.y||0))}});
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;sync()});
document.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{S.res=b.dataset.res;sync()});
document.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{S.w=b.dataset.w;sync()});
document.querySelectorAll('[data-yo]').forEach(b=>b.onclick=()=>{S.yo=+b.dataset.yo;sync()});
$('priv').onchange=()=>{S.priv=$('priv').checked?1:0};
const step=x=>{S.pts=Math.max(0,Math.min(30,S.pts+x));$('pv').textContent=S.pts};$('pm').onclick=()=>step(-1);$('pp').onclick=()=>step(1);
$('go').onclick=()=>{S.n=25;S.mv=null;S.mu=null;S.ol=null;history.pushState(st('list'),'',url());showList();top2($('out'))};
// open straight from a shared/bookmarked link
if(Q.get('sp')&&D){apply({sp:SP[Q.get('sp')]?Q.get('sp'):'elk',res:Q.get('r')=='nonres'?'nonres':'res',pts:Math.max(0,Math.min(30,+Q.get('p')||0)),w:'AMR'.includes(Q.get('w')||'-')?Q.get('w'):'',yo:Q.get('kid')?1:0,priv:Q.get('priv')?1:0,n:25,tab:Q.get('tab')=='map'||location.hash=='#map'?'map':'list'});
 const h=Q.get('h');history.replaceState(st('list'),'',url());if(h&&D[h]&&D[h][0]==S.sp&&!(typeof EXCL!='undefined'&&EXCL.has(h))){history.pushState(st('detail',h),'',url(h));fromList=true;showDetail(h)}else showList()}
sync();
window.__FY={ranked,odds,wOdds,S,FULLPASS_GATING,MC,vcol,gfile};
})();
