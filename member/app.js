// UnitIQ. One state picker on this page. The hunt list, map, compare,
// season dates, exact odds, and history render here, not in a frame.
// The old frame was a fixed-height box with its own scrollbar and rounded
// corners. iPhone Safari left that box blank. These tools now sit in the page.
(function(){
'use strict';
const STATES=[
  {id:'co', name:'Colorado', file:'../find.html'},
  {id:'ut', name:'Utah', file:'../utah/find.html'},
  {id:'az', name:'Arizona', file:'../arizona/find.html'},
  {id:'wy', name:'Wyoming', file:'../wyoming/find.html'},
  {id:'id', name:'Idaho', file:'../idaho/find.html'},
  {id:'nv', name:'Nevada', file:'../nevada/find.html'},
  {id:'mt', name:'Montana', file:'../montana/find.html'},
  {id:'nm', name:'New Mexico', file:'../newmexico/find.html'}
];
const $=id=>document.getElementById(id);
const Q=new URLSearchParams(location.search);
let state=(Q.get('state')||'co').toLowerCase();
if(!STATES.some(s=>s.id===state)) state='co';
let assetBase=location.href;

function absAsset(v){
  if(typeof v!=='string'||!v)return v;
  if(/^(https?:|\/\/|data:|blob:|mailto:|#|\/)/.test(v))return v;
  if(v.charAt(0)==='?')return v;
  try{return new URL(v, assetBase).href}catch(e){return v}
}
function installBase(base){
  assetBase=base;
  const origFetch=window.fetch.bind(window);
  window.fetch=function(input, init){
    if(typeof input==='string')input=absAsset(input);
    return origFetch(input, init);
  };
  function patch(proto, prop){
    const desc=Object.getOwnPropertyDescriptor(proto, prop);
    if(!desc||!desc.set||proto['__rw_'+prop])return;
    proto['__rw_'+prop]=1;
    Object.defineProperty(proto, prop, {
      configurable:true, enumerable:desc.enumerable, get:desc.get,
      set(v){desc.set.call(this, absAsset(v))}
    });
  }
  patch(HTMLScriptElement.prototype, 'src');
  patch(HTMLLinkElement.prototype, 'href');
}
function pinState(){
  for(const name of ['pushState','replaceState']){
    const orig=history[name].bind(history);
    history[name]=function(data, title, url){
      if(typeof url==='string'&&url.charAt(0)==='?'){
        const hashAt=url.indexOf('#');
        const hash=hashAt>=0?url.slice(hashAt):'';
        const q=hashAt>=0?url.slice(1, hashAt):url.slice(1);
        const u=new URLSearchParams(q);
        u.set('state', state);
        if(!u.get('sp'))u.set('sp','elk');
        url=location.pathname+'?'+u.toString()+hash;
      }
      return orig(data, title, url);
    };
  }
}
function ensureQuery(){
  const u=new URLSearchParams(location.search);
  u.set('state', state);
  if(!u.get('sp'))u.set('sp','elk');
  if(!u.get('go'))u.set('go','1');
  const next=location.pathname+'?'+u.toString()+location.hash;
  if(next!==location.pathname+location.search+location.hash)history.replaceState(null,'',next);
}
function paint(){
  const nav=$('states');
  const now=new URLSearchParams(location.search);
  nav.innerHTML=STATES.map(s=>{
    const u=new URLSearchParams(now);
    u.set('state', s.id);
    u.delete('unit'); u.delete('h'); u.delete('k');
    if(!u.get('sp'))u.set('sp','elk');
    u.set('go','1');
    const on=s.id===state;
    return '<a href="app.html?'+u.toString()+'" data-st="'+s.id+'"'+(on?' class="on" aria-current="page"':'')+'>'+s.name+'</a>';
  }).join('');
  const sp=now.get('sp')||'elk';
  $('pkg').href='../buy.html?p=package&state='+state.toUpperCase()+'&species='+encodeURIComponent(sp);
}
function rootUrl(v, base){
  if(!v||/^(https?:|\/\/|mailto:|#)/.test(v))return v;
  if(v.charAt(0)==='?'){
    const hashAt=v.indexOf('#');
    const hash=hashAt>=0?v.slice(hashAt):'';
    const u=new URLSearchParams(hashAt>=0?v.slice(1, hashAt):v.slice(1));
    u.set('state', state);
    return location.pathname+'?'+u.toString()+hash;
  }
  const abs=new URL(v, base);
  return abs.pathname+abs.search+abs.hash;
}
function runScript(s){
  return new Promise((resolve, reject)=>{
    if(s.src&&s.src.indexOf('member/rw.js')!==-1){resolve();return}
    const el=document.createElement('script');
    s.attrs.forEach(pair=>el.setAttribute(pair[0], pair[1]));
    if(s.src){
      el.onload=()=>resolve();
      el.onerror=()=>reject(new Error('could not load '+s.src));
      el.src=s.src;
      document.body.appendChild(el);
      return;
    }
    el.textContent=s.text;
    document.body.appendChild(el);
    resolve();
  });
}
async function mount(){
  const st=STATES.find(s=>s.id===state)||STATES[0];
  const pageUrl=new URL(st.file, location.href);
  const box=$('hunt');
  installBase(pageUrl.href);
  pinState();
  let html;
  try{
    const r=await fetch(pageUrl.href,{cache:'no-store'});
    if(!r.ok)throw new Error('status '+r.status);
    html=await r.text();
  }catch(e){
    box.innerHTML='<p class="rw-calm">The hunt list did not load. Nothing was charged.</p>';
    return;
  }
  const doc=new DOMParser().parseFromString(html,'text/html');
  const main=doc.querySelector('main');
  if(!main){box.innerHTML='<p class="rw-calm">The hunt list did not load. Nothing was charged.</p>';return}
  const scripts=[...main.querySelectorAll('script')].map(s=>({
    src:s.getAttribute('src'),
    text:s.textContent,
    attrs:[...s.attributes].filter(a=>a.name!=='src').map(a=>[a.name,a.value])
  }));
  main.querySelectorAll('script, h1, nav.stp').forEach(n=>n.remove());
  main.querySelectorAll('[href],[src]').forEach(el=>{
    ['href','src'].forEach(attr=>{
      if(!el.hasAttribute(attr))return;
      el.setAttribute(attr, rootUrl(el.getAttribute(attr), pageUrl.href));
    });
  });
  box.replaceChildren();
  [...main.childNodes].forEach(n=>box.appendChild(document.importNode(n, true)));
  try{
    for(const s of scripts)await runScript(s);
  }catch(e){
    if(!box.querySelector('#out'))box.insertAdjacentHTML('beforeend','<p class="rw-calm">The hunt list did not load. Nothing was charged.</p>');
  }
}
async function who(){
  const el=$('who');
  let a=null;
  try{a=await RW.account()}catch(e){a=null}
  if(!a||a.offline){el.textContent='The member service did not answer. The list below is the public file. Nothing was charged.';return}
  const eight=['co','ut','az','wy','id','nv','mt','nm'];
  const covered=eight.filter(s=>RW.hasFullPass(a,s));
  if(covered.length===8){el.textContent='Your Full Pass is active. You get the full hunt list and exact odds for all 8 states.';return}
  if(covered.length){el.textContent='Your Full Pass is active. You get the full hunt list for the states on your account.';return}
  if(a.loggedIn){el.textContent='You are logged in. This state is the free look: a count and sample units. The full list is the Full Pass.';return}
  el.textContent='You are not logged in. This is the free look: a count and sample units.';
}
ensureQuery();
paint();
mount();
who();
})();
