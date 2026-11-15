#!/usr/bin/env python3
"""Official 2026 GMU map and huntable-public bands for New Mexico.

Counted land is BLM, U.S. Forest Service, state trust (S), and Department or
State Game Commission land (SGF), from the NMDGF surface-ownership layer.
GMU 6B also measures Valles Caldera (NPS) as uncertain, because elk and turkey
draw hunts are authorized there. If that uncertain share would change the band,
the unit is omitted.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
GIS = Path("/tmp/nm-src/gis")
NODE_TOPO = "/tmp/nm-tools/node_modules/topojson-server/dist/topojson-server.js"
GMU_URL = "https://services2.arcgis.com/CjbW1bVhK4dB3WOa/arcgis/rest/services/NMDGF_Game_Management_Units_I_E__v2_WFL1/FeatureServer/0"
OWN_URL = "https://services2.arcgis.com/CjbW1bVhK4dB3WOa/arcgis/rest/services/BLM_NM_Surface_Ownership/FeatureServer/1"
HUNTABLE = {"BLM", "FS", "S", "SGF"}
# Valles Caldera is NPS and is closed except for listed elk and turkey draw hunts.
UNCERTAIN_6B = {"NPS"}
TOL = 0.002
TO_5070 = Transformer.from_crs(4326, 5070, always_xy=True)


def project(geom):
    geom = make_valid(geom)
    return transform(TO_5070.transform, geom)


def band_of(p):
    if p >= 0.70:
        return "pub"
    if p >= 0.40:
        return "mix"
    return "priv"


def decide(low, high):
    low = max(0.0, min(1.0, low))
    high = max(low, min(1.0, high))
    if abs(high - low) <= TOL:
        mid = (low + high) / 2
        return {"status": "computed", "band": band_of(mid), "pct": round(mid, 6), "low": round(low, 6), "high": round(high, 6)}
    b1, b2 = band_of(low), band_of(high)
    if b1 == b2:
        return {"status": "computed", "band": b1, "pct": None, "low": round(low, 6), "high": round(high, 6)}
    return {"status": "skipped", "reason": "uncertain land could move the band", "band": None, "pct": None, "low": round(low, 6), "high": round(high, 6)}


def load_gmus():
    raw = json.loads((GIS / "gmu.geojson").read_text())
    simple = []
    projected = {}
    for feat in raw["features"]:
        code = str(feat["properties"]["GMU"])
        geom = shape(feat["geometry"])
        if not geom.is_valid:
            geom = make_valid(geom)
        web = geom.simplify(0.002, preserve_topology=True)
        simple.append({"type": "Feature", "properties": {"u": code}, "geometry": mapping(web)})
        projected[code] = project(geom)
    return simple, projected


def load_ownership():
    geoms = []
    owners = []
    for path in sorted((GIS / "own").glob("*.geojson")):
        data = json.loads(path.read_text())
        for feat in data.get("features") or []:
            owner = str((feat.get("properties") or {}).get("own") or "")
            try:
                geom = shape(feat["geometry"])
            except Exception:
                continue
            if geom.is_empty:
                continue
            if not geom.is_valid:
                geom = make_valid(geom)
            geom = project(geom)
            if geom.is_empty:
                continue
            geoms.append(geom)
            owners.append(owner)
    return geoms, owners


def measure(unit, hits, owners, gmu):
    area = unit.area
    if area <= 0:
        return {"status": "skipped", "reason": "geometry area too small or invalid", "band": None}
    known = 0.0
    uncertain = 0.0
    for geom, owner in zip(hits, owners):
        if owner not in HUNTABLE and not (gmu == "6B" and owner in UNCERTAIN_6B):
            continue
        piece = unit.intersection(geom)
        if piece.is_empty:
            continue
        if owner in HUNTABLE:
            known += piece.area
        elif gmu == "6B" and owner in UNCERTAIN_6B:
            uncertain += piece.area
    return decide(known / area, (known + uncertain) / area)


def sort_key(code):
    import re
    m = re.match(r"^(\d+)([A-Z]?)$", code)
    return (int(m.group(1)), m.group(2)) if m else (999, code)


def hunt_keys():
    script = r"""
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const s = {};
vm.createContext(s);
vm.runInContext(readFileSync('newmexico/data.js','utf8') + '\n' + 'globalThis.NH=NH;', s);
const keys = new Set();
for (const h of Object.values(s.NH)) {
  if (h.privateOnly || h.wmaOnly || h.partial || h.areaChoice || (h.unmapped && h.unmapped.length) || !h.units || !h.units.length) continue;
  keys.add(h.units.join('+'));
}
console.log(JSON.stringify([...keys]));
"""
    # units in data.js are already sorted by the builder.
    raw = subprocess.check_output(["node", "--input-type=module", "-e", script], cwd=ROOT)
    return json.loads(raw)


def write_topo(features):
    fc = {"type": "FeatureCollection", "features": features}
    tmp = Path("/tmp/nm-build/gmu-simple.geojson")
    tmp.parent.mkdir(parents=True, exist_ok=True)
    tmp.write_text(json.dumps(fc))
    node = f"""
