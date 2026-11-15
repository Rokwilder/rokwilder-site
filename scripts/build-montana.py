#!/usr/bin/env python3
"""Build the Montana finder from official FWP files.

Reads a local cache (downloaded from the FWP URLs in the research catalog).
Writes public bands, history, map topology, land bands, and the private
Full Pass files under private/fullpass/ (gitignored).

Does not invent a rate. A point level with no row is omitted.
"""
from __future__ import annotations

import csv
import json
import os
import re
import subprocess
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(os.environ.get("MT_SRC", "/tmp/mt-src"))
CATALOG = Path(os.environ.get("MT_CATALOG", "/tmp/montana-research/parsed/draw-reports-catalog.json"))
LAND = Path(os.environ.get("MT_LAND", "/tmp/montana-research/parsed/land-ownership"))
PDF = SRC / "pdf"
TEXT = SRC / "text"
HARV = SRC / "harvest"
GIS = SRC / "gis"

MONTHS = {
    "jan": "Jan", "feb": "Feb", "mar": "Mar", "apr": "Apr", "may": "May", "jun": "Jun",
    "jul": "Jul", "aug": "Aug", "sep": "Sep", "sept": "Sep", "oct": "Oct", "nov": "Nov", "dec": "Dec",
}
DATE_RE = re.compile(
    r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})\s*[-–—]\s*"
    r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})",
    re.I,
)
LPT_RE = re.compile(r"\b(\d{3}-\d{2})\b")
ROW_RE = re.compile(
    r"^(?P<item>.+?)\s+(?P<lpt>\d{3}-\d{2})(?:\s+(?P<mid>.+?))?\s+"
    r"(?P<res>RESIDENT LANDOWNER|NONRESIDENT LANDOWNER|NONRESIDENT|RESIDENT)\s+"
    r"(?P<pts>\d+)\s+(?P<apps>[\d,]+)\s+(?P<succ>[\d,]+)\s+(?P<pct>[\d.]+)\s*$"
)
KIND_RE = re.compile(
    r"(Elk Permit|Deer Permit|Elk B License|Deer B License|Antelope B License|Antelope License)\s*:\s*(\d{3}-\d{2})\s*(.*)$"
)
HD_RE = re.compile(r"^HD\s+(\d{3})\s*[-–—]\s*(.+)$", re.I)
SKIP_TITLE = ("Smith", "Paddle", "Swan", "Crane", "Hound", "Lion")

# Place text copied from the 2026 Deer, Elk and Antelope regulations where the
# license is not one numbered hunting district.
MULTI = {
    "900-20": "Multi-region archery antelope license. The 2026 regulations say it is valid in any hunting district beginning with 4, 5, 6, or 7, and that it must be the first and only either-sex choice. Archery equipment only.",
    "399-20": "Region 3 archery antelope license. The 2026 regulations say it is valid in any Region 3 hunting district except HD 313. Archery equipment only.",
    "007-21": "Either-sex antelope. The 2026 regulations place this license on portions of HDs 700, 701, and 703 north of the Yellowstone River.",
    "007-31": "Doe and fawn antelope. The 2026 regulations place this license on portions of HDs 700, 701, and 703 north of the Yellowstone River.",
    "007-20": "Either-sex antelope. The 2026 regulations place this license on portions of HDs 701, 702, 703, 704, and 705 south of the Yellowstone River.",
    "007-30": "Doe and fawn antelope. The 2026 regulations place this license on portions of HDs 701, 702, 703, 704, and 705 south of the Yellowstone River.",
}


def useful_note(note):
    words = re.findall(r"[A-Za-z]{3,}", note or "")
    if len(words) < 3:
        return ""
    return plain(" ".join(words))


def plain(s):
    if not s:
        return ""
    s = str(s).replace("\u2014", ", ").replace("\u2013", " to ").replace("—", ", ").replace("–", " to ")
    s = s.replace("ﬁ", "fi").replace("ﬂ", "fl")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def band_of(success, apps):
    if apps is None or success is None:
        return None
    if not isinstance(apps, int) or not isinstance(success, int):
        return None
    if apps <= 0 or success < 0 or success > apps:
        return None
    if success == apps:
        return 1
    r = success / apps
    if r >= 0.75:
        return 0.75
    if r >= 0.25:
        return 0.25
    if r >= 0.05:
        return 0.05
    if r > 0:
        return 0.01
    return 0


def band_rate(rate):
    if rate is None:
        return None
    if rate >= 1:
        return 1
    if rate >= 0.75:
        return 0.75
    if rate >= 0.25:
        return 0.25
    if rate >= 0.05:
        return 0.05
    if rate > 0:
        return 0.01
    return 0


def chances(points):
    return points * points + 1


def nint(text):
    return int(text.replace(",", ""))


def pdf_text(path: Path) -> str:
    txt = TEXT / (path.stem + ".layout.txt")
    TEXT.mkdir(parents=True, exist_ok=True)
    if not txt.exists() or txt.stat().st_mtime < path.stat().st_mtime:
        subprocess.check_call(["pdftotext", "-layout", str(path), str(txt)], stdout=subprocess.DEVNULL)
    return txt.read_text(errors="replace")


def classify(title, item):
    blob = f"{title} {item}".upper()
    if "BLACK BEAR" in blob:
        return "bear", "permit"
    if "BISON" in blob:
        return "bison", "license"
    if "MOUNTAIN GOAT" in blob or re.search(r"\bGOAT\b", blob):
        return "goat", "license"
    if "SHEEP" in blob or "BIGHORN" in blob:
        return "sheep", "license"
    if "MOOSE" in blob:
        return "moose", "license"
    if "ANTELOPE" in blob and "ARCHERY" in blob:
        return "antelope", "archery"
    if "ANTELOPE B" in blob:
        return "antelope", "B"
    if "ANTELOPE" in blob:
        return "antelope", "license"
    if "ELK B" in blob:
        return "elk", "B"
    if "ELK" in blob:
        return "elk", "permit"
    if "DEER B" in blob:
        return "deer", "B"
    if "DEER" in blob:
        return "deer", "permit"
    return None, None


def fmt_date(a, d1, b, d2):
    return f"{MONTHS[a.lower()]} {int(d1)} to {MONTHS[b.lower()]} {int(d2)}"


def dates_in(text):
    out = []
    for m in DATE_RE.finditer(text or ""):
        out.append(fmt_date(m.group(1), m.group(2), m.group(3), m.group(4)))
    # unique, keep order
    seen = []
    for d in out:
        if d not in seen:
            seen.append(d)
    return seen


def sex_of(opp):
    o = (opp or "").lower()
    if not o:
        return ""
    if "either" in o or "or antlerless" in o:
        return "E"
    if any(w in o for w in ("antlerless", "doe", "fawn", "cow", "ewe", "nanny")):
        return "F"
    if any(w in o for w in ("antlered", "bull", "buck", "ram", "billy", "any ram", "legal ram")):
        return "M"
    return "E"


def area_of(lpt):
    return str(int(lpt.split("-")[0]))


def load_catalog():
    cat = json.loads(CATALOG.read_text())["unique"]
    rows = []
    for x in cat:
        if x["year"] not in (2024, 2025, 2026):
            continue
        if x["kind"] not in ("bonus_point", "drawing_stats", "nr_pref"):
            continue
        if any(s in x["title"] for s in SKIP_TITLE):
            continue
        rows.append(x)
    return rows


