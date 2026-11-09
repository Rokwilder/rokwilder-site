#!/usr/bin/env python3
"""Build idaho/general-data.js from official IDFG sources.

2026 nonresident draw bands come from IDFG's draw-odds PDF. The live file URL
returned 404 on 2026-11-08; the bytes used are the Internet Archive capture of
that same official URL from 2026-08-13. 2027 choices come from the current
Nonresident Supplement. Season windows come from the Hunt Planner list.
The output has verdict bands or tag limits. It has no success percentages.
"""
import json
import re
import urllib.request
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
ODDS_URL = 'https://web.archive.org/web/20260813085104id_/https://idfg.idaho.gov/sites/default/files/nonresident-draw-data-and-descriptions_2026-draw.pdf'
ODDS_LIVE = 'https://idfg.idaho.gov/sites/default/files/nonresident-draw-data-and-descriptions_2026-draw.pdf'
SUPP_URL = 'https://idfg.idaho.gov/sites/default/files/seasons-rules-big-game-supplemental-proclamation-2027.pdf'
LIST = 'https://idfg.idaho.gov/ifwis/huntplanner/api/1.1/list/'

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 Rokwilder research'})
    with urllib.request.urlopen(req, timeout=90) as res:
        return res.read()

def pdf_text(blob):
    path = Path('/tmp/idfg-build.pdf')
    path.write_bytes(blob)
    reader = PdfReader(str(path))
    return '\n'.join((page.extract_text() or '') for page in reader.pages)

def band(drew, apps):
    if not apps:
        return None
    if drew == apps:
        return 1
    ratio = drew / apps
    if ratio >= 0.75:
        return 0.75
    if ratio >= 0.25:
        return 0.25
    if ratio >= 0.05:
        return 0.05
    if ratio > 0:
        return 0.01
    return 0

def ints(chunk):
    cleaned = re.sub(r'\d+(?:\.\d+)?%|#DIV/0!', ' ', chunk)
    return [int(tok.replace(',', '')) for tok in re.findall(r'\d[\d,]*', cleaned)]

def parse_odds(text):
    rows = []
    gaps = []
    for raw in text.splitlines():
        line = ' '.join(raw.split())
        if not line:
            continue
        elk = re.match(r'^([A-Za-z][A-Za-z .\'-]+?) ([AB])\b', line)
        deer = re.match(r'^(RD|WD)([0-9]+[A-Z]?)\b', line)
        if elk:
            kind, place, tag = 'elk', elk.group(1).strip(), elk.group(2)
            nums = ints(line[elk.end():])
        elif deer:
            kind = 'deer-regular' if deer.group(1) == 'RD' else 'deer-whitetail'
            place, tag = deer.group(2), deer.group(1)
            nums = ints(line[deer.end():])
        else:
            continue
        if len(nums) < 11:
            raise SystemExit('short odds row: ' + line)
        tags, pairs = nums[0], nums[1:11]
        choices = [{'applied': pairs[i], 'drew': pairs[i + 1]} for i in range(0, 10, 2)]
        first = choices[0]
        later = any(choice['drew'] > 0 for choice in choices[1:])
        value = band(first['drew'], first['applied'])
        whole = None if not first['applied'] else round(100 * first['drew'] / first['applied'])
        from_whole = None if whole is None else (1 if whole == 100 else 0.75 if whole >= 75 else 0.25 if whole >= 25 else 0.05 if whole >= 5 else 0.01 if whole > 0 else 0)
        if from_whole != value:
            gaps.append(f'{kind} {place} {tag}: printed whole-number rate would band {from_whole}, counts band {value}')
        rows.append({
            'k': f'{kind}-{place}-{tag}'.lower().replace(' ', '-'),
            'sp': 'elk' if kind == 'elk' else 'deer',
            'kind': kind,
            'place': place,
            'tag': tag,
            'band': value,
            'later': 1 if later else 0,
        })
    dav = {}
    for label, key in (('ELK', 'elk'), ('DEER', 'deer')):
        block = re.search(rf'DAV {label} Count.*?Total Number of Tags Available ([\d,]+).*?Total Number of Applicants ([\d,]+).*?Tags Drawn ([\d,]+)', text, re.S)
        if not block and label == 'DEER':
            block = re.search(r'DAV Regular and White-tailed Deer Count.*?Total Number of Tags Available ([\d,]+).*?Total Number of Applicants ([\d,]+).*?Tags Drawn ([\d,]+)', text, re.S)
        if not block:
            raise SystemExit('missing DAV ' + label)
        tags, apps, drew = [int(n.replace(',', '')) for n in block.groups()]
        dav[key] = {'tags': tags, 'apps': apps, 'drew': drew, 'band': band(drew, apps)}
    rows.append({'k': 'dav-elk', 'sp': 'elk', 'kind': 'dav-elk', 'place': 'Statewide', 'tag': 'DAV', 'band': dav['elk']['band'], 'later': 0})
    rows.append({'k': 'dav-deer', 'sp': 'deer', 'kind': 'dav-deer', 'place': 'Statewide', 'tag': 'DAV', 'band': dav['deer']['band'], 'later': 0})
    return rows, dav, gaps

