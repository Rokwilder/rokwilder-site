// Rokwilder member helper (UnitIQ). Login state, the Full Pass check, and the Find Your Hunt data loader.
// The API lives at api.rokwilder.com in production; anywhere else (local preview) it is the same origin.
// Checkout stays closed until the API reports checkoutOpen. This file never loads exact Wyoming odds.
(function(){
'use strict';
const me_=document.currentScript;
const ROOT=me_.src.replace(/member\/rw\.js(\?.*)?$/,'');
const API=window.RW_API!=null?window.RW_API:(/(^|\.)rokwilder\.com$/.test(location.hostname)?'https://api.rokwilder.com':'');
const EXACT=new Set(['co','ut','az']); // Wyoming stays a free verdict band. Do not request /api/fullpass/data/wy.js.
const BAND=(me_.getAttribute('data-band-only')||'').toLowerCase();
let acct=null;
function account(force){if(!acct||force)acct=fetch(API+'/api/account',{credentials:'include',cache:'no-store'}).then(r=>r.ok?r.json():{loggedIn:false}).catch(()=>({loggedIn:false,offline:true}));return acct}
function hasFullPass(a,st){const f=a&&a.loggedIn&&a.fullpass;return !!(f&&f.active&&(f.states||[]).some(s=>s==='ALL'||s===String(st).toUpperCase()))}
async function api(path,body,method){const r=await fetch(API+path,{method:method||(body===undefined?'GET':'POST'),credentials:'include',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 let j={};try{j=await r.json()}catch(e){}return {ok:r.ok,status:r.status,j}}
function load(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=ok;s.onerror=()=>no(new Error('could not load '+src));document.body.appendChild(s)})}
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function hostOk(u,hosts){try{const x=new URL(u);return hosts.indexOf(x.hostname)!==-1}catch(e){return false}}
function safePayUrl(u,cat){try{const x=new URL(u);if(x.protocol==='https:'&&x.hostname==='checkout.stripe.com')return true;
 if(cat&&cat.testMode===true&&cat.checkoutOpen===true&&x.protocol==='http:'&&(x.hostname==='127.0.0.1'||x.hostname==='localhost')&&x.pathname.indexOf('/pay/')===0)return true;
 return false}catch(e){return false}}
function safePortalUrl(u,testMode){try{const x=new URL(u);if(x.protocol==='https:'&&x.hostname==='billing.stripe.com')return true;
 if(testMode&&x.protocol==='http:'&&(x.hostname==='127.0.0.1'||x.hostname==='localhost')&&x.pathname.indexOf('/portal/')===0)return true;
 return false}catch(e){return false}}
async function catalog(){try{const r=await fetch(API+'/api/catalog',{credentials:'include',cache:'no-store'});if(!r.ok)return null;return await r.json()}catch(e){return null}}
// Fail closed. A missing API, a closed flag, or a non-Stripe URL never navigates away and never charges.
async function startCheckout(body){const c=await catalog();
 if(!c||c.checkoutOpen!==true)return {ok:false,status:503,j:{error:'Checkout is not open. Nothing was charged.',checkoutOpen:false}};
 let r;try{r=await api('/api/checkout',body)}catch(e){return {ok:false,status:503,j:{error:'Checkout could not start. Nothing was charged. Email support@rokwilder.com if you need help.'}}}
 if(r.ok&&r.j&&r.j.url){if(!safePayUrl(r.j.url,c))return {ok:false,status:502,j:{error:'Checkout did not open a Stripe page. Nothing was charged. Email support@rokwilder.com.'}};return r}
 if(!r.j)r.j={};if(!r.j.error)r.j.error='Checkout could not start. Nothing was charged. Try again, or email support@rokwilder.com.';
 return r}
async function nav(){const a=await account();const n=document.querySelector('header .nav');
 if(n&&!n.querySelector('.rw-acct')){const l=document.createElement('a');l.className='l rw-acct';l.href=ROOT+(a.loggedIn?'account.html':'login.html');l.textContent=a.loggedIn?'My account':'Log in';n.appendChild(l)}
 if(a.testMode&&!document.querySelector('.rw-test')){const t=document.createElement('div');t.className='rw-test';t.textContent='TEST MODE · no real charges · checkout still follows the server switch · not live';document.body.prepend(t)}
 return a}
async function boot(o){const st=String(o.state||'').toLowerCase();
 // Public Wyoming (and any other state) always uses the band-only files already on the page's free list.
 if(BAND==='wy'||st==='wy'||!EXACT.has(st)){window.RW_FP=false;for(const s of [].concat(o.free||[]))await load(s);for(const s of o.after||[])await load(s);nav();return false}
 const a=await account();let fp=hasFullPass(a,st);const free=[].concat(o.free||[]);
 if(fp){try{await load(API+'/api/fullpass/data/'+st+'.js')}catch(e){fp=false}}
 if(!fp)for(const s of free)await load(s);
 window.RW_FP=fp;for(const s of o.after||[])await load(s);
 const m=document.querySelector('main');if(m&&(fp||a.loggedIn)&&!document.getElementById('rwbar')){const b=document.createElement('div');b.id='rwbar';b.className='rwbar '+(fp?'on':'off');
  b.innerHTML=fp?'<b>Full Pass:</b> exact draw odds are on for Colorado, Utah and Arizona. Exact Wyoming odds are not included.':'<b>Free view:</b> you see the verdict word and harvest band. Exact Wyoming odds are not in the Full Pass. <a href="'+ROOT+'pricing.html#fullpass">Full Pass pricing</a>';
  const out=document.getElementById('out');if(out&&out.parentNode)out.parentNode.insertBefore(b,out);else m.prepend(b)}
 nav();return fp}
window.RW={API,ROOT,account,hasFullPass,api,boot,nav,esc,catalog,startCheckout,safePayUrl,safePortalUrl,EXACT};
if(!me_.hasAttribute('data-no-nav'))document.addEventListener('DOMContentLoaded',()=>nav());
})();