import {{readFileSync, writeFileSync}} from 'node:fs';
import {{topology}} from '{NODE_TOPO}';
const fc = JSON.parse(readFileSync({json.dumps(str(tmp))}, 'utf8'));
const topo = topology({{area: fc}});
writeFileSync({json.dumps(str(ROOT / 'newmexico' / 'gmu.json'))}, JSON.stringify(topo));
"""
    subprocess.check_call(["node", "--input-type=module", "-e", node])


def main():
    print("loading GMUs", flush=True)
    simple, projected = load_gmus()
    write_topo(simple)
    (ROOT / "newmexico" / "bounds-sources.json").write_text(json.dumps({
        "retrieved": "2026-11-15",
        "credit": "Game management unit boundaries: New Mexico Department of Wildlife.",
        "url": GMU_URL,
        "item": "https://www.arcgis.com/home/item.html?id=192f3a7b478f4cee83741d7f5b5c7379",
        "updated": "2026-08-31",
        "units": len(simple),
        "note": "Lines are simplified. The written boundary in 19.30.4 NMAC is the one that counts. A parent unit such as 2, 5, 6, 16, 21, 51, or 55 is not a polygon in this 2026 layer."
    }, indent=1))
    print("loading ownership", flush=True)
    geoms, owners = load_ownership()
    print(f"  polygons {len(geoms)}", flush=True)
    tree = STRtree(geoms)
    results = {}
    for code, geom in projected.items():
        idxs = tree.query(geom)
        hits = [geoms[i] for i in idxs]
        owns = [owners[i] for i in idxs]
        results[code] = measure(geom, hits, owns, code)
        print(f"  {code} {results[code].get('band')} {results[code].get('status')}", flush=True)
    for key in hunt_keys():
        if key in results:
            continue
        parts = key.split("+")
        missing = [p for p in parts if p not in projected]
        if missing:
            results[key] = {"status": "skipped", "reason": "missing unit polygon: " + ",".join(missing), "band": None}
            continue
        merged = unary_union([projected[p] for p in parts])
        if not merged.is_valid:
            merged = make_valid(merged)
        # A multi-unit hunt is not GMU 6B alone, so Valles Caldera stays out of the count.
        results[key] = measure(merged, [geoms[i] for i in tree.query(merged)], [owners[i] for i in tree.query(merged)], gmu="")
    bands = {k: v["band"] for k, v in results.items() if v.get("status") == "computed" and v.get("band")}
    data_path = ROOT / "find" / "land-data.js"
    text = data_path.read_text()
    start = text.index("{")
    end = text.rindex("}")
    data = json.loads(text[start:end + 1])
    data["nm"] = dict(sorted(bands.items(), key=lambda kv: sort_key(kv[0].split("+")[0])))
    header = "// Generated by scripts/build-public-land.py. Band codes only. Exact shares are in data/public-land/exact.json.\n// New Mexico bands are added by scripts/build-nm-geo.py from the Department surface-ownership layer.\n"
    # Keep the Montana comment if the original header mentioned it. Replace the whole header with both.
    header = "// Generated by scripts/build-public-land.py and scripts/build-nm-geo.py. Band codes only. Exact shares are in data/public-land/exact.json.\n// Montana bands come from the FWP ownership workbook. New Mexico bands come from the Department surface-ownership layer.\n"
    data_path.write_text(header + "window.RW_LAND_DATA=" + json.dumps(data, separators=(",", ":")) + ";\n")
    exact_path = ROOT / "data" / "public-land" / "exact.json"
    exact = json.loads(exact_path.read_text())
    exact["nm"] = results
    exact_path.write_text(json.dumps(exact))
    prov_path = ROOT / "data" / "public-land" / "provenance.json"
    prov = json.loads(prov_path.read_text())
    prov["policy"] = [row for row in prov.get("policy", []) if row.get("state") != "NM"]
    prov["policy"].append({
        "state": "NM",
        "rule": "Counted land is BLM, U.S. Forest Service, New Mexico state trust land (owner code S), and Department or State Game Commission land (SGF), from the NMDGF surface-ownership layer current as of August 17, 2026. National parks, wildlife refuges, defense land, state parks, and tribal land are not counted. GMU 6B treats National Park Service land as uncertain because Valles Caldera is closed except for elk and turkey draw hunts. The band is omitted when that uncertain share would change it.",
        "url": OWN_URL
    })
    prov.setdefault("sources", {})["nm"] = [
        {"name": "NMDGF Game Management Units", "url": GMU_URL, "updated": "2026-08-31"},
        {"name": "BLM NM Surface Ownership", "description": "Hosted by the New Mexico Department of Wildlife. Current as of August 17, 2026.", "url": OWN_URL, "updated": "2026-08-17"}
    ]
    prov_path.write_text(json.dumps(prov, indent=1))
    computed = sum(1 for v in results.values() if v.get("status") == "computed")
    skipped = sum(1 for v in results.values() if v.get("status") != "computed")
    print(json.dumps({"units": len(simple), "computed": computed, "skipped": skipped, "bands": len(bands)}))


if __name__ == "__main__":
    main()
