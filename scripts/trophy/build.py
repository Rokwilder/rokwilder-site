#!/usr/bin/env python3
"""Build private Full Pass trophy files from official agency publications.

Writes window.RWT.<state> scripts. Those files are not public site data.
Cache downloads under scripts/trophy/cache (gitignored). Requires pdftotext.
"""
import json, os, re, subprocess, sys, zipfile
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'scripts' / 'trophy' / 'cache'
OUT = ROOT / 'private' / 'fullpass'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

GAPS = []

def gap(state, species, text):
    GAPS.append({'state': state, 'species': species, 'gap': text})

def sh(cmd, timeout=120):
    return subprocess.run(cmd, check=False, capture_output=True, text=True, timeout=timeout)

def download(url, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    r = sh(['curl', '-fsSL', '-A', 'Mozilla/5.0', '--max-time', '90', '-o', str(dest), url])
    if r.returncode != 0 or not dest.exists() or dest.stat().st_size < 500:
        if dest.exists():
            dest.unlink()
        raise RuntimeError(f'download failed {url}: {r.stderr[-300:]}')
    return dest

def pdf_text(path: Path, layout=True):
    txt = path.with_suffix(path.suffix + '.txt')
    if txt.exists() and txt.stat().st_mtime >= path.stat().st_mtime:
        return txt.read_text(errors='replace')
    cmd = ['pdftotext'] + (['-layout'] if layout else []) + [str(path), str(txt)]
    r = sh(cmd, timeout=180)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-300:])
    return txt.read_text(errors='replace')

def num(s):
    if s is None:
        return None
    s = str(s).strip().replace(',', '').replace('%', '')
    if s in ('', '-', '--', '—', '–', '—-', '–-'):
        return None
    try:
        return float(s)
    except ValueError:
        return None

def norm_name(s):
    s = (s or '').lower().replace('mtns', 'mountains').replace('mtn', 'mountain')
    s = s.replace("'", '')
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return ' '.join(s.split())

def forbid_dashes(s):
    if s and ('—' in s or '–' in s):
        raise SystemExit('em or en dash in copy: ' + s)

def fmt_age(v):
    return f'{v:.1f}'

def fmt_pct(v):
    return str(int(round(v)))

def fmt_ratio(v):
    if abs(v - round(v)) < 0.05:
        return str(int(round(v)))
    return f'{v:.1f}'

def level_of(pct):
    if pct >= 0.85:
        return 'top'
    if pct >= 0.60:
        return 'above'
    if pct >= 0.40:
        return 'typical'
    return 'below'

def assign_levels(places):
    """places: list of dicts with place, value, thin, n. Same rank group.
    One vote per place id. n under 10 is thin and is not ranked.
    Unknown n is not treated as thin.
    """
    usable = []
    seen = {}
    for p in places:
        if p.get('value') is None:
            continue
        n = p.get('n')
        if p.get('thin') or (n is not None and n < 10):
            p['level'] = 'thin'
            continue
        if p['place'] not in seen:
            seen[p['place']] = p['value']
            usable.append(p['place'])
    vals = [seen[i] for i in usable]
    few = len(vals) < 5
    for p in places:
        if p.get('level') == 'thin':
            continue
        if p.get('value') is None:
            p['level'] = 'none'
            continue
        if few:
            p['level'] = 'none'
            p['peers'] = 'few'
            continue
        v = p['value']
        below = sum(1 for x in vals if x < v)
        pct = below / (len(vals) - 1) if len(vals) > 1 else 1
        p['level'] = level_of(pct)
        p['peers'] = 'ok'

def summary_for(level, kind, ctx):
    """kind: age, pct, ratio, beam, score, horn. ctx has words and value strings."""
    if level == 'thin':
        return f"Thin data (n={ctx['n']}). Too few animals were checked to rank this hunt."
    if level == 'none':
        if ctx.get('peers') == 'few' and ctx.get('bit'):
            return f"Not enough other hunts with this measure to rank it ({ctx['bit']})."
        return 'Not enough official data to judge.'
    bit = ctx['bit']
    who = ctx.get('males', 'males')
    if kind == 'age' and level == 'top':
        return f"Older {who} than most units ({bit}). Big {who} possible but hard to find."
    if kind == 'age' and level == 'above':
        return f"Older {who} than a typical unit ({bit})."
    if kind == 'age' and level == 'below':
        return f"Younger {who} than most units ({bit})."
    if kind == 'pct' and level == 'top':
        return f"More mature {who} than most units ({bit})."
    if kind == 'pct' and level == 'above':
        return f"Good share of mature {who} ({bit})."
    if kind == 'pct' and level == 'below':
        return f"Mostly young {who}, few mature {ctx.get('animal', who)} ({bit})."
    if kind == 'ratio' and level == 'top':
        return f"More {who} per 100 {ctx['females']} than most herds ({bit}). Herd-wide ratio, not an age."
    if kind == 'ratio' and level == 'above':
        return f"More {who} left after the season than most herds ({bit})."
    if kind == 'ratio' and level == 'below':
        return f"Fewer {who} per 100 {ctx['females']} than most herds ({bit})."
    if kind == 'beam' and level == 'top':
        return f"More bulls with 50 inch beams than most hunts ({bit})."
    if kind == 'beam' and level == 'above':
        return f"A solid share of bulls with 50 inch beams ({bit})."
    if kind == 'beam' and level == 'below':
        return f"Fewer bulls with 50 inch beams than most hunts ({bit})."
    if kind == 'score' and level == 'top':
        return f"Higher check-in scores than most unit groups (average {bit})."
    if kind == 'score' and level == 'above':
        return f"Check-in scores above most unit groups (average {bit})."
    if kind == 'score' and level == 'below':
        return f"Lower check-in scores than most unit groups (average {bit})."
    if kind == 'horn' and level == 'top':
        return f"Longer horns at check-in than most hunts (average {bit})."
    if kind == 'horn' and level == 'above':
        return f"Longer horns than a typical hunt here (average {bit})."
    if kind == 'horn' and level == 'below':
        return f"Shorter horns at check-in than most hunts (average {bit})."
    if kind == 'bullshare' and level == 'top':
        return f"More branch-antlered bulls than most hunt areas ({bit})."
    if kind == 'bullshare' and level == 'above':
        return f"A good share of branch-antlered bulls ({bit})."
    if kind == 'bullshare' and level == 'below':
        return f"More spikes in the bull harvest than most hunt areas ({bit})."
    if level == 'typical':
        return f"About average for this state ({bit})." if bit else 'About average for this state.'
    return 'Not enough official data to judge.'

def blank(unit):
    return {'level': 'none', 'summary': 'Not enough official data to judge.', 'evidence': '', 'badge': '', 'value': None, 'unit': unit}

