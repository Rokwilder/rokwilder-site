#!/usr/bin/env python3
"""Parse official NMDGF draw workbooks, the 2026-27 booklet, and harvest PDFs.

Numbers come from those files. A blank cell stays missing. It is not stored as zero
unless the workbook printed a zero.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import openpyxl

CODE_RE = re.compile(r"^[A-Z]{3}-\d-\d{3}$")
CODE_IN = re.compile(r"\b([A-Z]{3}-\d-\d{3})\b")
MONTHS = r"Jan|Feb|Mar|Apr|May|June|July|Aug|Sept?|Oct|Nov|Dec"

POOLS = ("total", "res", "nr", "out")


def clean(value) -> str:
    if value is None:
        return ""
    text = str(value)
    text = (
        text.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2012", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )
    return re.sub(r"\s+", " ", text).strip()


def num(value):
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        if isinstance(value, float) and value != value:
            return None
        return int(value) if float(value) == int(value) else float(value)
    text = str(value).strip().replace(",", "")
    if text in {"", "-", "n/a", "N/A"}:
        return None
    try:
        parsed = float(text)
    except ValueError:
        return None
    return int(parsed) if parsed == int(parsed) else parsed


def header_cells(row):
    return [clean(c) for c in row]


def choice_groups(header, start, end):
    groups = []
    i = start
    while i < end:
        label = header[i].lower()
        if label.startswith("1st"):
            cols = {"1st": i}
            j = i + 1
            while j < end:
                key = header[j].lower()
                if key.startswith("1st") or key == "hunt code":
                    break
                if key.startswith("2nd"):
                    cols["2nd"] = j
                elif key.startswith("3rd"):
                    cols["3rd"] = j
                elif key.startswith("4th"):
                    cols["4th"] = j
                elif key in {"t", "total"} or key.startswith("total"):
                    cols["t"] = j
                elif key in {"r%", "nr%", "o%", "t%", "total%"}:
                    break
                else:
                    break
                j += 1
            groups.append(cols)
            i = j
        else:
            i += 1
    return groups


def find_col(header, start, end, names):
    names = {n.lower() for n in names}
    for i in range(start, end):
        if header[i].lower() in names:
            return i
    return None


def pool_name(label):
    text = clean(label).lower()
    if "non-resident" in text or "nonresident" in text:
        return "nr"
    if "resident" in text:
        return "res"
    if "outfitter" in text:
        return "out"
    if "total" in text:
        return "total"
    return None


def label_at(group, col):
    if group is None:
        return None
    cells = header_cells(group)
    if col < len(cells) and pool_name(cells[col]):
        return pool_name(cells[col])
    i = col
    while i >= 0:
        if i < len(cells) and cells[i]:
            return pool_name(cells[i])
        i -= 1
    return None


def map_row(header, row, group=None):
    split = None
    for i, cell in enumerate(header):
        if i > 0 and cell == "Hunt Code":
            split = i
            break
    if split is None:
        split = len(header)
    bag_i = find_col(header, 0, split, {"bag", "bag_limit", "bag limit"})
    if bag_i is None:
        bag_i = find_col(header, split, len(header), {"bag", "bag_limit", "bag limit"})
    lic_i = find_col(header, 0, split, {"licenses", "permits", "lic.", "lic"})
    unit_i = find_col(header, 0, split, {"unit/description", "unit", "description"})
    left_groups = choice_groups(header, 0, split)
    right_groups = choice_groups(header, split, len(header))
    first_right_choice = right_groups[0]["1st"] if right_groups else len(header)
    issued = {}
    issued_names = {
        "resident": "res",
        "res": "res",
        "non-resident": "nr",
        "nonresident": "nr",
        "nr": "nr",
        "outfitter": "out",
        "out": "out",
    }
    for i in range(split, first_right_choice):
        key = header[i].lower()
        if key in issued_names:
            issued[issued_names[key]] = num(row[i] if i < len(row) else None)
    pools = {}

    def take_apps(name, cols):
        def at(col):
            if col not in cols or cols[col] >= len(row):
                return None
            return num(row[cols[col]])

        pools.setdefault(name, {}).update({"a1": at("1st"), "a2": at("2nd"), "a3": at("3rd")})

    for cols in left_groups:
        name = label_at(group, cols["1st"]) or POOLS[left_groups.index(cols)]
        if name == "total":
            continue
        take_apps(name, cols)
    drawn_published = bool(right_groups)
    if drawn_published:
        for cols in right_groups:
            name = label_at(group, cols["1st"])
            if name in (None, "total"):
                continue

            def at(col, cols=cols):
                if col not in cols or cols[col] >= len(row):
                    return None
                return num(row[cols[col]])

            side = pools.setdefault(name, {})
            side["s1"] = at("1st")
            side["s2"] = at("2nd")
            side["s3"] = at("3rd")
            if "4th" in cols:
                side["s4"] = at("4th")
            side["drawn_total"] = at("t")
    for name, side in pools.items():
        if name == "total":
            continue
        if name in issued and issued[name] is not None:
            side["issued"] = issued[name]
        elif side.get("drawn_total") is not None:
            side["issued"] = side["drawn_total"]
    quota = num(row[lic_i]) if lic_i is not None and lic_i < len(row) else None
    bag = clean(row[bag_i]) if bag_i is not None and bag_i < len(row) else ""
    unit = clean(row[unit_i]) if unit_i is not None and unit_i < len(row) else ""
    right_code = clean(row[split]) if split < len(row) else ""
    dist = {}
    for i, cell in enumerate(header):
        key = cell.lower()
        if key == "r%" and i < len(row):
            dist["r"] = num(row[i])
        elif key == "nr%" and i < len(row):
            dist["nr"] = num(row[i])
        elif key == "o%" and i < len(row):
            dist["o"] = num(row[i])
    return {
        "code": clean(row[0]),
        "right_code": right_code,
        "unit": unit,
        "bag": bag,
        "quota": quota,
        "pools": {k: v for k, v in pools.items() if k != "total"},
        "drawn_published": drawn_published,
        "dist": dist,
        "left_groups": len(left_groups),
        "right_groups": len(right_groups),
    }


def parse_workbook(path, year, kind):
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = [tuple(r) for r in ws.iter_rows(values_only=True)]
    wb.close()
    header = None
    group = None
    species = ""
    hunts = []
    problems = []
    previous = None
    for row in rows:
        cells = header_cells(row)
        if not any(cells):
            previous = row
            continue
        if cells[0] == "Hunt Code":
            header = cells
            group = previous
            previous = row
            continue
        if CODE_RE.match(cells[0] or ""):
            if header is None:
                problems.append("hunt before a header: " + cells[0])
                continue
            rec = map_row(header, row, group)
            rec["year"] = year
            rec["kind"] = kind
            rec["species"] = species
            if rec["right_code"] and rec["right_code"] != rec["code"]:
                problems.append(rec["code"] + " left/right code mismatch " + rec["right_code"])
                continue
            if rec["left_groups"] < 4:
                problems.append(rec["code"] + " expected 4 applicant pools, got " + str(rec["left_groups"]))
            hunts.append(rec)
            previous = row
            continue
        label = cells[0].upper()
        if label in {
            "PRONGHORN",
            "DEER",
            "ELK",
            "ORYX",
            "IBEX",
            "JAVELINA",
            "BARBARY SHEEP",
            "BIGHORN SHEEP",
            "BEAR",
            "TURKEY",
        }:
            species = label
        previous = row
    return {"year": year, "kind": kind, "hunts": hunts, "problems": problems}


def extract_season(before):
    match = re.search(rf"((?:{MONTHS})\.?\s+.*)$", before)
    return clean(match.group(1)) if match else ""


def extract_weapon(before):
    if re.match(r"Bow\b", before):
        return "bow", "Bow"
    if re.match(r"Muzzle", before):
        return "muzzle", "Muzzleloader"
    if re.match(r"Any Legal", before):
        return "any", "Any legal sporting arm"
    return "", ""


def parse_booklet(text):
    text = clean_keep_lines(text)
    lines = [clean(line) for line in text.splitlines()]
    records = {}
    areas = {}
    header = ""
    header_res = False
    i = 0
    while i < len(lines):
        line = lines[i]
        heading = re.search(r"Hunt Code (BHS-\d-\d{3})", line)
        if heading:
            code = heading.group(1)
            block = []
            j = i + 1
            while j < len(lines) and not re.search(r"Hunt Code BHS-\d-\d{3}", lines[j]):
                if re.match(r"(Barbary|Ibex|Oryx|Turkey|Javelina|Bear|Deer|Elk|Pronghorn)\b", lines[j]) and "GMU" not in lines[j]:
                    break
                if lines[j]:
                    block.append(lines[j])
                j += 1
            joined = []
            for raw in block:
                if re.search(r"\bGMU", raw):
                    joined.append(raw)
                elif joined and re.match(rf"^(?:{MONTHS})\b", raw):
                    joined[-1] = joined[-1] + " " + raw
            # Footnotes explain a boundary. They are not a second set of odds.
            areas[code] = [line for line in joined if re.search(rf"(?:{MONTHS})", line)]
            i = j
            continue
        if not line:
            i += 1
            continue
        if re.match(r"Units?\b", line) and not CODE_IN.search(line):
            header = line
            header_res = bool(re.search(r"resident", line, re.I))
            i += 1
            continue
        match = CODE_IN.search(line)
        if not match:
            i += 1
            continue
        code = match.group(1)
        before = line[: match.start()].strip()
        after = line[match.end() :].strip()
        notes = []
        j = i + 1
        while j < len(lines):
            nxt = lines[j]
            if not nxt:
                j += 1
                continue
            if CODE_IN.search(nxt) or re.match(r"Units?\b", nxt) or re.search(r"Hunt Code BHS-", nxt):
                break
            if len(nxt) <= 60 and re.search(r"resident|youth|mobility|military|once", nxt, re.I):
                notes.append(nxt)
                j += 1
                continue
            if re.match(rf"^(?:{MONTHS})\b", nxt) and not extract_season(before):
                before = (before + " " + nxt).strip()
                j += 1
                continue
            break
        wpn, wlab = extract_weapon(before)
        tokens = after.split()
        fee = ""
        if tokens and tokens[0] in {"S", "Q", "HD", "Q/HD"}:
            fee = tokens.pop(0)
        booklet_quota = None
        if tokens and re.fullmatch(r"\d+", tokens[0]):
            booklet_quota = int(tokens.pop(0))
        bag_text = " ".join(tokens)
        res_only = header_res or any(re.search(r"resident", n, re.I) for n in notes) or bool(
            re.search(r"resident only", before, re.I)
        )
        season = extract_season(before)
        better = code not in records or (not records[code].get("season") and season)
        if better:
            records[code] = {
                "season": extract_season(before),
                "fee": fee,
                "wpn": wpn,
                "wlab": wlab,
                "bag_text": bag_text,
                "booklet_quota": booklet_quota,
                "header": header,
                "book_res_only": res_only,
                "notes": notes,
                "youth": bool(re.search(r"youth", before + " " + " ".join(notes), re.I)),
                "mobility": bool(re.search(r"mobility", before + " " + " ".join(notes), re.I)),
            }
        i = max(j, i + 1)
    return {"rows": records, "bighorn_areas": areas}


def clean_keep_lines(text):
    return (
        text.replace("\u2014", "-")
        .replace("\u2013", "-")
        .replace("\u2012", "-")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
    )


def parse_harvest_text(text):
    # Hunt codes in the bighorn report are printed "BHS 1-201" rather than "BHS-1-201".
    text = re.sub(r"\b([A-Z]{3})\s+(\d)-(\d{3})\b", r"\1-\2-\3", text)
    out = {}
    for raw in text.splitlines():
        line = clean(raw)
        match = CODE_IN.search(line)
        if not match:
            continue
        code = match.group(1)
        if code in out:
            # The public block is printed before a later private row for the same code.
            continue
        rest = line[match.end() :]
        rest = re.sub(r"(?<=\d),(?=\d)", "", rest)
        tokens = re.findall(r"\d+(?:\.\d+)?%?|\.(?!\d)", rest)
        ints_before = []
        pcts = []
        after = []
        seen = 0
        for token in tokens:
            if token.endswith("%"):
                pcts.append(float(token[:-1]) / 100)
                seen += 1
            elif seen == 0 and re.fullmatch(r"\d+", token):
                ints_before.append(int(token))
            elif seen >= 2:
                if token == ".":
                    after.append(None)
                elif re.fullmatch(r"\d+", token):
                    after.append(int(token))
        # Dates sit to the left of the license count. The license count is the
        # integer just before the hunters-reporting count, which is the last
        # integer before the first percent.
        rec = {}
        if len(ints_before) >= 2:
            rec["sold"] = ints_before[-2]
        elif ints_before:
            rec["sold"] = ints_before[-1]
        else:
            rec["sold"] = None
        rec["success"] = pcts[1] if len(pcts) >= 2 else None
        if len(after) >= 2:
            rec["males"] = after[0]
            rec["females"] = after[1]
        out[code] = rec
    return out


def pdftotext(path):
    proc = subprocess.run(["pdftotext", "-layout", str(path), "-"], check=True, capture_output=True)
    return proc.stdout.decode("utf-8", "replace")


def harvest_from_dir(folder: Path):
    # File names from the download log use the license-year end, or a short year.
    year_by_suffix = {
        "2025-26": "2025-26",
        "2024-25": "2024-25",
        "2023-24": "2023-24",
        "2025": "2025-26",
        "2024": "2024-25",
        "2023": "2023-24",
    }
    species = {
        "elk": "elk",
        "deer": "deer",
        "prong": "pronghorn",
        "oryx": "oryx",
        "ibex": "ibex",
        "jav": "javelina",
        "bby": "barbary",
        "bhs": "bighorn",
    }
    found = {}
    sources = []
    for path in sorted(folder.glob("*.pdf")):
        stem = path.stem
        year_key = None
        for suffix, label in year_by_suffix.items():
            if stem.endswith(suffix):
                year_key = label
                break
        if not year_key:
            continue
        sp = stem.split("-")[0]
        if sp not in species:
            continue
        text = pdftotext(path)
        rows = parse_harvest_text(text)
        for code, rec in rows.items():
            slot = found.setdefault(code, {})
            slot[year_key] = rec
        sources.append({"file": path.name, "year": year_key, "species": species[sp], "rows": len(rows)})
    return {"by_code": found, "sources": sources}


def load_sources(root: Path):
    draw = root / "draw"
    files = [
        (2026, "biggame", draw / "2026-complete.xlsx"),
        (2025, "biggame", draw / "2025-complete.xlsx"),
        (2024, "biggame", draw / "2024-complete.xlsx"),
        (2023, "biggame", draw / "2023-complete.xlsx"),
        (2026, "bear-turkey", draw / "2026-bear-turkey.xlsx"),
        (2025, "bear-turkey", draw / "2025-bear-turkey.xlsx"),
    ]
    books = []
    problems = []
    for year, kind, path in files:
        parsed = parse_workbook(path, year, kind)
        books.append(parsed)
        problems.extend(f"{year} {kind}: {item}" for item in parsed["problems"])
    booklet = parse_booklet(pdftotext(root / "regs" / "2026-2027-rules.pdf"))
    harvest = harvest_from_dir(root / "harvest")
    return {"books": books, "booklet": booklet, "harvest": harvest, "problems": problems}


def slim_hunt(rec):
    return {
        "year": rec["year"],
        "kind": rec["kind"],
        "species": rec["species"],
        "code": rec["code"],
        "unit": rec["unit"],
        "bag": rec["bag"],
        "quota": rec["quota"],
        "pools": rec["pools"],
        "drawn_published": rec["drawn_published"],
        "dist": rec["dist"],
    }


def self_test():
    """Tiny workbooks in the official column layouts. Counts are fixtures, not a report."""
    from openpyxl import Workbook
    import tempfile

    def sheet_2026():
        wb = Workbook()
        ws = wb.active
        group = [None] * 46
        group[0] = "ELK"
        group[3] = "Hunt Code Total"
        group[7] = "Resident"
        group[11] = "Non-Resident"
        group[15] = "Outfitter"
        group[23] = "Hunt Code Total"
        group[27] = "Resident"
        group[32] = "Non-Resident"
        group[37] = "Outfitter"
        header = [None] * 46
        header[0] = "Hunt Code"
        header[1] = "Unit/Description"
        header[2] = "Licenses"
        for col, name in ((3, "1st"), (4, "2nd"), (5, "3rd"), (6, "Total"),
                          (7, "1st"), (8, "2nd"), (9, "3rd"), (10, "Total"),
                          (11, "1st"), (12, "2nd"), (13, "3rd"), (14, "Total"),
                          (15, "1st"), (16, "2nd"), (17, "3rd"), (18, "Total"),
                          (20, "Hunt Code"), (21, "Bag"), (22, "Licenses"),
                          (23, "Resident"), (24, "Non-Resident"), (25, "Outfitter"), (26, "Total"),
                          (27, "1st"), (28, "2nd"), (29, "3rd"), (30, "4th"), (31, "Total"),
                          (32, "1st"), (33, "2nd"), (34, "3rd"), (35, "4th"), (36, "Total"),
                          (37, "1st"), (38, "2nd"), (39, "3rd"), (40, "4th"), (41, "Total")):
            header[col] = name
        data = [None] * 46
        data[0] = "ELK-1-132"
        data[1] = "Unit 2"
        data[2] = 85
        data[7] = 1152
        data[8] = 674
        data[9] = 658
        data[11] = 153
        data[15] = 80
        data[20] = "ELK-1-132"
        data[21] = "MB"
        data[22] = 85
        data[23] = 72
        data[24] = 5
        data[25] = 8
        data[27] = 63
        data[32] = 4
        data[37] = 7
        data[30] = 0
        ws.append(group)
        ws.append(header)
        ws.append(data)
        return wb

    def sheet_bear():
        wb = Workbook()
        ws = wb.active
        group = [None] * 31
        group[0] = "BEAR"
        group[3] = "Hunt Total"
        group[7] = "Resident"
        group[11] = "Non-Resident"
        group[15] = "Outfitter"
        header = [None] * 31
        header[0] = "Hunt Code"
        header[1] = "Unit/Description"
        header[2] = "Licenses"
        for col in (3, 7, 11, 15):
            header[col] = "1st"
            header[col + 1] = "2nd"
            header[col + 2] = "3rd"
            header[col + 3] = "Total"
        header[20] = "Hunt Code"
        header[21] = "Bag"
        header[22] = "Licenses"
        header[23] = "Res"
        header[24] = "NR"
        header[25] = "Out"
        header[26] = "Total"
        data = [None] * 31
        data[0] = "BER-1-100"
        data[1] = "Unit 2, Youth Only"
        data[2] = 5
        data[7] = 51
        data[8] = 12
        data[9] = 10
        data[11] = 0
        data[15] = 2
        data[20] = "BER-1-100"
        data[21] = "1B"
        data[23] = 5
        data[24] = 0
        data[25] = 0
        ws.append(["2026 Bear and Turkey Drawing Odds Report"])
        ws.append(group)
        ws.append(header)
        ws.append(data)
        return wb

    errors = []
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "2026.xlsx"
        sheet_2026().save(path)
        parsed = parse_workbook(path, 2026, "biggame")
        hunt = parsed["hunts"][0]
        res = hunt["pools"]["res"]
        if res.get("a1") != 1152 or res.get("s1") != 63 or res.get("issued") != 72:
            errors.append("2026 resident pool " + str(res))
        if hunt["pools"]["nr"].get("s1") != 4 or hunt["pools"]["out"].get("s1") != 7:
            errors.append("2026 other pools " + str(hunt["pools"]))
        if not hunt["drawn_published"]:
            errors.append("2026 should publish drawn-by-choice")
        path = Path(tmp) / "bear.xlsx"
        sheet_bear().save(path)
        bear = parse_workbook(path, 2026, "bear-turkey")["hunts"][0]
        if bear["drawn_published"]:
            errors.append("bear report should not publish first-choice drawn")
        if bear["pools"]["res"].get("a1") != 51 or bear["pools"]["res"].get("issued") != 5 or "s1" in bear["pools"]["res"]:
            errors.append("bear resident " + str(bear["pools"]["res"]))
    harvest = parse_harvest_text(
        "REG ELK-1-132 rifle Oct 18-22 MB 85 74 87% 53% 45 0 3.26 7.83\n"
        "BHS 1-201 Any Ram 28 28 100% 100% 28 .\n"
        "BHS 1-201 Any Ram 3 3 100% 100% 3 .\n"
    )
    row = harvest["ELK-1-132"]
    if row.get("sold") != 85 or row.get("success") != 0.53 or row.get("males") != 45 or row.get("females") != 0:
        errors.append("elk harvest " + str(row))
    ram = harvest["BHS-1-201"]
    if ram.get("sold") != 28 or ram.get("success") != 1 or ram.get("males") != 28:
        errors.append("bighorn harvest kept a later row " + str(ram))
    if errors:
        raise SystemExit("NM parser self-test failed:\n" + "\n".join(errors))
    print("parser self-test ok")


def main():
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--self-test":
        self_test()
        return
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/nm-src")
    out = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/nm-build/parsed.json")
    payload = load_sources(root)
    data = {
        "problems": payload["problems"],
        "booklet": payload["booklet"],
        "harvest": payload["harvest"],
        "books": [
            {"year": book["year"], "kind": book["kind"], "hunts": [slim_hunt(h) for h in book["hunts"]]}
            for book in payload["books"]
        ],
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data))
    counts = {f"{b['year']}-{b['kind']}": len(b["hunts"]) for b in data["books"]}
    print(json.dumps({"wrote": str(out), "counts": counts, "problems": len(data["problems"]), "booklet_rows": len(data["booklet"]["rows"]), "harvest_codes": len(data["harvest"]["by_code"])}))


if __name__ == "__main__":
    main()
