// Trophy potential for Find Your Hunt. Members only, same gate as exact odds (RWGate.paid).
// Numbers live in the private Full Pass file (window.RWT[state]), not in this public script.
// Levels and the plain-English lines are already computed in that file. This script only shows, sorts, and filters them.
(function(){
'use strict';
const me=document.currentScript;
const STATE=(me&&me.getAttribute('data-state')||'').toLowerCase();
const Q0=()=>new URLSearchParams(location.search);
let ts='', mq=false, uf='', focusUnit=false;
const RANK={top:5,above:4,typical:3,below:2,thin:1,none:0};
const LABEL={top:'Top',above:'Above average',typical:'Typical',below:'Below average',thin:'Thin data',none:'Not enough data'};
function paid(){
  if(window.RWGate&&typeof window.RWGate.paid==='function')return window.RWGate.paid();
  return window.RW_FP===true||Q0().get('preview')==='fullpass';
}
function pack(){const R=window.RWT;return R&&R[STATE]||null;}
function hunt(k){const p=pack();return p&&p.hunts?p.hunts[k]||null:null;}
function read(){
  const q=Q0();
  ts=q.get('ts')==='lo'?'lo':q.get('ts')==='hi'?'hi':'';
  mq=q.get('mq')==='1';
  uf=q.get('uf')||'';
}
function stamp(params){
  if(ts)params.set('ts',ts);else params.delete('ts');
  if(mq)params.set('mq','1');else params.delete('mq');
  if(uf)params.set('uf',uf);else params.delete('uf');
  return params;
}
function writeUrl(){
  const u=new URL(location.href);
  stamp(u.searchParams);
  const next=u.pathname+u.search+u.hash;
  if(next!==location.pathname+location.search+location.hash)history.replaceState(history.state,'',next);
}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function active(){return !!(ts||mq||uf);}
function sortNote(){
  if(!paid()||!pack()||!ts)return '';
  return ts==='lo'?'Trophy potential, low to high. ':'Trophy potential, high to low. ';
}
function refine(rows){
  if(!paid()||!pack())return rows;
  let out=rows.slice();
  const q=uf.trim().toLowerCase();
  if(q)out=out.filter(r=>{const h=hunt(r.k);const blob=((h&&h.unit)||'')+' '+(r.k||'');return blob.toLowerCase().indexOf(q)>=0;});
  if(mq)out=out.filter(r=>{const h=hunt(r.k);return !!(h&&h.badge);});
  if(ts==='hi'||ts==='lo'){
    out.sort((a,b)=>{
      const ha=hunt(a.k)||{}, hb=hunt(b.k)||{};
      const ra=RANK[ha.level]||0, rb=RANK[hb.level]||0;
      const la=ra<=1, lb=rb<=1;
      if(la!==lb)return la?1:-1;
      if(ra!==rb)return ts==='hi'?rb-ra:ra-rb;
      const va=ha.value, vb=hb.value;
      if(va==null&&vb==null)return String(a.k).localeCompare(String(b.k));
      if(va==null)return 1;
      if(vb==null)return -1;
      if(va!==vb)return ts==='hi'?vb-va:va-vb;
      return String(a.k).localeCompare(String(b.k));
    });
  }
  return out;
}
function chip(k){
  if(!paid()||!pack())return '';
  const h=hunt(k);if(!h)return '';
  const lab=LABEL[h.level]||LABEL.none;
  const badge=h.badge?`<span class="tbadge">${esc(h.badge)}</span>`:'';
  return `<span class="trp">${badge}<span class="hsl">Trophy potential</span><b class="tl tl-${esc(h.level||'none')}">${esc(lab)}</b> <span class="tsum">${esc(h.summary||'')}</span>${h.evidence?`<span class="tev">${esc(h.evidence)}</span>`:''}</span>`;
}
function block(k){return chip(k);}
function speciesNote(sp){
  const p=pack();if(!p||!p.species)return '';
  const s=p.species[sp];if(!s)return '';
  if(s.gap&&!s.field)return `<p class="dq">${esc(s.gap)}</p>`;
  const bits=[];
  if(s.field)bits.push(s.field);
  if(s.years)bits.push(s.years);
  if(s.source)bits.push(s.source);
  let t=bits.length?`This species uses ${bits.join(', ')}. Levels compare hunts in this state only.`:'';
  if(s.gap)t+=(t?' ':'')+s.gap;
  return t?`<p class="dq">${esc(t)}</p>`:'';
}
function bar(sp){
  if(!paid())return '';
  if(!pack())return '<p class="note">Trophy potential is part of the Full Pass data for this state. It is not in the public file.</p>';
  return `<div class="sbar tbar"><span class="lbl">Trophy potential</span><div class="seg" id="tseg"><button type="button" data-ts="" class="${ts?'':'on'}">Default order</button><button type="button" data-ts="hi" class="${ts==='hi'?'on':''}">Trophy, high to low</button><button type="button" data-ts="lo" class="${ts==='lo'?'on':''}">Trophy, low to high</button></div><label class="tchk"><input type="checkbox" id="tmq"${mq?' checked':''}> Managed for quality only</label><label class="tchk">Unit <input id="tuf" type="search" value="${esc(uf)}" placeholder="Unit or hunt name" autocomplete="off"></label>${speciesNote(sp)}</div>`;
}
function emptyNote(rawCount, shownCount){
  if(!paid()||!pack()||!active()||shownCount||!rawCount)return '';
  return '<p class="dq">No hunts match the trophy filter. Clear Managed for quality or the unit box to see the list.</p>';
}
function wire(root, refresh){
  if(!root||!paid()||!pack())return;
  root.querySelectorAll('[data-ts]').forEach(b=>b.onclick=()=>{ts=b.getAttribute('data-ts')||'';writeUrl();if(refresh)refresh();});
  const box=root.querySelector('#tmq');
  if(box)box.onchange=()=>{mq=box.checked;writeUrl();if(refresh)refresh();};
  const inp=root.querySelector('#tuf');
  if(inp){
    inp.oninput=()=>{uf=inp.value||'';focusUnit=true;writeUrl();if(refresh)refresh();};
    if(focusUnit){
      focusUnit=false;
      const el=root.querySelector('#tuf');
      if(el){const end=el.value.length;el.focus();try{el.setSelectionRange(end,end);}catch(e){}}
    }
  }
}
if(!document.getElementById('trophy-css')){
  const st=document.createElement('style');
  st.id='trophy-css';
  st.textContent='.trp{display:block;margin-top:.35rem}.trp .tl{font-size:1.15rem}.tl-top{color:#d5e6c8}.tl-above{color:#c5d6a4}.tl-typical{color:#e4d7a6}.tl-below{color:#e7b089}.tl-thin,.tl-none{color:var(--mute)}.tsum,.tev{display:block;font-size:1.02rem;line-height:1.35}.tev{color:var(--mute);font-size:.95rem}.tbadge{display:inline-block;font-weight:800;font-size:.82rem;letter-spacing:.02em;border:1.5px solid var(--acc);border-radius:6px;padding:.05rem .4rem;margin:0 .35rem .2rem 0}.tbar .tchk{display:flex;gap:.45rem;align-items:center;margin:.45rem 0;font-size:1.02rem}.tbar input[type=search]{font:inherit;padding:.35rem .5rem;min-width:10rem;border:2px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink)}';
  document.head.appendChild(st);
}
read();
window.RWTrophy={STATE,paid,read,stamp,writeUrl,refine,chip,block,bar,wire,emptyNote,sortNote,active,hunt,pack};
})();