def finish_group(records, kind, ctx_fn):
    assign_levels(records)
    out = []
    for r in records:
        ctx = ctx_fn(r)
        ctx['n'] = r.get('n')
        ctx['peers'] = r.get('peers')
        text = summary_for(r.get('level') or 'none', kind if r.get('value') is not None else 'none', ctx)
        if r.get('prelim') and r.get('level') not in (None, 'none') and 'preliminary' not in text.lower():
            text = text.rstrip('.') + '. This figure is preliminary.'
        ev = r.get('evidence') or ''
        badge = r.get('badge') or ''
        forbid_dashes(text)
        forbid_dashes(ev)
        forbid_dashes(badge)
        out.append((r['k'], {
            'level': r.get('level') or 'none',
            'summary': text,
            'evidence': ev,
            'badge': badge,
            'value': r.get('value'),
            'unit': r.get('unit') or '',
        }))
    return out

# ---------- catalogs ----------
CATALOG_JS = r'''
import vm from "node:vm";
import {readFileSync, writeFileSync} from "node:fs";
const root = process.argv[2];
function load(file, extra, sb) {
  sb = sb || {window: {}, console};
  vm.createContext(sb);
  vm.runInContext(readFileSync(root + "/" + file, "utf8") + "\n" + extra, sb, {timeout: 20000});
  return sb;
}
const hunts = {co: [], ut: [], az: [], wy: [], id: [], nv: []};
{
  const sb = {window: {}, console};
  vm.createContext(sb);
  vm.runInContext(readFileSync(root + "/drawodds/lite.js", "utf8") + "\nthis.D=D;", sb, {timeout: 20000});
  vm.runInContext(readFileSync(root + "/find/labels.js", "utf8") + "\nthis.FL=FL;", sb, {timeout: 20000});
  vm.runInContext(readFileSync(root + "/drawodds/oial.js", "utf8"), sb, {timeout: 20000});
  const D = sb.D, FL = sb.FL;
  for (const k of Object.keys(D)) {
    const d = D[k];
    const units = (FL[k] && FL[k][2] && FL[k][2].length) ? FL[k][2].map(String) : [String(d[1])];
    const sex = String(d[3] || "");
    let kind = "";
    if (/antlerless|ewe|nanny|doe|cow/i.test(sex)) kind = "F";
    else if (/antlered|ram|bearded|bull|buck/i.test(sex)) kind = "M";
    else if (/either/i.test(sex)) kind = "E";
    hunts.co.push({k, sp: d[0], kind, unit: units.join(" "), units});
  }
}
{
  const sb = load("utah/data.js", "globalThis.UH=UH;");
  for (const [k, h] of Object.entries(sb.UH)) {
    const x = String(h.sex || "").toUpperCase();
    let kind = "";
    if (/^(BULL|BUCK|RAM|BEARDED)$/.test(x)) kind = "M";
    else if (/^(COW|DOE|EWE)$/.test(x)) kind = "F";
    else if (/HUNTER/.test(x)) kind = "E";
    else if (!x && ["goat","bear","crane","swan","sgrouse","stgrouse","bison"].includes(h.sp)) kind = "E";
    hunts.ut.push({k, sp: h.sp, pool: h.pool, kind, name: h.name || "", unit: h.name || k});
  }
}
{
  const sb = load("arizona/data.js", "globalThis.AH=AH;");
  for (const [k, h] of Object.entries(sb.AH)) {
    const legal = h.legal || "";
    let kind = "";
    if (/^(Bull elk|Buck pronghorn|Any antlered deer|Antlered (mule|whitetail) deer|Any ram|Bearded turkey|Designated bull bison|Bull bison only)$/.test(legal)) kind = "M";
    else if (/^(Antlerless (elk|deer)|Designated cow bison|Cow bison only)$/.test(legal)) kind = "F";
    else if (/^(Any |Designated yearling)/.test(legal)) kind = "E";
    const units = (h.u || []).map(String);
    hunts.az.push({k, sp: h.sp, kind, unit: h.area || units.join(" "), units});
  }
}
{
  const sb = load("wyoming/data.js", "globalThis.WH=WH;");
  for (const [k, h] of Object.entries(sb.WH)) {
    hunts.wy.push({k, sp: h.sp, kind: h.sx || "", area: String(h.area), unit: "Hunt area " + h.area + " " + (h.desc || "")});
  }
}
{
  const sb = load("idaho/data.js", "globalThis.IH=IH;");
  for (const [k, h] of Object.entries(sb.IH)) {
    hunts.id.push({k, sp: h.sp, kind: h.sex || "", n: String(h.n), area: String(h.area), methods: h.methods || [], unit: "Hunt " + h.n + " area " + h.area});
  }
}
{
  const sb = load("nevada/data.js", "globalThis.NH=NH;");
  for (const [k, h] of Object.entries(sb.NH)) {
    hunts.nv.push({k, sp: h.sp, kind: h.sx || "", units: h.units || "", wpn: h.wpn || "", who: h.who || "", unit: (h.units || "") + " " + (h.wlab || "")});
  }
}
writeFileSync(process.argv[3], JSON.stringify(hunts));
'''

def catalogs():
    dest = CACHE / 'catalog.json'
    js = CACHE / '_catalog.mjs'
    CACHE.mkdir(parents=True, exist_ok=True)
    js.write_text(CATALOG_JS)
    r = sh(['node', str(js), str(ROOT), str(dest)], timeout=60)
    if r.returncode != 0:
        raise SystemExit(r.stderr)
    return json.loads(dest.read_text())

# ---------- parsers ----------
def parse_co_ratio(text, label):
    """Return {gmu int: (dau, ratio)} only when the GMU is in exactly one DAU."""
    dau_units = []
    for line in text.splitlines():
        if 'Total Statewide' in line or 'eastern plains' in line.lower() or 'GAME MANAGEMENT' in line:
            continue
        # Herd-name column is blank in the text extract. Units may be one GMU or a comma list.
        m = re.match(r'\s*(\d+)\s+((?:\d+[A-Za-z]*,\s*)*\d+[A-Za-z]*)\s+([\d,]+)\s+(\d+)\s*$', line)
        if not m:
            continue
        dau, units, _pop, ratio = m.group(1), m.group(2), m.group(3), int(m.group(4))
        ids = []
        for part in units.split(','):
            part = part.strip()
            mm = re.match(r'(\d+)', part)
            if mm:
                ids.append(int(mm.group(1)))
        dau_units.append((dau, ids, ratio))
    owner = defaultdict(list)
    for dau, ids, ratio in dau_units:
        for i in ids:
            owner[i].append((dau, ratio))
    clean = {}
    overlap = []
    for i, rows in owner.items():
        daus = {d for d, _ in rows}
        if len(daus) == 1:
            clean[i] = rows[0]
        else:
            overlap.append(i)
    return clean, sorted(overlap)

