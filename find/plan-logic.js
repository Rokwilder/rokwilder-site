// Shared comparison and season-date helpers. No network. No guessed numbers.
(function(root){
'use strict';
const MONTH={'jan':1,'feb':2,'mar':3,'apr':4,'may':5,'jun':6,'jul':7,'aug':8,'sep':9,'sept':9,'oct':10,'nov':11,'dec':12};
const MNAME=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function iso(y,m,d){
  if(!y||!m||!d||m<1||m>12||d<1||d>31) return null;
  const dt=new Date(Date.UTC(y,m-1,d));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d) return null;
  return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
function parseIso(s){
  const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return null;
  return iso(+m[1],+m[2],+m[3]);
}
function monthOf(word){
  const k=String(word||'').toLowerCase().replace(/\./g,'').slice(0,4);
  if(k.startsWith('sept')) return 9;
  if(k.startsWith('sep')) return 9;
  return MONTH[k.slice(0,3)]||null;
}
function overlap(a,b){
  if(!a||!b||!a.start||!a.end||!b.start||!b.end) return false;
  return a.start<=b.end && b.start<=a.end;
}
function overlappingPairs(picks){
  const out=[];
  for(let i=0;i<picks.length;i++){
    for(let j=i+1;j<picks.length;j++){
      const A=picks[i], B=picks[j];
      const hits=[];
      for(const sa of A.seasons||[]){
        for(const sb of B.seasons||[]){
          if(overlap(sa,sb)) hits.push([sa,sb]);
        }
      }
      if(hits.length) out.push({a:A,b:B,hits});
    }
  }
  return out;
}
function sameKind(rows, pick){
  const xs=rows.filter(p=>pick(p)!=null && pick(p).kind && typeof pick(p).value==='number');
  if(xs.length<2) return null;
  const kind=pick(xs[0]).kind;
  if(!xs.every(p=>pick(p).kind===kind)) return null;
  return {kind, rows:xs};
}
function byValue(rows, pick){
  return rows.slice().sort((a,b)=>pick(b).value-pick(a).value);
}
function oneLine(picks){
  const list=(picks||[]).filter(Boolean);
  if(list.length<2) return '';
  const bits=[];
  const odds=sameKind(list, p=>p.odds);
  if(odds){
    const top=byValue(odds.rows, p=>p.odds);
    const hi=top[0], lo=top[top.length-1];
    if(hi.odds.value!==lo.odds.value){
      const how=odds.kind==='exact'?'on the exact last-year odds':'on the last-year draw band';
      const pair=hi.title+' is easier to draw than '+lo.title+' '+how+' ('+hi.odds.headline+' versus '+lo.odds.headline+').';
      bits.push(top.length>2?hi.title+' is easier to draw than the other saved hunts '+how+' ('+hi.odds.headline+'). '+lo.title+' is the hardest ('+lo.odds.headline+').':pair);
    }else{
      bits.push('Last-year draw odds match for the hunts that publish them.');
    }
  }
  const harv=sameKind(list, p=>p.harvest);
  if(harv){
    const top=byValue(harv.rows, p=>p.harvest);
    const hi=top[0], lo=top[top.length-1];
    if(hi.harvest.value!==lo.harvest.value){
      const how=harv.kind==='exact'?'on the published success percent':'on the published success band';
      const pair=hi.title+' has better hunter success than '+lo.title+' '+how+' ('+hi.harvest.text+' versus '+lo.harvest.text+').';
      bits.push(top.length>2?hi.title+' has better hunter success than the other saved hunts '+how+' ('+hi.harvest.text+').':pair);
    }
  }
  const land=list.filter(p=>p.land && typeof p.land.rank==='number');
  if(land.length>=2 && land.every(p=>p.land.rank===land[0].land.rank)===false){
    const top=land.slice().sort((a,b)=>b.land.rank-a.land.rank);
    const hi=top[0], lo=top[top.length-1];
    if(hi.land.rank!==lo.land.rank){
      bits.push(hi.title+' has the higher public-land share ('+hi.land.text+' versus '+lo.land.text+').');
    }
  }
  const pts=list.filter(p=>p.points && typeof p.points.value==='number');
  if(pts.length>=2){
    const top=pts.slice().sort((a,b)=>a.points.value-b.points.value);
    if(top[0].points.value!==top[top.length-1].points.value){
      bits.push(top[0].title+' takes fewer points to be sure to draw ('+top[0].points.text+' versus '+top[top.length-1].points.text+').');
    }
  }
  return bits.join(' ');
}
function pretty(isoDate){
  const m=String(isoDate||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return '';
  return MNAME[+m[2]]+' '+(+m[3])+', '+m[1];
}
function rangeText(start,end){
  if(!start) return '';
  if(!end||start===end) return pretty(start);
  if(start.slice(0,7)===end.slice(0,7)){
    const a=pretty(start), b=pretty(end);
    return a.replace(/, \d{4}$/,'')+' to '+b;
  }
  return pretty(start)+' to '+pretty(end);
}
// A printed range such as "Nov 7 to Nov 15" or "Sept. 2-30" or "Apr. 15-May 20".
// defaultYear is used only when the text has no year. Callers pass the year the agency already printed.
function yearIn(raw, fallback){
  const full=String(raw||'').match(/\b(20\d{2})\b/);
  if(full) return +full[1];
  const tick=String(raw||'').match(/'(\d{2})/);
  if(tick) return 2000+(+tick[1]);
  return fallback||null;
}
function rangeFrom(m1, d1, m2, d2, year){
  if(!m1||!m2||!year) return null;
  let y1=year, y2=year;
  if(m2<m1) y2=year+1;
  const start=iso(y1,m1,d1), end=iso(y2,m2,d2);
  if(!start||!end||end<start) return null;
  return {start, end};
}
function parseRange(text, defaultYear){
  const many=parseMany(text, defaultYear);
  return many.length? [many[0]] : [];
}
function parseMany(text, defaultYear){
  const raw=String(text||'').replace(/[\u2013\u2014]/g,'-').replace(/\bto\b/gi,'-').replace(/\s+/g,' ').trim();
  if(!raw) return [];
  const re=/([A-Za-z]{3,}\.?)\s+(\d{1,2})\s*-\s*(?:([A-Za-z]{3,}\.?)\s+)?(\d{1,2})(?:\s*,?\s*'?(\d{2,4}))?/g;
  const out=[];
  let m;
  while((m=re.exec(raw))){
    const m1=monthOf(m[1]);
    const m2=m[3]?monthOf(m[3]):m1;
    let year=defaultYear||null;
    if(m[5]){
      year=+m[5];
      if(year<100) year+=2000;
    }else{
      year=yearIn(raw, defaultYear);
    }
    const hit=rangeFrom(m1, +m[2], m2, +m[4], year);
    if(hit) out.push(hit);
  }
  return out;
}
function mdY(s){
  const m=String(s||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(!m) return null;
  let y=+m[3];
  if(y<100) y+=2000;
  return iso(y,+m[1],+m[2]);
}
root.RWPlan={iso, parseIso, overlap, overlappingPairs, oneLine, pretty, rangeText, parseRange, parseMany, mdY, monthOf};
if(typeof module!=='undefined' && module.exports) module.exports=root.RWPlan;
})(typeof window!=='undefined'?window:globalThis);
