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
let S={sp:'elk',res:'res',pts:0,w:'',se:'',sx:'',so:'',mc:'',yo:0,priv:0,n:25,tab:'list',mv:null,mu:null,ol:null};
// Weapon = 5th character of the hunt code (CPW brochure): A archery, M muzzleloader, R rifle and associated methods.
// X = season choice (one license good in archery, muzzleloader and rifle seasons), so it matches every weapon choice.
const WN={'':'Any weapon',A:'Archery',M:'Muzzleloader',R:'Rifle'};const wOK=k=>!S.w||S.sp=='turkey'||k.at(-1)==S.w||k.at(-1)=='X';
// Sex = 2nd character of the CPW hunt code (CPW brochure): M male (antlered / bearded), F female (antlerless / ewe / nanny), E either sex.
// Rifle season, from the 4th and 5th characters of the CPW hunt code ("How to Read Hunt Codes", 2026 CPW big game brochure p. 10):
// O1-O6 = seasons, L1-L3 = late, E = early, P = private-land-only, K = youth-only, S = special or split, W = Ranching for Wildlife.
// For deer, elk and pronghorn, O1-O4 are the 1st-4th rifle seasons. Every other rifle code (early, private-land-only, youth-only,
// special, Ranching for Wildlife, and the seasons of species with their own season dates: bear, moose, sheep, goat) is "Other".
const SEN={'':'All','1':'1st','2':'2nd','3':'3rd','4':'4th',L:'Late',O:'Other',S:'Sept. rifle',R:'Oct.–Nov. rifle',P:'Private land only'};
// Bear (2026 CPW brochure, Bear Season Dates and rifle hunt tables): O1-R = September rifle (Sept. 2–30); O5-R = valid in all four regular
// rifle seasons (Oct. 14–18, Oct. 24–Nov. 1, Nov. 7–15, Nov. 18–22); P1-R / P5-R = private-land-only rifle.
function seaOf(k){if(k.at(-1)!='R'||D[k][0]=='turkey')return null;const t=k[5],n=k[6],sp=D[k][0];
 if(sp=='bear')return t=='O'&&n=='1'?'S':t=='O'&&n=='5'?'R':t=='P'?'P':'O';
 if(['deer','elk','pronghorn'].includes(sp)&&t=='O'&&'1234'.includes(n))return n;return t=='L'?'L':'O'}
const seOK=k=>!S.se||seaOf(k)==S.se;
const seAvail=sp=>{const o=new Set();for(const k in D)if(D[k][0]==sp&&!(typeof EXCL!='undefined'&&EXCL.has(k))){if(priv(D[k])&&!S.priv)continue;const x=seaOf(k);if(x)o.add(x)}return['1','2','3','4','S','R','P','L','O'].filter(x=>o.has(x))};
const SXN={'':'Any',M:'Male',F:'Female',E:'Either sex'};const sxOf=k=>'MFE'.includes(k[1])?k[1]:null;const sxOK=k=>!S.sx||sxOf(k)==S.sx;
const SXW={elk:{M:'bull (antlered)',F:'cow (antlerless)'},deer:{M:'buck (antlered)',F:'doe (antlerless)'},pronghorn:{M:'buck (antlered)',F:'doe (antlerless)'},moose:{M:'bull (antlered)',F:'cow (antlerless)'},turkey:{M:'bearded turkey (tom)'},sheep:{M:'ram',F:'ewe'},dsheep:{M:'ram'},goat:{F:'nanny'}};
const sxAvail=sp=>{const o=new Set();for(const k in D)if(D[k][0]==sp&&!(typeof EXCL!='undefined'&&EXCL.has(k))){const x=sxOf(k);if(x)o.add(x)}return['M','F','E'].filter(x=>o.has(x))};
function sxNote(sp,av){const w=SXW[sp]||{};return av.map(x=>x=='E'?'Either sex = you may take a male or a female':`${SXN[x]} = ${w[x]||SXN[x].toLowerCase()} hunts`).join('. ')+'. From the sex letter in each CPW hunt code (M, F or E).'}
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
function succHTML(k,cls){const d=D[k],l=lab(k);if(l)return `<div class="${cls}">${hsLab(k)}<b>${l}</b> <span>for hunter success</span></div>`;
 const n=hunters(k);return `<div class="${cls}">${hsLab(k)}<b>${Math.round(d[7])}%</b> <span>of hunters harvested ${hWhat(k)}</span>${hSrc('CPW 2025 harvest report',n)}${ssn(n)}</div>`}