def co_records(cat, clean, sp, males, females, overlap):
    recs = []
    for h in cat:
        if h['sp'] != sp:
            continue
        base = blank(h['unit'])
        base['k'] = h['k']
        if h['kind'] not in ('M', 'E'):
            recs.append(base)
            continue
        units = []
        for u in h['units']:
            mm = re.match(r'(\d+)', str(u).lstrip('SGsg'))
            if mm:
                units.append(int(mm.group(1)))
        if not units or any(u in overlap or u not in clean for u in units):
            recs.append(base)
            continue
        daus = {clean[u][0] for u in units}
        ratios = {clean[u][1] for u in units}
        if len(daus) != 1 or len(ratios) != 1:
            recs.append(base)
            continue
        dau = next(iter(daus))
        ratio = next(iter(ratios))
        base.update({
            'place': f'{sp}:dau:{dau}',
            'value': ratio,
            'n': None,
            'unit': h['unit'],
            'evidence': f"Post-season ratio: {ratio} {males} per 100 {females} (CPW, herd-wide, DAU {dau}, 2025)",
        })
        recs.append(base)
    return recs

def parse_ut_elk(text):
    rows = {}
    for line in text.splitlines():
        if 'Unit' in line and 'Objective' in line:
            continue
        m = re.match(r'\s*(.+?)\s+(\d\.\d\s*-\s*\d\.\d)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*$', line)
        if not m:
            continue
        name, obj, a, b, c, avg = m.groups()
        if name.lower().startswith('unit'):
            continue
        years = []
        for y, tok in ((2023, a), (2024, b), (2025, c)):
            if num(tok) is not None:
                years.append(y)
        av = num(avg)
        if av is None:
            continue
        rows[norm_name(name)] = {'name': name.strip(), 'obj': obj.replace(' ', ''), 'avg': av, 'years': years}
    return rows

def ut_elk_badge(obj):
    if obj in ('6.5-7.0', '6.0-6.5'):
        pretty = obj.replace('-', ' to ')
        return f'Managed for older bulls (UT age objective {pretty} yrs)'
    return ''

def parse_ut_deer(text):
    def block(title):
        i = text.find(title)
        if i < 0:
            return ''
        j = text.find('Table', i + 10)
        k = text.find('\f', i + 10)
        end = min(x for x in (j, k, len(text)) if x and x > i)
        return text[i:end]
    def rows(chunk):
        out = []
        for line in chunk.splitlines():
            line = line.strip().rstrip('*')
            parts = line.split()
            if len(parts) < 3:
                continue
            obj_i = None
            for i, p in enumerate(parts):
                if re.match(r'^\d+[–-]\d+$', p):
                    obj_i = i
                    break
            if obj_i is None:
                continue
            avg = num(parts[-1])
            if obj_i >= 1 and re.search(r'\d', parts[obj_i - 1]):
                name = ' '.join(parts[:obj_i - 1])
            else:
                name = ' '.join(parts[:obj_i])
            name = name.replace(' ,', ',').strip(' ,')
            if not name or name.lower().startswith('table'):
                continue
            obj = parts[obj_i].replace('–', '-')
            out.append((norm_name(name), name, avg, obj))
        return out
    general = rows(block('Table 1.'))
    premium = rows(block('Table 2.'))
    limited = rows(block('Table 3.'))
    return general, premium, limited

def parse_sheep_pdf(text):
    by = defaultdict(list)
    for line in text.splitlines():
        m = re.search(r'\b((?:DS|RS|BS)\d{3,5})\b', line)
        if not m:
            continue
        hunt = m.group(1)
        rest = line[m.end():].split()
        if len(rest) < 3 or rest[0] != 'Y' or rest[1] != 'Y':
            continue
        nums = []
        for t in rest[3:]:
            if re.match(r'\d{1,2}/\d{1,2}/', t):
                break
            if re.match(r'^\d+(\.\d+)?$', t):
                nums.append(float(t))
        # circumference, length, circumference, length when present
        lengths = []
        if len(nums) >= 2:
            lengths.append(nums[1])
        if len(nums) >= 4:
            lengths.append(nums[3])
        if lengths:
            by[hunt].append(sum(lengths) / len(lengths))
    return {k: (sum(v) / len(v), len(v)) for k, v in by.items()}

def xlsx_rows(path):
    z = zipfile.ZipFile(path)
    ss = []
    root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    for si in root.findall('m:si', NS):
        texts = [t.text or '' for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')]
        ss.append(''.join(texts))
    sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    rows = []
    for row in sheet.findall('m:sheetData/m:row', NS):
        vals = {}
        for c in row.findall('m:c', NS):
            ref = c.attrib.get('r', '')
            col = ''.join(ch for ch in ref if ch.isalpha())
            t = c.attrib.get('t')
            v = c.find('m:v', NS)
            val = v.text if v is not None else ''
            if t == 's' and val != '':
                val = ss[int(val)]
            vals[col] = val
        rows.append(vals)
    return rows[1:]

def unit_set(s):
    s = str(s).replace('–', '-').replace('—', '-')
    nums = []
    for part in re.split(r'[,/]', s):
        part = part.strip()
        m = re.match(r'^(\d+)\s*([A-Za-z]?)\s*-\s*(\d+)\s*([A-Za-z]?)$', part)
        if m and m.group(2) == '' and m.group(4) == '':
            a, b = int(m.group(1)), int(m.group(3))
            if 0 < b - a <= 30:
                nums.extend(range(a, b + 1))
                continue
        m = re.match(r'^(\d+)\s*([A-Za-z]?)$', part)
        if m:
            nums.append(int(m.group(1)) * 10 + (ord(m.group(2).upper()) - 64 if m.group(2) else 0))
    return frozenset(nums)

def parse_id_controlled(html, kind):
    """kind elk or deer. Returns hunt number -> list of (year, antlered n, pct)."""
    out = defaultdict(list)
    for tr in re.findall(r'<tr>(.*?)</tr>', html, re.S | re.I):
        tds = re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S | re.I)
        if len(tds) < 11:
            continue
        cells = [re.sub(r'<[^>]+>', '', x).replace('&#37;', '').strip() for x in tds]
        hunt, _method, _area = cells[0], cells[1], cells[2]
        if not re.fullmatch(r'\d+', hunt):
            continue
        ant = num(cells[7])
        if kind == 'elk':
            pct = num(cells[10]) if len(cells) > 10 else None
        else:
            pct = num(cells[9]) if len(cells) > 9 else None
        year = num(cells[-1])
        if pct is None or ant is None or year is None:
            continue
        out[hunt].append((int(year), ant, pct))
    return out

