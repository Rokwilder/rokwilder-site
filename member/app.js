// UnitIQ member app. The hunt list, maps, history, harvest, and public land
// are the same pages as the website. This shell only picks the state and
// sends a scouting package to the existing buy form.
(function(){
'use strict';
const STATES=[
  {id:'co', name:'Colorado', file:'../find.html'},
  {id:'ut', name:'Utah', file:'../utah/find.html'},
  {id:'az', name:'Arizona', file:'../arizona/find.html'},
  {id:'wy', name:'Wyoming', file:'../wyoming/find.html'},
  {id:'id', name:'Idaho', file:'../idaho/find.html'},
  {id:'nv', name:'Nevada', file:'../nevada/find.html'},
  {id:'mt', name:'Montana', file:'../montana/find.html'},
  {id:'nm', name:'New Mexico', file:'../newmexico/find.html'}
];
const Q=new URLSearchParams(location.search);
const $=id=>document.getElementById(id);
let state=(Q.get('state')||'co').toLowerCase();
if(!STATES.some(s=>s.id===state)) state='co';

function finderSrc(id){
  const st=STATES.find(s=>s.id===id)||STATES[0];
  const q=new URLSearchParams();
  q.set('app','1');
  q.set('sp', Q.get('sp')||'elk');
  q.set('go','1');
  if(Q.get('unit')) q.set('unit', Q.get('unit'));
  if(Q.get('ord')==='hard'||Q.get('ord')==='easy') q.set('ord', Q.get('ord'));
  if(Q.get('tab')==='map') q.set('tab','map');
  if(Q.get('pts')) q.set('p', Q.get('pts'));
  if(Q.get('pts')) q.set('pts', Q.get('pts'));
  return st.file+'?'+q.toString();
}

function paint(){
  const nav=$('states');
  nav.innerHTML=STATES.map(s=>'<a href="app.html?state='+s.id+'" data-st="'+s.id+'"'+(s.id===state?' class="on" aria-current="page"':'')+'>'+s.name+'</a>').join('');
  nav.querySelectorAll('a').forEach(a=>{
    a.onclick=ev=>{
      ev.preventDefault();
      state=a.getAttribute('data-st');
      Q.delete('unit');
      const u=new URL(location.href);
      u.searchParams.set('state', state);
      u.searchParams.delete('unit');
      history.replaceState(null,'', u.pathname+'?'+u.searchParams.toString());
      paint();
      who();
    };
  });
  const code=state.toUpperCase();
  $('pkg').href='../buy.html?p=package&state='+code+'&species='+encodeURIComponent(Q.get('sp')||'elk');
  $('view').src=finderSrc(state);
}

async function who(){
  const el=$('who');
  let a=null;
  try{a=await RW.account()}catch(e){a=null}
  if(!a||a.offline){el.textContent='The member service did not answer. The list below is the public file. Nothing was charged.';return}
  const eight=['co','ut','az','wy','id','nv','mt','nm'];
  const covered=eight.filter(s=>RW.hasFullPass(a,s));
  if(covered.length===8){el.textContent='Your Full Pass is active. You get the full hunt list and exact odds for all 8 states.';return}
  if(covered.length){el.textContent='Your Full Pass is active. You get the full hunt list for the states on your account.';return}
  if(a.loggedIn){el.textContent='You are logged in. This state is the free look: a count and sample units. The full list is the Full Pass.';return}
  el.textContent='You are not logged in. This is the free look: a count and sample units.';
}
paint();
who();
})();