// What the harvest number counts. CPW's 2025 harvest report splits each hunt code's harvest by bulls/cows/calves, bucks/does/fawns,
// rams/ewes and billies/nannies; on every male-only hunt code the female and young columns are 0 (and the reverse), so the
// sex-specific words match what CPW counted. Either-sex hunts and species without a split use the species name.
const SPN={elk:'an elk',deer:'a deer',pronghorn:'a pronghorn',bear:'a bear',moose:'a moose',turkey:'a turkey',sheep:'a bighorn sheep',dsheep:'a desert bighorn sheep',goat:'a mountain goat'};
const HN={elk:{M:'a bull elk',F:'a cow or calf elk'},deer:{M:'a buck deer',F:'a doe or fawn deer'},pronghorn:{M:'a buck pronghorn',F:'a doe or fawn pronghorn'},sheep:{M:'a bighorn ram',F:'a bighorn ewe'},dsheep:{M:'a desert bighorn ram'},goat:{F:'a nanny mountain goat'}};
function hWhat(k){const sp=D[k][0];return (HN[sp]||{})[sxOf(k)]||SPN[sp]||'one'}
function oddsHTML(v,cls){return FP?`<div class="${cls}"><b>${pct(v)}</b> <span>draw odds with ${S.pts} point${S.pts==1?'':'s'}</span></div>`:`<div class="${cls} lk"><span>Exact draw odds: <a href="unitiq.html">Full Pass</a></span></div>`}
function ranked(){return Object.keys(D).filter(k=>{const d=D[k];if(d[0]!=S.sp)return false;if(typeof EXCL!='undefined'&&EXCL.has(k))return false;if(priv(d)&&!S.priv)return false;if(!wOK(k)||!sxOK(k)||!seOK(k))return false;const v=odds(k);return v!=null&&(WT(S.sp)?v>0:v>=.05)})
 .map(k=>({k,v:odds(k)})).sort((a,b)=>b.v-a.v||(D[b.k][7]??-1)-(D[a.k][7]??-1)||a.k.localeCompare(b.k))}
