// Soft front-end gate. There is no member login yet, so this only hides the hunt list in the page.
// FULLPASS_GATING stays on. ?preview=fullpass, or window.RW_FP from a member data file, shows the paid list.
// Checkout stays closed. The public files are still verdict bands; exact percentages need the member file.
(function(){
const FULLPASS_GATING=true;
const Q=new URLSearchParams(location.search);
function paid(){
  if(!FULLPASS_GATING)return true;
  return window.RW_FP===true || Q.get('preview')==='fullpass';
}
function stamp(params){
  if(Q.get('preview')==='fullpass' || window.RW_FP===true) params.set('preview','fullpass');
  return params;
}
function banner(){
  if(!(Q.get('preview')==='fullpass' && window.RW_FP!==true)) return '';
  return '<p class="note">Full Pass preview. Checkout is not open. This is the hunt list. Exact percentages are not in the public file.</p>';
}
function unlock(pricing){
  return `<aside class="fpbox" id="unlock" aria-label="Unlock with Full Pass"><p class="fpt">Unlock with Full Pass</p><ul><li>The full hunt list, with a verdict on every hunt you can draw</li><li>Exact odds, where we have published them</li><li>Harvest success</li><li>The what-can-I-draw finder</li></ul><p class="fpp">We do the research and narrow it to the hunts you can draw. Full Pass: $29.99 a year. Founding Hunter: $19.99 a year for the first 200 members, locked as long as you keep renewing. Not on sale yet. Checkout is not open.</p><p><a class="btn" href="${pricing}#waitlist">Join the waitlist</a></p></aside>`;
}
function freeShell(o){
  const n=o.count, sp=o.species;
  return `<h2 id="lt">You could draw ${n} ${sp} hunt${n===1?'':'s'}</h2><p class="dq">${o.who} Free shows how this works: the count, plus full results for two sample units. The rest of the list is the Full Pass.</p>`+
    unlock(o.pricing)+
    `<h3>Sample units <span class="samp">SAMPLE</span></h3><p class="note">${o.sampleNote}</p>`+
    (o.samplesHtml||'<p class="dq">These sample units have no matching hunts with these choices. The count above still includes every matching hunt.</p>')+
    (o.extra||'')+
    '<p class="note">Season dates, how the draw works and the checklist on this page stay free. Not a guarantee. Checkout is not open.</p>';
}
window.RWGate={FULLPASS_GATING,paid,stamp,banner,unlock,freeShell};
})();