def parse_bonus(path, title, year):
    text = pdf_text(path)
    rows = []
    bad = []
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line or "TOTAL" in line.upper() or line.upper().startswith("ITEM DESCRIPTION"):
            continue
        m = ROW_RE.match(line)
        if not m:
            if LPT_RE.search(line) and "RESIDENT" in line and "TOTAL" not in line.upper():
                bad.append(line[:160])
            continue
        item = m.group("item").strip()
        sp, cls = classify(title, item)
        if not sp:
            bad.append("class " + line[:120])
            continue
        apps = nint(m.group("apps"))
        succ = nint(m.group("succ"))
        printed = float(m.group("pct"))
        if apps <= 0:
            continue
        calc = round(100 * succ / apps, 2)
        if abs(calc - printed) > 0.75 and not (printed == 100 and succ == apps):
            bad.append(f"pct {m.group('lpt')} {succ}/{apps} printed {printed} calc {calc}")
        res = m.group("res")
        side = {
            "RESIDENT": "res",
            "NONRESIDENT": "nr",
            "RESIDENT LANDOWNER": "lo_res",
            "NONRESIDENT LANDOWNER": "lo_nr",
        }[res]
        rows.append({
            "year": year,
            "sp": sp,
            "cls": cls,
            "lpt": m.group("lpt"),
            "tag": m.group("mid") or "",
            "mid": plain(m.group("mid") or ""),
            "side": side,
            "pts": int(m.group("pts")),
            "apps": apps,
            "succ": succ,
            "item": item,
        })
    return rows, bad


def parse_stats(path):
    text = pdf_text(path)
    out = {}
    for raw in text.splitlines():
        m = LPT_RE.search(raw)
        if not m:
            continue
        if "District" in raw and "Quota" in raw:
            continue
        lpt = m.group(1)
        rest = raw.split(lpt, 1)[1]
        note = plain(re.sub(r"UNL|\d+", " ", rest))
        note = re.sub(r"[^A-Za-z' ]+", " ", note)
        note = plain(note)
        toks = re.findall(r"UNL|\d+", rest)
        if not toks:
            continue
        quota = "UNL" if toks[0] == "UNL" else int(toks[0])
        qta = None
        if len(toks) > 1:
            qta = "UNL" if toks[1] == "UNL" else int(toks[1])
        out[lpt] = {"quota": quota, "qta": qta, "note": note, "toks": toks}
    return out


def parse_bison_stats(path):
    """2026 bison drawing statistics have no bonus-point companion.

    Column indexes were checked against the three 2026 rows:
    resident first-choice apps at index 9, successes at 11,
    nonresident apps at 15, successes at 18, total at 21.
    """
    text = pdf_text(path)
    hunts = {}
    for raw in text.splitlines():
        m = LPT_RE.search(raw)
        if not m or ("District" in raw and "Quota" in raw):
            continue
        lpt = m.group(1)
        rest = raw.split(lpt, 1)[1]
        name = plain(re.sub(r"\d+|UNL", " ", rest))
        name = plain(re.sub(r"[^A-Za-z ]+", " ", name))
        toks = re.findall(r"\d+", rest)
        if len(toks) < 22:
            raise SystemExit(f"bison row {lpt} has {len(toks)} numbers, expected at least 22")
        nums = [int(t) for t in toks]
        quota, res_a, res_s = nums[0], nums[9], nums[11]
        nr_a, nr_s, total = nums[15], nums[18], nums[21]
        if res_s + nr_s != total or total != quota:
            raise SystemExit(f"bison {lpt} does not add up: {res_s}+{nr_s} vs quota {quota} total {total}")
        hunts[lpt] = {
            "quota": quota,
            "name": name,
            "res": {"apps": res_a, "succ": res_s} if res_a else None,
            "nr": {"apps": nr_a, "succ": nr_s} if nr_a else None,
        }
    if len(hunts) < 3:
        raise SystemExit(f"expected 3 bison drawing rows, found {len(hunts)}")
    return hunts