const seas=k=>k.at(-1)=='X'?'season choice (archery, muzzleloader or rifle)':D[k][2];
const units=k=>{const f=typeof FL!='undefined'&&FL[k];return f&&f[2]?f[2]:[D[k][1]]};
function uL(k,full){const u=units(k);if(u.length==1)return 'Unit '+u[0];return full||u.length<=4?'Units '+u.join(', '):`Units ${u.slice(0,3).join(', ')} +${u.length-3} more`}
function title(k,full){const d=D[k],sx=sexL(d);return `${sx?`<b class="sx">${sx}</b> · `:''}${uL(k,full)} · ${seas(k)}`}
function showList(){const r=ranked(),o=$('out');
 $('detail').hidden=true;o.hidden=false;if(M&&S.tab!='map'){M.remove();M=null}if(DM){DM.remove();DM=null}
 const who=`${SP[S.sp]} · ${S.res=='res'?'Colorado resident':'Out of state'} · ${S.pts} point${S.pts==1?'':'s'} · ${S.sp=='turkey'?'any weapon':WN[S.w].toLowerCase()}${S.se?' · '+(S.se=='O'?'other rifle seasons':'SRP'.includes(S.se)?({S:'September rifle',R:'Oct.–Nov. rifle',P:'private-land-only rifle'})[S.se]:SEN[S.se].toLowerCase()+' rifle season'):''}${S.sx?' · '+SXN[S.sx].toLowerCase():''}${S.yo?' · kid 12–17':''}`;
 const tabs=`<div class="tabs" role="tablist"><button role="tab" class="tb${S.tab=='list'?' on':''}" aria-selected="${S.tab=='list'}" data-tab="list">List</button><button role="tab" class="tb${S.tab=='map'?' on':''}" aria-selected="${S.tab=='map'}" data-tab="map">Map</button></div>`;
 if(S.tab=='map'){o.innerHTML=`<h2 id="lt">${r.length} hunt${r.length==1?'':'s'} you can draw</h2>${tabs}${mcBar()}<p class="dq">${who}. Colored units have at least one hunt you can draw; ${S.mc=='h'?'the color is the best harvest success':'the color is the best odds'} in that unit. Tap a unit to see its hunts.</p>`+
  wtNote()+yxNote()+(S.sp=='turkey'?'<p class="note">Turkey hunts use the same unit numbers as big game, so they are shown on the same unit map.</p>':'')+
  (OIL(S.sp)?`<p class="note">${S.sp=='goat'?'Mountain goat':'Bighorn sheep'} units are not the big game units: CPW numbers them ${S.sp=='goat'?'G1, G2…':'S1, S2…'}, and this map shows those ${S.sp=='goat'?'goat':'sheep'} units.</p>`:'')+
  mapKey(WT(S.sp)?['Under 5% or no hunt you can draw','(tap a unit to see its hunts under 5%)']:['No hunt you can draw','(or only hunts under 5%, not shown)'],.9)+
  mLab()+`<div id="map" class="gmap" aria-label="Map of Colorado hunting units"></div><div id="mpanel" class="mp" hidden aria-live="polite"></div>`+
  `<p class="mapcred"><b>Unit boundaries: Colorado Parks and Wildlife.</b> Lines are simplified and approximate. Check the ${bro()} for official unit boundaries before you apply or hunt.</p>`+
  `<p class="note">Odds are estimates for 2027 from CPW's past draws (1st choice). ${WT(S.sp)?'Every hunt with a chance is shown, long shots under 5% included':'Hunts under 5% aren\'t shown'}${S.priv?'':', and private-land-only hunts are hidden (turn them on under More options)'}. Not a guarantee.</p>`+fbA('maps');
  wireTabs(o);drawMap(r);return}
 o.innerHTML=`<h2 id="lt">${r.length} hunt${r.length==1?'':'s'} you can draw</h2>${tabs}${sortBar()}<p class="dq">${who}. ${sortTxt()} Tap a hunt for details.</p>`+
  wtNote()+yxNote()+(S.sp=='elk'?`<p class="note"><b>No points needed:</b> ${S.res=='res'?'Colorado residents can buy an over-the-counter elk license for many units.':'Out-of-state hunters can buy over-the-counter rifle elk; OTC archery elk for nonresidents is east of I-25 only.'} <a href="https://cpw.state.co.us/activities/hunting/big-game/over-counter-otc-licenses">CPW over-the-counter licenses</a></p>`:'')+
  `<ol class="fl">`+lsort(r).slice(0,S.n).map((x,i)=>`<li><button class="fh" data-k="${x.k}"><span class="rk">${i+1}</span><span class="fv">${vdot(x.v)}${verdict(x.v)}</span><span class="ft">${title(x.k)}</span><span class="fd">${landS(D[x.k][4])}</span>${oddsHTML(x.v,'fo')}${succHTML(x.k,'fs')}</button></li>`).join('')+`</ol>`+
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
const KEYB=[['yes','Yes','sure to draw'],['likely','Likely',''],['maybe','Maybe',''],['long','Long shot','']];
const bucket=v=>v>=.995?'yes':v>=.75?'likely':v>=.25?'maybe':v>=.05?'long':'none';
// ===== Harvest success: sort the list and color the map by it =====
// Harvest success comes only from the agency's own harvest reports (the same number shown on each hunt): hunters who
// took an animal / hunters who hunted, as the agency reports it. A hunt with no official number shows "No data" and sorts last.
// Sorting and map color only reorder or recolor the same hunts you can draw (5% or better); they never add hunts.
function hsv(k){return lab(k)?null:D[k][7]}
function hsY(k){return '2025'}
function ssn(n){return n!=null&&n<30?`<span class="ssn">Only ${n} hunter${n==1?'':'s'}, so this number may not reflect a typical year.</span>`:''}
const hSrc=(s,n)=>`<span class="hsrc">${s}${n!=null?` · ${n.toLocaleString()} hunter${n==1?'':'s'}`:''}</span>`;
function hsLab(k){const y=hsY(k);return `<span class="hsl">Harvest success${y?' · '+y:''}</span>`}
function lsort(r){if(S.so!='h')return r;return [...r].sort((a,b)=>{const x=hsv(a.k),y=hsv(b.k);if((x==null)!=(y==null))return x==null?1:-1;return (y??0)-(x??0)||b.v-a.v||a.k.localeCompare(b.k)})}
function sortTxt(){return S.so=='h'?'Best harvest success first; hunts with no official harvest number are last.':'Best odds first, down to long shots.'}
function segB(id,attr,cur,opts){return `<div class="seg" id="${id}">`+opts.map(([v,t])=>`<button data-${attr}="${v}" class="${cur==v?'on':''}">${t}</button>`).join('')+'</div>'}
function sortBar(){return `<div class="sbar"><span class="lbl">Sort by</span>${segB('soseg','so',S.so,[['','Best draw odds'],['h','Best harvest success']])}${S.so=='h'?'<p class="dq ssnote">Numbers based on fewer than 30 hunters have a note under them.</p>':''}</div>`}
function mcBar(){return `<div class="sbar"><span class="lbl">Color map by</span>${segB('mcseg','mc',S.mc,[['','Draw odds'],['h','Harvest success']])}</div>`}
// Harvest bands (words only, same ramp as the odds key): High 50%+, Good 30-49%, Fair 15-29%, Low under 15%, dark gray = no official number.
const HND='#666666';
function HB(){return [['hh','High',`50% or more of hunters harvested ${SPN[S.sp]||'one'}`,HC.hh],['hg','Good','30–49%',HC.hg],['hf','Fair','15–29%',HC.hf],['hl','Low','under 15%',HC.hl],['hn','No data','no official harvest number for these hunts',HND]]}
function hbk(p){return p==null?'hn':p>=50?'hh':p>=30?'hg':p>=15?'hf':'hl'}
function hcol(p){return HB().find(x=>x[0]==hbk(p))[3]}
function hBest(h){let m=null;for(const x of h){const p=hsv(x.k);if(p!=null&&(m==null||p>m))m=p}return m}
function ucol(h){return S.mc=='h'?hcol(hBest(h)):vcol(h[0].v)}
function ubk(h){return S.mc=='h'?hbk(hBest(h)):bucket(h[0].v)}
function hKey(noneW,noneOp){const it=HB().map(([b,w,d,c])=>({b,w,d,st:fillSt(c,1)}));it.push({b:'none',w:noneW[0],d:noneW[1],st:fillSt(MC.none,noneOp)});
 it.push({w:'Cream outline',d:`the ${KU} you tapped`,ring:1,st:`background:${MC.bg}`});
 return keyHTML('mkey',`Map key: the color is the best harvest success (`+'CPW 2025 harvest statistics'+`) among the hunts you can draw in that ${KU}`,it)}
// Harvest map colors: their own blue family so a harvest map can't be mistaken for draw odds (greens/tan/orange).
// Sequential light-to-dark blues stay ordered for red-green color blindness; Low is pale blue-gray, not the tan "no hunt" fill.
const HC={hh:'#08306B',hg:'#2171B5',hf:'#6BAED6',hl:'#B7CDE3'};
const hdot=p=>`<i class="vdot" style="background:${hcol(p)}"></i>`;
const HBW={hh:'High',hg:'Good',hf:'Fair',hl:'Low',hn:'No data'};
function uLead(h,V){if(S.mc!='h')return `best odds: ${vdot(h[0].v)}<b>${V(h[0].v)}</b>`;const p=hBest(h);
 return `best harvest success: ${hdot(p)}<b>${p==null?'No data':Math.round(p)+'%'}</b>${p==null?'':' ('+HBW[hbk(p)]+')'} · best odds: ${vdot(h[0].v)}${V(h[0].v)}`}
const hLi=k=>{if(S.mc!='h')return '';const p=hsv(k);return `Harvest ${p==null?'no data':Math.round(p)+'%'} · `};
function mLab(){return S.mc=='h'?'<p class="mlab mlh">Map colored by <b>harvest success</b> (blues), not draw odds.</p>':'<p class="mlab">Map colored by <b>draw odds</b>.</p>'}
function hCtl(m){if(S.mc!='h')return;const c=L.control({position:'topright'});c.onAdd=()=>{const d=L.DomUtil.create('div','hctl');d.textContent='Harvest success';return d};c.addTo(m)}
function hPop(h){if(S.mc!='h')return '';const p=hBest(h);return ` · best harvest success: <b>${p==null?'No data':Math.round(p)+'%'}</b>`}
function wireSM(o){o.querySelectorAll('[data-so]').forEach(b=>b.onclick=()=>{S.so=b.dataset.so;history.replaceState(st('list'),'',url());showList()});
 o.querySelectorAll('[data-mc]').forEach(b=>b.onclick=()=>{S.mc=b.dataset.mc;S.mu=null;history.replaceState(st('list'),'',url());showList()})}
const vword=v=>({yes:'Yes',likely:'Likely',maybe:'Maybe',long:'Long shot',none:'Under 5%'})[bucket(v)];
const fillSt=(c,op)=>{const n=parseInt(c.slice(1),16),rgb=[n>>16,n>>8&255,n&255].join(',');return op>=1?`background:${c}`:`background:linear-gradient(rgba(${rgb},${op}),rgba(${rgb},${op})),${MC.bg}`};
function keyHTML(id,title,items){return `<div class="mkey" id="${id}" role="group" aria-label="${title}"><p class="mkh">${title}</p><ul>`+
 items.map(x=>`<li${x.b?` data-b="${x.b}"`:''}${x.cls?` class="${x.cls}"`:''}><i class="sw${x.ring?' ring':''}" style="${x.st||''}" aria-hidden="true"></i><span class="mkt"><b>${x.w}</b>${x.d?` <span class="mkd">${x.d}</span>`:''}<span class="mkn"></span></span></li>`).join('')+'</ul></div>'}
// Statewide map key. noneW: what the light color means on this map; noneOp: its fill opacity there.
function mapKey(noneW,noneOp){if(S.mc=='h')return hKey(noneW,noneOp);const it=KEYB.map(([b,w,d])=>({b,w,d,st:fillSt(MC[b],1)}));
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
function wireTabs(o){wireSM(o);o.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(S.tab==b.dataset.tab)return;S.tab=b.dataset.tab;S.mv=null;S.mu=null;S.ol=null;history.pushState(st('list'),'',url());showList();top2($('out'))})}
const loadJS=src=>new Promise((ok,no)=>{const e=document.createElement('script');e.src=src;e.onload=ok;e.onerror=no;document.head.appendChild(e)});
async function ensureMap(){if(!window.L){const c=document.createElement('link');c.rel='stylesheet';c.href='find/vendor/leaflet.css';document.head.appendChild(c);await loadJS('find/vendor/leaflet.js')}
 if(!window.topojson)await loadJS('find/vendor/topojson-client.min.js');const f=gfile(S.sp);if(!GJS[f]){const t=await(await fetch(f)).json();GJS[f]=topojson.feature(t,t.objects.gmu)}GJ=GJS[f]}
