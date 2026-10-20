// shared simple points-to-draw UI
const SPN={deer:['🦌','Deer'],elk:['🫎','Elk'],pronghorn:['🐐','Pronghorn'],bear:['🐻','Bear']};
const SEXW={deer:{antlered:'buck',antlerless:'doe','either-sex':'either-sex'},elk:{antlered:'bull',antlerless:'cow','either-sex':'either-sex'},pronghorn:{antlered:'buck',antlerless:'doe','either-sex':'either-sex'},bear:{antlered:'',antlerless:'',"either-sex":''}};
const isPriv=c=>'PW'.includes(c[5]);
function seasonWords(s){return /^\d/.test(s)?s+' season':(s=='archery'||s=='muzzleloader'?s+' season':'special rifle hunt '+s.split(' ')[1])}
function pcFind(o){const P=o.pt,out=[];for(const c in PC){const h=PC[c];if(h.sp!=o.sp)continue;if(o.pub!==false&&isPriv(c))continue;if(o.me&&h.m!=o.me)continue;if(o.se&&h.s!=o.se)continue;if(o.un&&String(h.u)!=o.un)continue;
const E=h.E[o.rs],ys=Object.keys(E).sort();if(!ys.length)continue;const y=ys.at(-1),e=E[y][0];if(e==null)continue;const need=Math.max(0,Math.ceil(e-1e-9)),pr=h.P[o.rs];
let b;if(P>=need&&(!pr||pr[2]<=P+0.01||P>=Math.ceil(pr[2]-1e-9)))b=0;else if(P>=Math.floor(e))b=1;else if(P+2>=e)b=2;else continue;
out.push({c,h,e,need,y,b,pr,ys,E})}
const q=r=>(r.c[5]=='O'?0:1)+((r.h.nh??0)<20?2:0);out.sort((a,b)=>a.b-b.b||q(a)-q(b)||(b.h.succ??-1)-(a.h.succ??-1));return out}
const BADGE=[['ok',"You'd likely draw"],['pa','Maybe'],['no','Long shot']];
function pcCard(r,o,adv){const h=r.h,sw=SEXW[h.sp][h.sex]||'',an=SPN[h.sp][1].toLowerCase();
const what=`Unit ${h.u} ${seasonWords(h.s)}, ${sw?sw+' ':''}${an}${isPriv(r.c)?' (private land only)':''}`;
const drew=r.e==0?`everyone who applied drew last year (${r.y})`:`drew with ${r.need} point${r.need==1?'':'s'} last year (${r.y})`;
const succ=h.succ==null?'':` ${Math.round(h.succ)}% of hunters got one${(h.nh??0)<20?' (small sample)':''}.`;
return `<div class="pcc" data-c="${r.c}"><span class="bd ${BADGE[r.b][0]}">${BADGE[r.b][1]}</span><div class="pw">${what}</div><div class="pl">${drew[0].toUpperCase()+drew.slice(1)}.${succ}</div><div class="pc">Hunt code ${r.c}</div>${adv?`<div class="pc">Points needed: ${r.ys.map(y=>"'"+y.slice(2)+': '+r.E[y][0].toFixed(1)).join(' · ')}${r.pr?` · 2027 estimate ${r.pr[1].toFixed(1)}–${r.pr[2].toFixed(1)}`:''}</div>`:''}</div>`}
const PCCSS=`.q{font-size:22px;font-weight:700;margin:18px 0 8px}.big{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.big button{font-size:22px;padding:18px 10px;border-radius:14px;border:3px solid #c9c2ad;background:#fff;color:#222;cursor:pointer;min-height:70px}.big button.on{border-color:#3d4a2f;background:#e4eed8;font-weight:700}
.big button .i{font-size:34px;display:block}.stp{display:flex;align-items:center;gap:14px}.stp button{width:70px;height:70px;font-size:36px;border-radius:50%;border:3px solid #3d4a2f;background:#fff;color:#3d4a2f;cursor:pointer}
.stp output{font-size:44px;font-weight:800;min-width:70px;text-align:center;color:#222}.go{display:block;width:100%;font-size:24px;font-weight:800;padding:18px;margin:22px 0 10px;border:0;border-radius:14px;background:#c96f1e;color:#fff;cursor:pointer}
.pcc{border:2px solid #ddd;border-radius:14px;padding:14px;margin:10px 0;background:#fff;color:#222;cursor:pointer}.pcc.sel{border-color:#3d4a2f;background:#eef3e6}.bd{display:inline-block;font-size:17px;font-weight:800;padding:5px 12px;border-radius:20px;margin-bottom:6px}
.bd.ok{background:#2f8a3a;color:#fff}.bd.pa{background:#f2c230;color:#222}.bd.no{background:#c0392b;color:#fff}.pw{font-size:20px;font-weight:700}.pl{font-size:18px;margin-top:4px}.pc{font-size:13px;color:#888;margin-top:4px}
.more{font-size:15px;color:#555;text-decoration:underline;background:none;border:0;cursor:pointer;padding:8px 0}.adv{display:none;gap:8px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}.adv.on{display:grid}.adv label{font-size:14px;color:#444}.adv select,.adv input{width:100%;font-size:16px;padding:8px}
.nt{background:#fff6e0;border:1px solid #e8c770;padding:10px;border-radius:10px;font-size:16px;color:#222}.sm{display:block;width:100%;font-size:19px;padding:14px;border-radius:12px;border:2px solid #3d4a2f;background:#fff;color:#3d4a2f;font-weight:700;cursor:pointer}`;
