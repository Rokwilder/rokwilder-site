// Utah extended archery preview: saved checklist, area list and map (boundaries: Utah DWR).
(()=>{const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const K='rw_xarch',st=JSON.parse(localStorage.getItem(K)||'{}');st.ck=st.ck||{};
const cks=[...document.querySelectorAll('#xck input[data-k]')],prog=()=>{$('ckp').textContent=`${cks.filter(c=>c.checked).length} of ${cks.length} done`};
cks.forEach(c=>{c.checked=!!st.ck[c.dataset.k];c.onchange=()=>{st.ck[c.dataset.k]=c.checked;localStorage.setItem(K,JSON.stringify(st));prog()}});prog();
const S={sp:new URLSearchParams(location.search).get('sp')=='elk'?'elk':'deer'};let M,ly;
function draw(){document.querySelectorAll('#xsp button').forEach(b=>b.classList.toggle('on',b.dataset.sp==S.sp));
 const fs=XA.features.filter(f=>f.properties.sp==S.sp);$('hplink').href='https://dwrapps.utah.gov/huntboundary/hbstart?HN='+(S.sp=='elk'?'EX1000':'DB0008');
 $('xareas').innerHTML=fs.map((f,i)=>{const p=f.properties;return `<div class="ar" data-bid="${p.bid}"><h3><span class="no">${i+1}</span> <span class="nm">${esc(p.name)}</span></h3><p class="dt">${esc(p.dates)}</p><p class="dn">${S.sp=='deer'?'Deer, either sex':'Elk: any bull or antlerless'} · archery only</p>`+
  (p.desc?`<details><summary>DWR boundary description</summary><p>${esc(p.desc)}</p></details>`:`<p class="dn">See DWR’s Hunt Planner for this boundary’s description.</p>`)+`<button class="btn o zm" data-i="${i}">Show on map</button></div>`}).join('');
 if(window.L){if(!M){M=L.map('xmap',{zoomSnap:.25,scrollWheelZoom:false,attributionControl:true});M.attributionControl.setPrefix('Leaflet');M.attributionControl.addAttribution('Boundaries: Utah Division of Wildlife Resources')}
  if(ly)ly.remove();ly=L.geoJSON({type:'FeatureCollection',features:fs},{style:()=>({color:'#E8E0D2',weight:1.5,fillColor:'#c8792f',fillOpacity:.55}),
   onEachFeature:(f,l)=>{l.bindTooltip(String(fs.indexOf(f)+1),{permanent:true,direction:'center',className:'lab'});l.bindPopup(`<b>${esc(f.properties.name)}</b><br>${esc(f.properties.dates)}`)}}).addTo(M);
  M.fitBounds(ly.getBounds(),{padding:[12,12]});
  const ls=ly.getLayers();document.querySelectorAll('.zm').forEach(b=>b.onclick=()=>{const l=ls[+b.dataset.i];M.fitBounds(l.getBounds(),{padding:[16,16]});l.openPopup();$('xmap').scrollIntoView({block:'center'})})}
 history.replaceState(null,'','?sp='+S.sp);window.__XA.layers=ly?ly.getLayers().length:0}
window.__XA={S,draw,map:()=>M};document.querySelectorAll('#xsp button').forEach(b=>b.onclick=()=>{S.sp=b.dataset.sp;draw()});draw()})();