def id_merge(rows):
    den = sum(n for _y, n, _p in rows)
    if den <= 0:
        return None
    val = sum(n * p for _y, n, p in rows) / den
    years = sorted({y for y, _n, _p in rows})
    return val, den, years

def parse_wy_elk(text):
    areas = {}
    current = None
    acc = None
    def flush():
        nonlocal acc, current
        if current is None or acc is None:
            return
        if acc.get('total') and current not in areas:
            areas[current] = acc['total']
        acc = None
    for line in text.splitlines():
        s = line.strip()
        m = re.match(r'^(\d{1,3})\s+[A-Z][A-Za-z]', s)
        if m and 'Table' not in s and not re.match(r'^\d+\s+\d', s):
            flush()
            current = int(m.group(1))
            acc = {'bull': 0, 'spike': 0, 'total': None}
            continue
        if current is None:
            continue
        if s.startswith('Resident') or s.startswith('Nonresident'):
            continue
        if re.match(r'^Total\b', s):
            # First harvest table: Active, Bull, Spike, Cow, Calf, Total, then days.
            # A later table repeats hunt areas with fewer columns. Keep the first long row.
            ints = re.findall(r'[\d,]+', s.split('.')[0])
            if len(ints) >= 6 and acc.get('total') is None:
                acc['total'] = (int(ints[1].replace(',', '')), int(ints[2].replace(',', '')))
            continue
    flush()
    return areas

def parse_nv_sheep(text):
    rows = []
    for line in text.splitlines():
        if 'Unit' in line and 'Tags' in line:
            continue
        if not re.search(r'\d+\s*%', line):
            continue
        m = re.match(r'\s*(.+?)\s+(\d+)\s+(\d+)%\s+([\d.]+)\s+([\d.]+)\s+(\d+(?:\s+\d+/\d+)?)', line)
        if not m:
            continue
        unit, tags, succ, _days, age, bc = m.groups()
        def frac(tok):
            mm = re.match(r'^(\d+)\s+(\d+)/(\d+)$', tok.strip())
            if mm:
                return int(mm.group(1)) + int(mm.group(2)) / int(mm.group(3))
            return num(tok)
        harvested = int(round(int(tags) * int(succ) / 100))
        rows.append({'unit': unit.strip(), 'n': harvested, 'age': num(age), 'score': frac(bc), 'key': unit_set(unit)})
    return rows

def parse_nv_goat(text):
    by = defaultdict(list)
    for line in text.splitlines():
        m = re.match(r'\s*(\d{3})\b(.*)$', line)
        if not m:
            continue
        unit, rest = m.group(1), m.group(2)
        mm = re.search(r'\b(male|female)\s+(\d{1,2})\b', rest, re.I)
        if not mm:
            continue
        age = int(mm.group(2))
        if 0 < age < 20:
            by[unit].append(age)
    return {u: (sum(v) / len(v), len(v)) for u, v in by.items()}

def years_phrase(years):
    years = list(years)
    if not years:
        return ''
    if len(years) == 1:
        return str(years[0])
    return f'{min(years)} to {max(years)}'

def emit(state, hunts, species_meta):
    body = {
        'meta': {
            'built': '2026-11-14',
            'state': state,
            'note': 'Official agency fields only. Levels rank hunts inside this state and species. A sample under 10 animals is Thin data and is not ranked.',
        },
        'species': species_meta,
        'hunts': hunts,
    }
    raw = json.dumps(body, separators=(',', ':'), ensure_ascii=True)
    if '—' in raw or '\\u2014' in raw or '–' in raw or '\\u2013' in raw:
        raise SystemExit(f'dash in {state} output')
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f'trophy-{state}.js'
    path.write_text(f'window.RWT=window.RWT||{{}};window.RWT.{state}={raw};\n')
    return path

def count_levels(hunts, sp_keys):
    # sp_keys unused; count all
    c = defaultdict(int)
    for h in hunts.values():
        c[h['level']] += 1
    return dict(c)

