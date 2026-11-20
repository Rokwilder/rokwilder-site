// Draw-result history. One state's band file loads after the hunter asks for hunts.
// The public file stores bands, not percentages. This never prints a percent.
// Last year is the newest year on that hunt. A later year in the file shows up on its own.
// A 2-year or 3-year line uses the published average when that average is exactly those years.
// When every year in the window sits in one band, the average is that band, because the
// published cutoffs do not let the mean leave the band. Anything else is not invented.
(function(){
const KEY='rw_draw_span';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const YES=v=>v>=.995?"YES, you'll draw":v>=.75?'LIKELY':v>=.25?'MAYBE':v>=.05?'LONG SHOT':'NOT THIS YEAR';
const DREW=v=>v===1?'ALL DREW':v>=.75?'MOST DREW':v>=.25?'SOME DREW':v>=.05?'FEW DREW':v>0?'UNDER ONE IN TWENTY':v===0?'NONE DREW':'NO RESULT';
const COL=[[.995,'#263E2C'],[.75,'#6F7F4F'],[.25,'#C4B28C'],[.05,'#D2501F']];
const RANK=[0,0.01,0.05,0.25,0.75,1];
const col=v=>(COL.find(c=>v>=c[0])||[0,'#E8E0D2'])[1];
const me=typeof document!=='undefined'&&document.currentScript;
const url=me&&me.dataset.history;
let data=null, failed=false, pending=null, scheduled=false, busy=false;

function span(){
  try{
    const v=localStorage.getItem(KEY);
    if(v==='1'||v==='2'||v==='3') return Number(v);
  }catch(e){}
  return 1;
}
function setSpan(v){
  const n=String(v)==='2'?'2':String(v)==='3'?'3':'1';
  try{localStorage.setItem(KEY,n)}catch(e){}
  return Number(n);
}
function yearsIn(text){
  return [...String(text??'').matchAll(/(?:^|[^0-9])(20\d{2})(?![0-9])/g)].map(m=>Number(m[1]));
}
function maxYear(text){
  const ys=yearsIn(text);
  return ys.length?Math.max.apply(null,ys):null;
}
function seasonLabel(year, kind, band){
  if(!band) return '';
  if(year==null||!Number.isFinite(Number(year))) return String(band);
  const name=kind==='result'?'result':'estimate';
  return Number(year)+' '+name+': '+band;
}
function word(v){
  if(v==null)return '';
  return data&&data.words==='drew'?DREW(v):YES(v);
}
function dot(v){return `<i class="vdot" style="background:${col(v)}"></i>`}
function rankOf(v){const i=RANK.indexOf(v);return i<0?null:i}
function recordFor(hunt, side){
  if(!hunt)return null;
  if(hunt.y)return hunt;
  if(side&&hunt[side]&&hunt[side].y)return hunt[side];
  return null;
}
function view(rec, pts){
  const sample=Object.values(rec.y).find(v=>v!=null);
  const pointed=sample&&typeof sample==='object';
  if(!pointed){
    return {years:rec.y, avg:rec.n>=2?rec.a:null, n:rec.n||0, trend:rec.t||null, pointed:false};
  }
  if(pts==null||pts==='')return {years:{}, avg:null, n:0, trend:null, pointed:true, missing:true};
  const key=String(pts);
  const years={};
  for(const [yr,map] of Object.entries(rec.y)){
    if(map&&Object.prototype.hasOwnProperty.call(map, key))years[yr]=map[key];
  }
  const n=rec.n&&rec.n[key]||0;
  return {years, avg:n>=2?rec.a[key]:null, n, trend:rec.t&&rec.t[key]||null, pointed:true};
}
function series(row){
  return Object.keys(row.years||{}).filter(y=>row.years[y]!=null).sort((a,b)=>Number(a)-Number(b)).map(y=>({year:String(y), band:row.years[y]}));
}
function sameBand(slice){
  if(!slice.length)return null;
  const b=slice[0].band;
  return slice.every(x=>x.band===b)?b:null;
}
// want is 1 (newest year), 2, or 3. Shorter history keeps the years that exist.
function windowOf(row, want){
  const all=series(row||{years:{}});
  const ask=want===2?2:want===3?3:1;
  if(!all.length)return {ok:false, kind:'none', band:null, n:0, label:'History not available'};
  if(ask===1){
    const last=all[all.length-1];
    return {ok:true, kind:'year', year:last.year, band:last.band, n:1, short:false, label:last.year+' draw'};
  }
  const slice=all.slice(-ask);
  if(slice.length===1){
    const y=slice[0];
    return {ok:true, kind:'year', year:y.year, band:y.band, n:1, short:true, label:y.year+' draw (only 1 year available)'};
  }
  const covers=row&&row.avg!=null&&Number(row.n)===slice.length&&all.length===slice.length;
  const shared=sameBand(slice);
  const band=covers?row.avg:(shared!=null?shared:null);
  if(band==null){
    let label=ask+'-year average is not published for this hunt';
    let wider=null, widerN=null;
    if(row&&row.avg!=null&&Number(row.n)>=2&&Number(row.n)===all.length&&all.length>slice.length){
      label+='. Published average uses '+row.n+' years';
      wider=row.avg;
      widerN=Number(row.n);
    }
    return {ok:false, kind:'missing', band:null, n:slice.length, short:slice.length<ask, wider, widerN, label};
  }
  const n=slice.length;
  const name=n===2?'2-yr avg':n===3?'3-yr avg':n+'-yr avg';
  const short=n<ask;
  const label=short?name+' (only '+n+' years available)':name;
  return {ok:true, kind:'avg', band, n, short, label};
}
function hintText(head, three, last){
  if(!three||!three.ok||three.short||three.n!==3||three.band==null)return '';
  const subject=head&&head.kind==='avg'&&head.n===3&&!head.short?last:head;
  if(!subject||subject.band==null)return '';
  const a=rankOf(subject.band), b=rankOf(three.band);
  if(a==null||b==null||a===b)return '';
  const harder=a<b;
  if(head&&head.kind==='avg'&&head.n===3&&!head.short){
    return harder?'Last year was harder to draw than this average':'Last year was easier than this average';
  }
  return harder?'Harder to draw than the 3-yr average':'Easier than the 3-yr average';
}
function pctLabel(rate){
  if(typeof rate!=='number'||!Number.isFinite(rate)||rate<0||rate>1) return '';
  const r=Math.round(rate*100);
  if(rate>0&&r===0) return 'under 1%';
  if(rate<1&&r===100) return 'over 99%';
  return r+'%';
}
function memberOn(){
  return window.RW_FP===true||window.RW_EXACT===true;
}
function exactRate(hk, side, pts, year){
  if(!memberOn()) return null;
  const pack=window.RWHyExact;
  const hunt=pack&&pack.hunts&&pack.hunts[hk];
  if(!hunt) return null;
  let node=hunt;
  if(side&&node[side]&&typeof node[side]==='object') node=node[side];
  const cell=node[year]!=null?node[year]:node[String(year)];
  if(typeof cell==='number') return cell;
  if(cell&&typeof cell==='object'&&pts!=null){
    const v=cell[String(pts)];
    return typeof v==='number'?v:null;
  }
  return null;
}
function yearLine(entries, say, allowExact, rates){
  return entries.map(y=>{
    const rate=allowExact&&rates?rates[y.year]:null;
    const value=rate==null?say(y.band):pctLabel(rate);
    return y.year+': '+(value||say(y.band));
  }).join(', ');
}
function trendWord(stored){
  if(stored==='Getting harder'||stored==='Getting easier') return stored;
  if(stored==='Holding steady') return 'Steady';
  return '';
}
function reasonText(rows){
  const list=(rows||[]).filter(r=>r&&Number.isFinite(r.year)).slice().sort((a,b)=>a.year-b.year);
  const tags=list.filter(r=>typeof r.tags==='number'&&Number.isFinite(r.tags));
  if(tags.length>=2){
    const a=tags[tags.length-2], b=tags[tags.length-1];
    if(b.tags<a.tags) return 'Tags cut from '+a.tags.toLocaleString()+' to '+b.tags.toLocaleString();
    if(b.tags>a.tags) return 'Tags up from '+a.tags.toLocaleString()+' to '+b.tags.toLocaleString();
  }
  const apps=list.filter(r=>typeof r.apps==='number'&&Number.isFinite(r.apps));
  if(apps.length>=2){
    const a=apps[apps.length-2], b=apps[apps.length-1];
    if(a.apps>0&&b.apps!==a.apps){
      const pct=Math.round((b.apps-a.apps)/a.apps*100);
      if(pct>0) return 'Applicants up '+pct+'%';
      if(pct<0) return 'Applicants down '+Math.abs(pct)+'%';
    }
  }
  return '';
}
function countsLine(rows){
  const list=(rows||[]).filter(r=>r&&(typeof r.tags==='number'||typeof r.apps==='number')).slice().sort((a,b)=>b.year-a.year);
  if(!list.length) return '';
  return list.map(r=>{
    const bits=[];
    if(typeof r.tags==='number') bits.push(r.tags.toLocaleString()+' tags');
    if(typeof r.apps==='number') bits.push(r.apps.toLocaleString()+' applicants');
    return r.year+': '+bits.join(', ');
  }).join('. ');
}
function countRows(hk){
  if(!memberOn()) return [];
  const rows=[];
  const table=typeof D!=='undefined'?D:(window.D||null);
  if(table&&table[hk]&&Array.isArray(table[hk][6])){
    for(const h of table[hk][6]){
      if(!h) continue;
      const year=Number(h[0]);
      if(!year) continue;
      const tags=typeof h[1]==='number'?h[1]:null;
      const apps=typeof h[2]==='number'?h[2]:null;
      if(tags==null&&apps==null) continue;
      rows.push({year, tags, apps});
    }
  }
  const st=data&&data.state&&{colorado:'co',utah:'ut',arizona:'az',wyoming:'wy',idaho:'id',nevada:'nv',montana:'mt',newmexico:'nm'}[data.state];
  const rec=st&&window.RWQ&&RWQ[st]&&RWQ[st].hunts&&RWQ[st].hunts[hk];
  if(!rows.length&&rec){
    for(const y of Object.keys(rec)){
      if(!/^\d{4}$/.test(y)||!rec[y]) continue;
      const tags=typeof rec[y].quota==='number'?rec[y].quota:null;
      const apps=typeof rec[y].apps==='number'?rec[y].apps:(typeof rec[y].applicants==='number'?rec[y].applicants:null);
      if(tags==null&&apps==null) continue;
      rows.push({year:Number(y), tags, apps});
    }
  }
  return rows;
}
function oddsCard(el){
  return !!(el.closest&&(el.closest('#detail')||el.closest('.yo')));
}
function formatLine(win, say){
  if(!win)return '';
  const band=win.band!=null?win.band:win.wider;
  if(band==null)return win.label;
  return win.label+': '+(say?say(band):'');
}
function sentenceWord(v){
  const w=word(v);
  const map={
    "YES, you'll draw":"Yes, you'll draw",
    'LIKELY':'Likely',
    'MAYBE':'Maybe',
    'LONG SHOT':'Long shot',
    'NOT THIS YEAR':'Not this year',
    'ALL DREW':'All drew',
    'MOST DREW':'Most drew',
    'SOME DREW':'Some drew',
    'FEW DREW':'Few drew',
    'UNDER ONE IN TWENTY':'Under one in twenty',
    'NONE DREW':'None drew',
    'NO RESULT':'No result'
  };
  return map[w]||w;
}
function infoLabel(win){
  return String(win&&win.label||'').replace(/(\d+)-yr avg/g,'$1-year average');
}
function infoLine(win){
  if(!win||!win.ok)return '';
  const band=win.band!=null?win.band:win.wider;
  if(band==null)return '';
  return infoLabel(win)+': '+sentenceWord(band);
}
function historyNote(last, three){
  if(!three||!three.ok||three.short||three.n!==3||three.band==null)return '';
  if(!last||last.band==null)return '';
  const a=rankOf(last.band), b=rankOf(three.band);
  if(a==null||b==null||a===b)return '';
  return a<b
    ? 'Last year was harder to draw than the 3-year average.'
    : 'Last year was easier to draw than the 3-year average.';
}
function verdictHead(el){
  const parent=el&&el.parentElement;
  if(!parent)return null;
  return [...parent.children].find(c=>c!==el&&c.classList&&(c.classList.contains('fv')||c.classList.contains('vd')))||null;
}
function isEstimateCard(el){
  const head=verdictHead(el);
  return !!(head&&/estimate:/i.test(head.textContent||''));
}
function moreInfoHtml(row){
  const last=windowOf(row, 1);
  const three=windowOf(row, 3);
  const bits=[];
  const a=infoLine(last);
  const b=infoLine(three);
  if(a)bits.push(`<span class="hymine">${esc(a)}</span>`);
  if(b&&b!==a)bits.push(`<span class="hymine">${esc(b)}</span>`);
  const note=historyNote(last, three);
  if(note)bits.push(`<span class="hyhint">${esc(note)}</span>`);
  if(!bits.length)return '';
  return `<span class="hymore"><span class="hylab">More info</span>${bits.join('')}</span>`;
}
function lineHtml(win){
  if(!win)return '';
  const band=win.band!=null?win.band:win.wider;
  if(band==null)return esc(win.label);
  return `${esc(win.label)}: ${dot(band)}${esc(word(band))}`;
}
function rowFor(hk, side, pts){
  if(!data)return null;
  const hunt=data.hunts&&data.hunts[hk];
  const rec=recordFor(hunt, side);
  if(!rec)return null;
  return view(rec, pts);
}
function bandFor(hk, side, pts){
  const row=rowFor(hk, side, pts);
  if(!row)return null;
  const win=windowOf(row, span());
  return win&&win.ok&&typeof win.band==='number'?win.band:null;
}
function htmlFor(el){
  if(el.dataset.hist==='none')return `<span class="hym">${esc(el.dataset.why||'History not available')}</span>`;
  if(failed)return `<span class="hym">History not available</span>`;
  if(!data)return `<span class="hym">History loading</span>`;
  const pts=el.hasAttribute('data-pts')?el.dataset.pts:null;
  const row=rowFor(el.dataset.hk, el.dataset.side, pts);
  if(!row)return `<span class="hym">History not available</span>`;
  const years=Object.keys(row.years||{});
  if(!years.length)return `<span class="hym">${row.pointed&&row.missing?'History not available':'History not available at this point level'}</span>`;
  const want=span();
  const head=windowOf(row, want);
  const three=windowOf(row, 3);
  const last=windowOf(row, 1);
  const sub=want===3?last:three;
  const say=v=>word(v);
  const headHtml=lineHtml(head);
  if(!oddsCard(el)&&isEstimateCard(el)){
    return moreInfoHtml(row);
  }
  if(oddsCard(el)){
    const entries=series(row).slice().reverse();
    const rates={};
    let anyExact=false;
    for(const y of entries){
      const rate=exactRate(el.dataset.hk, el.dataset.side, pts, y.year);
      if(rate!=null){rates[y.year]=rate;anyExact=true}
    }
    const yearsHtml=entries.length?`<span class="hyyears">${esc(yearLine(entries, say, anyExact, rates))}</span>`:'';
    const trend=trendWord(row.trend);
    const trendHtml=trend?`<span class="hytrend">${esc(trend)}</span>`:'';
    const rows=countRows(el.dataset.hk);
    const why=reasonText(rows);
    const counts=countsLine(rows);
    const whyHtml=why?`<span class="hywhy">${esc(why)}</span>`:'';
    const countsHtml=counts?`<span class="hycounts">${esc(counts)}</span>`:'';
    return `<span class="hynum">${headHtml}</span>${yearsHtml}${trendHtml}${whyHtml}${countsHtml}`;
  }
  let subHtml='';
  if(sub&&formatLine(sub, say)!==formatLine(head, say)) subHtml=`<span class="hysub">${lineHtml(sub)}</span>`;
  const hint=hintText(head, three, last);
  const hintHtml=hint?`<span class="hyhint">${esc(hint)}</span>`:'';
  return `<span class="hynum">${headHtml}</span>${subHtml}${hintHtml}`;
}
function place(el){
  const parent=el.parentElement;
  if(!parent)return;
  const head=verdictHead(el);
  if(!head)return;
  if(isEstimateCard(el)){
    const odds=[...parent.children].find(c=>c.classList&&c.classList.contains('fo')&&!c.classList.contains('lk'));
    if(odds&&head.nextElementSibling!==odds)parent.insertBefore(odds, head.nextSibling);
    const anchor=odds&&odds.parentNode===parent?odds:head;
    if(el.previousElementSibling!==anchor)parent.insertBefore(el, anchor.nextSibling);
    return;
  }
  if(head.previousElementSibling===el)return;
  parent.insertBefore(el, head);
}
function hideTagGate(el){
  if(!el.querySelector('.hycounts')) return;
  const card=el.closest&&(el.closest('#detail')||el.closest('.yo'));
  if(!card) return;
  card.querySelectorAll('.note.fpx').forEach(p=>{
    if(String(p.textContent||'').indexOf('Tags each year, and hunters afield')===0) p.hidden=true;
  });
}
function paint(el){
  const html=htmlFor(el);
  el.classList.toggle('hy-est', isEstimateCard(el));
  if(el.dataset.sig!==html){
    el.dataset.sig=html;
    el.innerHTML=html;
  }
  place(el);
  hideTagGate(el);
}
function controls(){
  if(typeof document==='undefined')return;
  for(const id of ['out','detail']){
    const box=document.getElementById(id);
    if(!box||box.hidden||box.querySelector('.dspan'))continue;
    if(!box.querySelector('.hy'))continue;
    const label=document.createElement('label');
    label.className='dspan';
    label.appendChild(document.createTextNode('Show draw odds as'));
    const sel=document.createElement('select');
    sel.className='rwspan';
    sel.setAttribute('aria-label','Show draw odds as');
    [['1','Last year'],['2','2-year average'],['3','3-year average']].forEach(([v,t])=>{
      const o=document.createElement('option');
      o.value=v;o.textContent=t;
      if(String(span())===v)o.selected=true;
      sel.appendChild(o);
    });
    sel.addEventListener('change',()=>{
      setSpan(sel.value);
      document.querySelectorAll('.hy').forEach(el=>{delete el.dataset.sig});
      const out=document.getElementById('out');
      const det=document.getElementById('detail');
      const listOpen=out&&!out.hidden&&!(det&&!det.hidden);
      if(listOpen&&typeof window.RWFindRefresh==='function')askRefresh();
      else fill();
    });
    label.appendChild(sel);
    const note=document.createElement('p');
    note.className='dnote';
    note.textContent='Last year is the newest year on file for that hunt. Fewer years are labeled.';
    const h=box.querySelector('h2');
    if(h){
      h.insertAdjacentElement('afterend', label);
      label.insertAdjacentElement('afterend', note);
    }else{
      box.prepend(note);
      box.prepend(label);
    }
  }
}
function note(){
  if(!data||!data.note||typeof document==='undefined')return;
  for(const id of ['out','detail']){
    const box=document.getElementById(id);
    if(!box||box.hidden||!box.querySelector('.hy'))continue;
    if(box.querySelector('.hynote'))continue;
    const p=document.createElement('p');
    p.className='hynote';
    p.textContent=data.note;
    const anchor=box.querySelector('.dspan .dnote')||box.querySelector('.dnote')||box.querySelector('.dspan')||box.querySelector('h2');
    if(anchor)anchor.insertAdjacentElement('afterend', p);
    else box.prepend(p);
  }
}
function fill(){
  scheduled=false;
  if(typeof document==='undefined')return;
  document.querySelectorAll('.hy').forEach(paint);
  controls();
  note();
}
function schedule(){
  if(scheduled)return;
  scheduled=true;
  const raf=typeof requestAnimationFrame==='function'?requestAnimationFrame:fn=>setTimeout(fn,0);
  raf(fill);
}
function askRefresh(){
  if(busy||typeof window==='undefined'||typeof window.RWFindRefresh!=='function')return;
  const det=typeof document!=='undefined'&&document.getElementById('detail');
  const out=typeof document!=='undefined'&&document.getElementById('out');
  if(det&&!det.hidden)return;
  if(out&&out.hidden)return;
  busy=true;
  try{window.RWFindRefresh()}finally{busy=false}
}
function load(){
  if(data||failed||pending||!url){if(!url)failed=true;return pending||Promise.resolve()}
  pending=fetch(url).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()}).then(j=>{
    data=j;pending=null;schedule();askRefresh();
  }).catch(()=>{failed=true;pending=null;schedule()});
  return pending;
}
function hy(k, side, pts){
  const sideAttr=side==null?'':` data-side="${esc(side)}"`;
  const ptsAttr=pts==null||pts===''?'':` data-pts="${Number(pts)}"`;
  return `<span class="hy" data-hk="${esc(k)}"${sideAttr}${ptsAttr}></span>`;
}
function packFor(hk, side, pts){
  if(!data) return {headline:'Not published', line:'Not published', value:null, kind:null, exact:false, year:null};
  const row=rowFor(hk, side, pts);
  if(!row) return {headline:'Not published', line:'Not published', value:null, kind:null, exact:false, year:null};
  const entries=series(row);
  const last=windowOf(row, 1);
  const rates={};
  let any=false;
  for(const y of entries){
    const rate=exactRate(hk, side, pts, y.year);
    if(rate!=null){rates[y.year]=rate;any=true}
  }
  const line=entries.length?yearLine(entries.slice().reverse(), word, any, rates):'';
  let headline='Not published', value=null, kind=null, exact=false, year=null;
  if(last&&last.ok&&typeof last.band==='number'){
    year=last.year||null;
    const rate=year!=null?rates[year]:null;
    if(typeof rate==='number'){
      exact=true; kind='exact'; value=rate;
      headline=(year?year+' draw: ':'')+pctLabel(rate);
    }else{
      kind='band'; value=last.band;
      headline=(last.label?last.label+': ':'')+word(last.band);
    }
  }
  return {headline, line:line||'Not published', value, kind, exact, year};
}
hy.pack=packFor;
hy.when=function(){return load()};
hy.band=bandFor;
hy.yearLine=yearLine;
hy.trendWord=trendWord;
hy.reasonText=reasonText;
hy.pctLabel=pctLabel;
hy.span=span;
hy.setSpan=setSpan;
hy.windowOf=windowOf;
hy.hintText=hintText;
hy.historyNote=historyNote;
hy.infoLine=infoLine;
hy.formatLine=formatLine;
window.RWSeason={yearsIn, maxYear, label:seasonLabel};
window.RWHy=hy;
window.RWHyNone=function(why){
  return `<span class="hy" data-hist="none" data-why="${esc(why)}"></span>`;
};
function boot(){
  if(typeof document==='undefined'||!document.documentElement||typeof MutationObserver!=='function')return;
  const obs=new MutationObserver(()=>{
    if(document.querySelector('.hy'))load();
    schedule();
  });
  obs.observe(document.documentElement,{childList:true,subtree:true});
}
boot();
})();