def parse_dea(text):
    """License lines and general-season lines from the 2026 regulations."""
    info = {}
    seasons = []
    otc = []
    hd = None
    hd_name = ""
    species = ""
    place = ""
    general = ""
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        hm = HD_RE.match(line)
        if hm:
            hd = str(int(hm.group(1)))
            hd_name = plain(re.sub(r"\s*-\s*Continued.*", "", hm.group(2), flags=re.I))
            place = f"HD {hd}" + (f", {hd_name}" if hd_name else "")
            general = ""
            continue
        if re.match(r"^(DEER|ELK|ANTELOPE)$", line):
            species = line.lower()
            general = ""
            continue
        if line.lower().startswith("portions of hd") or line.lower().startswith("region "):
            place = plain(line)
            general = ""
            continue
        if "General Deer License" in line or "General Elk License" in line:
            general = "deer" if "Deer" in line else "elk"
            species = general
        km = KIND_RE.search(line)
        if km:
            general = ""
            lpt = km.group(2)
            rest = km.group(3)
            opp, apply_by, extra = split_opportunity(rest)
            dates = dates_in(line)
            note = plain(extra)
            archery = "archequip" in line.lower() or "archery only" in line.lower()
            private_only = bool(re.search(r"private land only|only valid on private", line, re.I))
            youth = "youth" in line.lower()
            first_only = "first and only" in line.lower() or "first choice only" in line.lower()
            is_otc = bool(re.search(r"\bOTC\b|\bJun(?:e)?\s+15\b", line, re.I))
            rec = info.setdefault(lpt, {
                "opp": plain(opp),
                "apply": apply_by,
                "dates": dates,
                "note": note,
                "place": place,
                "hd": hd or "",
                "archery": archery,
                "privateOnly": private_only,
                "youth": youth,
                "firstOnly": first_only,
                "otc": is_otc,
            })
            if not rec["opp"] and opp:
                rec["opp"] = plain(opp)
            if dates and not rec["dates"]:
                rec["dates"] = dates
            if note and len(note) > len(rec["note"]):
                rec["note"] = note
            if is_otc:
                rec["otc"] = True
                otc.append({
                    "lpt": lpt, "sp": species or ("deer" if "Deer" in km.group(1) else "elk" if "Elk" in km.group(1) else "antelope"),
                    "opp": plain(opp), "hd": hd or area_of(lpt), "name": hd_name, "dates": dates, "note": note,
                })
            continue
        if general and species in ("deer", "elk"):
            if not re.search(r"Antler|Either|Brow-tined|Spike", line, re.I):
                continue
            if "License:" in line or "Permit:" in line:
                continue
            opp = plain(re.split(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b", line, maxsplit=1, flags=re.I)[0])
            opp = re.sub(r"General (Deer|Elk) License", "", opp, flags=re.I).strip(" -")
            if len(opp) < 6:
                continue
            seasons.append({
                "hd": hd or "",
                "name": hd_name,
                "sp": species,
                "opp": plain(opp)[:140],
                "dates": dates_in(line),
                "place": place,
            })
    # multi-district wording from the license-type pages overrides a repeated map header
    for lpt, sentence in MULTI.items():
        info.setdefault(lpt, {"opp": "", "dates": [], "note": "", "place": "", "hd": "", "archery": False, "privateOnly": False, "youth": False, "firstOnly": False, "otc": False, "apply": ""})
        info[lpt]["place"] = sentence
        if lpt.startswith("900") or lpt.startswith("399"):
            info[lpt]["archery"] = True
            info[lpt]["firstOnly"] = True
    return info, seasons, otc


def split_opportunity(rest):
    rest = rest.strip()
    m = re.search(r"\b(April|Jun|June|May|July)\s+\d{1,2}\b|\bOTC\b", rest, re.I)
    if not m:
        # opportunity may be the words before a date
        dm = DATE_RE.search(rest)
        opp = rest[: dm.start()] if dm else rest
        return opp, "", ""
    opp = rest[: m.start()]
    apply_by = m.group(0)
    extra = rest[m.end():]
    # drop quota numbers from the tail, keep a short restriction if words remain after dates
    extra = DATE_RE.sub(" ", extra)
    extra = re.sub(r"\bUNL\b|\b\d[\d,]*\b", " ", extra)
    return opp, apply_by, extra


def parse_msgb(text):
    info = {}
    species = ""
    hd_name = ""
    for raw in text.splitlines():
        line = raw.strip()
        if "Moose HD Regulations" in line:
            species = "moose"
            continue
        if "Bighorn Sheep HD Regulations" in line:
            species = "sheep"
            continue
        if "Mountain Goat HD Regulations" in line:
            species = "goat"
            continue
        if "Bison Hunting District Regulations" in line or "Bison HD" in line:
            species = "bison"
            continue
        hm = re.match(r"^(\d{3})\s*[-–]\s+(.+)$", line)
        if hm and len(hm.group(2)) < 80 and "License" not in line:
            hd_name = plain(hm.group(2))
        m = re.search(r"\b(\d{3}-\d{2})\*?\s+(Any Ram|Legal Ram|Adult Ewe|Antlered Bull|Either Sex|Either-sex)\b(.*)$", line)
        if not m or not species:
            continue
        lpt, opp, tail = m.group(1), m.group(2), m.group(3)
        dates = dates_in(line)
        archery = ""
        general = ""
        if len(dates) >= 2 and dates[0].startswith("Sep 5 to Sep 14"):
            archery, general = dates[0], dates[1]
        elif len(dates) == 1:
            general = dates[0]
        unl = "UNL" in tail
        info[lpt] = {
            "sp": species,
            "opp": opp,
            "hdName": hd_name,
            "dates": dates,
            "archery": archery,
            "general": general,
            "unl": unl,
            "nrMark": "*" in line.split(opp)[0],
            "note": "",
        }
        if lpt == "300-60":
            info[lpt]["note"] = "The 2026 regulations print this quota as UNL and say the harvest quota is 2. The season closes on 24-hour notice when that harvest quota is reached."
        if lpt in ("385-20", "385-21"):
            info[lpt]["hdName"] = "Gardiner Basin and Absaroka Beartooth"
        if lpt == "385-20":
            info[lpt]["note"] = "Only valid in the Gardiner Basin portion of the hunting district."
        if lpt == "385-21":
            info[lpt]["note"] = "Only valid in the Absaroka Beartooth portion. The 2026 regulations call this a wilderness backcountry hunt."
            info[lpt]["general"] = "Sep 15 to Nov 14"
        if lpt == "395-20":
            info[lpt]["hdName"] = "Madison and Gallatin watershed"
            info[lpt]["note"] = "The 2026 regulations say the Gallatin watershed portion of HD 395 is closed to hunting."
    return info


def parse_combo(text):
    text = text.replace("\u2013", "-").replace("\u2014", "-").replace("–", "-").replace("—", "-")
    chunks = re.split(r"\f+", text)
    # The file has a big-game section then a deer section.
    products = []
    if len(chunks) == 1:
        parts = re.split(r"(?=General Deer Combo|Deer Combo)", text, maxsplit=1)
    else:
        parts = chunks
    labels = []
    for i, part in enumerate(parts):
        if re.search(r"Deer Combo", part, re.I) and not re.search(r"Big Game", part, re.I):
            labels.append(("deer", part))
        elif re.search(r"Big Game|Elk Combo", part, re.I):
            labels.append(("elk", part))
        elif i == 0:
            labels.append(("elk", part))
        else:
            labels.append(("deer", part))
    out = {"elk": {}, "deer": {}}
    group_re = re.compile(
        r"(\d*\.\d+|\d+)\s*(?:-\s*(\d*\.\d+|\d+))?\s*PP\s+([\d.]+)%\s*Draw\s*\(([\d,]+)\s*apps(?:,\s*([\d,]+)\s*successful)?\)",
        re.I,
    )
    for sp, part in labels:
        # year blocks: "2026 Regular" or "2026 (Total"
        for year in (2024, 2025, 2026):
            m = re.search(rf"{year}\s+(Regular\s+)?\(Total apps", part)
            if not m:
                continue
            start = m.start()
            nxt = re.search(rf"{year}\s+NR Landowner", part[start:])
            block = part[start: start + nxt.start()] if nxt else part[start: start + 800]
            groups = []
            for g in group_re.finditer(block):
                lo = float(g.group(1))
                hi = float(g.group(2)) if g.group(2) else lo
                pct = float(g.group(3))
                apps = nint(g.group(4))
                succ = nint(g.group(5)) if g.group(5) else None
                if succ is None and pct == 100:
                    succ = apps
                if succ is None and pct == 0:
                    succ = 0
                if apps == 0:
                    continue
                if succ is None:
                    raise SystemExit(f"combo {sp} {year} group {lo}-{hi} has no success count")
                if abs(100 * succ / apps - pct) > 0.2 and not (pct == 100 and succ == apps):
                    raise SystemExit(f"combo {sp} {year} {lo}-{hi} {succ}/{apps} != {pct}")
                label = f"{trim_num(lo)} preference points" if lo == hi else f"{trim_num(lo)} to {trim_num(hi)} preference points"
                groups.append({"lo": lo, "hi": hi, "exact": lo == hi, "label": label, "apps": apps, "succ": succ, "rate": succ / apps})
            if groups:
                out[sp][year] = groups
    return out


def trim_num(n):
    if abs(n - round(n)) < 1e-9:
        return str(int(round(n)))
    s = f"{n:.2f}".rstrip("0").rstrip(".")
    return s


def group_for_point(groups, point):
    exact = [g for g in groups if g["exact"] and abs(g["lo"] - point) < 1e-9]
    if exact:
        return exact[0]
    for g in groups:
        if g["lo"] - 1e-9 <= point <= g["hi"] + 1e-9:
            return g
    return None


def harvest_rows(name):
    path = HARV / f"{name}-2023-2025.csv"
    with path.open(newline="") as f:
        reader = csv.reader(f)
        header = [h.strip() for h in next(reader)]
        rows = []
        for rec in reader:
            if not rec or all(not c.strip() for c in rec):
                continue
            row = {}
            for i, h in enumerate(header):
                if not h or i >= len(rec):
                    continue
                row[h] = rec[i].strip()
            rows.append(row)
    return rows


def num(v):
    if v is None or v == "":
        return 0
    try:
        return int(float(v))
    except ValueError:
        return 0


def build_harvest():
    elk = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for r in harvest_rows("elk"):
        if r.get("Residency") != "SUM":
            continue
        hd = str(int(r["Hunting District"])) if r.get("Hunting District", "").isdigit() else r.get("Hunting District", "")
        y = r["License Year"]
        cell = elk[hd][y]
        for src, dst in (
            ("Hunters", "hunters"), ("Total Harvest", "harvest"), ("Bulls", "bulls"),
            ("Cows", "cows"), ("Calves", "calves"), ("Spike Bull Elk", "spike"),
            ("Less than 6 Points", "lt6"), ("6 or More Points", "ge6"),
        ):
            cell[dst] += num(r.get(src))
    deer = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int))))
    for r in harvest_rows("deer"):
        if r.get("Residency") != "SUM":
            continue
        kind = r.get("Deer Species")
        if kind not in ("md", "wt"):
            continue
        hd_raw = r.get("Hunting District", "")
        if not hd_raw.isdigit():
            continue
        hd = str(int(hd_raw))
        y = r["License Year"]
        cell = deer[hd][kind][y]
        for src, dst in (
            ("Hunters", "hunters"), ("Total Harvest", "harvest"), ("Bucks", "bucks"),
            ("Does", "does"), ("Less than 4 Points", "lt4"), ("4 or More Points", "ge4"),
        ):
            cell[dst] += num(r.get(src))
    other = {}
    for sp, bulls, cows in (
        ("antelope", "Bucks", "Does"),
        ("moose", "Bulls", "Cows"),
        ("sheep", "Rams", "Ewes"),
        ("goat", "Billies", "Nannies"),
    ):
        bag = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        for r in harvest_rows(sp):
            if r.get("Residency") != "SUM":
                continue
            hd_raw = r.get("Hunting District", "")
            if not str(hd_raw).isdigit():
                continue
            hd = str(int(hd_raw))
            y = r["License Year"]
            cell = bag[hd][y]
            cell["hunters"] += num(r.get("Hunters"))
            cell["harvest"] += num(r.get("Total Harvest"))
            cell["m"] += num(r.get(bulls))
            cell["f"] += num(r.get(cows))
        other[sp] = bag
    return elk, deer, other


