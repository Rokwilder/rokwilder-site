// Tag history in the hunt detail. Exact counts render only when the Full Pass file set window.RWQ.
// The public page has no counts. A missing year stays "not available".
(function(){
'use strict';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function num(n){return Number(n).toLocaleString()}
function trend(rec, years){
  const have=years.filter(y=>rec[y]&&rec[y].quota!=null);
  if(have.length<2)return '';
  const y1=have[have.length-2], y2=have[have.length-1];
  const a=rec[y1].quota, b=rec[y2].quota;
  if(a===0)return b===0?'Tags the same as '+y1+'.':'';
  const pct=Math.round((b-a)/a*100);
  if(pct===0)return 'Tags the same as '+y1+'.';
  return 'Tags '+(pct>0?'up':'down')+' '+Math.abs(pct)+'% from '+y1+'.';
}
function row(year, cell, hunters){
  const tags=cell&&cell.quota!=null?num(cell.quota)+' tags':'Tags: not available';
  const drawn=cell&&cell.drawn!=null?num(cell.drawn)+' drawn':'Drawn: not available';
  let hunt='Hunters afield: not available';
  if(hunters&&hunters.n!=null)hunt=num(hunters.n)+' hunters afield'+(hunters.confirmed===false?' (not confirmed)':'');
  return '<div class="yr"><b>'+esc(year)+'</b><span>'+esc(tags)+'</span><span>'+esc(drawn)+'</span><span>'+esc(hunt)+'</span></div>';
}
function html(state, code, fp){
  const pub=window.RWQPublic&&RWQPublic[state];
  const pack=window.RWQ&&RWQ[state];
  const rec=pack&&pack.hunts&&pack.hunts[code];
  if(!fp){
    if(pub&&pub.gated)return '<p class="note fpx">Tags each year, and hunters afield: Full Pass.</p>';
    return '<p class="note">Tag history is not available for this state yet.</p>';
  }
  if(!rec){
    if(pub&&pub.gated)return '<div class="qhist"><p class="lh">Tags by year</p><p class="note">Tag history for this hunt is not available.</p></div>';
    return '<p class="note">Tag history is not available for this state yet.</p>';
  }
  const years=(pack.years||[]).map(String);
  const line=trend(rec, years);
  const note=pack.note||'A year that says not available was not in the report. These figures are not estimates.';
  return '<div class="qhist"><p class="lh">Tags by year</p>'+years.map(y=>row(y, rec[y], rec.hunters&&rec.hunters[y])).join('')+
    (line?'<p class="qtr">'+esc(line)+'</p>':'')+
    '<p class="note">'+esc(note)+'</p></div>';
}
window.RWQuota={html};
})();
