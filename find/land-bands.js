// Public-land bands for the find pages. Exact shares stay in data/public-land/ and are not loaded here.
// Bands: Mostly public (70%+), Mixed public/private (40–70%), Mostly private (under 40%).
(function(){
const D=window.RW_LAND_DATA||{co:{},wy:{},id:{},nv:{},ut:{}};
const LABEL={
  pub:'Mostly public (70%+)',
  mix:'Mixed public/private (40–70%)',
  priv:'Mostly private (under 40%)'
};
function bandOf(p){
  if(p==null||!isFinite(p)) return null;
  if(p>=0.70) return 'pub';
  if(p>=0.40) return 'mix';
  return 'priv';
}
function oddsKind(v){
  if(v==null||!(v>=0.05)) return null;
  if(v>=0.75) return 'good';
  if(v>=0.25) return 'mixed';
  return 'poor';
}
function harvestKind(p){
  if(p==null||p==='') return null;
  const n=+p;
  if(!isFinite(n)) return null;
  if(n>=50) return 'high';
  if(n>=30) return 'good';
  if(n>=15) return 'fair';
  return 'low';
}
function rank(band){return band==='pub'?3:band==='mix'?2:band==='priv'?1:0}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function human(items, one, many){
  const xs=(items||[]).filter(Boolean);
  if(!xs.length) return '';
  if(xs.length===1) return one+' '+xs[0];
  if(xs.length===2) return many+' '+xs[0]+' and '+xs[1];
  return many+' '+xs.slice(0,-1).join(', ')+' and '+xs[xs.length-1];
}
function sg(code){
  const m=String(code).trim().toUpperCase().match(/^([SG])0*(\d+)$/);
  return m?m[1]+String(+m[2]):null;
}
function coKey(sp, units){
  const ids=(units||[]).map(String);
  if(sp==='sheep'||sp==='dsheep'){
    const n=ids.map(sg).filter(Boolean).sort();
    return n.length?'sheep:'+n.join('+'):null;
  }
  if(sp==='goat'){
    const n=ids.map(sg).filter(Boolean).sort();
    return n.length?'goat:'+n.join('+'):null;
  }
  const n=[...new Set(ids.map(x=>String(+x)).filter(x=>x!=='NaN'))].sort((a,b)=>+a-+b);
  return n.length?'gmu:'+n.join('+'):null;
}
function wyKey(sp, area){
  if(!/^\d+$/.test(String(area).trim())) return null;
  return sp+':'+String(+area);
}
function idKey(area){
  const s=String(area==null?'':area).trim().toUpperCase();
  const m=s.match(/^0*(\d+)([A-Z]?)$/);
  return m?String(+m[1])+m[2]:null;
}
function nvKey(text){
  if(text==null) return null;
  const nums=[];
  const cleaned=String(text).replace(/\s*\(see CR [^)]+\)\s*$/i,'').trim();
  for(const part of cleaned.split(',')){
    const p=part.trim();
    if(!p) continue;
    const range=p.match(/^(\d+)\s*-\s*(\d+)$/);
    if(range){
      const a=+range[1], b=+range[2];
      if(!Number.isInteger(a)||!Number.isInteger(b)||b<a||b-a>40) return null;
      for(let i=a;i<=b;i++) nums.push(i);
    }else if(/^\d+$/.test(p)) nums.push(+p);
    else return null;
  }
  if(!nums.length) return null;
  return [...new Set(nums)].sort((a,b)=>a-b).map(n=>String(n).padStart(3,'0')).join('+');
}
function utKey(ids){
  const n=(ids||[]).map(x=>+x).filter(x=>Number.isInteger(x)&&x>0).sort((a,b)=>a-b);
  return n.length?n.join('+'):null;
}
function band(state, key){
  if(!key||!D[state]) return null;
  const v=D[state][key];
  return v==='pub'||v==='mix'||v==='priv'?v:null;
}
function joinParts(parts){
  const bits=parts.filter(Boolean);
  if(!bits.length) return '';
  const norm=bits.map((s,i)=>i?s.charAt(0).toLowerCase()+s.slice(1):s);
  if(norm.length===1) return norm[0];
  if(norm.length===2) return norm[0]+' and '+norm[1];
  return norm.slice(0,-1).join(', ')+', and '+norm[norm.length-1];
}
function combined(o){
  o=o||{};
  if(o.privateOnly) return 'This hunt is private land only, so plan access.';
  if(!o.land) return '';
  const harvest=o.harvest, odds=o.odds, land=o.land, voice=o.voice==='history'?'history':'forecast';
  const hWord=harvest==='high'?'High harvest success':harvest==='good'?'Good harvest success':harvest==='fair'?'Fair harvest success':harvest==='low'?'Low harvest success':null;
  const oWord=voice==='history'
    ?(odds==='good'?'Most first-choice applicants drew':odds==='mixed'?'Some first-choice applicants drew':odds==='poor'?'Few first-choice applicants drew':null)
    :(odds==='good'?'Good odds':odds==='mixed'?'Odds could go either way':odds==='poor'?'Long odds':null);
  if((harvest==='good'||harvest==='high')&&land==='priv'&&!oWord)
    return (harvest==='high'?'High':'Good')+' harvest success, but mostly private land, so plan access.';
  if(oWord==='Good odds'&&land==='pub'&&!hWord) return 'Good odds and mostly public land.';
  if(voice==='history'&&odds==='good'&&land==='pub'&&!hWord) return 'Most first-choice applicants drew, and the land is mostly public.';
  const landWord=land==='pub'?'mostly public land':land==='mix'?'a mix of public and private land':'mostly private land';
  let s=joinParts([oWord,hWord,landWord]);
  if(!s) return '';
  if(land==='priv') s+=', so plan access';
  if(!s.endsWith('.')) s+='.';
  return s;
}
function packageCap(tags){
  if(!Number.isInteger(tags)||tags<1) return null;
  return Math.min(30, Math.max(3, Math.floor(tags/25)));
}
function pkgHref(prefix, state, unit){
  return (prefix||'')+'packages.html?state='+encodeURIComponent(state)+'&unit='+encodeURIComponent(unit)+'#unitiq-scouting';
}
function extra(o){
  o=o||{};
  const bits=[];
  if(o.band&&!o.privateOnly&&LABEL[o.band])
    bits.push('<div class="fs fland"><span class="hsl">Public land</span><b>'+LABEL[o.band]+'</b></div>');
  const note=combined(o);
  if(note) bits.push('<p class="sum">'+esc(note)+'</p>');
  if(o.place&&o.href){
    const cap=Number.isInteger(o.cap)&&o.cap>=3&&o.cap<=30?o.cap:null;
    let line='<p class="next"><a href="'+esc(o.href)+'">Ready for the next step? Get the UnitIQ Scouting Package for '+esc(o.place)+'.</a>';
    if(cap) line+=' Only '+cap+' scouting packages go out for this unit each season, so we don\'t send too many hunters to the same spots.';
    bits.push(line+'</p>');
  }
  return bits.join('');
}
function pageNote(state){
  const lead='Public land is a band for the share of the hunt unit that is publicly huntable, not an exact percentage.';
  const by={
    co:'Counted: BLM, U.S. Forest Service, CPW state wildlife areas, CPW hunting-access properties, and state trust land enrolled in the CPW public access program. Other Colorado state trust land, national parks, wildlife refuges, and tribal land are not counted.',
    wy:'Counted: BLM and U.S. Forest Service. Wyoming state trust land is open to hunting except cultivated cropland, when you can reach it legally. A band is shown only when that state land could not move the unit into another band. National parks, wildlife refuges, and tribal land are not counted.',
    id:'Counted: BLM, U.S. Forest Service, and Idaho endowment land the Department of Lands marks as publicly accessible. Hunt areas that are only part of a unit are left blank. National parks, wildlife refuges, and tribal land are not counted.',
    nv:'Counted: BLM and U.S. Forest Service. A band is shown when other federal or state land could not move the unit into another band. National parks and tribal land are not counted.',
    ut:'Counted: BLM and U.S. Forest Service inside the official hunt boundary. Utah trust land is not counted. A hunt with no matching boundary is left blank.'
  };
  return lead+' '+(by[state]||'')+' Landlocked public land is not flagged. Exact percentages are not shown.';
}
function splitNext(html){const i=String(html).indexOf('<p class="next">');return i<0?{info:html,next:''}:{info:html.slice(0,i),next:html.slice(i)}}
window.RWLand={D,LABEL,bandOf,oddsKind,harvestKind,rank,coKey,wyKey,idKey,nvKey,utKey,band,combined,packageCap,pkgHref,extra,splitNext,pageNote,human,esc,sg};
})();
