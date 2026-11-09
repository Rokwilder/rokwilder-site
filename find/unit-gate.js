// Hides paid draw verdicts on the older unit pages, and exact CPW numbers on the sample teasers.
// ?preview=fullpass (or a member file) leaves the page as written. Checkout stays closed.
(function(){
const me=document.currentScript;
const pricing=(me&&me.dataset.pricing)||'../../pricing.html';
if(window.RWGate&&RWGate.paid())return;
const box=RWGate.unlock(pricing);
if(me&&me.dataset.mode==='teaser'){
  const head=[...document.querySelectorAll('h2')].find(el=>/Real CPW numbers/i.test(el.textContent));
  if(head){
    head.insertAdjacentHTML('beforebegin', box);
    head.hidden=true;
    const next=head.nextElementSibling;
    if(next&&next.classList.contains('tw')){next.hidden=true;next.style.setProperty('display','none','important')}
  }
  return;
}
document.querySelectorAll('.vg').forEach(el=>{el.hidden=true;el.style.setProperty('display','none','important')});
document.querySelectorAll('main p').forEach(p=>{
  if(p.closest('.fpbox'))return;
  if(/Likely or Yes|come out/.test(p.textContent))p.hidden=true;
  if(/verdict words here are free/i.test(p.textContent))p.innerHTML=p.innerHTML.replace(/The verdict words here are free\.?/i,'The verdict for each hunt code is in the Full Pass.');
});
document.querySelectorAll('details').forEach(d=>{
  if(/Likely or Yes|come out|verdict words here are free/i.test(d.textContent))d.hidden=true;
});
const lead=document.querySelector('p.lead');
if(lead&&/verdict/i.test(lead.textContent))lead.textContent='Hunt codes, seasons and dates for this unit. The draw verdict for each hunt code is in the Full Pass.';
const anchor=document.querySelector('.hl')||document.querySelector('h2');
if(anchor&&!document.getElementById('unlock'))anchor.insertAdjacentHTML('beforebegin', box);
})();
