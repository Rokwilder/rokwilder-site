// Point-by-point draw counts. Renders only rows the caller already read from an official file.
// A free hunter sees the lock. A member file with no point-by-point count says so.
(function(){
'use strict';
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function num(n){return typeof n==='number'&&Number.isFinite(n)?n.toLocaleString():'';}
function locked(href){
  return `<h3>Where the tags went</h3><p class="dq">Who applied and who drew, by point level, is in the Full Pass.</p><p class="rw-fp-cta"><a class="btn" href="${esc(href||'../pricing.html')}">Full Pass pricing</a></p>`;
}
function missing(why){
  return `<h3>Where the tags went</h3><p class="dq">${esc(why||'A point-by-point count of who applied and who drew is not in the draw report on this page.')}</p>`;
}
function table(o){
  const rows=o.rows||[];
  const body=rows.map(r=>`<tr><td>${esc(r.points)}</td><td>${r.applied==null?'Not printed':num(r.applied)}</td><td>${r.drew==null?'Not printed':num(r.drew)}</td><td>${esc(r.how||'')}</td></tr>`).join('');
  return `<h3>Where the tags went (${esc(o.year)})</h3><table class="dt"><tr><th>Points</th><th>Applied</th><th>Drew</th><th>How</th></tr>${body}</table>`+(o.sentence?`<p class="dq">${esc(o.sentence)}</p>`:'');
}
function show(o){
  if(!o||!o.paid)return locked(o&&o.pricing);
  if(!o.rows||!o.rows.length)return missing(o.why);
  return table(o);
}
window.RWTags={show,locked,missing,table};
})();