def parse_2027(text):
    deer = []
    for line in text.splitlines():
        line = ' '.join(line.split())
        match = re.match(r'^(RD|WD)([0-9]+[A-Z]?)\s+([0-9]+[A-Z]?)\*?\s+([\d,]+)$', line)
        if not match:
            continue
        kind = 'deer-regular' if match.group(1) == 'RD' else 'deer-whitetail'
        deer.append({
            'k': f"2027-{match.group(1).lower()}{match.group(2).lower()}",
            'sp': 'deer',
            'kind': kind,
            'code': match.group(1) + match.group(2),
            'place': match.group(3),
            'tag': 'regular' if match.group(1) == 'RD' else 'whitetail',
            'limit': int(match.group(4).replace(',', '')),
            'capped': 0,
            'band': None,
        })
    elk = []
    zone = ''
    units = ''
    for raw in text.splitlines():
        line = ' '.join(raw.split())
        if re.search(r'Zone\b', line) and 'Tag' not in line and 'NONRESIDENT' not in line and 'ELK' != line:
            zone = re.sub(r'\s+Zone\*?$', '', line).strip()
            units = ''
            continue
        if line.startswith('Units ') or line.startswith('Unit '):
            units = re.split(r'\s+[AB] Tag\b', line, maxsplit=1)[0]
        match = re.search(r'(?:^|\s)([AB]) Tag (ELK\d+|DAVE\d+|No B Tags\b[^.]*)', line)
        if not match or not zone:
            continue
        if match.group(2).startswith('No'):
            continue
        capped = 1 if 'Capped Zone' in line else 0
        code = match.group(2)
        nums = ints(line[match.end():])
        limit = nums[0] if nums and code.startswith('ELK') else None
        elk.append({
            'k': '2027-' + code.lower(),
            'sp': 'elk',
            'kind': 'dav-elk' if code.startswith('DAVE') else 'elk',
            'code': code,
            'place': zone,
            'units': units,
            'tag': match.group(1),
            'limit': limit,
            'capped': capped,
            'band': None,
        })
    # The zone tracker also sees 2026-rules prose. Keep only rows captured from the tag tables:
    # elk codes are unique. Drop duplicates, preferring the first.
    seen = set()
    clean = []
    for row in elk:
        if row['code'] in seen:
            continue
        if row['code'].startswith('ELK') and row['limit'] is None:
            continue
        seen.add(row['code'])
        clean.append(row)
    return deer, clean