def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    # Prefer files already fetched into /tmp/trophy-src during research.
    src = Path('/tmp/trophy-src')
    def use(name, url=None):
        p = src / name
        if p.exists() and p.stat().st_size > 500:
            return p
        if url:
            return download(url, CACHE / name)
        raise RuntimeError('missing ' + name)
    cat = catalogs()
    species_out = {}

    # ----- Colorado -----
    elk_pdf = use('co-elk-2025.pdf', 'https://cpw.widen.net/content/zgsbsyuok0/original/2025-Elk-Population-and-Sex-Ratio-Estimates.pdf?u=qdpcdt&download=true')
    deer_pdf = use('co-deer-2025.pdf', 'https://cpw.widen.net/content/bzkxxbydyy/original/2025-Deer-Population-and-Sex-Ratio-Estimates.pdf?u=qdpcdt&download=true')
    elk_map, elk_over = parse_co_ratio(pdf_text(elk_pdf), 'elk')
    deer_map, deer_over = parse_co_ratio(pdf_text(deer_pdf), 'deer')
    if not elk_map or not deer_map:
        raise SystemExit(f'CO parse failed elk {len(elk_map)} deer {len(deer_map)}')
    co_species = {}
    co_hunts = {}
    for sp, clean, over, males, females in (
        ('elk', elk_map, elk_over, 'bulls', 'cows'),
        ('deer', deer_map, deer_over, 'bucks', 'does'),
    ):
        recs = co_records(cat['co'], clean, sp, males, females, set(over))
        def ctx(r, males=males, females=females):
            bit = f"{fmt_ratio(r['value'])} {males} per 100 {females}" if r.get('value') is not None else ''
            return {'bit': bit, 'males': males, 'females': females}
        for k, row in finish_group(recs, 'ratio', ctx):
            co_hunts[k] = row
        co_species[sp] = {
            'field': f'2025 post-season {males} per 100 {females}, herd-wide by DAU',
            'years': '2025',
            'source': 'CPW',
            'sourceUrl': 'https://cpw.state.co.us/activities/hunting/big-game/hunting-elk/elk-statistics' if sp == 'elk' else 'https://cpw.state.co.us/activities/hunting/big-game/hunting-deer/deer-statistics',
            'gap': (f'GMUs listed in more than one DAU were left as Not enough data: {", ".join(map(str, over))}.' if over else ''),
        }
    for sp in sorted({h['sp'] for h in cat['co']} - {'elk', 'deer'}):
        co_species[sp] = {'field': '', 'years': '', 'source': 'CPW', 'sourceUrl': '', 'gap': 'No confirmed official age, point, or sex-ratio field for this species. Marked Not enough data.'}
        gap('co', sp, co_species[sp]['gap'])
        for h in cat['co']:
            if h['sp'] == sp:
                co_hunts[h['k']] = blank(h['unit'])
    # hunts whose species was elk/deer but missing from recs should not happen
    gap('co', 'elk', 'Tooth ages on the elk statistics page are Larimer County files. A GMU table for units 7, 8, 9, 19, 191 and 20 was not confirmed, so tooth age is not shown.')
    gap('co', 'pronghorn', 'No pronghorn sex-ratio file was confirmed on the statistics pages used here.')
    if elk_over:
        gap('co', 'elk', 'Some GMUs appear in more than one 2025 elk DAU, so those units are Not enough data: ' + ', '.join(map(str, elk_over)))
    if deer_over:
        gap('co', 'deer', 'Some GMUs appear in more than one 2025 deer DAU, so those units are Not enough data: ' + ', '.join(map(str, deer_over)))
    species_out['co'] = (co_hunts, co_species)

    # ----- Utah elk ages, deer ratios, sheep horns -----
    elk_rows = parse_ut_elk(pdf_text(use('ut-elk-ages.pdf')))
    if len(elk_rows) < 10:
        raise SystemExit('UT elk age parse failed: ' + str(len(elk_rows)))
    general, premium, limited = parse_ut_deer(pdf_text(use('ut-deer-plan.pdf')))
    if len(general) < 10 or len(premium) < 2 or len(limited) < 5:
        raise SystemExit(f'UT deer tables {len(general)} {len(premium)} {len(limited)}')
    deer_by = {}
    for name, raw, avg, obj in general:
        deer_by[name] = {'avg': avg, 'badge': '', 'label': raw, 'tier': 'general'}
    for name, raw, avg, obj in limited:
        deer_by[name] = {'avg': avg, 'badge': 'Managed for quality (UT limited-entry buck deer)', 'label': raw, 'tier': 'le'}
    for name, raw, avg, obj in premium:
        deer_by[name] = {'avg': avg, 'badge': 'Managed for quality (UT premium limited entry)', 'label': raw, 'tier': 'premium'}
    # aliases from hunt names to table keys
    alias = {
        'henry mountains': 'henry mountains',
        'paunsaugunt': 'paunsaugunt',
        'cache crawford mountain': 'cache crawford mountain',
        'diamond mountain': 'south slope diamond mountain',
        'book cliffs': 'book cliffs',
        'dolores triangle': 'la sal dolores triangle',
        'san juan elk ridge': 'san juan elk ridge',
        'thousand lakes': 'thousand lakes',
        'west desert vernon': 'west desert vernon',
        'fillmore oak creek le': 'fillmore oak creek',
        'antelope island': None,
    }
    ut_species = {}
    ut_recs = []
    matched_elk = 0
    for h in cat['ut']:
        if h['sp'] != 'elk':
            continue
        base = blank(h['unit'])
        base['k'] = h['k']
        key = norm_name(h['name'])
        row = elk_rows.get(key)
        if row and h['kind'] in ('M', 'E') and h['pool'] == 'elk-le':
            yrs = years_phrase(row['years'])
            base.update({
                'place': 'elk:' + key,
                'value': row['avg'],
                'n': None,
                'badge': ut_elk_badge(row['obj']),
                'evidence': f"Avg age of harvested bulls: {fmt_age(row['avg'])} yrs (Utah DWR, {row['name']}, {yrs})",
            })
            matched_elk += 1
        ut_recs.append(base)
    def elk_ctx(r):
        bit = f"{fmt_age(r['value'])} yr average age" if r.get('value') is not None else ''
        return {'bit': bit, 'males': 'bulls'}
    ut_hunts = {}
    for k, row in finish_group(ut_recs, 'age', elk_ctx):
        ut_hunts[k] = row
    ut_species['elk'] = {
        'field': 'Limited-entry average age of harvested bulls, 3-year average when the table prints one',
        'years': '2023 to 2025',
        'source': 'Utah DWR',
        'sourceUrl': 'https://wildlife.utah.gov/pdf/meetings/rac/table-2026-04-01-bull-elk-tables.pdf',
        'gap': 'The age table does not list how many bulls were aged, so the under-10 thin-data rule could not be applied. Hunts that are not limited-entry bull hunts stay Not enough data.',
    }
    gap('ut', 'elk', ut_species['elk']['gap'])
    deer_recs = []
    deer_hit = 0
    for h in cat['ut']:
        if h['sp'] != 'deer':
            continue
        base = blank(h['unit'])
        base['k'] = h['k']
        key = norm_name(h['name'])
        if key in alias:
            key = alias[key] if alias[key] else ''
        row = deer_by.get(key) if key else None
        if h['name'] == 'Antelope Island' and h['kind'] == 'M':
            base['badge'] = 'Managed for quality (UT premium limited entry)'
        if row and row.get('avg') is not None and h['kind'] in ('M', 'E'):
            base.update({
                'place': 'deer:' + key,
                'value': row['avg'],
                'n': None,
                'badge': row['badge'],
                'evidence': f"Bucks per 100 does: {fmt_ratio(row['avg'])} (Utah DWR, {row['label']}, 2021 to 2023)",
            })
            deer_hit += 1
        elif row and row.get('badge'):
            base['badge'] = row['badge']
        deer_recs.append(base)
    def deer_ctx(r):
        bit = f"{fmt_ratio(r['value'])} bucks per 100 does" if r.get('value') is not None else ''
        return {'bit': bit, 'males': 'bucks', 'females': 'does'}
    for k, row in finish_group(deer_recs, 'ratio', deer_ctx):
        ut_hunts[k] = row
    ut_species['deer'] = {
        'field': 'Observed bucks per 100 does, 3-year average, from the statewide mule deer plan tables',
        'years': '2021 to 2023',
        'source': 'Utah DWR',
        'sourceUrl': 'https://wildlife.utah.gov/pdf/bg/plans/mule_deer_plan.pdf',
        'gap': 'Classified-deer sample size is not in the plan tables, so the under-10 rule was not applied. Premium badge: Henry Mountains, Paunsaugunt, and Antelope Island. Antelope Island has a badge and no ratio in Table 2.',
    }
    sheep = parse_sheep_pdf(pdf_text(use('ut-sheep.pdf')))
    sheep_recs = {'desert': [], 'rocky': []}
    for h in cat['ut']:
        if h['sp'] != 'sheep':
            continue
        base = blank(h['unit'])
        base['k'] = h['k']
        group = 'desert' if h['k'].startswith('DS') else 'rocky'
        stat = sheep.get(h['k'])
        if stat and h['kind'] in ('M', 'E'):
            avg, n = stat
            base.update({
                'place': f'sheep:{group}:{h["k"]}',
                'value': round(avg, 2),
                'n': n,
                'thin': n < 10,
                'evidence': f"Avg horn length at check-in: {avg:.1f} inches (Utah DWR, hunt {h['k']}, {h['name']}, 2025, n={n})",
            })
        sheep_recs[group].append(base)
    def horn_ctx(r):
        bit = f"{r['value']:.1f} inches" if r.get('value') is not None else ''
        return {'bit': bit, 'males': 'rams'}
    for group in ('desert', 'rocky'):
        for k, row in finish_group(sheep_recs[group], 'horn', horn_ctx):
            ut_hunts[k] = row
    ut_species['sheep'] = {
        'field': 'Average horn length from the 2025 bighorn harvest record, by hunt number',
        'years': '2025',
        'source': 'Utah DWR',
        'sourceUrl': 'https://wildlife.utah.gov/pdf/sheep/2025_sheep/2025-harvest-data.pdf',
        'gap': 'Desert and Rocky Mountain rams are ranked separately. Hunts with fewer than 10 measured rams are Thin data.',
    }
    for sp in sorted({h['sp'] for h in cat['ut']} - set(ut_species)):
        ut_species[sp] = {'field': '', 'years': '', 'source': 'Utah DWR', 'sourceUrl': '', 'gap': 'No confirmed official age, horn, or sex-ratio field for this species in the files used here.'}
        gap('ut', sp, ut_species[sp]['gap'])
        for h in cat['ut']:
            if h['sp'] == sp and h['k'] not in ut_hunts:
                ut_hunts[h['k']] = blank(h['unit'])
    species_out['ut'] = (ut_hunts, ut_species)
    print('UT elk matched', matched_elk, 'deer', deer_hit, 'sheep hunts with horns', len(sheep))

    # ----- Nevada -----
    rows = xlsx_rows(use('nv-2025.xlsx'))
    # aggregate (hunt class, weapon, unit set) -> n, weighted metric
    agg = defaultdict(lambda: [0.0, 0.0])
    for r in rows:
        hunt, weapon, units = r.get('B', ''), r.get('E', ''), r.get('F', '')
        succ = num(r.get('M'))
        survey = num(r.get('O'))
        points = num(r.get('Q'))
        length = num(r.get('R'))
        if succ is None:
            continue
        n = succ * survey if survey is not None else succ
        metric = None
        if hunt.startswith('Elk Antlered') or hunt == 'Elk Antlered':
            metric = length
        elif hunt == 'Mule Deer Antlered' or hunt == 'Mule Deer Guided Antlered' or hunt == 'Mule Deer Junior':
            metric = points
        elif hunt == 'Antelope Horns Longer Than Ears' or hunt == 'Antelope Horns Shorter Than Ears':
            metric = length
        if metric is None or n <= 0:
            continue
        if metric <= 1:
            metric *= 100
        key = (hunt, weapon, unit_set(units))
        agg[key][0] += n
        agg[key][1] += n * metric
    def nv_pick(h):
        us = unit_set(h['units'])
        weapon = {'alw': 'ALW', 'bow': 'AR', 'muz': 'M'}.get(h['wpn'])
        if not weapon or not us:
            return None
        if h['sp'] == 'elk' and h['kind'] == 'M':
            cls = 'Elk Antlered'
        elif h['sp'] == 'deer' and h['kind'] == 'M':
            cls = 'Mule Deer Guided Antlered' if h['who'] == 'guided' else ('Mule Deer Junior' if h['who'] == 'junior' else 'Mule Deer Antlered')
        elif h['sp'] == 'antelope' and h['kind'] == 'M':
            cls = 'Antelope Horns Longer Than Ears'
        elif h['sp'] == 'antelope' and h['kind'] == 'F':
            cls = 'Antelope Horns Shorter Than Ears'
        else:
            return None
        hit = agg.get((cls, weapon, us))
        if not hit or hit[0] <= 0:
            return None
        return hit[0], hit[1] / hit[0], cls
    nv_recs = {'elk': [], 'deer': [], 'antelope': []}
    for h in cat['nv']:
        if h['sp'] not in nv_recs:
            continue
        base = blank(h['unit'])
        base['k'] = h['k']
        picked = nv_pick(h)
        if picked:
            n, val, cls = picked
            kind = 'beam' if h['sp'] == 'elk' else ('pct' if h['sp'] == 'deer' else 'pct')
            if h['sp'] == 'elk':
                ev = f"Bulls with 50 inch beams: {fmt_pct(val)}% (NDOW, unit group {h['units']}, {h['wpn']}, 2025, n={int(round(n))})"
                males, animal = 'bulls', 'elk'
            elif h['sp'] == 'deer':
                ev = f"Bucks with 4+ points: {fmt_pct(val)}% (NDOW, unit group {h['units']}, {h['wpn']}, 2025, n={int(round(n))})"
                males, animal = 'bucks', 'deer'
            else:
                ev = f"Bucks with 15 inch horns or longer: {fmt_pct(val)}% (NDOW, unit group {h['units']}, {h['wpn']}, 2025, n={int(round(n))})"
                males, animal = 'bucks', 'pronghorn'
            base.update({'place': f"{h['sp']}:{cls}:{h['wpn']}:{unit_set(h['units'])}", 'value': val, 'n': n, 'thin': n < 10, 'evidence': ev, '_males': males, '_animal': animal, '_kind': 'beam' if h['sp']=='elk' else 'pct'})
        nv_recs[h['sp']].append(base)
    nv_hunts = {}
    nv_species = {}
    for sp, recs in nv_recs.items():
        kind = 'beam' if sp == 'elk' else 'pct'
        def ctx(r, sp=sp):
            if r.get('value') is None:
                return {'bit': '', 'males': 'males', 'animal': 'animals'}
            if sp == 'elk':
                return {'bit': f"{fmt_pct(r['value'])}% with 50 inch beams", 'males': 'bulls', 'animal': 'elk'}
            if sp == 'deer':
                return {'bit': f"{fmt_pct(r['value'])}% 4+ points", 'males': 'bucks', 'animal': 'deer'}
            return {'bit': f"{fmt_pct(r['value'])}% with 15 inch horns or longer", 'males': 'bucks', 'animal': 'pronghorn'}
        for k, row in finish_group(recs, kind, ctx):
            nv_hunts[k] = row
    nv_species['elk'] = {'field': 'Share of harvested bulls with 50 inch main beams, from the 2025 hunt summary, by unit group and weapon', 'years': '2025', 'source': 'NDOW', 'sourceUrl': 'https://www.ndow.org/wp-content/uploads/2026/03/2025-Nevada-Big-Game-Hunt-Data.xlsx', 'gap': '2025 elk ages in the preliminary age PDF are not the ranking field. Spike and antlerless elk are Not enough data on this measure.'}
    nv_species['deer'] = {'field': 'Share of harvested bucks with 4 or more points, by unit group and weapon', 'years': '2025', 'source': 'NDOW', 'sourceUrl': 'https://www.ndow.org/wp-content/uploads/2026/03/2025-Nevada-Big-Game-Hunt-Data.xlsx', 'gap': ''}
    nv_species['antelope'] = {'field': 'Share of harvested bucks with horns 15 inches or longer, by unit group and weapon', 'years': '2025', 'source': 'NDOW', 'sourceUrl': 'https://www.ndow.org/wp-content/uploads/2026/03/2025-Nevada-Big-Game-Hunt-Data.xlsx', 'gap': ''}
    # sheep from trend PDFs
    sheep_files = {
        'dsheep': ('nv-desert.pdf', 'https://www.ndow.org/wp-content/uploads/2026/04/Desert-Bighorn-Ram-Hunt-Trends-Comparative-Stats-2005-2025-003.pdf'),
        'csheep': ('nv-cali.pdf', 'https://www.ndow.org/wp-content/uploads/2026/04/California-Bighorn-Ram-Hunt-Trends-Stats-2005-2025.pdf'),
        'rsheep': ('nv-rocky.pdf', 'https://www.ndow.org/wp-content/uploads/2026/04/Rocky-Mtn-Ram-Hunt-Trends-Stats-2005-2025-1.pdf'),
    }
    for sp, (name, url) in sheep_files.items():
        try:
            parsed = parse_nv_sheep(pdf_text(use(name, url)))
        except Exception as e:
            parsed = []
            gap('nv', sp, f'Sheep trend PDF could not be parsed ({e}).')
        by_key = {}
        for row in parsed:
            if row['key']:
                by_key[row['key']] = row
        recs = []
        hit = 0
        for h in cat['nv']:
            if h['sp'] != sp:
                continue
            base = blank(h['unit'])
            base['k'] = h['k']
            row = by_key.get(unit_set(h['units']))
            if row and row.get('score') is not None and h['kind'] == 'M':
                hit += 1
                base.update({
                    'place': f'{sp}:{h["units"]}',
                    'value': row['score'],
                    'n': row['n'],
                    'thin': row['n'] < 10,
                    'evidence': f"Average B&C score at check-in: {row['score']:.1f}; average age {row['age']:.1f} yrs (NDOW, unit group {h['units']}, 2024 to 2025, n={row['n']})",
                })
            recs.append(base)
        def sctx(r):
            bit = f"{r['value']:.1f} B&C" if r.get('value') is not None else ''
            return {'bit': bit, 'males': 'rams'}
        for k, row in finish_group(recs, 'score', sctx):
            nv_hunts[k] = row
        nv_species[sp] = {
            'field': 'Average B&C score at check-in, last two years, by unit group',
            'years': '2024 to 2025',
            'source': 'NDOW',
            'sourceUrl': url,
            'gap': '' if hit else 'Unit groups in the trend table did not match finder hunts.',
        }
        print(sp, 'sheep rows', len(parsed), 'matched hunts', hit)
    goat = parse_nv_goat(pdf_text(use('nv-goat.pdf')))
    grecs = []
    for h in cat['nv']:
        if h['sp'] != 'goat':
            continue
        base = blank(h['unit'])
        base['k'] = h['k']
        # unit string may be "101" or "102"
        keys = re.findall(r'\d{3}', h['units'])
        if len(keys) == 1 and keys[0] in goat:
            avg, n = goat[keys[0]]
            base.update({
                'place': 'goat:' + keys[0],
                'value': avg,
                'n': n,
                'thin': n < 10,
                'evidence': f"Avg age at check-in: {avg:.1f} yrs (NDOW, unit {keys[0]}, 2025, n={n})",
            })
        grecs.append(base)
    def gctx(r):
        bit = f"{r['value']:.1f} yr average age" if r.get('value') is not None else ''
        return {'bit': bit, 'males': 'goats'}
    for k, row in finish_group(grecs, 'age', gctx):
        nv_hunts[k] = row
    nv_species['goat'] = {'field': 'Average age at check-in, by unit', 'years': '2025', 'source': 'NDOW', 'sourceUrl': 'https://www.ndow.org/wp-content/uploads/2026/04/2025-Mountain-Goat-Hunt-Summary-FINAL-4-17-26.pdf', 'gap': 'Most units have fewer than 10 checked goats, so they show Thin data.'}
    for sp in sorted({h['sp'] for h in cat['nv']} - set(nv_species)):
        nv_species[sp] = {'field': '', 'years': '', 'source': 'NDOW', 'sourceUrl': '', 'gap': 'The 2025 hunt summary has harvest for this species and no age, point, horn, or score field that was confirmed here.'}
        gap('nv', sp, nv_species[sp]['gap'])
        for h in cat['nv']:
            if h['sp'] == sp:
                nv_hunts[h['k']] = blank(h['unit'])
    gap('nv', 'elk', 'Elk ages in Preliminary-Elk-2025-Age-by-Unit-Group.pdf are labeled preliminary and were not used for the level. The level uses the 2025 share of bulls with 50 inch beams.')
    species_out['nv'] = (nv_hunts, nv_species)

    # ----- Idaho controlled harvest -----
    id_stats = {}
    for yr in (2023, 2024, 2025):
        for game, kind in (('elk', 'elk'), ('deer', 'deer')):
            name = f'id-{game}-c-{yr}.html'
            path = use(name, f'https://idfg.idaho.gov/ifwis/huntplanner/stats/?game={game}&season=controlled&yr={yr}')
            html = path.read_text(errors='replace')
            parsed = parse_id_controlled(html, kind)
            for hunt, rows_ in parsed.items():
                id_stats.setdefault((kind, hunt), []).extend(rows_)
    id_hunts = {}
    id_species = {}
    id_recs = {'elk': [], 'deer': []}
    for h in cat['id']:
        if h['sp'] not in ('elk', 'deer'):
            continue
        base = blank(h['unit'])
        base['k'] = h['k']
        merged = id_merge(id_stats.get((h['sp'], h['n']), []))
        if merged and h['kind'] == 'M':
            val, den, years = merged
            yrs = years_phrase(years)
            if h['sp'] == 'elk':
                ev = f"Bulls with 6+ points: {fmt_pct(val)}% (IDFG, hunt {h['n']}, unit {h['area']}, {yrs}, n={int(den)})"
            else:
                ev = f"Bucks with 4+ points: {fmt_pct(val)}% (IDFG, hunt {h['n']}, unit {h['area']}, {yrs}, n={int(den)})"
            base.update({'place': f"{h['sp']}:{h['n']}", 'value': val, 'n': den, 'thin': den < 10, 'evidence': ev})
        id_recs[h['sp']].append(base)
    for sp, males, animal in (('elk', 'bulls', 'elk'), ('deer', 'bucks', 'deer')):
        label = '6+ points' if sp == 'elk' else '4+ points'
        def ctx(r, males=males, animal=animal, label=label):
            bit = f"{fmt_pct(r['value'])}% {label}" if r.get('value') is not None else ''
            return {'bit': bit, 'males': males, 'animal': animal}
        for k, row in finish_group(id_recs[sp], 'pct', ctx):
            id_hunts[k] = row
        id_species[sp] = {
            'field': f'Share of the antlered harvest with {label}, controlled hunts, weighted across the years on the Hunt Planner',
            'years': '2023 to 2025',
            'source': 'IDFG',
            'sourceUrl': f'https://idfg.idaho.gov/ifwis/huntplanner/stats/?game={sp}&season=controlled',
            'gap': 'Matched by hunt number on the controlled-hunt harvest table. General-season rows were not mixed in. Female hunts are Not enough data on this measure.',
        }
    for sp in sorted({h['sp'] for h in cat['id']} - {'elk', 'deer'}):
        id_species[sp] = {'field': '', 'years': '', 'source': 'IDFG', 'sourceUrl': 'https://idfg.idaho.gov/ifwis/huntplanner/harvestfinder.aspx', 'gap': 'No confirmed point-class or age table for this species was parsed. Marked Not enough data.'}
        gap('id', sp, id_species[sp]['gap'])
        for h in cat['id']:
            if h['sp'] == sp:
                id_hunts[h['k']] = blank(h['unit'])
    species_out['id'] = (id_hunts, id_species)

    # ----- Wyoming elk bull vs spike, plus named special-management areas -----
    wy_areas = parse_wy_elk(pdf_text(use('wy-elk-harv.pdf')))
    if len(wy_areas) < 20:
        raise SystemExit('WY elk harvest parse failed: ' + str(len(wy_areas)))
    special = {30, 32, 100}
    wy_recs = []
    for h in cat['wy']:
        if h['sp'] != 'elk':
            continue
        base = blank(h['unit'])
        base['k'] = h['k']
        try:
            area = int(h['area'])
        except ValueError:
            area = None
        if area in special:
            base['badge'] = 'WY special management herd'
        if area in wy_areas and h['kind'] in ('M', 'E'):
            bulls, spikes = wy_areas[area]
            n = bulls + spikes
            if n > 0:
                val = 100.0 * bulls / n
                base.update({
                    'place': f'elk:{area}',
                    'value': val,
                    'n': None,
                    'evidence': f"Branch-antlered bulls: {fmt_pct(val)}% of harvested males (estimated {bulls} bulls and {spikes} spikes) (WGFD, hunt area {area}, 2025)",
                })
        wy_recs.append(base)
    def wctx(r):
        bit = f"{fmt_pct(r['value'])}% branch-antlered" if r.get('value') is not None else ''
        return {'bit': bit, 'males': 'bulls', 'animal': 'elk'}
    wy_hunts = {}
    for k, row in finish_group(wy_recs, 'bullshare', wctx):
        wy_hunts[k] = row
    wy_species = {'elk': {
        'field': 'Share of the male harvest that is branch-antlered (bulls, not spikes), from the 2025 elk harvest report, by hunt area',
        'years': '2025',
        'source': 'WGFD',
        'sourceUrl': 'https://wgfd.wyo.gov/media/33482/download?inline=',
        'gap': 'Figures are survey estimates. The report does not publish a checked-animal sample by hunt area, so the under-10 rule was not applied. Special-management badge only for hunt areas 30, 32, and 100, named on the elk hunting guide.',
    }}
    gap('wy', 'elk', wy_species['elk']['gap'])
    gap('wy', 'deer', 'The downloaded mule deer file at the plan URL is the 2018 Mule Deer Initiative. It does not list current special versus recreational herds, and a deer harvest report with buck:doe or point class was not confirmed. Not enough data.')
    for sp in sorted({h['sp'] for h in cat['wy']} - {'elk'}):
        wy_species[sp] = {'field': '', 'years': '', 'source': 'WGFD', 'sourceUrl': 'https://wgfd.wyo.gov/hunting-trapping/job-completion-reports', 'gap': 'No confirmed herd-unit age or sex-ratio table was parsed for this species. Job Completion Reports were not mapped hunt area by hunt area. Marked Not enough data.'}
        gap('wy', sp, wy_species[sp]['gap'])
        for h in cat['wy']:
            if h['sp'] == sp:
                wy_hunts[h['k']] = blank(h['unit'])
    species_out['wy'] = (wy_hunts, wy_species)

    # ----- Arizona: downloads blocked -----
    az_note = 'azgfd.com returned 403 to this script, so the 2025 survey summary was not confirmed. No ratio or management label was guessed. Every hunt is Not enough data.'
    gap('az', 'all', az_note)
    az_hunts = {h['k']: blank(h['unit']) for h in cat['az']}
    az_species = {}
    for sp in sorted({h['sp'] for h in cat['az']}):
        az_species[sp] = {'field': '', 'years': '', 'source': 'AZGFD', 'sourceUrl': 'https://www.azgfd.com/hunting/hunt-draw-and-licenses/harvest-reporting/', 'gap': az_note}
    species_out['az'] = (az_hunts, az_species)

    coverage = {'gaps': GAPS, 'states': {}}
    for st, (hunts, meta) in species_out.items():
        # fill any catalog hunt missing a row
        cat_keys = {h['k']: h for h in cat[st]}
        for k, h in cat_keys.items():
            if k not in hunts:
                hunts[k] = blank(h.get('unit') or '')
        path = emit(st, hunts, meta)
        by_sp = defaultdict(lambda: defaultdict(int))
        sp_of = {h['k']: h['sp'] for h in cat[st]}
        for k, row in hunts.items():
            by_sp[sp_of.get(k, '?')][row['level']] += 1
        coverage['states'][st] = {
            'file': path.name,
            'hunts': len(hunts),
            'species': {sp: {'levels': dict(levels), **{kk: meta.get(sp, {}).get(kk, '') for kk in ('field', 'years', 'source', 'sourceUrl', 'gap')}} for sp, levels in sorted(by_sp.items())},
        }
        print(st, path, 'hunts', len(hunts))
    cov_path = ROOT / 'scripts' / 'trophy' / 'coverage.json'
    cov_path.write_text(json.dumps(coverage, indent=2))
    print('coverage', cov_path)

if __name__ == '__main__':
    main()