def sheep_measurements():
    by = defaultdict(list)
    for year, name in ((2024, "sheep-2024.pdf"), (2025, "sheep-2025.pdf")):
        text = pdf_text(PDF / name)
        for line in text.splitlines():
            m = re.search(
                r"\b(\d{2,3})\b\s+[A-Za-z .'-]+?\s+\d{1,2}/\d{1,2}/\d{4}\s+Hunter Harvest\s+"
                r"(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)",
                line,
            )
            if not m:
                continue
            hd = str(int(m.group(1)))
            age = float(m.group(2))
            right = float(m.group(3))
            left = float(m.group(5))
            horn = (right + left) / 2
            by[hd].append({"year": year, "age": age, "horn": horn})
    return by


def level_of(pct):
    if pct >= 0.85:
        return "top"
    if pct >= 0.60:
        return "above"
    if pct >= 0.40:
        return "typical"
    return "below"


def rank_places(places):
    usable = {}
    for p in places:
        if p.get("value") is None:
            p["level"] = "none"
            continue
        if p.get("n") is not None and p["n"] < 10:
            p["level"] = "thin"
            continue
        usable.setdefault(p["place"], p["value"])
    ids = list(usable)
    if len(ids) < 5:
        for p in places:
            if p.get("level") in ("thin",):
                continue
            if p.get("value") is None:
                p["level"] = "none"
            else:
                p["level"] = "none"
                p["peers"] = "few"
        return
    vals = [usable[i] for i in ids]
    for p in places:
        if p.get("level") == "thin" or p.get("value") is None:
            if p.get("value") is None and p.get("level") != "thin":
                p["level"] = "none"
            continue
        v = p["value"]
        below = sum(1 for x in vals if x < v)
        pct = below / (len(vals) - 1) if len(vals) > 1 else 1
        p["level"] = level_of(pct)


def summary_pct(level, bit, who):
    if level == "thin":
        return f"Thin data (n={bit}). Too few animals were checked to rank this district."
    if level == "none":
        return "Not enough official data to judge."
    if level == "top":
        return f"More mature {who} than most districts ({bit})."
    if level == "above":
        return f"Good share of mature {who} ({bit})."
    if level == "below":
        return f"Fewer mature {who} than most districts ({bit})."
    return f"About average for this state ({bit})."


def summary_horn(level, bit, n):
    if level == "thin":
        return f"Thin data (n={n}). Too few rams were measured to rank this district."
    if level == "none":
        return "Not enough official data to judge."
    if level == "top":
        return f"Longer horns at check-in than most districts (average {bit})."
    if level == "above":
        return f"Longer horns than a typical district here (average {bit})."
    if level == "below":
        return f"Shorter horns at check-in than most districts (average {bit})."
    return f"About average for this state (average {bit})."


def trend_of(rates):
    vals = [round(v, 6) for v in rates if v is not None]
    if len(vals) < 2:
        return None
    if all(v == vals[0] for v in vals):
        return "Holding steady"
    non_inc = all(vals[i] <= vals[i - 1] for i in range(1, len(vals)))
    non_dec = all(vals[i] >= vals[i - 1] for i in range(1, len(vals)))
    if non_inc and vals[-1] < vals[0]:
        return "Getting harder"
    if non_dec and vals[-1] > vals[0]:
        return "Getting easier"
    if vals[0] == vals[-1]:
        return "One year stood out"
    return "Up and down"


def average_of(rates):
    vals = [v for v in rates if v is not None]
    if len(vals) < 2 or len(vals) > 3:
        return None
    mean = sum(vals) / len(vals)
    return {"band": band_rate(min(1, mean)), "n": len(vals)}


def pack_points(year_points, years):
    points = []
    seen = set()
    for y in years:
        for p in (year_points.get(y) or {}):
            if p not in seen:
                seen.add(p)
                points.append(p)
    if not points:
        return None
    ymap = {}
    for y in years:
        row = year_points.get(y) or {}
        bands = {}
        for p in points:
            if row.get(p) is None:
                continue
            bands[p] = band_rate(row[p])
        if bands:
            ymap[str(y)] = bands
    if not ymap:
        return None
    a, n, t = {}, {}, {}
    for p in points:
        rates = [((year_points.get(y) or {}).get(p)) for y in years]
        avg = average_of(rates)
        tr = trend_of(rates)
        if avg:
            a[p] = avg["band"]
            n[p] = avg["n"]
        if tr:
            t[p] = tr
    out = {"y": ymap}
    if a:
        out["a"] = a
        out["n"] = n
    if t:
        out["t"] = t
    return out


def season_sentence(dates, archery_label, general_label):
    bits = []
    if archery_label:
        bits.append("2026 archery " + archery_label)
    if general_label:
        bits.append("2026 general " + general_label)
    if not bits and dates:
        bits.append("2026 dates printed on the regulation line: " + ", ".join(dates))
    if not bits:
        return "2026 district dates are in the FWP regulations. A single date was not read off this line."
    text = ". ".join(bits) + "."
    if dates and not archery_label:
        text += " The regulation table names which season each date belongs to."
    return text


