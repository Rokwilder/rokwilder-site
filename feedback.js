// Site feedback form -> rokwilder-waitlist Worker POST /feedback (PREVIEW: endpoint not deployed yet).
(function(){
const $=id=>document.getElementById(id),Q=new URLSearchParams(location.search);
const LOCAL=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API=(LOCAL&&Q.get('api'))||'https://rokwilder-waitlist.rokwilder.workers.dev/feedback';
const TOP=['find','maps','packages','other'];
// Page they came from: ?from= (Find Your Hunt links) or the referrer (footer link). Only our own pages.
let from=Q.get('from')||document.referrer||'';try{const u=new URL(from,location.href);from=u.origin==location.origin?u.href:''}catch(e){from=''}
// Hunt code / filters from the Find Your Hunt URL.
let ctx='';try{const u=new URL(from);if(/find\.html$/.test(u.pathname)){const p=u.searchParams,b=[];
 for(const [k,n] of [['sp','species'],['r','residency'],['p','points'],['w','weapon'],['kid','kid'],['priv','private land'],['h','hunt'],['tab','tab']])if(p.get(k))b.push(n+'='+p.get(k));
 if(u.hash)b.push('view='+u.hash.slice(1));ctx=b.join(' ').slice(0,300)}}catch(e){}
const ab=Q.get('about');if(TOP.includes(ab))document.querySelector(`input[name=topic][value=${ab}]`).checked=true;
const esc=t=>t.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
$('fba').innerHTML=from?`<b>We'll attach:</b> the page you were on (${esc(from.replace(location.origin+'/',''))})${ctx?`<br>and what you were looking at: ${esc(ctx)}`:''}`:'<b>We\'ll attach:</b> nothing else.';
$('fbm').oninput=()=>$('fbc').textContent=$('fbm').value.length+' / 2000';
const f=$('fb');f.onsubmit=async e=>{e.preventDefault();const m=$('fbmsg'),b=$('fbs');m.className='msg';m.textContent='';
 const msg=$('fbm').value.trim(),em=$('fbe').value.trim();
 if(msg.length<3){m.className='msg err';m.textContent='Please write a short message.';$('fbm').focus();return}
 if(em&&!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)){m.className='msg err';m.textContent="That email doesn't look right. Leave it blank if you don't want a reply.";$('fbe').focus();return}
 b.disabled=true;b.textContent='Sending...';
 try{const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic:f.topic.value,message:msg,email:em,page_url:from,context:ctx,website:f.website.value})});
  const d=await r.json().catch(()=>({}));
  if(r.ok&&d.ok){f.outerHTML=`<div class="ok" id="fbok"><b>Thanks! We got it.</b><br>${em?"We'll reply to you by email.":'We read every message.'}${from?`<br><a href="${esc(from)}">← Back to where you were</a>`:''}</div>`;return}
  m.className='msg err';m.textContent=d.error||'Something went wrong. Please try again.'}
 catch(x){m.className='msg err';m.textContent="Couldn't send right now. Please try again, or email christopher@rokwilder.com."}
 b.disabled=false;b.textContent='Send feedback'};
})();
