// Find Your Hunt: Utah (LOCAL PREVIEW). Same look and verdict cutoffs as the Colorado tool (../find/find.js).
// Odds come from Utah DWR's 2026 draw results (utahdraws.com/drawodds, 1st choice) and Utah's published draw rules:
//  - Preference-point hunts (general buck deer, most antlerless): permits go to the most points first, so the odds at
//    your points are what share of 2026 first-choice applicants at your points (or fewer) drew. More points never lowers it.
//  - Bonus-point hunts (limited-entry, once-in-a-lifetime, antlerless moose): Utah Admin. Rule R657-62-8. Half the permits
//    (the max-point quota) go to the highest point holders; the rest are drawn at random among everyone left, and each
//    applicant gets one random number plus one per bonus point, keeping the lowest. We replay that rule on DWR's own 2026
//    applicant counts and quotas to get the chance for one applicant at your points (build_utah.py, bonus_model).
//  - Draw-only youth elk: straight random draw, no points.
(function(){
const $=id=>document.getElementById(id);const Q=new URLSearchParams(location.search);
const MAXP=33;
let S={sp:'elk',pl:'elk-le',res:'res',pts:0,w:'',yo:0,priv:0,n:25,tab:'list',mv:null,mu:null,ol:null};
const SP={elk:'Elk',deer:'Deer',pronghorn:'Pronghorn',moose:'Moose',bison:'Bison',sheep:'Bighorn sheep',goat:'Mountain goat'};
const PL=UT_META.pools;const poolsOf=sp=>Object.keys(PL).filter(k=>PL[k][0]==sp);
const PT={bonus:'bonus points',pref:'preference points',lottery:'no points'};
const PSHORT={'elk-le':'Limited-entry bull','elk-yo':'Youth draw-only','elk-al':'Antlerless (cow)','deer-gen':'General-season buck','deer-le':'Limited-entry buck','deer-al':'Antlerless (doe)','pronghorn-le':'Limited-entry buck','pronghorn-al':'Doe','moose-oial':'Bull (once in a lifetime)','moose-al':'Antlerless','bison-oial':'Once in a lifetime','sheep-dbs':'Desert bighorn','sheep-rbs':'Rocky Mountain bighorn','goat-oial':'Once in a lifetime'};
const WN={'':'Any weapon',A:'Archery',M:'Muzzleloader',R:'Rifle (any legal weapon)'};
const wOK=h=>!S.w||h.w.includes(S.w);
const sumN=raw=>Object.values(raw||{}).reduce((a,x)=>a+x[0],0);
function odds(k){const h=UH[k],b=h.d[S.res];if(!b)return null;
 if(h.pt=='lottery')return S.yo?b.o[0]:null;
 const p=Math.min(S.pts,MAXP);let v=b.o[p];
 if(S.yo&&h.y&&h.y[S.res]){const y=h.y[S.res];if(sumN(y.raw)>=10&&y.o[p]!=null)v=Math.max(v??0,y.o[p])}
 return v??null}
const verdict=v=>v>=.995?"YES, you'll draw":v>=.75?'LIKELY':v>=.25?'MAYBE':v>=.05?'LONG SHOT':'NOT THIS YEAR';
const pct=v=>{const r=Math.round(v*100);return v>0&&r==0?'under 1%':v<1&&r==100?'over 99%':r+'%'};
function ranked(){return Object.keys(UH).filter(k=>{const h=UH[k];if(h.pool!=S.pl)return false;if(h.cw&&!S.priv)return false;if(!wOK(h))return false;const v=odds(k);return v!=null&&v>=.05})
 .map(k=>({k,v:odds(k)})).sort((a,b)=>b.v-a.v||((UH[b.k].hv||[])[3]??-1)-((UH[a.k].hv||[])[3]??-1)||a.k.localeCompare(b.k))}
const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dt=s=>{const [y,m,d]=s.split('-');return `${MO[+m-1]} ${+d}, ${y}`};
const wL=h=>h.cw?'CWMU (any legal weapon, CWMU dates)':h.ms?'Multi-season: '+h.wn.join(', '):h.wn.join(', ');
const land=h=>h.cw?'CWMU: private land, Utah residents only in the draw':'Public draw. Check land access (private land needs written permission)';
function title(k){const h=UH[k];return `${h.sex?`<b class="sx">${h.sex}</b> · `:''}${h.name} · ${wL(h)}`}
function succHTML(k,cls){const h=UH[k],x=h.hv;if(!x)return `<div class="${cls}"><b>No data</b> <span>for hunter success (not in Utah DWR's 2025 harvest report)</span></div>`;
 return `<div class="${cls}"><b>${Math.round(x[3])}%</b> <span>of hunters got one (Utah DWR, 2025 preliminary) · ${x[1].toLocaleString()} hunters${x[1]<30?' · <em class="ss">SMALL SAMPLE</em>':''}</span></div>`}
const ptsWord=()=>{const t=UH&&PL[S.pl][1];return t=='lottery'?'':`${S.pts} ${t=='bonus'?'bonus':'preference'} point${S.pts==1?'':'s'}`};
function oddsHTML(v,cls,k){const h=UH[k];return `<div class="${cls}"><b>${pct(v)}</b> <span>draw odds${h.pt=='lottery'?' (random draw, 2026)':' with '+ptsWord()+' (2027 estimate)'}</span></div>`}
function fee(h){return h.pool=='deer-gen'&&S.yo&&h.fy?h.fy:h.fee}
const money=n=>n==null?'not offered':'$'+n.toLocaleString();
function showList(){const r=ranked(),o=$('out');$('detail').hidden=true;o.hidden=false;if(M&&S.tab!='map'){M.remove();M=null}if(DM){DM.remove();DM=null}
 const who=`${SP[S.sp]} · ${PSHORT[S.pl]} · ${S.res=='res'?'Utah resident':'Out of state'}${PL[S.pl][1]=='lottery'?'':' · '+ptsWord()} · ${WN[S.w].toLowerCase()}${S.yo?' · youth':''}`;
 const tabs=`<div class="tabs" role="tablist"><button role="tab" class="tb${S.tab=='list'?' on':''}" aria-selected="${S.tab=='list'}" data-tab="list">List</button><button role="tab" class="tb${S.tab=='map'?' on':''}" aria-selected="${S.tab=='map'}" data-tab="map">Map</button></div>`;
 const note=`<p class="note">Odds are estimates for 2027 from Utah DWR's 2026 draw (1st choice only) and Utah's draw rules; how we figure them is under each hunt. Hunts under 5% aren't shown${S.priv?'':', and CWMU (private land) hunts are hidden (turn them on under More options)'}. Not a guarantee. Always check the Utah DWR guidebook before you apply.</p>`;
 const yoOnly=S.pl=='elk-yo'&&!S.yo?'<p class="dq"><b>Youth only.</b> This hunt is for hunters 17 or younger on July 31. Turn on "Yes, youth" under More options.</p>':'';
 if(S.tab=='map'){o.innerHTML=`<h2 id="lt">${r.length} hunt${r.length==1?'':'s'} you can draw</h2>${tabs}<p class="dq">${who}. Colored areas have at least one hunt you can draw; the color is the best odds there. Hunt areas can overlap, so smaller areas sit on top. Tap an area to see its hunts.</p>${yoOnly}`+
  `<div id="map" class="gmap" aria-label="Map of Utah hunt boundaries"></div><div id="mpanel" class="mp" hidden aria-live="polite"></div>`+
  `<div class="mleg"><span><i style="background:${VC[0][1]}"></i>YES</span><span><i style="background:${VC[1][1]}"></i>LIKELY</span><span><i style="background:${VC[2][1]}"></i>MAYBE</span><span><i style="background:${VC[3][1]}"></i>LONG SHOT</span><span><i style="background:${MC.none}"></i>Other hunt areas of this type</span></div>`+
  CRED+note+fbA('maps');wireTabs(o);drawMap(r);return}
 o.innerHTML=`<h2 id="lt">${r.length} hunt${r.length==1?'':'s'} you can draw</h2>${tabs}<p class="dq">${who}. Best odds first, down to long shots. Tap a hunt for details. Hunter success is from Utah DWR's 2025 preliminary harvest report.</p>${yoOnly}`+
  (S.sp=='elk'?`<p class="note"><b>No draw needed:</b> Utah sells general-season any bull and spike bull elk permits over the counter (2026: any bull from July 9, spike bull from July 16; $56 resident, $849 nonresident). Youth general-season elk permits are unlimited (from July 7). Source: <a href="https://wildlife.utah.gov/guidebooks/biggameapp.pdf">2026 Utah Big Game Application Guidebook</a>, pages 13 and 15.</p>`:'')+
  `<ol class="fl">`+r.slice(0,S.n).map((x,i)=>`<li><button class="fh" data-k="${x.k}"><span class="rk">${i+1}</span><span class="fv">${vdot(x.v)}${verdict(x.v)}</span><span class="ft">${title(x.k)}</span><span class="fd">${land(UH[x.k])}</span>${oddsHTML(x.v,'fo',x.k)}${succHTML(x.k,'fs')}</button></li>`).join('')+`</ol>`+
  (r.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(25,r.length-S.n)} more (${r.length-S.n} left)</button>`:'')+
  (r.length||yoOnly?'':'<p class="dq">No hunts at 5% or better with these choices. Try fewer filters, or check back as you build points.</p>')+note+fbA('find');
 wireTabs(o);o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>openHunt(b.dataset.k));
 if($('more'))$('more').onclick=()=>{S.n+=25;history.replaceState(st('list'),'',url());showList()}}
const CRED='<p class="mapcred"><b>Hunt boundaries: Utah Division of Wildlife Resources.</b> Lines are simplified and approximate. Check the Utah DWR guidebook or the Utah Hunt Planner (hunt.utah.gov) for official boundaries before you apply or hunt.</p>';
// ===== Map (same brand palette and buckets as Colorado) =====
const MC={yes:'#263E2C',likely:'#6F7F4F',maybe:'#C4B28C',long:'#D2501F',none:'#E8E0D2',line:'#1E1E1C',bg:'#2A2D26',sel:'#E8E0D2'};
const VC=[[.995,MC.yes],[.75,MC.likely],[.25,MC.maybe],[.05,MC.long]];
const vcol=v=>(VC.find(c=>v>=c[0])||[0,MC.none])[1];const vdot=v=>`<i class="vdot" style="background:${vcol(v)}"></i>`;
function halo(m,ls){const g=L.layerGroup().addTo(m);ls.forEach(l=>{g.addLayer(L.geoJSON(l.feature,{interactive:false,style:{fill:false,color:MC.line,weight:7}}));g.addLayer(L.geoJSON(l.feature,{interactive:false,style:{fill:false,color:MC.sel,weight:3}}))});return g}
let M=null,GJ=null,DM=null;
function wireTabs(o){o.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(S.tab==b.dataset.tab)return;S.tab=b.dataset.tab;S.mv=null;S.mu=null;S.ol=null;history.pushState(st('list'),'',url());showList();top2($('out'))})}
const loadJS=src=>new Promise((ok,no)=>{const e=document.createElement('script');e.src=src;e.onload=ok;e.onerror=no;document.head.appendChild(e)});
async function ensureMap(){if(!window.L){const c=document.createElement('link');c.rel='stylesheet';c.href='../find/vendor/leaflet.css';document.head.appendChild(c);await loadJS('../find/vendor/leaflet.js')}
 if(!window.topojson)await loadJS('../find/vendor/topojson-client.min.js');if(!GJ){const t=await(await fetch('bnd.json')).json();GJ=topojson.feature(t,t.objects[Object.keys(t.objects)[0]]);GJ.features.sort((a,b)=>b.properties.a-a.properties.a)}}
const bname=u=>{const f=GJ&&GJ.features.find(f=>f.properties.u==u);return f?f.properties.n:'Hunt area'};
function byUnit(r){const m={};r.forEach(x=>UH[x.k].b.forEach(u=>{u=String(u);(m[u]=m[u]||[]).push(x)}));return m}
const poolB=()=>{const s=new Set();Object.values(UH).forEach(h=>{if(h.pool==S.pl&&(!h.cw||S.priv))h.b.forEach(u=>s.add(String(u)))});return s};
function popHTML(u,h){return `<div class="mp"><p class="mpt">${bname(u)} · best odds: ${vdot(h[0].v)}<b>${verdict(h[0].v)}</b></p><p class="mps">${h.length} hunt${h.length==1?'':'s'} you can draw here</p><ul>`+h.map(x=>{const d=UH[x.k];
 return `<li><button class="mh" data-k="${x.k}">${vdot(x.v)}<b>${x.k}</b> · ${verdict(x.v)} · ${pct(x.v)}<span>${d.sex?d.sex+' · ':''}${d.name} · ${wL(d)}</span></button></li>`}).join('')+'</ul></div>'}
let SEL=null,PY=null;
function pick(u,h,l){if(SEL)SEL.remove();SEL=halo(M,[l]);S.mu=String(u);const pn=$('mpanel');pn.hidden=false;pn.innerHTML=popHTML(u,h);pn.querySelectorAll('.mh').forEach(b=>b.onclick=()=>openHunt(b.dataset.k));
 const s0=history.state;if(s0&&s0.v=='list')history.replaceState(st('list'),'',url())}
async function drawMap(r){SEL=null;const el=$('map');if(!el)return;try{await ensureMap()}catch(e){el.innerHTML='<p class="dq">The map could not load. Use the List tab.</p>';return}
 if(!el.isConnected)return;if(M){M.remove();M=null}
 M=L.map(el,{zoomSnap:.25,minZoom:5.5,maxZoom:11,scrollWheelZoom:false,tap:true});window.__UT.map=M;
 M.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>').addAttribution('Hunt boundaries: Utah Division of Wildlife Resources');
 const bu=byUnit(r),pb=poolB(),cnt={hl:0};
 const fc={type:'FeatureCollection',features:GJ.features.filter(f=>pb.has(String(f.properties.u)))};
 const ly=L.geoJSON(fc,{style:f=>{const h=bu[f.properties.u];return{color:MC.sel,opacity:.55,weight:.8,fillColor:h?vcol(h[0].v):MC.none,fillOpacity:h?1:.25}},
  onEachFeature:(f,l)=>{const u=f.properties.u,h=bu[u];if(!h){l.options.interactive=false;return}cnt.hl++;
   l.bindTooltip(f.properties.n,{sticky:true,direction:'top'});l.on('click',()=>{pick(u,h,l);const pn=$('mpanel'),b=pn.getBoundingClientRect();if(b.top>innerHeight-80)scrollBy({top:b.top-innerHeight*.45,behavior:'instant'})})}}).addTo(M);
 ly.eachLayer(l=>{if(bu[l.feature.properties.u])l.bringToFront()});
 window.__UT.hl=cnt.hl;const all=L.geoJSON(GJ);M.setMaxBounds(all.getBounds().pad(.3));
 if(S.mv)M.setView([S.mv[0],S.mv[1]],S.mv[2]);else M.fitBounds(all.getBounds(),{padding:[4,4]});
 if(S.ol){const g=[];ly.eachLayer(l=>{if(S.ol.includes(String(l.feature.properties.u)))g.push(l)});halo(M,g);window.__UT.ol=g.length;if(g.length&&!S.mv)M.fitBounds(L.featureGroup(g).getBounds().pad(.6),{maxZoom:9})}
 if(S.mu!=null)ly.eachLayer(l=>{if(String(l.feature.properties.u)==String(S.mu)&&bu[S.mu])pick(S.mu,bu[S.mu],l)});if(PY!=null){const y=PY;PY=null;requestAnimationFrame(()=>scrollTo(0,y))}
 M.on('moveend',()=>{const c=M.getCenter();S.mv=[+c.lat.toFixed(4),+c.lng.toFixed(4),M.getZoom()];const s0=history.state;if(s0&&s0.v=='list')history.replaceState(st('list'),'',url())})}
function qy(h){const y=(h.yq||[0,0])[S.res=='res'?0:1];return y>0?`, ${y.toLocaleString()} of them set aside for youth`:''}
function qt(h,b){const y=(h.yq||[0,0])[S.res=='res'?0:1],who=S.res=='res'?'residents':'nonresidents';return `2026 permits for ${who}: ${b.q.toLocaleString()}`+(y>0?`, including ${y.toLocaleString()} set aside for youth hunters (${(b.q-y).toLocaleString()} for adults). <span class="yq">Utah's draw-odds page may list only the adult share (${(b.q-y).toLocaleString()}) as the quota; both numbers are Utah DWR's.</span> `:'. ')}
function how(h){if(h.pt=='bonus')return `<p class="how"><b>How Utah draws this hunt (bonus points):</b> half of the permits are reserved for the applicants with the most bonus points. The other half are drawn at random among everyone left, and you get one random number for applying plus one for each bonus point, so points help in both halves (Utah Admin. Rule R657-62-8). Your odds above are a 2027 estimate. We replay that rule with the 2026 permit numbers two ways: on Utah DWR's 2026 applicants as they were, and with everyone who didn't draw moved up one point (point creep). We show the lower of the two. The table below is the actual 2026 draw.</p>`;
 if(h.pt=='pref')return `<p class="how"><b>How Utah draws this hunt (preference points):</b> permits go to the applicants with the most preference points first, with ties broken at random (Utah Admin. Rule R657-62-9). Your odds above are a 2027 estimate. We hand out the 2026 number of permits by points two ways: to Utah DWR's 2026 first-choice applicants as they were, and with everyone who didn't draw moved up one point (point creep). We show the lower of the two. Lifetime license holders, who are drawn first, are left out. The table below is the actual 2026 draw.</p>`;
 return `<p class="how"><b>How Utah draws this hunt:</b> a straight random draw among youth applicants. Points aren't used. Your odds above are the share of 2026 applicants who drew.</p>`}
function showDetail(k){const h=UH[k],v=odds(k),o=$('detail');$('out').hidden=true;o.hidden=false;const b=h.d[S.res];
 let lad='',sure='',tbl='';
 if(b&&h.pt!='lottery'){const mx=Math.min(MAXP,Math.max(S.pts,...Object.keys(b.raw).map(Number),0)+2);const ks=[...Array(mx+1).keys()];
  lad=`<p class="lh">Odds by points (2027 estimate)</p><div class="lad">`+ks.map(n=>{const z=b.o[n];return `<div class="lr${n==Math.min(S.pts,MAXP)?' on':''}"><span class="ln">${n} pts</span><span class="lb"><i style="width:${z==null?0:Math.max(Math.round(z*100),1)}%"></i></span><span class="lz">${z==null?'no data':pct(z)}</span></div>`}).join('')+'</div>';
  const s=b.o.findIndex(z=>z!=null&&z>=.995);sure=`<p class="dq"><b>${s>=0?`Our 2027 estimate: about ${s} point${s==1?'':'s'} to be sure to draw.`:'No point level is a sure draw in our 2027 estimate.'}</b>${h.pt=='bonus'&&s>0?' Below that, you are in the random half, where each point is one more random number.':''}</p>`;
  const rows=Object.entries(b.raw).map(([p,x])=>[+p,x]).sort((a,c)=>c[0]-a[0]);
  tbl=`<h3>2026 draw at your residency (1st choice, Utah DWR)</h3><table class="dt"><tr><th>Points</th><th>Applied</th><th>Drew</th>${h.pt=='bonus'?'<th>Top-points half</th><th>Random half</th>':''}</tr>`+rows.map(([p,x])=>`<tr${p==S.pts?' class="on"':''}><td>${p}</td><td>${x[0].toLocaleString()}</td><td>${x[1].toLocaleString()}</td>${h.pt=='bonus'?`<td>${x[2]}</td><td>${x[3]}</td>`:''}</tr>`).join('')+'</table>'+
   `<p class="note">${Object.values(b.raw).some(x=>x[4])?`Includes ${Object.values(b.raw).reduce((a,x)=>a+x[4],0)} lifetime license holders, who are drawn first. `:''}${h.pt=='bonus'?`2026 permits for ${S.res=='res'?'residents':'nonresidents'}: ${b.q} (${b.mp} top-points, ${b.rg} random). `:qt(h,b)}Source: <a href="https://utahdraws.com/drawodds">Utah DWR draw odds, 2026</a>.</p>`}
 else if(b){const n=sumN(b.raw),d=Object.values(b.raw).reduce((a,x)=>a+x[1],0);tbl=`<h3>2026 draw (Utah DWR)</h3><p class="dq">${d.toLocaleString()} of ${n.toLocaleString()} ${S.res=='res'?'resident':'nonresident'} applicants drew (${b.q} permits)${qy(h)}. Source: <a href="https://utahdraws.com/drawodds">Utah DWR draw odds, 2026</a>.</p>`}
 const f=fee(h),ss=h.seas.map(s=>`<div class="yr"><b>${dt(s[0])} – ${dt(s[1])}</b><span>${s[2]}</span></div>`).join('');
 const bk=S.tab=='map'?'← Back to my map':'← Back to my list';if(M){M.remove();M=null}if(DM){DM.remove();DM=null}
 o.innerHTML=`<button class="btn big2" id="back">${bk}</button>
 <div class="yo"><p class="yt">Your odds</p><p class="tg">${title(k)}</p><div class="vd">${vdot(v??0)}${v==null?'NO DATA':verdict(v)}</div>${v==null?'':oddsHTML(v,'fo',k)}${sure}${succHTML(k,'fs')}<p class="note hvn">Hunter success comes from Utah DWR's <a href="https://wildlife.utah.gov/biggame/reports">2025 preliminary harvest report</a>. Utah DWR may revise these numbers in the final report.</p><p class="dq">${land(h)}</p></div>${how(h)}${lad}${tbl}
 ${h.h25?`<h3>2025 draw (1st choice, Utah DWR)</h3><div class="yr"><b>Residents</b><span>${h.h25[1]} drew of ${h.h25[0].toLocaleString()} applied</span></div><div class="yr"><b>Nonresidents</b><span>${h.h25[3]} drew of ${h.h25[2].toLocaleString()} applied</span></div><p class="note">Source: Utah DWR 2025 drawing odds reports (<a href="https://wildlife.utah.gov/biggame/odds">wildlife.utah.gov/biggame/odds</a>).</p>`:''}
 <h3>2026 season</h3>${ss||'<p class="dq">See the Utah DWR guidebook.</p>'}
 ${f?`<h3>Permit fee (2026)</h3><div class="yr"><b>Resident</b><span>${money(f[0])}</span></div><div class="yr"><b>Nonresident</b><span>${f[1]==null&&h.cw?"CWMU operator only":money(f[1])}</span></div><p class="note">Plus a $10 resident / $21 nonresident application fee and a hunting license.${h.cw&&h.pool=='deer-le'?' Premium CWMU buck deer permits are $185 resident / $1,398 nonresident.':''}${h.cw&&f[1]==null?' Nonresidents can get CWMU permits only through the CWMU operator.':''} Source: ${h.fs=='al'?'<a href="https://wildlife.utah.gov/guidebooks/antlerless_guidebook.pdf">2026 Utah Antlerless Application Guidebook</a>, hunt tables':'<a href="https://wildlife.utah.gov/guidebooks/biggameapp.pdf">2026 Utah Big Game Application Guidebook</a>, pages 15–16'}.</p>`:''}
 <h3>Where this hunt is</h3><div id="dmap" class="gmap dm" aria-label="Map of this hunt's boundary"></div>${CRED}
 <p><button class="btn o" id="vsm">View on statewide map</button> <a class="btn o" href="${h.map}" target="_blank" rel="noopener">Official boundary (Utah Hunt Planner)</a></p>
 <p class="note">Hunt number <b>${k}</b>. Estimates from Utah DWR's past draw and harvest reports, not a guarantee. Check the Utah DWR guidebook before you apply.</p>
 <p><a class="btn" href="../packages.html">Scouting help for this hunt</a></p>${fbA('find')}<button class="btn o big2" id="back2">${bk}</button>`;
 $('back').onclick=$('back2').onclick=goBack;$('vsm').onclick=()=>{S.tab='map';S.mv=null;S.mu=null;S.ol=h.b.map(String);history.pushState(st('list'),'',url());showList();top2($('out'))};
 drawDetailMap(k);top2(o)}
async function drawDetailMap(k){const el=$('dmap');try{await ensureMap()}catch(e){el.innerHTML='<p class="dq">The map could not load.</p>';return}if(!el.isConnected)return;if(DM){DM.remove();DM=null}
 const us=new Set(UH[k].b.map(String)),pb=poolB();DM=L.map(el,{zoomSnap:.25,minZoom:5.5,maxZoom:11,scrollWheelZoom:false,dragging:!L.Browser.mobile,tap:false});window.__UT.dmap=DM;
 DM.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>').addAttribution('Hunt boundaries: Utah Division of Wildlife Resources');
 const on=[],v=odds(k)??0;const fc={type:'FeatureCollection',features:GJ.features.filter(f=>pb.has(String(f.properties.u))||us.has(String(f.properties.u)))};
 L.geoJSON(fc,{interactive:false,style:f=>us.has(String(f.properties.u))?{color:MC.sel,weight:2.5,fillColor:vcol(v),fillOpacity:1}:{color:MC.sel,opacity:.3,weight:.5,fillColor:MC.none,fillOpacity:.25},
  onEachFeature:(f,l)=>{if(us.has(String(f.properties.u))){on.push(l)}}}).addTo(DM);
 on.forEach(l=>{l.bringToFront();l.bindTooltip(l.feature.properties.n,{permanent:true,direction:'center',className:'ulab'})});
 window.__UT.dlab=on.map(l=>String(l.feature.properties.u));const all=L.geoJSON(GJ);if(on.length)DM.fitBounds(L.featureGroup(on).getBounds(),{padding:[18,18],maxZoom:9});else DM.fitBounds(all.getBounds())}
const fbA=about=>`<p class="fbk"><a class="fbl" href="../feedback.html?about=${about}" data-about="${about}">Something off? Tell us</a></p>`;
const top2=e=>{const h=document.querySelector('header');scrollTo({top:e.getBoundingClientRect().top+scrollY-((h&&getComputedStyle(h).position=='sticky')?h.offsetHeight:0)-12,behavior:'instant'})};
const st=(v,k)=>({v,k,sp:S.sp,pl:S.pl,res:S.res,pts:S.pts,w:S.w,yo:S.yo,priv:S.priv,n:S.n,tab:S.tab,mv:S.mv,mu:S.mu,ol:S.ol,y:v=='list'?scrollY:0});
const url=k=>{const u=new URLSearchParams({sp:S.sp,pl:S.pl,r:S.res,p:S.pts});if(S.w)u.set('w',S.w);if(S.yo)u.set('kid',1);if(S.priv)u.set('priv',1);if(k)u.set('h',k);if(S.tab=='map')u.set('tab','map');return '?'+u+'#'+(k?'hunt':S.tab=='map'?'map':'list')};
let fromList=false;
function openHunt(k){history.replaceState(st('list'),'',url());history.pushState(st('detail',k),'',url(k));fromList=true;showDetail(k)}
function goBack(){if(fromList)history.back();else{history.replaceState(st('list'),'',url());showList();top2($('out'))}}
function apply(s){Object.assign(S,{sp:s.sp,pl:s.pl,res:s.res,pts:+s.pts,w:s.w||'',yo:+s.yo||0,priv:+s.priv||0,n:+s.n||25,tab:s.tab=='map'?'map':'list',mv:s.mv||null,mu:s.mu??null,ol:s.ol||null});sync()}
function sync(){if(!PL[S.pl]||PL[S.pl][0]!=S.sp)S.pl=poolsOf(S.sp)[0];
 $('pools').innerHTML=poolsOf(S.sp).map(k=>`<button data-pl="${k}" class="${k==S.pl?'on':''}">${PSHORT[k]}<br><span class="ptl">${PT[PL[k][1]]}</span></button>`).join('');
 $('pools').querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>{S.pl=b.dataset.pl;sync()});
 const t=PL[S.pl][1];$('pnote').textContent=PL[S.pl][2]+': '+(t=='bonus'?'uses your bonus points for this species.':t=='pref'?'uses your preference points for this hunt type.':'random draw, youth only.');
 $('plbl').textContent=t=='bonus'?'5. How many bonus points do you have for this species?':'5. How many preference points do you have for this hunt type?';
 $('ptsbox').hidden=t=='lottery';$('lotnote').hidden=t!='lottery';
 document.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('on',x.dataset.sp==S.sp));document.querySelectorAll('[data-res]').forEach(x=>x.classList.toggle('on',x.dataset.res==S.res));
 document.querySelectorAll('[data-yo]').forEach(x=>x.classList.toggle('on',+x.dataset.yo==S.yo));$('pv').textContent=S.pts;$('priv').checked=!!S.priv;
 document.querySelectorAll('[data-w]').forEach(x=>x.classList.toggle('on',x.dataset.w==S.w));if($('ynote'))$('ynote').hidden=!S.yo}
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a.fbl');if(a)a.href='../feedback.html?about='+a.dataset.about+'&from='+encodeURIComponent(location.href)},true);
addEventListener('popstate',e=>{const s=e.state;if(!s){$('out').hidden=true;$('detail').hidden=true;return}apply(s);
 if(s.v=='detail'){fromList=false;showDetail(s.k)}else{PY=s.tab=='map'?s.y||0:null;showList();requestAnimationFrame(()=>scrollTo(0,s.y||0))}});
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;sync()});
document.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{S.res=b.dataset.res;sync()});
document.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{S.w=b.dataset.w;sync()});
document.querySelectorAll('[data-yo]').forEach(b=>b.onclick=()=>{S.yo=+b.dataset.yo;sync()});
$('priv').onchange=()=>{S.priv=$('priv').checked?1:0};
const step=x=>{S.pts=Math.max(0,Math.min(MAXP,S.pts+x));$('pv').textContent=S.pts};$('pm').onclick=()=>step(-1);$('pp').onclick=()=>step(1);
$('go').onclick=()=>{S.n=25;S.mv=null;S.mu=null;S.ol=null;history.pushState(st('list'),'',url());showList();top2($('out'))};
if(Q.get('sp')&&typeof UH!='undefined'){const sp=SP[Q.get('sp')]?Q.get('sp'):'elk',pl=PL[Q.get('pl')]&&PL[Q.get('pl')][0]==sp?Q.get('pl'):poolsOf(sp)[0];
 apply({sp,pl,res:Q.get('r')=='nonres'?'nonres':'res',pts:Math.max(0,Math.min(MAXP,+Q.get('p')||0)),w:'AMR'.includes(Q.get('w')||'-')?Q.get('w'):'',yo:Q.get('kid')?1:0,priv:Q.get('priv')?1:0,n:25,tab:Q.get('tab')=='map'||location.hash=='#map'?'map':'list'});
 const h=Q.get('h');history.replaceState(st('list'),'',url());if(h&&UH[h]&&UH[h].pool==S.pl){history.pushState(st('detail',h),'',url(h));fromList=true;showDetail(h)}else showList()}
sync();
window.__UT={ranked,odds,S,MC,vcol,fee};
})();