def main():
    catalog = load_catalog()
    by_id = {x["objectID"]: x for x in catalog}
    bonus_rows = []
    stats = {}  # (sp, year) -> lpt -> quota info
    warnings = []
    sources = []
    for x in catalog:
        path = PDF / f"{x['objectID']}.pdf"
        if not path.exists():
            raise SystemExit("missing " + str(path))
        sp, cls = classify(x["title"], "")
        sources.append({
            "objectID": x["objectID"],
            "year": x["year"],
            "kind": x["kind"],
            "title": x["title"],
            "url": x["url"],
            "species": sp,
        })
        if x["kind"] == "bonus_point":
            rows, bad = parse_bonus(path, x["title"], x["year"])
            if bad:
                warnings.extend(bad[:8])
            if not rows:
                raise SystemExit("no bonus rows in " + x["title"])
            bonus_rows.extend(rows)
        elif x["kind"] == "drawing_stats" and sp != "bison":
            parsed = parse_stats(path)
            stats.setdefault((sp, x["year"]), {}).update(parsed)

    bison_2026 = parse_bison_stats(PDF / "116347.pdf")
    combo_text = pdf_text(PDF / "116132.pdf")
    # also 2024 and 2025 combo files
    combo = {"elk": {}, "deer": {}}
    for oid in ("110887", "112967", "116132"):
        part = parse_combo(pdf_text(PDF / f"{oid}.pdf"))
        for sp in ("elk", "deer"):
            combo[sp].update(part[sp])
    for sp in ("elk", "deer"):
        if 2026 not in combo[sp]:
            raise SystemExit("missing 2026 combo " + sp)

    dea_text = (TEXT / "dea.txt").read_text(errors="replace")
    reg, seasons, otc = parse_dea(dea_text)
    msgb = parse_msgb((TEXT / "msgb.txt").read_text(errors="replace"))

    # 2026 hunts from bonus rows
    hunts = {}
    grouped = defaultdict(lambda: defaultdict(dict))
    for r in bonus_rows:
        if r["year"] != 2026:
            continue
        if r["side"] not in ("res", "nr", "lo_res", "lo_nr"):
            continue
        key = f"{r['sp']}|{r['lpt']}"
        grouped[key][r["side"]][str(r["pts"])] = r
        hunts.setdefault(key, {
            "sp": r["sp"], "lpt": r["lpt"], "cls": r["cls"], "item": r["item"],
            "area": area_of(r["lpt"]), "mid": "",
        })
        if r.get("mid"):
            hunts[key]["mid"] = r["mid"]

    st2026 = {}
    for (sp, year), blob in stats.items():
        if year == 2026 and sp:
            st2026.setdefault(sp, {}).update(blob)

    public = {}
    private = {}
    species_counts = defaultdict(int)
    for key, h in sorted(hunts.items(), key=lambda kv: (kv[1]["sp"], int(kv[1]["area"]) if kv[1]["area"].isdigit() else 0, kv[1]["lpt"])):
        lpt = h["lpt"]
        regrow = reg.get(lpt, {})
        mrow = msgb.get(lpt, {})
        opp = regrow.get("opp") or mrow.get("opp") or ""
        if lpt in MULTI:
            place = MULTI[lpt]
        else:
            place = regrow.get("place") or ""
            if mrow.get("hdName"):
                place = f"HD {h['area']}, {mrow['hdName']}"
        note_bits = []
        if regrow.get("note"):
            note_bits.append(regrow["note"])
        if mrow.get("note"):
            note_bits.append(mrow["note"])
        st = st2026.get(h["sp"], {}).get(lpt, {})
        if st.get("note"):
            note_bits.append(st["note"])
        note = useful_note(". ".join(x for x in note_bits if x))
        mid = (h.get("mid") or "").upper()
        archery = bool(regrow.get("archery") or mrow.get("archery") or "ARCHERY" in mid or "ARCHERY" in (st.get("note") or "").upper() or h["cls"] == "archery")
        if mrow.get("archery") and mrow.get("general"):
            season = season_sentence(mrow.get("dates") or [], mrow["archery"], mrow["general"])
        elif archery and not mrow:
            season = "2026 archery only. " + season_sentence(regrow.get("dates") or [], "", "")
            season = plain(season)
        else:
            season = season_sentence(regrow.get("dates") or mrow.get("dates") or [], "", "")
        sx = ""
        wpn = "bow" if archery else "gen"
        wlab = "Archery only" if archery else "Any legal weapon"
        unl = st.get("quota") == "UNL" or bool(mrow.get("unl"))
        first_only = bool(regrow.get("firstOnly") or "FIRST" in mid or "FIRST" in (st.get("note") or "").upper())
        private_only = bool(regrow.get("privateOnly") or re.search(r"private land only", note, re.I))
        youth = bool(regrow.get("youth") or re.search(r"\byouth\b", note, re.I))
        name = ""
        if place and not place.startswith("HD") and len(place) <= 80:
            name = place
        elif mrow.get("hdName"):
            name = mrow["hdName"]
        elif regrow.get("place") and "," in regrow.get("place", ""):
            name = regrow["place"].split(",", 1)[1].strip()
        if not opp and "MULE" in mid and "WT" in mid:
            opp = "Mule deer or white-tailed deer"
        elif not opp and "MULE" in mid:
            opp = "Mule deer"
        elif not opp and re.search(r"\bWT\b", mid):
            opp = "White-tailed deer"
        if "EITHER SEX" in mid and "either" not in opp.lower():
            opp = plain(opp + " either sex") if opp else "Either sex"
        desc = plain(opp) or "2026 license code " + lpt
        if "CWD" in mid:
            desc = plain(desc + ". The 2026 report labels this row CWD")
        sx = sex_of(desc)
        od = {}
        raw = {}
        for side in ("res", "nr"):
            levels = grouped[key].get(side) or {}
            if not levels:
                continue
            bp = {}
            lv = {}
            for pts, row in levels.items():
                b = band_of(row["succ"], row["apps"])
                if b is None:
                    continue
                bp[pts] = b
                lv[pts] = {"a1": row["apps"], "s1": row["succ"], "rate1": row["succ"] / row["apps"]}
            od[side] = {"bp": bp}
            raw[side] = {
                "lv": lv,
                "quota": st.get("quota"),
                "qta": st.get("qta"),
            }
        lo = {}
        for side, raw_side in (("lo_res", "res"), ("lo_nr", "nr")):
            levels = grouped[key].get(side) or {}
            if not levels:
                continue
            lv = {}
            for pts, row in levels.items():
                lv[pts] = {"a1": row["apps"], "s1": row["succ"], "rate1": row["succ"] / row["apps"]}
            lo[raw_side] = {"lv": lv}
        if lo:
            raw["lo"] = lo
        rec = {
            "sp": h["sp"], "lpt": lpt, "area": h["area"], "name": plain(name),
            "cls": h["cls"], "sx": sx, "wpn": wpn, "wlab": wlab,
            "desc": desc, "season": plain(season), "note": note[:400],
            "place": plain(place)[:300],
            "unl": unl, "firstOnly": first_only, "privateOnly": private_only, "youth": youth,
            "pts": True, "od": od,
        }
        public[key] = rec
        priv = json.loads(json.dumps(rec))
        priv["raw"] = raw
        private[key] = priv
        species_counts[h["sp"]] += 1

    # Bison from drawing statistics. No bonus-point report was in the catalog.
    for lpt, row in bison_2026.items():
        if f"bison|{lpt}" in public:
            continue
        mrow = msgb.get(lpt, {})
        key = f"bison|{lpt}"
        od = {}
        raw = {}
        for side in ("res", "nr"):
            cell = row.get(side)
            if not cell or not cell["apps"]:
                continue
            b = band_of(cell["succ"], cell["apps"])
            od[side] = {"band": b}
            raw[side] = {"a1": cell["apps"], "s1": cell["succ"], "rate1": cell["succ"] / cell["apps"], "quota": row["quota"]}
        season = season_sentence(mrow.get("dates") or [], mrow.get("archery") or "", mrow.get("general") or "")
        rec = {
            "sp": "bison", "lpt": lpt, "area": area_of(lpt), "name": mrow.get("hdName") or row.get("name") or "",
            "cls": "license", "sx": sex_of(mrow.get("opp") or "Either Sex"), "wpn": "gen", "wlab": "Any legal weapon",
            "desc": mrow.get("opp") or "Either sex",
            "season": plain(season),
            "note": plain(mrow.get("note") or "FWP did not publish a 2026 bison bonus-point report. This band is the first-choice drawing statistics for this residency."),
            "place": plain(mrow.get("hdName") or ""),
            "unl": False, "firstOnly": False, "privateOnly": False, "youth": False,
            "pts": False, "od": od,
        }
        public[key] = rec
        priv = json.loads(json.dumps(rec))
        priv["raw"] = raw
        private[key] = priv
        species_counts["bison"] += 1

    # Known check: elk permit 217-10 resident.
    known = private.get("elk|217-10", {}).get("raw", {}).get("res", {}).get("lv", {})
    if not known or known.get("0", {}).get("a1") != 115 or known.get("0", {}).get("s1") != 3:
        raise SystemExit("217-10 resident 0-point row did not match the 2026 elk permit report")
    if known.get("9", {}).get("s1") != 1 or known.get("7", {}).get("s1") != 7:
        raise SystemExit("217-10 resident point ladder failed a known row")
    if public["elk|217-10"]["od"]["res"]["bp"].get("0") != 0.01:
        raise SystemExit("217-10 band at 0 points is wrong")
    if public["elk|217-10"]["od"]["res"]["bp"].get("7") != 0.75:
        raise SystemExit("217-10 band at 7 points is wrong")
    if "elk|410-21" not in public or public["elk|410-21"]["wpn"] != "bow":
        raise SystemExit("410-21 archery elk permit was not read")
    if "elk|270-45" not in public or not public["elk|270-45"]["firstOnly"]:
        raise SystemExit("270-45 first-choice-only elk permit was not read")

    # History 2024-2026
    hist_rows = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    for r in bonus_rows:
        if r["side"] not in ("res", "nr"):
            continue
        key = f"{r['sp']}|{r['lpt']}"
        if key not in public:
            continue
        hist_rows[key][r["side"]][r["year"]][str(r["pts"])] = r["succ"] / r["apps"]
    years = [2024, 2025, 2026]
    history_hunts = {}
    for key, sides in hist_rows.items():
        blob = {}
        for side, year_points in sides.items():
            packed = pack_points(year_points, years)
            if packed:
                blob[side] = packed
        if blob:
            history_hunts[key] = blob
    # combo history
    for sp in ("elk", "deer"):
        year_points = {}
        for year in years:
            groups = combo[sp].get(year)
            if not groups:
                continue
            year_points[year] = {}
            for p in (0, 1, 2, 3):
                g = group_for_point(groups, p)
                if g:
                    year_points[year][str(p)] = g["rate"]
        packed = pack_points(year_points, years)
        if packed:
            history_hunts[f"combo|{sp}"] = {"nr": packed}

    # 2026 combo public/private
    combo_public = {}
    combo_private = {}
    for sp, title, quota, quota_src in (
        ("elk", "Big Game and Elk combination", 17000, "The 2026 regulations say 17,000 Big Game Combination licenses are issued. The preference-point report covers the Big Game and Elk combination together and does not restate that quota."),
        ("deer", "Deer combination", 4600, "The 2026 regulations say 4,600 Deer Combination licenses are issued. The preference-point report does not restate that quota."),
    ):
        groups = combo[sp][2026]
        pub_groups = []
        priv_groups = []
        for p in (0, 1, 2, 3):
            g = group_for_point(groups, p)
            if not g:
                continue
            pub_groups.append({
                "p": p,
                "label": g["label"],
                "band": band_of(g["succ"], g["apps"]),
                "exactGroup": g["exact"],
            })
            priv_groups.append({
                "p": p,
                "label": g["label"],
                "band": band_of(g["succ"], g["apps"]),
                "exactGroup": g["exact"],
                "apps": g["apps"],
                "succ": g["succ"],
                "rate": g["succ"] / g["apps"],
            })
        combo_public[f"combo|{sp}"] = {"sp": sp, "name": title, "quotaText": quota_src, "groups": pub_groups}
        combo_private[f"combo|{sp}"] = {"sp": sp, "name": title, "quota": quota, "quotaText": quota_src, "groups": priv_groups}
    # The user's example: elk 0 points drew, 1 point did not.
    elk0 = next(g for g in combo_private["combo|elk"]["groups"] if g["p"] == 0)
    elk1 = next(g for g in combo_private["combo|elk"]["groups"] if g["p"] == 1)
    if elk0["succ"] != 4205 or elk0["apps"] != 7843 or elk1["rate"] != 0:
        raise SystemExit(f"2026 elk combo check failed: {elk0} {elk1}")

    # Harvest public summary
    elk_h, deer_h, other_h = build_harvest()
    harvest = {"elk": {}, "deer": {}, "antelope": {}, "moose": {}, "sheep": {}, "goat": {}}

    def elk_public(cell, year):
        out = {"harvest": cell["harvest"], "bulls": cell["bulls"], "cows": cell["cows"], "spike": cell["spike"], "lt6": cell["lt6"], "ge6": cell["ge6"]}
        # 2025 elk hunter column is 0 on 154 of 157 SUM rows while harvest is filled.
        if year == "2025" or cell["hunters"] <= 0:
            out["success"] = None
        else:
            out["hunters"] = cell["hunters"]
            out["success"] = round(cell["harvest"] / cell["hunters"], 4) if cell["hunters"] else None
        return out

    for hd, years_map in elk_h.items():
        harvest["elk"][hd] = {y: elk_public(c, y) for y, c in years_map.items()}
    for hd, kinds in deer_h.items():
        harvest["deer"][hd] = {}
        for kind, years_map in kinds.items():
            harvest["deer"][hd][kind] = {}
            for y, c in years_map.items():
                item = {"harvest": c["harvest"], "bucks": c["bucks"], "does": c["does"], "lt4": c["lt4"], "ge4": c["ge4"]}
                if c["hunters"] > 0:
                    item["hunters"] = c["hunters"]
                    item["success"] = round(c["harvest"] / c["hunters"], 4)
                else:
                    item["success"] = None
                harvest["deer"][hd][kind][y] = item
    for sp, bag in other_h.items():
        for hd, years_map in bag.items():
            harvest[sp][hd] = {}
            for y, c in years_map.items():
                item = {"harvest": c["harvest"], "males": c["m"], "females": c["f"]}
                if c["hunters"] > 0:
                    item["hunters"] = c["hunters"]
                    item["success"] = round(c["harvest"] / c["hunters"], 4)
                else:
                    item["success"] = None
                harvest[sp][hd][y] = item

    # Trophy
    sheep = sheep_measurements()
    if len(sheep) < 10:
        raise SystemExit(f"sheep measurements parsed {len(sheep)} districts")
    elk_recs = []
    for hd, years_map in elk_h.items():
        ge6 = sum(c["ge6"] for c in years_map.values())
        classed = sum(c["spike"] + c["lt6"] + c["ge6"] for c in years_map.values())
        if classed <= 0:
            continue
        elk_recs.append({"place": hd, "value": ge6 / classed, "n": classed, "ge6": ge6, "classed": classed})
    deer_recs = {"md": [], "wt": []}
    for hd, kinds in deer_h.items():
        for kind in ("md", "wt"):
            if kind not in kinds:
                continue
            ge4 = sum(c["ge4"] for c in kinds[kind].values())
            classed = sum(c["lt4"] + c["ge4"] for c in kinds[kind].values())
            if classed <= 0:
                continue
            deer_recs[kind].append({"place": hd, "value": ge4 / classed, "n": classed, "ge4": ge4, "classed": classed})
    sheep_recs = []
    for hd, rams in sheep.items():
        horn = sum(r["horn"] for r in rams) / len(rams)
        age = sum(r["age"] for r in rams) / len(rams)
        years_s = sorted({r["year"] for r in rams})
        sheep_recs.append({"place": hd, "value": horn, "n": len(rams), "age": age, "years": years_s})
    rank_places(elk_recs)
    rank_places(deer_recs["md"])
    rank_places(deer_recs["wt"])
    rank_places(sheep_recs)
    elk_by = {r["place"]: r for r in elk_recs}
    md_by = {r["place"]: r for r in deer_recs["md"]}
    wt_by = {r["place"]: r for r in deer_recs["wt"]}
    sh_by = {r["place"]: r for r in sheep_recs}

    trophy_hunts = {}
    for key, h in public.items():
        if h["sx"] == "F":
            continue
        if h["sp"] == "elk":
            r = elk_by.get(h["area"])
            if not r:
                continue
            bit = f"{round(100 * r['value'])} percent of classed bulls were 6 points or more"
            text = summary_pct(r["level"], bit if r["level"] not in ("thin", "none") else r["n"], "bulls")
            if r["level"] == "thin":
                text = f"Thin data (n={r['n']}). Too few classed bulls to rank this district."
            ev = f"6 or more points: {r['ge6']} of {r['classed']} classed bulls (FWP elk harvest estimates, HD {h['area']}, 2023 to 2025). District-wide, not this license only."
            trophy_hunts[key] = {"level": r["level"], "summary": text, "evidence": ev, "badge": "", "value": round(r["value"], 4), "unit": h["area"]}
        elif h["sp"] == "deer":
            opp = h["desc"].lower()
            if "mule" in opp and "white" not in opp:
                kind, table, who = "md", md_by, "mule deer bucks"
            elif "white" in opp and "mule" not in opp:
                kind, table, who = "wt", wt_by, "white-tailed bucks"
            else:
                trophy_hunts[key] = {
                    "level": "none",
                    "summary": "Not enough official data to judge.",
                    "evidence": "FWP publishes 4-point shares separately for mule deer and white-tailed deer. This license line does not name one.",
                    "badge": "", "value": None, "unit": h["area"],
                }
                continue
            r = table.get(h["area"])
            if not r:
                continue
            bit = f"{round(100 * r['value'])} percent of classed bucks were 4 points or more"
            text = summary_pct(r["level"], bit if r["level"] not in ("thin", "none") else r["n"], who)
            if r["level"] == "thin":
                text = f"Thin data (n={r['n']}). Too few classed bucks to rank this district."
            ev = f"4 or more points: {r['ge4']} of {r['classed']} classed {who} (FWP deer harvest estimates, HD {h['area']}, 2023 to 2025). District-wide, not this license only."
            trophy_hunts[key] = {"level": r["level"], "summary": text, "evidence": ev, "badge": "", "value": round(r["value"], 4), "unit": h["area"]}
        elif h["sp"] == "sheep":
            r = sh_by.get(h["area"])
            if not r:
                continue
            bit = f"{r['value']:.1f} inches"
            text = summary_horn(r["level"], bit, r["n"])
            if r.get("peers") == "few":
                text = f"Not enough other districts with this measure to rank it (average {bit})."
            yrs = f"{min(r['years'])} to {max(r['years'])}" if len(r["years"]) > 1 else str(r["years"][0])
            ev = f"Average horn length {r['value']:.1f} inches, average age {r['age']:.1f} years (FWP bighorn sheep measurements, HD {h['area']}, {yrs}, n={r['n']}). Length is the mean of the right and left totals. These are measurements, not a score."
            trophy_hunts[key] = {"level": r["level"], "summary": text, "evidence": ev, "badge": "", "value": round(r["value"], 2), "unit": h["area"]}

    for blob in trophy_hunts.values():
        for field in ("summary", "evidence", "badge"):
            if "\u2014" in blob[field] or "\u2013" in blob[field] or "—" in blob[field] or "–" in blob[field]:
                raise SystemExit("dash in trophy " + blob[field])

    # Sample districts: one western and one eastern elk district with a resident
    # 0-point result at one in twenty or better, and a deer record.
    def sample_ok(area):
        elk_hits = deer_hits = False
        for h in public.values():
            if h["area"] != area:
                continue
            if h["sp"] == "deer":
                deer_hits = True
            if h["sp"] == "elk":
                bp = (h["od"].get("res") or {}).get("bp") or {}
                if bp.get("0", 0) >= 0.05:
                    elk_hits = True
        return elk_hits and deer_hits

    gis_ids = set()
    deer_gis = json.loads((GIS / "deerelk.geojson").read_text())
    for feat in deer_gis.get("features") or []:
        dist = str((feat.get("properties") or {}).get("DISTRICT") or "")
        if dist.isdigit():
            gis_ids.add(str(int(dist)))
    areas = sorted((a for a in {h["area"] for h in public.values() if h["area"].isdigit()} if a in gis_ids), key=int)
    west = next((a for a in areas if int(a) < 300 and sample_ok(a)), None)
    east = next((a for a in areas if int(a) >= 500 and sample_ok(a)), None)
    if not west or not east:
        raise SystemExit(f"could not pick sample districts west={west} east={east}")

    meta = {
        "year": 2026,
        "draw": "2026 FWP drawings, first choice",
        "retrieved": "2026-11-15",
        "samples": [west, east],
        "maxp": {},
        "pages": {
            "stats": "https://fwp.mt.gov/buyandapply/hunting-licenses/drawing-statistics",
            "regs": "https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-dea-regulations-final-with-low-resolution-maps-for-web.pdf",
            "msgb": "https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-msgb-final-for-web.pdf",
            "harvest": "https://myfwp.mt.gov/fwpPub/harvestReports",
            "bonusFaq": "https://fwp.mt.gov/binaries/content/assets/fwp/buyandapply/hunting/bonus-points-faq--final-updated.pdf",
            "legal": "https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-2027-legal-descriptions-finalfor-web.pdf",
        },
    }
    for h in public.values():
        if not h["pts"]:
            continue
        m = 0
        for side in h["od"].values():
            for p in (side.get("bp") or {}):
                m = max(m, int(p))
        meta["maxp"][h["sp"]] = max(meta["maxp"].get(h["sp"], 0), m)

    # General seasons: keep rows that have a district and an opportunity.
    seasons_out = []
    seen_s = set()
    for row in seasons:
        if not row["hd"] or not row["opp"]:
            continue
        sig = (row["hd"], row["sp"], row["opp"], tuple(row["dates"]))
        if sig in seen_s:
            continue
        seen_s.add(sig)
        seasons_out.append({
            "hd": row["hd"], "name": plain(row["name"]), "sp": row["sp"],
            "opp": plain(row["opp"]), "dates": row["dates"],
        })
    otc_out = []
    seen_o = set()
    for row in otc:
        if row["lpt"] in seen_o:
            continue
        seen_o.add(row["lpt"])
        otc_out.append({
            "lpt": row["lpt"], "sp": row["sp"] or "deer", "hd": row["hd"], "name": plain(row["name"]),
            "opp": plain(row["opp"]), "dates": row["dates"], "note": plain(row["note"])[:240],
        })

    # Write public JS
    mt = ROOT / "montana"
    mt.mkdir(exist_ok=True)
    meta_json = json.dumps(meta, separators=(",", ":"), ensure_ascii=True)
    hunts_json = json.dumps(public, separators=(",", ":"), ensure_ascii=True)
    if "rate1" in hunts_json or "a1" in hunts_json:
        raise SystemExit("public hunts leaked a count")
    (mt / "data.js").write_text(
        "// 2026 Montana first-choice result bands. Counts stay in the Full Pass file.\n"
        "// Built by scripts/build-montana.py from FWP drawing statistics.\n"
        f"const MT_META={meta_json};\nconst MH={hunts_json};\n"
    )
    general = {
        "meta": {"year": 2026, "retrieved": "2026-11-15"},
        "seasons": seasons_out,
        "otc": otc_out,
    }
    (mt / "general-data.js").write_text(
        "// 2026 Montana resident general licenses and the nonresident combination drawing.\n"
        "// Combination bands only. Exact percents stay in the Full Pass file.\n"
        f"const MG={json.dumps(general, separators=(',', ':'), ensure_ascii=True)};\n"
        f"const MC={json.dumps({'year': 2026, 'hunts': combo_public}, separators=(',', ':'), ensure_ascii=True)};\n"
    )
    harvest_json = json.dumps(harvest, separators=(",", ":"))
    (mt / "harvest.js").write_text(
        "// FWP harvest estimates, 2023 to 2025. 2026 harvest was not published on November 15, 2026.\n"
        "// Elk success is omitted where the hunters column is 0, including 2025.\n"
        f"const MT_HARV={harvest_json};\n"
    )

    hist = {
        "state": "montana",
        "words": "drew",
        "years": years,
        "note": "Each mark is the first-choice result at that point level for that year. A missing level is not a zero. These are past drawings, not a forecast. 2026 elk and deer combination figures are preference points, not bonus points.",
        "hunts": history_hunts,
    }
    hist_path = ROOT / "find" / "history" / "montana.json"
    hist_path.write_text(json.dumps(hist, separators=(",", ":"), ensure_ascii=True))
    (ROOT / "find" / "history" / "montana.sources.json").write_text(json.dumps({
        "state": "montana",
        "years": years,
        "retrieved": "2026-11-15",
        "sources": [s for s in sources if s["year"] in years and s["kind"] in ("bonus_point", "nr_pref")],
    }, indent=1))

    # Private files
    priv_dir = ROOT / "private" / "fullpass"
    priv_dir.mkdir(parents=True, exist_ok=True)
    priv_js = (
        "window.RW_FP=true;\n"
        f"const MT_META={meta_json};\n"
        f"const MH={json.dumps(private, separators=(',', ':'), ensure_ascii=True)};\n"
        f"const MG={json.dumps(general, separators=(',', ':'), ensure_ascii=True)};\n"
        f"const MC={json.dumps({'year': 2026, 'hunts': combo_private}, separators=(',', ':'), ensure_ascii=True)};\n"
    )
    (priv_dir / "mt.js").write_text(priv_js)
    species_meta = {
        "elk": {
            "field": "Share of classed bulls with 6 or more points",
            "years": "2023 to 2025",
            "source": "Montana FWP harvest estimates",
            "sourceUrl": "https://myfwp.mt.gov/fwpPub/harvestReports",
            "gap": "2025 elk hunter counts are 0 in this file while harvest is filled, so 2025 success is not used. The 6-point share uses the point columns. 2026 harvest is not published.",
        },
        "deer": {
            "field": "Share of classed bucks with 4 or more points, mule deer and white-tailed deer separately",
            "years": "2023 to 2025",
            "source": "Montana FWP harvest estimates",
            "sourceUrl": "https://myfwp.mt.gov/fwpPub/harvestReports",
            "gap": "A license line that does not name mule deer or white-tailed deer is not given one species share. 2026 harvest is not published.",
        },
        "sheep": {
            "field": "Average horn length at check-in, with age",
            "years": "2024 to 2025",
            "source": "Montana FWP bighorn sheep measurements",
            "sourceUrl": "https://myfwp.mt.gov/getRepositoryFile?objectID=114626",
            "gap": "2026 measurements were not posted on November 15, 2026. Length is the mean of the right and left horn totals. It is not a record-book score.",
        },
        "antelope": {"field": "", "years": "", "source": "Montana FWP", "sourceUrl": "https://myfwp.mt.gov/fwpPub/harvestReports", "gap": "No official horn or age field was in the harvest estimates. Marked Not enough data."},
        "moose": {"field": "", "years": "", "source": "Montana FWP", "sourceUrl": "https://myfwp.mt.gov/fwpPub/harvestReports", "gap": "No official age or antler field was in the harvest estimates. Marked Not enough data."},
        "goat": {"field": "", "years": "", "source": "Montana FWP", "sourceUrl": "https://myfwp.mt.gov/fwpPub/harvestReports", "gap": "No official age field was in the harvest estimates. Marked Not enough data."},
        "bison": {"field": "", "years": "", "source": "Montana FWP", "sourceUrl": "https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-msgb-final-for-web.pdf", "gap": "No bison harvest estimate was in the harvest tool, and no 2026 age or horn table was found. Marked Not enough data."},
        "bear": {"field": "", "years": "", "source": "Montana FWP", "sourceUrl": "https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-season-date-card-5x4.25-final.pdf", "gap": "No official age or skull field was parsed for black bear permits. Marked Not enough data."},
    }
    trophy = {
        "meta": {
            "built": "2026-11-15",
            "state": "mt",
            "note": "Official agency fields only. Levels rank districts inside this state and species. A sample under 10 animals is Thin data and is not ranked.",
        },
        "species": species_meta,
        "hunts": trophy_hunts,
    }
    trophy_raw = json.dumps(trophy, separators=(",", ":"), ensure_ascii=True)
    if "\\u2014" in trophy_raw or "\\u2013" in trophy_raw:
        raise SystemExit("dash escape in trophy")
    (priv_dir / "trophy-mt.js").write_text(f"window.RWT=window.RWT||{{}};window.RWT.mt={trophy_raw};\n")

    art = Path("/opt/cursor/artifacts")
    art.mkdir(parents=True, exist_ok=True)
    (art / "mt.js").write_text(priv_js)
    (art / "trophy-mt.js").write_text((priv_dir / "trophy-mt.js").read_text())

    summary = {
        "hunts": len(public),
        "bySpecies": dict(species_counts),
        "samples": [west, east],
        "seasons": len(seasons_out),
        "otc": len(otc_out),
        "history": len(history_hunts),
        "trophy": len(trophy_hunts),
        "warnings": warnings[:30],
        "maxp": meta["maxp"],
        "combo2026": {sp: combo_private[f"combo|{sp}"]["groups"] for sp in ("elk", "deer")},
    }
    (SRC / "build-summary.json").write_text(json.dumps(summary, indent=1))
    print(json.dumps({k: summary[k] for k in ("hunts", "bySpecies", "samples", "seasons", "otc", "history", "trophy", "maxp")}, indent=1))
    print("warnings", len(warnings))
    for w in warnings[:12]:
        print(" WARN", w)


if __name__ == "__main__":
    main()
