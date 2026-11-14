// Rokwilder member helper (UnitIQ). Login state, the Full Pass check, and the Find Your Hunt data loader.
// Wired to https://api.rokwilder.com. Checkout stays closed until the API reports checkoutOpen.
// This file never loads exact Wyoming odds. Public buy buttons stay waitlist / not on sale unless checkout is open.
//
// A tap on a buy button used to follow the waitlist link, or a login link that did not continue,
// so /api/checkout never ran. The tap now asks the server itself and posts when checkout is open.
// Catalog is public, so that read does not send cookies. Phones were keeping an old copy of this
// file (GitHub Pages caches it for 10 minutes). Load it with ?v= so a new copy is a new URL.
(function(){
'use strict';
const me_=document.currentScript;
const ROOT=me_.src.replace(/member\/rw\.js(\?.*)?$/,'');
const API=window.RW_API!=null?window.RW_API:'https://api.rokwilder.com';
const EXACT=new Set(['co','ut','az']); // Wyoming stays a free verdict band. Do not request /api/fullpass/data/wy.js.
const BAND=(me_.getAttribute('data-band-only')||'').toLowerCase();
const VER='20261114';
const BUY_KEY='rw-buy';
let acct=null;
let buying=false;
let saleP=null;
let saleState=null;

function bust(path){return API+path+(path.indexOf('?')>=0?'&':'?')+'_='+Date.now()}
async function fetchJSON(url,creds){
  const opts={credentials:creds||'omit',cache:'no-store'};
  try{
    const r=await fetch(url,opts);
    if(!r.ok)return null;
    return await r.json();
  }catch(e){
    // Some iPhone Safari versions throw on cache:'no-store' for a cross-origin call. Try once without it.
    try{
      const r=await fetch(url,{credentials:opts.credentials});
      if(!r.ok)return null;
      return await r.json();
    }catch(e2){return null}
  }
}
function account(force){
  if(!acct||force)acct=fetchJSON(bust('/api/account'),'include').then(j=>j||{loggedIn:false,offline:true});
  return acct;
}
function hasFullPass(a,st){const f=a&&a.loggedIn&&a.fullpass;return !!(f&&f.active&&(f.states||[]).some(s=>s==='ALL'||s===String(st).toUpperCase()))}
function passOn(a){const f=a&&a.loggedIn&&a.fullpass;return !!(f&&f.active)}
async function api(path,body,method){
  const r=await fetch(API+path,{method:method||(body===undefined?'GET':'POST'),credentials:'include',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  let j={};try{j=await r.json()}catch(e){}
  return {ok:r.ok,status:r.status,j};
}
function load(src){const spec=typeof src==='string'?{src:src}:src;return new Promise((ok,no)=>{const s=document.createElement('script');s.src=spec.src;s.async=false;if(spec.attrs){for(const k in spec.attrs)s.setAttribute(k,spec.attrs[k])}s.onload=ok;s.onerror=()=>no(new Error('could not load '+spec.src));document.body.appendChild(s)})}
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function safePayUrl(u,cat){try{const x=new URL(u);if(x.protocol==='https:'&&x.hostname==='checkout.stripe.com')return true;
 if(cat&&cat.testMode===true&&cat.checkoutOpen===true&&x.protocol==='http:'&&(x.hostname==='127.0.0.1'||x.hostname==='localhost')&&x.pathname.indexOf('/pay/')===0)return true;
 return false}catch(e){return false}}
function safePortalUrl(u,testMode){try{const x=new URL(u);if(x.protocol==='https:'&&x.hostname==='billing.stripe.com')return true;
 if(testMode&&x.protocol==='http:'&&(x.hostname==='127.0.0.1'||x.hostname==='localhost')&&x.pathname.indexOf('/portal/')===0)return true;
 return false}catch(e){return false}}
async function catalog(){
  // Public. Do not send the session cookie. A credentialed call is not required here, and a failure
  // used to leave the waitlist button in place so a tap never reached /api/checkout.
  const c=await fetchJSON(bust('/api/catalog'),'omit');
  if(c&&typeof c.checkoutOpen==='boolean')return c;
  const h=await fetchJSON(bust('/api/health'),'omit');
  if(h&&typeof h.checkoutOpen==='boolean')return {checkoutOpen:h.checkoutOpen===true,testMode:h.testMode===true,founding:c&&c.founding,seasons:c&&c.seasons,products:c&&c.products};
  return c;
}
async function health(){return fetchJSON(bust('/api/health'),'omit')}
async function startCheckout(body){
  const c=await catalog();
  if(!c||c.checkoutOpen!==true)return {ok:false,status:503,j:{error:'Checkout is not open. Nothing was charged.',checkoutOpen:false}};
  let r;try{r=await api('/api/checkout',body)}catch(e){return {ok:false,status:503,j:{error:'Checkout could not start. Nothing was charged. Email support@rokwilder.com if you need help.'}}}
  if(r.ok&&r.j&&r.j.url){if(!safePayUrl(r.j.url,c))return {ok:false,status:502,j:{error:'Checkout did not open a Stripe page. Nothing was charged. Email support@rokwilder.com.'}};return r}
  if(!r.j)r.j={};if(!r.j.error)r.j.error='Checkout could not start. Nothing was charged. Try again, or email support@rokwilder.com.';
  return r;
}
function rememberBuy(info){try{sessionStorage.setItem(BUY_KEY,JSON.stringify(info))}catch(e){}}
function pendingBuy(){try{const s=sessionStorage.getItem(BUY_KEY);return s?JSON.parse(s):null}catch(e){return null}}
function clearBuy(){try{sessionStorage.removeItem(BUY_KEY)}catch(e){}}
function resumePath(k){
  if(k==='package')return '/buy.html?p=package';
  if(k==='extra_unit')return '/buy.html?p=extra_unit';
  return '/pricing.html?buy=fullpass#fullpass';
}
function loadSale(force){
  if(force)saleP=null;
  if(!saleP)saleP=Promise.all([catalog(),account(!!force)]).then(([c,a])=>{
    const st={
      open:!!(c&&c.checkoutOpen===true),
      pass:passOn(a),
      loggedIn:!!(a&&a.loggedIn),
      founding:!!(c&&c.founding&&c.founding.open&&c.founding.left!==0),
      offline:!!(a&&a.offline),
      catalog:c,
      account:a
    };
    saleState=st;
    if(window.RW)window.RW.saleState=st;
    return st;
  });
  return saleP;
}
function cartHref(st){
  const p=pendingBuy();
  if(p&&p.href){
    if(p.product==='fullpass'&&st&&st.pass)return '/account.html';
    return p.href;
  }
  return '/pricing.html';
}
const CART_SVG='<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7 18a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 18zm10 0a2 2 0 1 0 .001 4.001A2 2 0 0 0 17 18zM6.2 6l.4 2h13.1l-1.6 7.2a1 1 0 0 1-1 .8H8.2a1 1 0 0 1-1-.8L5.2 4H2V2h4.2l.4 1.6L6.2 6z"/></svg>';
function paintNav(a){
  const nav=document.querySelector('header .nav');
  if(!nav)return;
  let tools=nav.querySelector('.rw-tools');
  if(!tools){
    tools=document.createElement('div');
    tools.className='rw-tools';
    nav.appendChild(tools);
    const br=document.createElement('span');
    br.className='rw-break';
    br.setAttribute('aria-hidden','true');
    nav.appendChild(br);
  }
  const logged=!!(a&&a.loggedIn);
  let cart=tools.querySelector('.rw-cart');
  if(!cart){
    cart=document.createElement('a');
    cart.className='rw-cart';
    cart.innerHTML=CART_SVG+'<span class="rw-word">Checkout</span>';
    tools.appendChild(cart);
  }
  const href=cartHref(saleState);
  cart.href=href;
  cart.setAttribute('aria-label',pendingBuy()?'Resume checkout':'Checkout');
  let link=tools.querySelector('.rw-acct');
  if(!link){link=document.createElement('a');link.className='rw-acct';tools.appendChild(link)}
  link.href=ROOT+(logged?'account.html':'login.html');
  link.textContent=logged?'My account':'Log in';
  if(a&&a.testMode&&!document.querySelector('.rw-test')){
    const t=document.createElement('div');
    t.className='rw-test';
    t.textContent='TEST MODE · no real charges · checkout still follows the server switch · not live';
    document.body.prepend(t);
  }
}
async function nav(){
  paintNav(null);
  const a=await account();
  try{await loadSale(false)}catch(e){}
  paintNav(a);
  return a;
}
function noteNear(el,text){
  if(!el||!el.insertAdjacentElement)return;
  let n=el.nextElementSibling;
  if(!n||!n.classList||!n.classList.contains('rw-sale-note')){
    n=document.createElement('p');
    n.className='rw-calm rw-sale-note';
    n.setAttribute('role','status');
    el.insertAdjacentElement('afterend',n);
  }
  n.hidden=false;
  n.textContent=text;
}
function paintState(st){
  document.querySelectorAll('[data-rw-state]').forEach(el=>{
    const kind=el.getAttribute('data-rw-state')||'sale';
    if(kind==='login'){
      el.hidden=false;
      el.textContent=st.open?'Logging in does not charge your card.':'Checkout is not open. Logging in does not charge your card.';
      return;
    }
    if(kind==='buy'){
      el.hidden=false;
      el.textContent=st.open?'The price is set by the server. A promo code goes on the Stripe page.':'Checkout is not open.';
      return;
    }
    if(st.pass||st.open){el.hidden=true;return}
    el.hidden=false;
    el.textContent='Checkout is not open.';
  });
}
function saleLabel(el,st){
  const k=el.getAttribute('data-rw-sale');
  if(k==='fullpass'&&st.pass)return 'You have the Full Pass';
  if(!st.open)return '';
  if(k==='fullpass'&&el.hasAttribute('data-rw-founding')&&st.founding)return 'Get the Founding Hunter price';
  if(k==='fullpass')return 'Get the Full Pass';
  if(k==='package')return 'Get a scouting package';
  if(k==='extra_unit')return 'Add an extra unit';
  return '';
}
function paintButtons(st){
  document.querySelectorAll('[data-rw-sale]').forEach(el=>{
    const k=el.getAttribute('data-rw-sale');
    const label=saleLabel(el,st);
    if(!label)return;
    el.textContent=label;
    el.classList.remove('dis');
    if(el.tagName!=='A'){el.setAttribute('role','button');if(!el.hasAttribute('tabindex'))el.tabIndex=0}
    let dest;
    if(k==='fullpass'&&st.pass)dest=ROOT+'account.html';
    else if(st.loggedIn)dest=resumePath(k);
    else dest='/login.html?next='+encodeURIComponent(resumePath(k));
    if(el.tagName==='A')el.setAttribute('href',dest);
  });
}
function armSales(){
  document.querySelectorAll('[data-rw-sale]').forEach(el=>{
    if(el.tagName!=='A'){el.setAttribute('role','button');if(!el.hasAttribute('tabindex'))el.tabIndex=0}
  });
}
async function saleButtons(){
  armSales();
  const st=await loadSale(false);
  paintState(st);
  paintButtons(st);
  paintNav(st.account||null);
  return st;
}
async function goStripe(r,el,k){
  if(r.status===401){location.href=ROOT+'login.html?next='+encodeURIComponent(resumePath(k||'fullpass'));return}
  if(r.ok&&r.j&&r.j.url){location.assign(r.j.url);return}
  noteNear(el,(r.j&&r.j.error)||'Checkout could not start. Nothing was charged.');
}
async function onSale(el){
  if(buying)return;
  const k=el.getAttribute('data-rw-sale');
  if(k!=='fullpass'&&k!=='package'&&k!=='extra_unit')return;
  buying=true;
  el.setAttribute('aria-busy','true');
  try{
    const st=await loadSale(true);
    paintState(st);
    paintButtons(st);
    paintNav(st.account||null);
    if(k==='fullpass'&&st.pass){
      clearBuy();
      noteNear(el,'You have the Full Pass.');
      location.href=ROOT+'account.html';
      return;
    }
    if(!st.open){
      noteNear(el,'Checkout is not open.');
      const href=el.getAttribute('href')||'';
      if(href.indexOf('#waitlist')!==-1){
        const id=(href.split('#')[1]||'waitlist').split('?')[0];
        const t=document.getElementById(id);
        if(t&&t.scrollIntoView)t.scrollIntoView({block:'start'});
      }
      return;
    }
    rememberBuy({product:k,href:resumePath(k)});
    paintNav(st.account||null);
    if(!st.loggedIn){location.href=ROOT+'login.html?next='+encodeURIComponent(resumePath(k));return}
    if(k!=='fullpass'){location.href=ROOT+'buy.html?p='+encodeURIComponent(k);return}
    noteNear(el,'Sending you to checkout.');
    const r=await startCheckout({product:'fullpass'});
    await goStripe(r,el,k);
  }catch(e){
    noteNear(el,'Checkout could not start. Nothing was charged.');
  }finally{
    buying=false;
    if(el&&el.removeAttribute)el.removeAttribute('aria-busy');
    if(el&&el.isConnected&&saleState){
      const label=saleLabel(el,saleState);
      if(label&&el.textContent==='Sending you to checkout.')el.textContent=label;
    }
  }
}
async function maybeBuyFullPass(){
  const Q=new URLSearchParams(location.search);
  if(Q.get('buy')!=='fullpass')return;
  const st=await loadSale(true);
  paintState(st);
  paintButtons(st);
  const el=document.querySelector('[data-rw-sale="fullpass"]')||document.getElementById('fullpass');
  if(st.pass){clearBuy();noteNear(el,'You have the Full Pass.');return}
  if(!st.open){noteNear(el,'Checkout is not open.');return}
  if(!st.loggedIn){location.href=ROOT+'login.html?next='+encodeURIComponent(location.pathname+location.search+location.hash);return}
  if(buying)return;
  buying=true;
  rememberBuy({product:'fullpass',href:'/pricing.html?buy=fullpass#fullpass'});
  try{
    noteNear(el,'Sending you to checkout.');
    const r=await startCheckout({product:'fullpass'});
    await goStripe(r,el,'fullpass');
  }finally{buying=false}
}
async function boot(o){const st=String(o.state||'').toLowerCase();
 if(BAND==='wy'||st==='wy'||!EXACT.has(st)){window.RW_FP=false;for(const s of [].concat(o.free||[]))await load(s);for(const s of o.after||[])await load(s);nav();return false}
 const a=await account();let fp=hasFullPass(a,st);const free=[].concat(o.free||[]);
 if(fp){try{await load(API+'/api/fullpass/data/'+st+'.js')}catch(e){fp=false}}
 if(!fp)for(const s of free)await load(s);
 window.RW_FP=fp;for(const s of o.after||[])await load(s);
 const m=document.querySelector('main');if(m&&(fp||a.loggedIn)&&!document.getElementById('rwbar')){const b=document.createElement('div');b.id='rwbar';b.className='rwbar '+(fp?'on':'off');
  b.innerHTML=fp?'<b>Full Pass:</b> exact draw odds are on for Colorado, Utah and Arizona. Exact Wyoming odds are not included.':'<b>Free view:</b> you see the verdict word and harvest band. Exact Wyoming odds are not in the Full Pass. <a href="'+ROOT+'pricing.html#fullpass">Full Pass pricing</a>';
  const out=document.getElementById('out');if(out&&out.parentNode)out.parentNode.insertBefore(b,out);else m.prepend(b)}
 nav();return fp}
document.addEventListener('click',function(ev){
  const el=ev.target&&ev.target.closest&&ev.target.closest('[data-rw-sale]');
  if(!el)return;
  ev.preventDefault();
  onSale(el);
},true);
document.addEventListener('keydown',function(ev){
  if(ev.key!=='Enter'&&ev.key!==' ')return;
  const el=ev.target&&ev.target.closest&&ev.target.closest('[data-rw-sale]');
  if(!el||el.tagName==='A')return;
  ev.preventDefault();
  onSale(el);
});
window.RW={API,ROOT,account,hasFullPass,api,boot,nav,esc,catalog,health,startCheckout,safePayUrl,safePortalUrl,saleButtons,loadSale,pendingBuy,rememberBuy,clearBuy,EXACT,VER};
window.RW.saleState=saleState;
document.addEventListener('DOMContentLoaded',()=>{
  armSales();
  if(!me_.hasAttribute('data-no-nav'))nav();
  else paintNav(null);
  saleButtons();
  maybeBuyFullPass();
});
})();
