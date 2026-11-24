# Rebuild wyoming/seasons.js from the official 2026 rules HTML saved beside this script's inputs.
# Download first:
#   curl -fsSL -o /tmp/wyregs/elk.html 'https://rules.wyo.gov/AjaxHandler.ashx?RULE_VERSION_ID=25457&handler=GetRuleVersionHTML'
#   curl -fsSL -o /tmp/wyregs/deer.html 'https://rules.wyo.gov/AjaxHandler.ashx?RULE_VERSION_ID=25456&handler=GetRuleVersionHTML'
#   curl -fsSL -o /tmp/wyregs/antelope.html 'https://rules.wyo.gov/AjaxHandler.ashx?RULE_VERSION_ID=25455&handler=GetRuleVersionHTML'
# Then: python3 scripts/build-wy-seasons.py /tmp/wyregs
import json, re, sys
from html.parser import HTMLParser
from pathlib import Path

class T(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.row=None; self.in_table=0; self.capture=False; self.buf=[]
    def handle_starttag(self, tag, attrs):
        if tag=='table':
            self.in_table += 1
        elif self.in_table==1 and tag=='tr':
            self.row=[]
        elif self.in_table==1 and tag in ('td','th'):
            self.capture=True; self.buf=[]
    def handle_endtag(self, tag):
        if tag in ('td','th') and self.capture:
            self.row.append(re.sub(r'\s+',' ',''.join(self.buf)).strip()); self.capture=False
        elif tag=='tr' and self.row is not None and self.in_table==1:
            if len(self.row)==8 and self.row[0][:1].isdigit():
                self.rows.append(self.row)
            self.row=None
        elif tag=='table' and self.in_table:
            self.in_table -= 1
    def handle_data(self, data):
        if self.capture: self.buf.append(data)

MONTH={'jan':1,'feb':2,'mar':3,'apr':4,'may':5,'jun':6,'jul':7,'aug':8,'sep':9,'oct':10,'nov':11,'dec':12}

def sex_of(limit):
    s=limit.lower()
    if re.search(r'antlerless|cow or calf|doe or fawn', s): return 'F'
    if 'any white-tailed' in s and 'antlered' in s: return ''
    if re.search(r'any elk|any deer|any antelope|any white-tailed', s): return 'E'
    if re.search(r'antlered|\bspike\b', s): return 'M'
    return ''

def bucket(mon):
    if mon==10: return 'regular'
    if mon>=11 or mon<=7: return 'late'
    return 'early'

def label(raw):
    m=re.match(r'([A-Za-z]+)\.?\s+(\d+)', raw or '')
    if not m: return None
    mon=MONTH.get(m.group(1)[:3].lower())
    if not mon: return None
    name=m.group(1).rstrip('.')
    return mon, name[:1].upper()+name[1:3].lower()+' '+m.group(2)

def book(path):
    p=T(); p.feed(Path(path).read_text(encoding='utf-8', errors='replace'))
    mp={}
    for area, typ, a_o, a_c, r_o, r_c, quota, limit in p.rows:
        archery_only=bool(re.search(r'archery only', limit, re.I))
        priv=1 if re.search(r'private land', limit, re.I) else 0
        sex=sex_of(limit)
        segs=[]
        def add(o,c,archery):
            po, pc=label(o), label(c)
            if not po or not pc: return
            segs.append({'archery':1 if archery or archery_only else 0,'o':po[1],'c':pc[1],'m':po[0],'b':bucket(po[0]),'lim':limit,'sx':sex,'p':priv,'q':1 if quota else 0})
        add(a_o, a_c, True)
        add(r_o, r_c, archery_only)
        if not segs: continue
        areas=[str(int(bit.strip())) for bit in area.split(',') if bit.strip().isdigit()]
        t='' if typ=='Gen' else typ
        for a in areas:
            mp.setdefault(a+'|'+t, []).extend(segs)
    return mp

src=Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/wyregs')
data={'elk':book(src/'elk.html'),'deer':book(src/'deer.html'),'antelope':book(src/'antelope.html')}
banner='''// 2026 Wyoming hunting seasons. Wyoming Game and Fish Commission, effective June 10, 2026.
// Elk Chapter 7, rule version 25457. Deer Chapter 6, rule version 25456. Antelope Chapter 5, rule version 25455.
// https://rules.wyo.gov/ Each key is hunt area and type. A general license type is stored as a blank type.
// archery 1 is a special archery season or an archery-only limitation.
// b is early (opens before Oct 1), regular (opens in October), or late (opens Nov 1 or later, including January).
// p 1 is a private-land row. q 0 is a continuation row with no separate quota.
const WY_SEASONS = '''
out=Path(__file__).resolve().parents[1]/'wyoming'/'seasons.js'
out.write_text(banner+json.dumps(data, separators=(',',':'))+';\n')
print({k:len(v) for k,v in data.items()}, 'bytes', out.stat().st_size)