function byUnit(r){const m={};r.forEach(x=>units(x.k).forEach(u=>{u=String(u);(m[u]=m[u]||[]).push(x)}));return m}
function popHTML(u,h){return `<div class="mp"><p class="mpt">Unit ${u} · ${uLead(h,verdict)}</p><p class="mps">${h.length} hunt${h.length==1?'':'s'} you can draw here</p><ul>`+h.map(x=>{const d=D[x.k],sx=sexL(d),n=units(x.k).length;
 return `<li><button class="mh" data-k="${x.k}">${vdot(x.v)}<b>${x.k}</b> · ${verdict(x.v)}${FP?' · '+pct(x.v):''}<span>${hLi(x.k)}${sx?sx+' · ':''}${seas(x.k)}${n>1?` · covers ${n} units`:''}</span></button></li>`}).join('')+'</ul></div>'}
let SEL=null,PY=null;
function pick(u,h,l){if(SEL)SEL.remove();SEL=halo(M,[l]);S.mu=String(u);
 const pn=$('mpanel');pn.hidden=false;pn.innerHTML=popHTML(u,h);pn.querySelectorAll('.mh').forEach(b=>b.onclick=()=>openHunt(b.dataset.k));
 const s0=history.state;if(s0&&s0.v=='list')history.replaceState(st('list'),'',url())}
