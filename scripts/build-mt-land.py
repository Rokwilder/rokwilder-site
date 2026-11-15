#!/usr/bin/env python3
"""Montana huntable public land from FWP's 2026-2027 ownership workbook.

Counted: BLM, U.S. Forest Service, Montana state trust land, and FWP.
Not counted: national parks, wildlife refuges, defense, Bureau of Reclamation,
local government, and tribal land. The workbook gives one percent, so low and
high are the same share and the band does not depend on an uncertain layer.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAND = Path("/tmp/montana-research/parsed/land-ownership")
COUNTED = (
    "Public_US Bureau of Land Management",
    "Public_US Forest Service",
    "Public_Montana State Trust Lands",
    "Public_Montana Fish, Wildlife, and Parks",
)
FILES = {
    "deer": "landcover-ownership-2026-2027-deer-elk-lion__Own.csv",
    "elk": "landcover-ownership-2026-2027-deer-elk-lion__Own.csv",
    "antelope": "landcover-ownership-2026-2027-antelope__Own.csv",
    "moose": "landcover-ownership-2026-2027-moose__Own.csv",
    "sheep": "landcover-ownership-2026-2027-sheep__Own.csv",
    "goat": "landcover-ownership-2026-2027-goat__Own.csv",
    "bison": "landcover-ownership-2026-2027-bison__Own.csv",
    "bear": "landcover-ownership-2026-2027-black-bear__Own.csv",
}
SOURCE = "FWP 2026-2027 Hunting District Landcover and Land Ownership Calculations, Own sheet"


def band_of(p):
    if p >= 0.70:
        return "pub"
    if p >= 0.40:
        return "mix"
    return "priv"


def rows(path):
    with path.open(newline="") as f:
        for row in csv.DictReader(f):
            yield {k.strip(): v for k, v in row.items() if k}


def main():
    exact = {}
    skipped = {}
    for sp, name in FILES.items():
        for row in rows(LAND / name):
            dist = str(row.get("DISTRICT") or "").strip()
            if not dist.isdigit():
                skipped["not a numbered district"] = skipped.get("not a numbered district", 0) + 1
                continue
            hd = str(int(dist))
            try:
                parts = {col: float(row[col] or 0) for col in COUNTED}
                public_all = float(row.get("PublicAll") or 0)
            except (KeyError, ValueError):
                skipped["ownership columns missing"] = skipped.get("ownership columns missing", 0) + 1
                continue
            huntable = sum(parts.values())
            if huntable > public_all + 0.6:
                skipped["counted acres exceed the workbook public total"] = skipped.get("counted acres exceed the workbook public total", 0) + 1
                continue
            share = min(huntable, 100) / 100
            key = f"{sp}:{hd}"
            exact[key] = {
                "pct": round(share, 6),
                "low": round(share, 6),
                "high": round(share, 6),
                "band": band_of(share),
                "status": "computed",
                "counted_percent": round(huntable, 2),
                "public_all_percent": round(public_all, 2),
                "source": SOURCE,
            }
    out = ROOT / "data" / "public-land"
    exact_all = json.loads((out / "exact.json").read_text())
    exact_all["mt"] = exact
    (out / "exact.json").write_text(json.dumps(exact_all, indent=1, sort_keys=True) + "\n")
    prov = json.loads((out / "provenance.json").read_text())
    prov["policy"] = [p for p in prov["policy"] if p.get("state") != "MT"]
    prov["policy"].append({
        "state": "MT",
        "rule": "Counted land is BLM, U.S. Forest Service, Montana state trust land, and Montana Fish, Wildlife and Parks, from FWP's 2026-2027 ownership workbook. National parks, wildlife refuges, defense land, Bureau of Reclamation, and tribal land are not counted. The workbook is one figure, so there is no second uncertain share.",
        "url": "https://fwp.mt.gov/gis/maps/huntPlanner",
    })
    prov.setdefault("sources", {})["mt"] = [{
        "title": SOURCE,
        "url": "https://fwp.mt.gov/gis/maps/huntPlanner",
        "sheet": "Own",
    }]
    prov.setdefault("notes", {})["mt"] = {
        "counted": "BLM, USFS, Montana state trust land, and FWP",
        "not_counted": "NPS, USFWS, Defense, BOR, local government, and tribal land",
        "uncertain": "None. The workbook percent is a single figure, so low and high are the same share.",
    }
    (out / "provenance.json").write_text(json.dumps(prov, indent=1) + "\n")
    cov = json.loads((out / "coverage.json").read_text())
    cov["mt"] = {"computed": len(exact), "skipped": sum(skipped.values()), "skip_reasons": skipped}
    (out / "coverage.json").write_text(json.dumps(cov, indent=1, sort_keys=True) + "\n")
    data_path = ROOT / "find" / "land-data.js"
    text = data_path.read_text()
    prefix = "window.RW_LAND_DATA="
    start = text.index(prefix) + len(prefix)
    data = json.loads(text[start:].rstrip().rstrip(";"))
    data["mt"] = {k: v["band"] for k, v in sorted(exact.items())}
    body = json.dumps(data, separators=(",", ":"), sort_keys=True)
    data_path.write_text(
        "// Generated by scripts/build-public-land.py. Band codes only. Exact shares are in data/public-land/exact.json.\n"
        "// Montana bands are added by scripts/build-mt-land.py from FWP's ownership workbook.\n"
        "window.RW_LAND_DATA=" + body + ";\n"
    )
    print("mt bands", len(exact), "skipped", skipped)


if __name__ == "__main__":
    main()
