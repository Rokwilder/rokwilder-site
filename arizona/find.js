// Find Your Hunt: Arizona. Same look and verdict cutoffs as the Colorado and Utah tools.
// Odds come from AZGFD's own 2026 draw reports (Bonus Point Report, Bonus Pass and 1-2 Pass draw reports, 1st choice) and
// Arizona's draw rule R12-4-114(C)(2): up to 20% of each hunt's tags go first to the applicants with the most bonus points
// (1st or 2nd choice); the rest are drawn at random, and every application gets one random number plus one more for each
// bonus point (bonus, loyalty and hunter education points all count), keeping the lowest. build_az.py replays that rule on
// AZGFD's applicant counts by points. See arizona/tools in the research folder.
(function(){
const $=id=>document.getElementById(id);const Q=new URLSearchParams(location.search);
const MAXP=AZ_META.maxp;const SRC=AZ_META.src;
let S={sp:'elk',pl:'elk-bull',res:'res',pts:0,w:'',yo:0,champ:0,n:25,tab:'list',mu:null};
const SP={elk:'Elk',pronghorn:'Pronghorn',deer:'Deer',turkey:'Turkey',javelina:'Javelina',sheep:'Bighorn sheep',bison:'Bison',crane:'Sandhill crane',bear:'Black bear'};
const PL=AZ_META.pools;const poolsOf=sp=>Object.keys(PL).filter(k=>PL[k][0]==sp);
const PSHORT={'elk-bull':'Bull','elk-cow':'Antlerless','elk-any':'Any elk','ph':'Buck pronghorn','deer-ad':'Any antlered deer','deer-mule':'Antlered mule deer','deer-wt':'Antlered whitetail','deer-al':'Antlerless or any deer','turkey-s':'Spring','turkey-f':'Fall','jav-s':'Spring','jav-f':'Fall','sheep-d':'Desert bighorn','sheep-rm':'Rocky Mountain bighorn','bison':'Bison','crane':'Sandhill crane'};
const WN={'':'Any weapon',R:'General (any legal weapon)',A:'Archery only',M:'Muzzleloader',H:'HAM (handgun, archery, muzzleloader)',S:'Shotgun shooting shot'};
const DRAW={M:'elk and pronghorn draw',F:'fall draw',S:'spring draw'};
const VERD=v=>v>=.995?"YES, you'll draw":v>=.75?'LIKELY':v>=.25?'MAYBE':v>=.05?'LONG SHOT':'NOT THIS YEAR';
const pct=v=>{const r=Math.round(v*100);return v>0&&r==0?'under 1%':v<1&&r==100?'over 99%':r+'%'};
const AHk=Object.keys(AH);
const avail=h=>(h.t!='youth'||S.yo)&&(h.t!='champ'||S.champ);
const wOK=h=>!S.w||h.w==S.w;
function odds(k){const h=AH[k];if(!h.od)return null;const b=h.od[S.res];if(!b)return null;return b.o[Math.min(S.pts,MAXP)]}
function ranked(){return AHk.filter(k=>{const h=AH[k];if(h.pool!=S.pl||!avail(h)||!wOK(h))return false;const v=odds(k);return v!=null&&v>=.05})
 .map(k=>({k,v:odds(k)})).sort((a,b)=>b.v-a.v||((AH[b.k].hv||[])[3]??-1)-((AH[a.k].hv||[])[3]??-1)||a.k.localeCompare(b.k))}
const noHist=()=>AHk.filter(k=>{const h=AH[k];return h.pool==S.pl&&avail(h)&&wOK(h)&&!h.od});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const tag=h=>(h.t=='youth'?'<b class="yb">YOUTH ONLY</b> ':'')+(h.t=='champ'?'<b class="yb">CHAMP</b> ':'')+(h.t=='lo'?'<b class="sx">Limited opportunity</b> · ':'');
function title(k){const h=AH[k];return `${tag(h)}${esc(h.legal)} · ${esc(h.area)} · ${WN[h.w]}`}
function succHTML(k,cls){const h=AH[k],x=h.hv;if(!x||x[3]==null)return `<div class="${cls}"><b>No data</b> <span>for hunter success (no matching hunt in AZGFD's latest harvest summary)</span></div>`;
 return `<div class="${cls}"><b>${x[3]}%</b> <span>of hunters got one (AZGFD ${x[0]} harvest summary) · ${x[1].toLocaleString()} hunters${x[1]<30?' · <em class="ss">SMALL SAMPLE</em>':''}</span></div>`}
const ptsWord=()=>`${S.pts} point${S.pts==1?'':'s'}`;
const nextDraw=h=>h.dr=='M'?'2027 elk and pronghorn draw':h.dr=='F'?'2027 fall draw':'next spring draw';
function oddsHTML(v,cls,k){const h=AH[k];return `<div class="${cls}"><b>${pct(v)}</b> <span>draw odds with ${ptsWord()} (estimate for the ${nextDraw(h)})</span></div>`}
const fee=h=>h.fee;const money=n=>'$'+n.toLocaleString();
const vcolList=[[.995,'#263E2C'],[.75,'#6F7F4F'],[.25,'#C4B28C'],[.05,'#D2501F']];
const MC={yes:'#263E2C',likely:'#6F7F4F',maybe:'#C4B28C',long:'#D2501F',none:'#E8E0D2'};
const vcol=v=>(vcolList.find(c=>v>=c[0])||[0,MC.none])[1];const vdot=v=>`<i class="vdot" style="background:${vcol(v)}"></i>`;
const bk=(d,pg)=>{const t={M:'2026 Pronghorn and Elk Regulations',F:'2026–27 Arizona Hunting Regulations',S:'2027 Spring Hunting Regulations'}[d];return `<a href="${SRC.bk[d]}">${t}</a>${pg?' ('+(typeof pg=='number'?'PDF page '+pg:pg)+')':''}`};
const rep=d=>{const s=SRC[{M:'M26',F:'F26',S:'S26'}[d]];const n={M:'2026 elk and pronghorn',F:'2026 fall',S:'2026 spring'}[d];return `AZGFD ${n} draw reports: <a href="${s.bp}">Bonus Point Report</a>, <a href="${s.bonus}">Bonus Pass</a>, <a href="${s.p12}">1-2 Pass</a>`};
const gmu=u=>`https://www.azgfd.com/location/gmu-${u.toLowerCase()}/`;
const RG=AZ_META.regions;const RGN={I:'Region I (Pinetop)',II:'Region II (Flagstaff)',III:'Region III (Kingman)',IV:'Region IV (Yuma)',V:'Region V (Tucson)',VI:'Region VI (Mesa)'};
const RGU=r=>`https://www.azgfd.com/location-type/region-${r.toLowerCase()}-gmus/`;
// Youth box: what a youth can get for this species
function youthBox(){const sp=S.sp;if(sp=='bear')return '';
 const yo=AHk.filter(k=>AH[k].sp==sp&&AH[k].t=='youth');
 if(!S.yo)return yo.length?`<p class="note ybox"><b>Hunting with a youth (under 18)?</b> Arizona has ${yo.length} youth-only ${SP[sp].toLowerCase()} hunts. Turn on "Yes, youth" in step 6 to see them.</p>`:'';
 const li=[];const fy={elk:'$63 resident, $65 nonresident',deer:'$38 resident, $40 nonresident',javelina:'$28 resident, $30 nonresident',turkey:'$23 resident, $25 nonresident'}[sp];
 if(yo.length)li.push(`<b>Youth-only hunts:</b> ${yo.length} ${SP[sp].toLowerCase()} hunt${yo.length==1?'':'s'} in the current booklets${yo.some(k=>AH[k].pool==S.pl)?', listed below with the rest':'. None are in the hunt type you picked; try another type in step 2'}. Youth hunters can take part up to their 18th birthday. A youth who turns 18 after opening day can finish that youth-only hunt.`);
 else li.push(`${SP[sp]} has no youth-only draw hunts in the current booklets. Youth draw with everyone else, using the same points.`);
 if(fy)li.push(`<b>Youth-only fee:</b> ${fy} (includes the application fee). A youth pays the regular fee if the application also lists a regular hunt.`);
 if(sp=='turkey')li.push('<b>No draw needed:</b> a youth-only fall turkey nonpermit-tag is sold over the counter ($10) for the youth-only nonpermit fall hunt in Units 4A, 4B, 6A and 27.');
 li.push('<b>Age rules:</b> no one under 10 may hunt big game in Arizona. Ages 10 through 13 must finish a hunter education course first. A youth combination hunt and fish license (ages 10–17) is $5.');
 return `<div class="note ybox"><p><b>Youth (under 18): what's available</b></p><ul>${li.map(x=>`<li>${x}</li>`).join('')}</ul><p class="note">Source: ${bk('F','PDF pages 7 and 24')}.</p></div>`}
function spNote(){const sp=S.sp;
 if(sp=='elk'||sp=='pronghorn')return `<p class="note"><b>Next draw:</b> the 2027 elk and pronghorn draw. AZGFD usually posts the booklet in early January with a deadline in February (2026 was Feb. 3, 2026, 11:59 p.m. Arizona time). Your odds use the 2026 hunts and permit numbers until the 2027 booklet is out.${sp=='elk'?' <b>No draw needed:</b> elk nonpermit-tags are sold over the counter for some areas ($135 resident, $650 nonresident). They aren\'t listed here.':''} Source: ${bk('M','PDF pages 3–5')}.</p>`;
 if(sp=='deer'||sp=='sheep'||sp=='bison'||sp=='crane'||S.pl=='turkey-f'||S.pl=='jav-f')return `<p class="note"><b>Next draw:</b> the 2027 fall draw (deer, fall turkey, fall javelina, bighorn sheep, fall bison, sandhill crane). AZGFD usually posts the booklet in early May with a deadline in June (2026 was June 2, 2026, 11:59 p.m. Arizona time). Your odds use the 2026–27 hunts and permit numbers until the new booklet is out.${sp=='deer'?' <b>No draw needed:</b> archery-only deer nonpermit-tags are sold over the counter ($45 resident, $300 nonresident; nonresident tags are capped). They aren\'t listed here.':''}${S.pl=='turkey-f'?' <b>No draw needed:</b> archery turkey nonpermit-tags ($25 resident, $90 nonresident) are sold over the counter for the archery-only nonpermit seasons.':''}${S.pl=='jav-f'?' <b>No draw needed:</b> javelina nonpermit-tags ($25 resident, $100 nonresident) are sold over the counter for the archery-only nonpermit seasons.':''} Source: ${bk('F','PDF pages 6–7')}.</p>`;
 if(S.pl=='turkey-s'||S.pl=='jav-s')return `<p class="note"><b>Next draw:</b> the 2027 spring draw closed Oct. 6, 2026, and results are out, so the next chance is the spring draw in fall 2027 (for 2028 hunts). AZGFD usually posts that booklet in early September with a deadline in October. Hunts and permits shown are from the 2027 spring booklet. Odds use AZGFD's 2026 spring draw (the latest with published reports), with a guard for more applicants: 1st-choice applicants rose a median ${Math.round(AZ_META.grow.S*100)}% from the 2025 to the 2026 spring draw.${S.pl=='turkey-s'?' <b>No draw needed:</b> archery turkey nonpermit-tags ($25 resident, $90 nonresident).':' <b>No draw needed:</b> javelina nonpermit-tags for the archery-only nonpermit seasons ($25 resident, $100 nonresident).'} Source: ${bk('S','PDF pages 4–5')}.</p>`;
 return ''}
function bearNote(){return `<div class="note"><p><b>Arizona black bear has no draw.</b> Every bear hunt in the 2026–27 fall booklet and the 2027 spring booklet is a nonpermit-tag hunt: you buy a bear tag over the counter ($25 resident, $150 nonresident) and hunt the open units until the season ends or the unit's female harvest limit is reached. You must check that the unit is still open before you hunt. Source: ${bk('F','PDF pages 7 and 46')}, ${bk('S','PDF page 21')}.</p></div>`}
function showList(){const o=$('out');$('detail').hidden=true;o.hidden=false;
 if(S.sp=='bear'){o.innerHTML=`<h2 id="lt">Black bear</h2>${bearNote()}${fbA('find')}`;return}
 const r=ranked(),nh=noHist();
 const who=`${SP[S.sp]} · ${PSHORT[S.pl]} · ${S.res=='res'?'Arizona resident':'Out of state'} · ${ptsWord()} · ${WN[S.w].toLowerCase()}${S.yo?' · youth':''}`;
 const tabs=`<div class="tabs" role="tablist"><button role="tab" class="tb${S.tab=='list'?' on':''}" aria-selected="${S.tab=='list'}" data-tab="list">List</button><button role="tab" class="tb${S.tab=='map'?' on':''}" aria-selected="${S.tab=='map'}" data-tab="map">Map</button></div>`;
 const note=`<p class="note">Odds are estimates from AZGFD's 2026 draw reports (1st choice only) and Arizona's draw rules; how we figure them is under each hunt. Hunts under 5% aren't shown${S.champ?'':', and CHAMP hunts are hidden (turn them on under More options)'}.${nh.length?` ${nh.length} hunt${nh.length==1?' has':'s have'} no usable 2026 draw record and ${nh.length==1?'isn\'t':'aren\'t'} ranked.`:''} Not a guarantee. Always check the AZGFD regulations before you apply.</p>`;
 if(S.tab=='map'){o.innerHTML=`<h2 id="lt">${r.length} hunt${r.length==1?'':'s'} you can draw</h2>${tabs}<p class="dq">${who}. Units are grouped by AZGFD region, not drawn to scale. The color is the best odds for a hunt that includes that unit. Tap a unit to see its hunts.</p>`+youthBox()+tiles(r)+
  `<div id="mpanel" class="mp" hidden aria-live="polite"></div><div class="mleg"><span><i style="background:${MC.yes}"></i>YES</span><span><i style="background:${MC.likely}"></i>LIKELY</span><span><i style="background:${MC.maybe}"></i>MAYBE</span><span><i style="background:${MC.long}"></i>LONG SHOT</span><span><i style="background:${MC.none}"></i>No hunt you can draw</span></div>`+
  `<p class="mapcred">This is a list by unit, not a map. For unit boundaries, use AZGFD's official unit maps: ${Object.keys(RG).map(g=>`<a href="${RGU(g)}">Region ${g}</a>`).join(' · ')}.</p>`+note+fbA('maps');wireTabs(o);wireTiles(o,r);if(S.mu)pickU(S.mu,r);return}
 o.innerHTML=`<h2 id="lt">${r.length} hunt${r.length==1?'':'s'} you can draw</h2>${tabs}<p class="dq">${who}. Best odds first, down to long shots. Tap a hunt for details.</p>`+youthBox()+spNote()+
  `<ol class="fl">`+r.slice(0,S.n).map((x,i)=>`<li><button class="fh" data-k="${x.k}"><span class="rk">${i+1}</span><span class="fv">${vdot(x.v)}${VERD(x.v)}</span><span class="ft">${title(x.k)}</span><span class="fd">Hunt ${AH[x.k].n} · ${esc(AH[x.k].d)}</span>${oddsHTML(x.v,'fo',x.k)}${succHTML(x.k,'fs')}</button></li>`).join('')+`</ol>`+
  (r.length>S.n?`<button class="btn o big2" id="more">Show ${Math.min(25,r.length-S.n)} more (${r.length-S.n} left)</button>`:'')+
  (r.length?'':'<p class="dq">No hunts at 5% or better with these choices. Try another weapon or hunt type, or check back as you build points.</p>')+note+fbA('find');
 wireTabs(o);o.querySelectorAll('.fh').forEach(b=>b.onclick=()=>openHunt(b.dataset.k));
 if($('more'))$('more').onclick=()=>{S.n+=25;history.replaceState(st('list'),'',url());showList()}}
// ===== Unit tiles by AZGFD region (no boundary data is used) =====
function byUnit(r){const m={};r.forEach(x=>{const h=AH[x.k];(h.u.length?h.u:['SP']).forEach(u=>(m[u]=m[u]||[]).push(x))});return m}
function tiles(r){const bu=byUnit(r);const pu=new Set();AHk.forEach(k=>{const h=AH[k];if(h.pool==S.pl)(h.u.length?h.u:['SP']).forEach(u=>pu.add(u))});
 let s='<div class="rgs" id="tiles">';for(const g of Object.keys(RG)){const us=RG[g].split(' ');
  s+=`<div class="rg"><p class="rgt">${RGN[g]}</p><div class="ut">`+us.map(u=>{const h=bu[u];const c=h?vcol(h[0].v):MC.none;return `<button class="un${h?'':' off'}" data-u="${u}" style="background:${c}" ${h?'':'disabled'} aria-label="Unit ${u}${h?': '+h.length+' hunt'+(h.length==1?'':'s'):''}">${u}</button>`}).join('')+'</div></div>'}
 if(pu.has('SP')){const h=bu.SP;s+=`<div class="rg"><p class="rgt">Special hunt areas (named areas, see the hunt's notes)</p><div class="ut"><button class="un wide${h?'':' off'}" data-u="SP" style="background:${h?vcol(h[0].v):MC.none}" ${h?'':'disabled'}>Special areas</button></div></div>`}
 return s+'</div>'}
function wireTiles(o,r){o.querySelectorAll('.un[data-u]').forEach(b=>b.onclick=()=>{pickU(b.dataset.u,r);const pn=$('mpanel'),bb=pn.getBoundingClientRect();if(bb.top>innerHeight-80)scrollBy({top:bb.top-innerHeight*.45,behavior:'instant'})})}
function pickU(u,r){const h=byUnit(r)[u];if(!h)return;S.mu=u;document.querySelectorAll('.un.sel').forEach(x=>x.classList.remove('sel'));const b=document.querySelector(`.un[data-u="${u}"]`);if(b)b.classList.add('sel');
 const pn=$('mpanel');pn.hidden=false;const reg=u=='SP'?null:Object.keys(RG).find(g=>RG[g].split(' ').includes(u));
 pn.innerHTML=`<p class="mpt">${u=='SP'?'Special hunt areas':'Unit '+u} · best odds: ${vdot(h[0].v)}<b>${VERD(h[0].v)}</b></p><p class="mps">${h.length} hunt${h.length==1?'':'s'} you can draw here${u=='SP'?'':` · <a href="${gmu(u)}">AZGFD Unit ${u} page</a>`}</p><ul>`+h.map(x=>{const d=AH[x.k];
  return `<li><button class="mh" data-k="${x.k}">${vdot(x.v)}<b>${d.n}</b> · ${VERD(x.v)} · ${pct(x.v)}<span>${esc(d.legal)} · ${esc(d.area)} · ${WN[d.w]} · ${esc(d.d)}</span></button></li>`}).join('')+'</ul>';
 pn.querySelectorAll('.mh').forEach(b=>b.onclick=()=>openHunt(b.dataset.k));const s0=history.state;if(s0&&s0.v=='list')history.replaceState(st('list'),'',url())}
function wireTabs(o){o.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(S.tab==b.dataset.tab)return;S.tab=b.dataset.tab;S.mu=null;history.pushState(st('list'),'',url());showList();top2($('out'))})}
function how(h){return `<p class="how"><b>How Arizona draws this hunt:</b> up to 20% of the tags${h.sp=='sheep'||h.sp=='bison'?' (for bighorn sheep and bison, 20% of all tags statewide)':''} go first to applicants with bonus points who list the hunt as 1st or 2nd choice, starting with the most points. All other tags are drawn at random. Each application gets one random number plus one more for each bonus point (bonus, loyalty and hunter education points all count), and only the lowest number is used, so points help in both steps (Rule R12-4-114(C)(2), reprinted in ${bk('F','PDF page 93')}). Your odds above are an estimate for the ${nextDraw(h)}. We replay that rule on AZGFD's 2026 applicants by points two ways${h.dr=='S'?', plus a third with more applicants,':''}: as they were, and with everyone who didn't draw back with one more point (point creep). We show the lowest. The table below is the actual 2026 draw.</p>`}
function showDetail(k){const h=AH[k],v=odds(k),o=$('detail');$('out').hidden=true;o.hidden=false;const b=h.od&&h.od[S.res];
 let lad='',sure='',tbl='',cap='';
 if(b){const raw=h.raw[S.res];const mx=Math.min(MAXP,Math.max(S.pts,...Object.keys(raw).map(Number),0)+2);const ks=[...Array(mx+1).keys()];
  lad=`<p class="lh">Odds by points (estimate)</p><div class="lad">`+ks.map(n=>{const z=b.o[n];return `<div class="lr${n==Math.min(S.pts,MAXP)?' on':''}"><span class="ln">${n} pts</span><span class="lb"><i style="width:${Math.max(Math.round(z*100),1)}%"></i></span><span class="lz">${pct(z)}</span></div>`}).join('')+'</div>';
  const s=b.o.findIndex(z=>z>=.995);sure=`<p class="dq"><b>${s>=0?`Our estimate: about ${s} point${s==1?'':'s'} to be sure to draw.`:'No point level is a sure draw in our estimate.'}</b></p>`;
  const rows=Object.entries(raw).map(([p,x])=>[+p,x]).sort((a,c)=>c[0]-a[0]);const q=b.q;
  tbl=`<h3>2026 draw at your residency (1st choice, AZGFD)</h3><table class="dt"><tr><th>Points</th><th>Applied (1st choice)</th><th>Drew</th><th>In the bonus pass</th></tr>`+rows.map(([p,x])=>`<tr${p==S.pts?' class="on"':''}><td>${p}</td><td>${x[0].toLocaleString()}</td><td>${x[1].toLocaleString()}</td><td>${x[2].toLocaleString()}</td></tr>`).join('')+'</table>'+
   `<p class="note">"Drew" counts tags issued in the bonus pass and the 1st/2nd-choice pass to applicants at each point level, so it can include a few who listed this hunt 2nd. ${S.res=='res'?'Residents':'Nonresidents'} drew ${(q.bonus+q.p12).toLocaleString()} of the ${h.T0.toLocaleString()} tags in 2026. Points include bonus, loyalty and hunter education points (AZGFD's "group bonus points"). Source: ${rep(h.dr)}.${h.idm=='n'?' AZGFD\'s 2026 spring booklet isn\'t posted, so we matched this hunt to the 2026 draw by hunt number and permit count.':''}</p>`;
  if(h.nrc)cap=`<p class="note"><b>Nonresident cap changes in 2027.</b> Under the amended Rule R12-4-114(E)(2), in effect July 1, 2026, nonresidents can get no more than ${h.nrc.new} of this hunt's ${h.T} tags. In the 2026 draw the limit was ${h.nrc.old}. Our estimate uses the new cap.</p>`}
 const f=fee(h);const bk2=S.tab=='map'?'← Back to my map':'← Back to my list';
 o.innerHTML=`<button class="btn big2" id="back">${bk2}</button>
 <div class="yo"><p class="yt">Your odds</p><p class="tg">${title(k)}</p><div class="vd">${vdot(v??0)}${v==null?'NO DATA':VERD(v)}</div>${v==null?`<p class="dq">${esc(h.why||'No 2026 draw record.')}</p>`:oddsHTML(v,'fo',k)}${sure}${succHTML(k,'fs')}${h.hv?`<p class="note hvn">Hunter success comes from AZGFD's <a href="${SRC.hv[h.hv[4]]}">${h.hv[0]} harvest summary</a> (hunt ${h.hv[5]} that year, same units and hunt type). Numbers are from hunter questionnaires.</p>`:''}${h.t=='champ'?'<p class="dq">CHAMP hunts need a Challenged Hunter Access/Mobility Permit (Rule R12-4-217).</p>':''}</div>
 ${how(h)}${lad}${tbl}${cap}
 <h3>Season</h3><div class="yr"><b>${esc(h.d)}</b><span>${esc(h.sect)}</span></div>${h.nt?`<p class="note">Hunt notes ${esc(h.nt)} in the booklet apply (special restrictions, access, closures).</p>`:''}
 <h3>Tag fee</h3><div class="yr"><b>Resident</b><span>${money(f[0])}</span></div><div class="yr"><b>Nonresident</b><span>${money(f[1])}</span></div><p class="note">Includes the $13 resident / $15 nonresident application fee. You also need a hunting or combination license before you apply ($37 resident hunting, $57 resident combination, $160 nonresident combination, $5 youth combination). ${h.t=='youth'?'Youth-only price. ':''}Source: ${bk('F','PDF page 7')}.</p>
 <h3>Where this hunt is</h3><p class="dq">${esc(h.area)}</p><p>${h.u.map(u=>`<a class="chip" href="${gmu(u)}">Unit ${u}</a>`).join(' ')}</p><p class="note">Unit links go to AZGFD's own unit pages and maps. ${h.u.length?'':'This hunt uses a named hunt area; see the hunt notes in the booklet for its boundary. '}</p>
 <p><button class="btn o" id="vsm">See units on the unit list</button></p>
 <p class="note">Hunt number <b>${h.n}</b> (${DRAW[h.dr]}), listed in ${bk(h.dr,h.pg)}. Estimates from AZGFD's past draw and harvest reports, not a guarantee. Check the AZGFD regulations before you apply.</p>
 <p><a class="btn" href="../packages.html">Scouting help for this hunt</a></p>${fbA('find')}<button class="btn o big2" id="back2">${bk2}</button>`;
 $('back').onclick=$('back2').onclick=goBack;$('vsm').onclick=()=>{S.tab='map';S.mu=h.u[0]||'SP';history.pushState(st('list'),'',url());showList();top2($('out'))};top2(o)}
const fbA=about=>`<p class="fbk"><a class="fbl" href="../feedback.html?about=${about}" data-about="${about}">Something off? Tell us</a></p>`;
const top2=e=>{const h=document.querySelector('header');scrollTo({top:e.getBoundingClientRect().top+scrollY-((h&&getComputedStyle(h).position=='sticky')?h.offsetHeight:0)-12,behavior:'instant'})};
const st=(v,k)=>({v,k,sp:S.sp,pl:S.pl,res:S.res,pts:S.pts,w:S.w,yo:S.yo,champ:S.champ,n:S.n,tab:S.tab,mu:S.mu,y:v=='list'?scrollY:0});
const url=k=>{const u=new URLSearchParams({sp:S.sp,pl:S.pl,r:S.res,p:S.pts});if(S.w)u.set('w',S.w);if(S.yo)u.set('kid',1);if(S.champ)u.set('champ',1);if(k)u.set('h',k);if(S.tab=='map')u.set('tab','map');if(S.mu&&S.tab=='map')u.set('u',S.mu);return '?'+u+'#'+(k?'hunt':S.tab=='map'?'map':'list')};
let fromList=false;
function openHunt(k){history.replaceState(st('list'),'',url());history.pushState(st('detail',k),'',url(k));fromList=true;showDetail(k)}
function goBack(){if(fromList)history.back();else{history.replaceState(st('list'),'',url());showList();top2($('out'))}}
function apply(s){Object.assign(S,{sp:s.sp,pl:s.pl,res:s.res,pts:+s.pts,w:s.w||'',yo:+s.yo||0,champ:+s.champ||0,n:+s.n||25,tab:s.tab=='map'?'map':'list',mu:s.mu??null});sync()}
const wsOf=pl=>[...new Set(AHk.filter(k=>AH[k].pool==pl).map(k=>AH[k].w))];
function sync(){if(S.sp!='bear'&&(!PL[S.pl]||PL[S.pl][0]!=S.sp))S.pl=poolsOf(S.sp)[0];
 const bear=S.sp=='bear';$('form2').hidden=bear;
 if(!bear){$('pools').innerHTML=poolsOf(S.sp).map(k=>`<button data-pl="${k}" class="${k==S.pl?'on':''}">${PSHORT[k]}</button>`).join('');
  $('pools').querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>{S.pl=b.dataset.pl;S.w='';sync()});
  const n=AHk.filter(k=>AH[k].pool==S.pl).length;$('pnote').textContent=`${PL[S.pl][1]}: ${n} draw hunt${n==1?'':'s'} in the current AZGFD booklet. Uses your ${SP[S.sp].toLowerCase()} bonus points.`;
  const ws=wsOf(S.pl);if(S.w&&!ws.includes(S.w))S.w='';
  $('wseg').innerHTML=`<button data-w="" class="${S.w==''?'on':''}">Any</button>`+['R','A','M','H','S'].filter(w=>ws.includes(w)).map(w=>`<button data-w="${w}" class="${S.w==w?'on':''}">${{R:'General',A:'Archery',M:'Muzzleloader',H:'HAM',S:'Shotgun shooting shot'}[w]}</button>`).join('');
  $('wseg').querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{S.w=b.dataset.w;sync()})}
 document.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('on',x.dataset.sp==S.sp));document.querySelectorAll('[data-res]').forEach(x=>x.classList.toggle('on',x.dataset.res==S.res));
 document.querySelectorAll('[data-yo]').forEach(x=>x.classList.toggle('on',+x.dataset.yo==S.yo));$('pv').textContent=S.pts;$('champ').checked=!!S.champ;if($('ynote'))$('ynote').hidden=!S.yo}
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a.fbl');if(a)a.href='../feedback.html?about='+a.dataset.about+'&from='+encodeURIComponent(location.href)},true);
addEventListener('popstate',e=>{const s=e.state;if(!s){$('out').hidden=true;$('detail').hidden=true;return}apply(s);
 if(s.v=='detail'){fromList=false;showDetail(s.k)}else{showList();requestAnimationFrame(()=>scrollTo(0,s.y||0))}});
document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;S.w='';sync()});
document.querySelectorAll('[data-res]').forEach(b=>b.onclick=()=>{S.res=b.dataset.res;sync()});
document.querySelectorAll('[data-yo]').forEach(b=>b.onclick=()=>{S.yo=+b.dataset.yo;sync()});
$('champ').onchange=()=>{S.champ=$('champ').checked?1:0};
const step=x=>{S.pts=Math.max(0,Math.min(MAXP,S.pts+x));$('pv').textContent=S.pts};$('pm').onclick=()=>step(-1);$('pp').onclick=()=>step(1);
$('go').onclick=()=>{S.n=25;S.mu=null;history.pushState(st('list'),'',url());showList();top2($('out'))};
if(Q.get('sp')){const sp=SP[Q.get('sp')]?Q.get('sp'):'elk',pl=sp=='bear'?'':(PL[Q.get('pl')]&&PL[Q.get('pl')][0]==sp?Q.get('pl'):poolsOf(sp)[0]);
 apply({sp,pl,res:Q.get('r')=='nonres'?'nonres':'res',pts:Math.max(0,Math.min(MAXP,+Q.get('p')||0)),w:'RAMHS'.includes(Q.get('w')||'-')?Q.get('w'):'',yo:Q.get('kid')?1:0,champ:Q.get('champ')?1:0,n:25,tab:Q.get('tab')=='map'||location.hash=='#map'?'map':'list',mu:Q.get('u')});
 const h=Q.get('h');history.replaceState(st('list'),'',url());if(h&&AH[h]&&AH[h].pool==S.pl){history.pushState(st('detail',h),'',url(h));fromList=true;showDetail(h)}else showList()}
sync();
window.__AZ={ranked,odds,S,MC,vcol,fee,noHist};
})();