async function drawMap(r){SEL=null;const el=$('map');if(!el)return;try{await ensureMap()}catch(e){el.innerHTML='<p class="dq">The map could not load. Use the List tab.</p>';return}
 if(!el.isConnected)return;if(M){M.remove();M=null}
 M=L.map(el,{zoomSnap:.25,minZoom:5.5,maxZoom:11,scrollWheelZoom:false,tap:true});window.__FY.map=M;
 M.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>').addAttribution('Unit boundaries: Colorado Parks and Wildlife');hCtl(M);
 const bu=byUnit(r),cnt={hl:0};
 const ly=L.geoJSON(GJ,{style:f=>{const u=f.properties.u,h=u!=null&&bu[u];return{color:MC.sel,opacity:.45,weight:.7,fillColor:h?ucol(h):MC.none,fillOpacity:h&&(S.mc=='h'||h[0].v>=.05)?1:.9}},
  onEachFeature:(f,l)=>{const u=f.properties.u,h=u!=null&&bu[u];if(!h){l.options.interactive=false;return}if(h[0].v>=.05)cnt.hl++;
   l.bindTooltip('Unit '+u,{sticky:true,direction:'top'});l.on('click',()=>{pick(u,h,l);const pn=$('mpanel'),b=pn.getBoundingClientRect();if(b.top>innerHeight-80)scrollBy({top:b.top-innerHeight*.45,behavior:'instant'})})}}).addTo(M);
 {const kc={},seen=new Set();GJ.features.forEach(f=>{const u=f.properties.u;if(u==null||seen.has(String(u)))return;seen.add(String(u));const h=bu[u];const b=h?ubk(h):'none';kc[b]=(kc[b]||0)+1});fillKey(kc)}
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
const yxNote=()=>S.yo&&['elk','deer','pronghorn'].includes(S.sp)?'<p class="note"><b>Youth extended season:</b> if a youth\'s elk, deer or pronghorn license goes unfilled, CPW\'s youth extended season may let them keep hunting in a later season. It\'s separate from the draw odds above. <a href="youth-extended.html">See where a youth license can extend</a>.</p>':'';
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
const st=(v,k)=>({v,k,sp:S.sp,res:S.res,pts:S.pts,w:S.w,se:S.se,sx:S.sx,so:S.so,mc:S.mc,yo:S.yo,priv:S.priv,n:S.n,tab:S.tab,mv:S.mv,mu:S.mu,ol:S.ol,y:v=='list'?scrollY:0});
const url=k=>{const u=new URLSearchParams({sp:S.sp,r:S.res,p:S.pts});if(S.w)u.set('w',S.w);if(S.se)u.set('se',S.se);if(S.sx)u.set('sx',S.sx);if(S.so)u.set('so',S.so);if(S.mc)u.set('mc',S.mc);if(S.yo)u.set('kid',1);if(S.priv)u.set('priv',1);if(k)u.set('h',k);if(S.tab=='map')u.set('tab','map');if(FULLPASS_GATING&&FP)u.set('preview','fullpass');return '?'+u+'#'+(k?'hunt':S.tab=='map'?'map':'list')};
let fromList=false;
function openHunt(k){history.replaceState(st('list'),'',url());history.pushState(st('detail',k),'',url(k));fromList=true;showDetail(k)}
function goBack(){if(fromList)history.back();else{history.replaceState(st('list'),'',url());showList();top2($('out'))}}
function apply(s){Object.assign(S,{sp:s.sp,res:s.res,pts:+s.pts,w:s.w||'',se:s.se||'',sx:s.sx||'',so:s.so=='h'?'h':'',mc:s.mc=='h'?'h':'',yo:+s.yo||0,priv:+s.priv||0,n:+s.n||25,tab:s.tab=='map'?'map':'list',mv:s.mv||null,mu:s.mu??null,ol:s.ol||null});sync()}
function sync(){{const ea=S.w=='R'&&S.sp!='turkey'?seAvail(S.sp):[];if(S.se&&!ea.includes(S.se))S.se='';const show=ea.length>=2;$('sebox').hidden=!show;
 $('seseg').innerHTML=show?['',...ea].map(x=>`<button data-se="${x}" class="${S.se==x?'on':''}">${SEN[x]}</button>`).join(''):'';$('seseg').querySelectorAll('[data-se]').forEach(b=>b.onclick=()=>{S.se=b.dataset.se;sync()});
 $('senote').textContent=S.sp=='bear'?'CPW 2026 bear rifle seasons: Sept. rifle is Sept. 2–30; Oct.–Nov. rifle hunts are good in all four regular rifle seasons (Oct. 14–18, Oct. 24–Nov. 1, Nov. 7–15, Nov. 18–22); private-land-only hunts show when you turn them on under More options. From the season part of each CPW hunt code.':ea.includes('O')?'Other = '+(['deer','elk','pronghorn'].includes(S.sp)?'early, private-land-only, youth-only, special and Ranching for Wildlife rifle hunts':'this species\' own rifle season dates (see each hunt)')+'. From the season part of each CPW hunt code.':'From the season part of each CPW hunt code.'}
 const av=sxAvail(S.sp);if(S.sx&&!av.includes(S.sx))S.sx='';
 $('sxseg').innerHTML=['',...av].map(x=>`<button data-sx="${x}" class="${S.sx==x?'on':''}">${SXN[x]}</button>`).join('');$('sxseg').querySelectorAll('[data-sx]').forEach(b=>b.onclick=()=>{S.sx=b.dataset.sx;sync()});$('sxnote').textContent=sxNote(S.sp,av);
 document.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('on',x.dataset.sp==S.sp));document.querySelectorAll('[data-res]').forEach(x=>x.classList.toggle('on',x.dataset.res==S.res));
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
if(Q.get('sp')&&D){apply({sp:SP[Q.get('sp')]?Q.get('sp'):'elk',res:Q.get('r')=='nonres'?'nonres':'res',pts:Math.max(0,Math.min(30,+Q.get('p')||0)),w:'AMR'.includes(Q.get('w')||'-')?Q.get('w'):'',se:'1234LOSRP'.includes(Q.get('se')||'-')?Q.get('se'):'',sx:'MFE'.includes(Q.get('sx')||'-')?Q.get('sx'):'',so:Q.get('so')=='h'?'h':'',mc:Q.get('mc')=='h'?'h':'',yo:Q.get('kid')?1:0,priv:Q.get('priv')?1:0,n:25,tab:Q.get('tab')=='map'||location.hash=='#map'?'map':'list'});
 const h=Q.get('h');history.replaceState(st('list'),'',url());if(h&&D[h]&&D[h][0]==S.sp&&!(typeof EXCL!='undefined'&&EXCL.has(h))){history.pushState(st('detail',h),'',url(h));fromList=true;showDetail(h)}else showList()}
sync();
window.__FY={hWhat,seaOf,seAvail,hsv,lsort,hbk,hBest,ranked,odds,wOdds,sxOf,sxAvail,S,FULLPASS_GATING,MC,vcol,gfile};
})();
