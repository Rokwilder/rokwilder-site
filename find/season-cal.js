// Official season and application dates for the planner and alerts.
// Only dates copied from a state publication. A missing day is left out.
(function(root){
const MO=['Jan.','Feb.','Mar.','Apr.','May','June','July','Aug.','Sept.','Oct.','Nov.','Dec.'];
const SRC={
  coStructure:{name:'CPW 2025-2029 Big Game Season Structure',url:'https://cpw.state.co.us/sites/default/files/dam/ifgylu070o/final_bgss2025-2029.pdf'},
  coDraw:{name:'CPW Primary Draw',url:'https://cpw.state.co.us/activities/hunting/big-game/primary-draw'},
  utGuide:{name:'2026 Utah Big Game Application Guidebook',url:'https://wildlife.utah.gov/guidebooks/biggameapp.pdf'},
  utNews:{name:'Utah DWR, March 5, 2026',url:'https://wildlife.utah.gov/news/2026/03/05/want-the-chance-to-hunt-big-game-in-utah-in-2026-the-application-period-opens-march-19'},
  azReg:{name:'2026-27 Arizona Hunting Regulations',url:'https://azgfd-live-portal-wordpress-pantheon.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/05/20151617/2026-27-Arizona-Hunting-Regulations.pdf'},
  azElk:{name:'2026 Arizona Pronghorn and Elk Regulations',url:'https://azgfd-live-portal-wordpress-pantheon.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/12/20163130/2026-Pronghorn-and-Elk-Regulations_251223.pdf'},
  azSpring:{name:'2027 Arizona Spring Regulations',url:'https://azgfd-live-portal-wordpress-pantheon.s3.us-west-2.amazonaws.com/wp-content/uploads/2026/09/08084903/2027-Spring-Regulations.pdf'},
  wyDates:{name:'WGFD application dates and deadlines',url:'https://wgfd.wyo.gov/licenses-applications/application-dates-deadlines'},
  idRule:{name:'IDAPA 13.01.04',url:'https://adminrules.idaho.gov/rules/current/13/130104.pdf'},
  nvCr:{name:'Nevada Commission Regulation 26-01',url:'https://www.ndow.org/wp-content/uploads/2026/01/CR-26-01-2026-2027-Application-Deadlines-Draw-Result-Dates-NBWC-Approved-January-2026.pdf'},
  nvApply:{name:'NDOW apply page, as recorded Nov. 8, 2026',url:'https://www.ndow.org/apply-buy/apply-buy-hunting/'}
};
// Deer and elk regular seasons, west of I-25 and GMU 140, plus the regular combined rifle seasons.
// Plains deer (east of I-25, except GMU 140) is a different calendar and is not applied hunt by hunt.
const DEER_ELK={
  A:{label:'Archery',y2026:[['2026-09-02','2026-09-30']],y2027:[['2027-09-02','2027-09-30']]},
  M:{label:'Muzzleloader',y2026:[['2026-09-12','2026-09-20']],y2027:[['2027-09-11','2027-09-19']]},
  '1':{label:'1st rifle',y2026:[['2026-10-14','2026-10-18']],y2027:[['2027-10-13','2027-10-17']]},
  '2':{label:'2nd rifle',y2026:[['2026-10-24','2026-11-01']],y2027:[['2027-10-23','2027-10-31']]},
  '3':{label:'3rd rifle',y2026:[['2026-11-07','2026-11-15']],y2027:[['2027-11-06','2027-11-14']]},
  '4':{label:'4th rifle',y2026:[['2026-11-18','2026-11-22']],y2027:[['2027-11-17','2027-11-21']]}
};
const PRONG={
  A:{label:'Archery',y2026:[['2026-08-15','2026-08-31'],['2026-09-01','2026-09-20']],y2027:[['2027-08-15','2027-08-31'],['2027-09-01','2027-09-20']]},
  M:{label:'Muzzleloader',y2026:[['2026-09-21','2026-09-29']],y2027:[['2027-09-21','2027-09-29']]},
  '1':{label:'Rifle',y2026:[['2026-10-03','2026-10-11']],y2027:[['2027-10-02','2027-10-10']]},
  '2':{label:'2nd rifle',y2026:[['2026-10-17','2026-10-25']],y2027:[['2027-10-16','2027-10-24']]}
};
const CO_NOTE='2026 dates are the regular seasons in the CPW 2025-2029 Big Game Season Structure. Plains deer east of I-25, except GMU 140, uses a different rifle calendar, and this preview does not guess which units those are. Late, private-land-only, and Ranching for Wildlife hunts are a window, not one statewide pair, so those dates are left off.';
const CO_2027='2027 dates below are in that same adopted structure. The 2027 brochure was not on the CPW page checked Nov. 14, 2026.';

function pad(n){return String(n).padStart(2,'0')}
function iso(y,m,d){return y+'-'+pad(m)+'-'+pad(d)}
function fmt(s){
  if(!s)return'';
  const [y,m,d]=s.split('-').map(Number);
  return MO[m-1]+' '+d+', '+y;
}
function fmtSpan(a,b){
  if(!a||!b)return'';
  if(a===b)return fmt(a);
  const [y1,m1,d1]=a.split('-').map(Number);
  const [y2,m2,d2]=b.split('-').map(Number);
  if(y1===y2)return MO[m1-1]+' '+d1+' to '+MO[m2-1]+' '+d2+', '+y1;
  return fmt(a)+' to '+fmt(b);
}
function ranges(pairs, label){
  return (pairs||[]).map(([start,end])=>({start,end,label:label||''}));
}
function overlapHits(a,b){
  const hits=[];
  for(const x of a||[])for(const y of b||[]){
    const start=x.start>y.start?x.start:y.start;
    const end=x.end<y.end?x.end:y.end;
    if(start<=end)hits.push({start,end});
  }
  return hits;
}
function coKey(sp, code){
  if(!code||code.length<8)return null;
  const weapon=code.at(-1), t=code[5], n=code[6];
  let slot=null;
  if(weapon==='A')slot='A';
  else if(weapon==='M')slot='M';
  else if(weapon==='R'&&t==='O'&&'1234'.includes(n))slot=n;
  if(!slot)return null;
  if(sp==='pronghorn')return PRONG[slot]||null;
  if(sp==='deer'||sp==='elk')return DEER_ELK[slot]||null;
  return null;
}
function coAttach(sp, code){
  const row=coKey(sp, code);
  if(!row)return {ranges:[],also:[],note:CO_NOTE,seasonLabel:''};
  return {
    ranges:ranges(row.y2026, row.label),
    also:ranges(row.y2027, row.label+' (2027 structure)'),
    note:CO_NOTE+' '+CO_2027,
    seasonLabel:row.label,
    source:SRC.coStructure
  };
}
const MONTH={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
function mon(s){return MONTH[String(s).slice(0,3).toLowerCase()]||0}
function parseAz(text){
  const parts=String(text||'').split(/\s+and\s+/i);
  const out=[];
  for(const part of parts){
    const m=part.trim().match(/^([A-Za-z]+)\.?\s+(\d{1,2})\s*-\s*([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})$/);
    if(!m)return null;
    const y=m[5], a=iso(y, mon(m[1]), m[2]), b=iso(y, mon(m[3]), m[4]);
    if(!mon(m[1])||!mon(m[3]))return null;
    out.push({start:a,end:b,label:part.trim()});
  }
  return out;
}
function parseSlash(s){
  const p=String(s||'').split('/');
  if(p.length!==3)return null;
  const y=p[2].length===2?2000+(+p[2]):+p[2];
  if(!+p[0]||!+p[1]||!y)return null;
  return iso(y, +p[0], +p[1]);
}
function parseNv(text){
  const m=String(text||'').match(/^([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})\s*-\s*([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})$/);
  if(!m||!mon(m[1])||!mon(m[4]))return null;
  return [{start:iso(m[3], mon(m[1]), m[2]), end:iso(m[6], mon(m[4]), m[5]), label:text}];
}

const states={
  co:{
    name:'Colorado',
    agency:'Colorado Parks and Wildlife',
    checked:'2026-11-14',
    gaps:[
      '2027 primary draw open, deadline, and results are not on the CPW primary draw page checked Nov. 14, 2026.',
      'That page lists the 2026 application window and does not list a results day, so no Colorado draw-results date is shown.',
      'Plains deer dates are in the season structure, but the structure does not list every plains unit here, so those dates are not attached to a unit.',
      'Late, private-land-only, and Ranching for Wildlife seasons are published as windows, not one pair of days. Those hunts have no bar.'
    ],
    windows:[{
      id:'primary',
      label:'Primary draw',
      species:['deer','elk','pronghorn','bear','moose','sheep','goat','turkey'],
      year:2026,
      confirmed:true,
      open:'2026-03-01',
      close:'2026-04-07',
      closeNote:'8 p.m. Mountain Time',
      results:null,
      source:SRC.coDraw
    }]
  },
  ut:{
    name:'Utah',
    agency:'Utah Division of Wildlife Resources',
    checked:'2026-11-14',
    gaps:[
      '2027 application dates and 2027 season dates are not in the 2026 guidebook. They are left blank.',
      'Antlerless application dates (June 9 to June 23, 2026) are a second window. They are listed only for antlerless pools.'
    ],
    windows:[{
      id:'bg',
      label:'Big game application',
      species:['deer','elk','pronghorn','moose','sheep','goat','bison','bear'],
      year:2026,
      confirmed:true,
      open:'2026-03-19',
      openNote:'8 a.m. MDT',
      close:'2026-04-23',
      closeNote:'11 p.m. MDT',
      results:'2026-05-31',
      resultsNote:'By May 31, by email and at utahdraws.com.',
      source:SRC.utGuide
    }]
  },
  az:{
    name:'Arizona',
    agency:'Arizona Game and Fish Department',
    checked:'2026-11-14',
    gaps:[
      'The regulations cite deadlines, not the day applications open. Open dates are left blank.',
      'A draw-results day is not in the dates used here.',
      '2027 elk, pronghorn, and fall dates are not published yet.'
    ],
    windows:[
      {id:'elk',label:'Elk and pronghorn draw deadline',species:['elk','pronghorn'],year:2026,confirmed:true,open:null,close:'2026-02-03',closeNote:'11:59 p.m. Arizona time',results:null,source:SRC.azElk},
      {id:'fall',label:'Deer, fall turkey, fall javelina, bighorn, bison, and sandhill crane deadline',species:['deer','turkey','javelina','sheep','bison','crane','bear'],year:2026,confirmed:true,open:null,close:'2026-06-02',closeNote:'11:59 p.m. Arizona time',results:null,source:SRC.azReg},
      {id:'spring',label:'2027 spring turkey, javelina, and bison deadline',species:['turkey','javelina','bison'],year:2027,confirmed:true,open:null,close:'2026-10-06',closeNote:'11:59 p.m. Arizona time. This deadline has passed.',results:null,source:SRC.azSpring}
    ]
  },
  wy:{
    name:'Wyoming',
    agency:'Wyoming Game and Fish Department',
    checked:'2026-11-14',
    gaps:[
      '2027 application dates are not posted. This preview does not guess them.',
      'Hunt season dates are not in the 2026 draw-odds file, so Wyoming hunts have no season bar.',
      'A single draw-results day is not used here.',
      'Preference-point-only dates disagree between the application table (July 1 to Nov. 2) and Chapter 44 (July through Oct. 31). That window is left off.'
    ],
    windows:[
      {id:'nr-elk',label:'Nonresident elk',species:['elk'],year:2026,confirmed:true,open:'2026-01-02',close:'2026-02-02',results:null,source:SRC.wyDates,who:'nonres'},
      {id:'msg',label:'Moose, bighorn sheep, and mountain goat',species:['moose','sheep','goat'],year:2026,confirmed:true,open:'2026-01-02',close:'2026-04-30',results:null,source:SRC.wyDates},
      {id:'bison',label:'Bison',species:['bison'],year:2026,confirmed:true,open:'2026-03-02',close:'2026-04-30',results:null,source:SRC.wyDates},
      {id:'deer',label:'Deer, pronghorn, and resident elk',species:['deer','pronghorn','elk'],year:2026,confirmed:true,open:'2026-01-02',close:'2026-06-01',results:null,source:SRC.wyDates,who:'res-elk'}
    ]
  },
  id:{
    name:'Idaho',
    agency:'Idaho Department of Fish and Game',
    checked:'2026-11-14',
    gaps:[
      'The rule says IDFG publishes the calendar on its site. It does not put the days in the rule.',
      'Deer, elk, pronghorn, fall bear, and fall turkey were posted as May 1 through June 5, 2026, and the second drawing as Aug. 5 through Aug. 15, 2026. Moose, sheep, and goat were posted as Apr. 1 through Apr. 30, 2026. The main IDFG site could not be reopened on Nov. 8, 2026, so confirm those posts.',
      'No single results day is stated. 2027 dates are not stated.'
    ],
    windows:[
      {id:'deer',label:'Deer, elk, and pronghorn applications',species:['deer','elk','pronghorn','bear','turkey'],year:2026,confirmed:false,yearLabel:'2026 IDFG news posts. Not rechecked on the main site Nov. 8, 2026.',open:'2026-05-01',close:'2026-06-05',results:null,source:SRC.idRule},
      {id:'msg',label:'Moose, bighorn sheep, and mountain goat applications',species:['moose','sheep','goat'],year:2026,confirmed:false,yearLabel:'2026 IDFG news posts. Not rechecked on the main site Nov. 8, 2026.',open:'2026-04-01',close:'2026-04-30',results:null,source:SRC.idRule},
      {id:'second',label:'Second drawing',species:['deer','elk','pronghorn'],year:2026,confirmed:false,yearLabel:'2026 IDFG news posts. Not rechecked on the main site Nov. 8, 2026.',open:'2026-08-05',close:'2026-08-15',results:null,source:SRC.idRule}
    ]
  },
  nv:{
    name:'Nevada',
    agency:'Nevada Department of Wildlife',
    checked:'2026-11-14',
    gaps:[
      'Commission Regulation 26-01 does not post a 2027 big-game main-draw deadline. None is shown.',
      'Hunt seasons in the draw file are the 2025 seasons printed on the bonus-point tables.',
      'The second-draw deadline disagrees: the apply page says June 15, and CR 26-01 says 11:00 p.m. Pacific on June 16. Both are shown. This preview does not pick one.'
    ],
    windows:[
      {id:'guided',label:'Guided mule deer',species:['deer'],year:2026,confirmed:true,open:'2026-02-09',close:'2026-03-09',results:'2026-03-20',source:SRC.nvApply},
      {id:'main',label:'Main draw',species:['deer','elk','antelope','sheep','goat','moose','bear'],year:2026,confirmed:true,open:'2026-03-23',close:'2026-05-13',results:'2026-05-29',source:SRC.nvApply},
      {id:'second-page',label:'Second draw (apply page)',species:['deer','elk','antelope','sheep','goat','moose','bear'],year:2026,confirmed:true,open:'2026-06-08',close:'2026-06-15',results:null,source:SRC.nvApply},
      {id:'second-cr',label:'Second draw (CR 26-01)',species:['deer','elk','antelope','sheep','goat','moose','bear'],year:2026,confirmed:true,open:null,close:'2026-06-16',closeNote:'11:00 p.m. Pacific',results:'2026-06-26',resultsNote:'On or before June 26.',source:SRC.nvCr},
      {id:'turkey27',label:'2027 spring turkey applications',species:['turkey'],year:2027,confirmed:true,open:null,close:'2027-01-25',closeNote:'Before 11:00 p.m. Pacific',results:'2027-02-12',resultsNote:'On or before Feb. 12, 2027.',source:SRC.nvCr}
    ]
  }
};

function windowsFor(state, species){
  const st=states[state];
  if(!st)return [];
  return st.windows.filter(w=>!species||!w.species||w.species.includes(species));
}
function overlapPhrase(a,b,when){
  const ut=x=>x&&x.kind==='ut-general-deer';
  const co=x=>x&&x.kind==='co-2nd-rifle';
  if((ut(a)&&co(b))||(ut(b)&&co(a)))return 'Utah general deer overlaps your Colorado 2nd rifle ('+when+').';
  return a.flag+' overlaps '+b.flag+' ('+when+').';
}
function overlapLines(hunts){
  const lines=[];
  for(let i=0;i<hunts.length;i++)for(let j=i+1;j<hunts.length;j++){
    const hits=overlapHits(hunts[i].ranges, hunts[j].ranges);
    if(!hits.length)continue;
    const when=hits.map(h=>fmtSpan(h.start,h.end)).join(', and ');
    lines.push(overlapPhrase(hunts[i], hunts[j], when));
  }
  return lines;
}

const api={SRC,states,fmt,fmtSpan,ranges,overlapHits,overlapLines,coAttach,parseAz,parseSlash,parseNv,windowsFor,CO_NOTE};
root.RWCal=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
