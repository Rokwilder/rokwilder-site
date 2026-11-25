// Soft front-end gate. Member login is on this page via member/rw.js. This still hides the hunt list unless window.RW_FP is set or ?preview=fullpass is used.
// FULLPASS_GATING stays on. ?preview=fullpass, or window.RW_FP from a member data file, shows the paid list.
// The public files are still verdict bands; exact percentages need the member file.
// Buy links follow checkoutOpen: Get the Full Pass when checkout is open, and the old not-on-sale line when it is closed.
(function(){
const FULLPASS_GATING=true;
const Q=new URLSearchParams(location.search);
function advisorMode(){
  const q=new URLSearchParams(location.search).get('preview');
  if(q==='advisor'||q==='advisor-free'){
    try{sessionStorage.setItem('rw_advisor_preview', q==='advisor'?'member':'free')}catch(e){}
    return q==='advisor'?'member':'free';
  }
  try{
    const s=sessionStorage.getItem('rw_advisor_preview');
    if(s==='member'||s==='free') return s;
  }catch(e){}
  return null;
}
function paid(){
  if(!FULLPASS_GATING)return true;
  return window.RW_FP===true || Q.get('preview')==='fullpass' || advisorMode()==='member';
}
function stamp(params){
  const a=advisorMode();
  if(a==='member') params.set('preview','advisor');
  else if(a==='free') params.set('preview','advisor-free');
  else if(Q.get('preview')==='fullpass' || window.RW_FP===true) params.set('preview','fullpass');
  return params;
}
function sale(){return (window.RW&&window.RW.saleState)||{open:false,pass:false}}
function banner(){
  if(!(Q.get('preview')==='fullpass' && window.RW_FP!==true)) return '';
  const closed=sale().open===true?'':' Checkout is not open.';
  return '<p class="note">Full Pass preview.'+closed+' This is the hunt list. Exact percentages are not in the public file.</p>';
}
function offerHTML(pricing, kind){
  if(window.RW_FP===true) return '';
  const open=sale().open===true;
  const href=open?pricing+'#fullpass':pricing;
  const label=open?'Get the Full Pass':'See pricing';
  const link='<a href="'+href+'">'+label+'</a>';
  if(kind==='paren') return open?'. '+link:' (not on sale yet). '+link;
  return open?' '+link:' Not on sale yet. '+link;
}
function paintOffers(){
  const open=sale().open===true?'1':'0';
  document.querySelectorAll('.rw-offer').forEach(el=>{
    if(el.getAttribute('data-painted')===open) return;
    el.setAttribute('data-painted', open);
    el.innerHTML=offerHTML(el.getAttribute('data-pricing')||'pricing.html', el.getAttribute('data-kind')||'aside');
  });
}
function armOffers(){
  const run=()=>{
    paintOffers();
    if(window.RW&&RW.loadSale) RW.loadSale().then(paintOffers).catch(function(){});
  };
  const obs=new MutationObserver(run);
  ['out','detail'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) obs.observe(el,{childList:true,subtree:true});
  });
  run();
}
armOffers();
function unlock(pricing){
  const open=sale().open===true;
  const line=open
    ? 'We do the research and narrow it to the hunts you can draw. Full Pass: $29.99 a year. Founding Hunter: $19.99 a year for the first 200 members, locked as long as you keep renewing.'
    : 'We do the research and narrow it to the hunts you can draw. Full Pass: $29.99 a year. Founding Hunter: $19.99 a year for the first 200 members, locked as long as you keep renewing. Not on sale yet. Checkout is not open.';
  const href=open?pricing+'#fullpass':pricing+'#waitlist';
  const label=open?'Get the Full Pass':'See Full Pass';
  if(window.RW_FP===true) return '';
  return `<aside class="fpbox rw-fp-cta" id="unlock" aria-label="Unlock with Full Pass"><p class="fpt">Unlock with Full Pass</p><ul><li>The full hunt list, with a verdict on every hunt you can draw</li><li>Exact odds, where we have published them</li><li>Harvest success</li><li>The what-can-I-draw finder</li></ul><p class="fpp">${line}</p><p><a class="btn" href="${href}">${label}</a></p><p class="renew">Renews every year at the same price until you cancel. You can cancel anytime from your account.</p><p class="renew">Renews every year at $19.99. That price stays locked as long as you keep renewing. You can cancel anytime from your account.</p></aside>`;
}
// At most n hunts from each sample unit. A hunt is shown once and counts toward the first of its sample units that still has room.
function takePerUnit(rows, unitOf, n){
  n=n==null?3:n;
  const seen={};
  const out=[];
  for(const row of rows){
    const units=[].concat(unitOf(row)||[]).map(String).filter(Boolean);
    const open=units.find(u=>(seen[u]||0)<n);
    if(!open)continue;
    seen[open]=(seen[open]||0)+1;
    out.push(row);
  }
  return out;
}
function freeShell(o){
  const n=o.count, sp=o.species;
  return `<h2 id="lt">You could draw ${n} ${sp} hunt${n===1?'':'s'}</h2><p class="dq">${o.who} Free shows how this works: the count, plus up to 3 hunts from each sample unit. The rest of the list is the Full Pass.</p>`+
    unlock(o.pricing)+
    `<h3>Sample units <span class="samp">SAMPLE</span></h3><p class="note">${o.sampleNote}</p>`+
    (o.samplesHtml||'<p class="dq">These sample units have no matching hunts with these choices. The count above still includes every matching hunt.</p>')+
    (o.extra||'')+
    (sale().open?'<p class="note">Season dates, how the draw works and the checklist on this page stay free. Not a guarantee.</p>':'<p class="note">Season dates, how the draw works and the checklist on this page stay free. Not a guarantee. Checkout is not open.</p>');
}
window.RWGate={FULLPASS_GATING,paid,stamp,banner,unlock,freeShell,takePerUnit,offerHTML,paintOffers,advisorMode};
})();