def seasons():
    opener = urllib.request.build_opener()
    opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
    out = []
    for game in (1, 2, 3):
        offset = 0
        total = None
        while True:
            url = f'{LIST}?game={game}&type=1&start=2026-01-01&end=2027-06-30&limit=100&offset={offset}'
            with opener.open(url, timeout=60) as res:
                payload = json.loads(res.read().decode())
            if total is None:
                total = payload.get('total') or 0
            batch = payload.get('rows') or []
            if not batch:
                break
            for row in batch:
                year = int(str(row['open']).split('/')[-1])
                year = 2000 + year if year < 100 else year
                if year != 2026:
                    continue
                out.append({
                    'g': row['game'],
                    'area': row['area'],
                    'season': row['season'],
                    'method': row['method'],
                    'sex': row['ornament'],
                    'tag': row['tag'],
                    'o': row['open'],
                    'c': row['close'],
                })
            offset += len(batch)
            if offset >= total:
                break
    # Drop duplicate planner rows.
    uniq = []
    seen = set()
    for row in out:
        key = tuple(row.values())
        if key in seen:
            continue
        seen.add(key)
        uniq.append(row)
    uniq.sort(key=lambda row: (row['g'], row['area'], row['o'], row['method'], row['season']))
    return uniq

def main():
    odds_text = pdf_text(fetch(ODDS_URL))
    supp_text = pdf_text(fetch(SUPP_URL))
    draw, dav, gaps = parse_odds(odds_text)
    deer_2027, elk_2027 = parse_2027(supp_text)
    season_rows = seasons()
    choices = deer_2027 + elk_2027
    payload = {
        'meta': {
            'built': '2026-11-08',
            'oddsCapture': '2026-08-13',
            'oddsUrl': ODDS_LIVE,
            'oddsArchive': 'https://web.archive.org/web/20260813085104/https://idfg.idaho.gov/sites/default/files/nonresident-draw-data-and-descriptions_2026-draw.pdf',
            'supplement': SUPP_URL,
            'huntList': 'https://idfg.idaho.gov/ifwis/huntplanner/filter/?type=1',
            'rules': 'https://idfg.idaho.gov/sites/default/files/seasons-rules-big-game-2026.pdf',
            'page': 'https://idfg.idaho.gov/licenses/tag/quotas/nonresident',
            'dav2026': {key: {'band': value['band']} for key, value in dav.items()},
        },
        'seasons': season_rows,
        'draw2026': draw,
        'choices2027': choices,
    }
    body = json.dumps(payload, separators=(',', ':'))
    if re.search(r'%|\bquota\b|\bapplicants\b|"raw"', body):
        raise SystemExit('leak scan failed')
    header = (
        '// Idaho general-season windows and the nonresident deer/elk tag draw.\n'
        '// 2026 draw bands are first-choice results from IDFG\'s nonresident draw-odds PDF,\n'
        '// captured 2026-08-13 because that official URL returned 404 on 2026-11-08.\n'
        '// A band is 1, .75, .25, .05, .01, 0, or null. null means nobody put that choice first.\n'
        '// 2027 rows are application choices and tag limits from the 2027 Nonresident Supplement.\n'
        '// They are not draw results. The 2027 drawing had not been held on 2026-11-08.\n'
        '// Season rows are Hunt Planner general-season windows. They are not draw results and not harvest rates.\n'
        '// Exact success rates are not in this file. The Full Pass does not serve them.\n'
    )
    out = ROOT / 'idaho' / 'general-data.js'
    out.write_text(header + 'const IG=' + body + ';\n')
    print('seasons', len(season_rows), 'draw2026', len(draw), 'choices2027', len(choices))
    print('elk draw', sum(1 for row in draw if row['sp'] == 'elk'), 'deer draw', sum(1 for row in draw if row['sp'] == 'deer'))
    print('2027 deer', len(deer_2027), '2027 elk/dav', len(elk_2027))
    print('dav', dav['elk']['band'], dav['deer']['band'])
    print('rounding gaps', len(gaps))
    for line in gaps[:12]:
        print(' ', line)

if __name__ == '__main__':
    main()
