#!/usr/bin/env python3
"""Simplified Idaho and Nevada hunt-unit maps from the official layers.

Idaho: IDFG Controlled Hunts - All Species. HuntArea is the draw area.
A trailing * is IDFG's mark on that polygon. It is removed only when the
same species has no separate polygon without the *. An X suffix is an
extra-tag hunt on the same area (IDAPA 13.01.04.350) and is not a second shape.

Nevada: NDOW Hunt Units. A three-digit display_name is a hunt unit.
Named closures (parks and ranges) are not units. A hunt string is linked
only when every unit it names is one of those polygons. A portion, a
north or south piece, or any other wording that is not a unit list is
left off.

Lines are simplified the same way as the Montana and New Mexico maps.
The written boundary in the regulations is the one that counts.
"""
from __future__ import annotations

import json
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
NODE = "/tmp/idnv-tools/node_modules/topojson-server/dist/topojson-server.js"
UA = "rokwilder-bounds"
ID_LAYER = "https://services.arcgis.com/FjJI5xHF2dUPVrgK/arcgis/rest/services/ControlledHunts_All/FeatureServer/0"
NV_LAYER = "https://services.arcgis.com/RyxlXSfFi87rAosq/arcgis/rest/services/NDOW_Hunt_Units/FeatureServer/0"
ID_SPECIES = {
    "elk": "Elk",
    "deer": "Deer",
    "pronghorn": "Pronghorn",
    "moose": "Moose",
    "sheep-rm": "Rocky Mtn Sheep",
    "sheep-ca": "California Sheep",
    "goat": "Goat",
    "bear": "Bear",
    "turkey": "Turkey",
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode())


def query_geojson(layer, fields, where="1=1", page=100):
    feats = []
    offset = 0
    while True:
        qs = urllib.parse.urlencode({
            "where": where,
            "outFields": fields,
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "geojson",
            "resultOffset": str(offset),
            "resultRecordCount": str(page),
        })
        data = fetch(f"{layer}/query?{qs}")
        batch = data.get("features") or []
        feats.extend(batch)
        exceeded = bool(data.get("exceededTransferLimit") or (data.get("properties") or {}).get("exceededTransferLimit"))
        print(f"  {len(feats)} features", flush=True)
        if not batch or (not exceeded and len(batch) < page):
            break
        offset += len(batch)
    return feats


def as_geom(raw):
    if not raw:
        return None
    try:
        geom = shape(raw)
    except Exception:
        return None
    if geom.is_empty:
        return None
    if not geom.is_valid:
        geom = make_valid(geom)
    if geom.geom_type == "GeometryCollection":
        parts = [g for g in geom.geoms if g.geom_type in ("Polygon", "MultiPolygon") and not g.is_empty]
        if not parts:
            return None
        geom = unary_union(parts)
    if geom.geom_type not in ("Polygon", "MultiPolygon"):
        return None
    geom = geom.simplify(0.002, preserve_topology=True)
    if geom.is_empty:
        return None
    return geom


def write_topo(features, path):
    fc = {"type": "FeatureCollection", "features": features}
    tmp = Path("/tmp/idnv-build")
    tmp.mkdir(parents=True, exist_ok=True)
    raw = tmp / (path.stem + ".geojson")
    raw.write_text(json.dumps(fc))
    node = f"""
import {{readFileSync, writeFileSync}} from 'node:fs';
import {{topology}} from '{NODE}';
const fc = JSON.parse(readFileSync({json.dumps(str(raw))}, 'utf8'));
const topo = topology({{area: fc}});
writeFileSync({json.dumps(str(path))}, JSON.stringify(topo));
"""
    subprocess.check_call(["node", "--input-type=module", "-e", node])


def load_hunts():
    script = r"""
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const s = {};
vm.createContext(s);
vm.runInContext(readFileSync('idaho/data.js','utf8') + '\nglobalThis.IH=IH;', s);
vm.runInContext(readFileSync('nevada/data.js','utf8') + '\nglobalThis.NH=NH;', s);
const id = Object.values(s.IH).map(h => ({sp:h.sp, area:String(h.area)}));
const nv = Object.values(s.NH).map(h => ({units:String(h.units)}));
console.log(JSON.stringify({id, nv}));
"""
    return json.loads(subprocess.check_output(["node", "--input-type=module", "-e", script], cwd=ROOT))


def canon_code(raw, codes):
    text = str(raw).strip()
    if text.endswith("*") and text[:-1] not in codes:
        return text[:-1]
    return text


def one_id(codes, area):
    if area in codes:
        return [area]
    if area.endswith("X") and area[:-1] in codes:
        return [area[:-1]]
    return []


def idaho_ids(codes, area):
    text = str(area).strip()
    if "," in text:
        parts = [p.strip() for p in text.split(",") if p.strip()]
        ids = []
        for part in parts:
            hit = one_id(codes, part)
            if not hit:
                return []
            ids.extend(hit)
        return ids
    return one_id(codes, text)


def nv_key(text):
    import re
    text = re.sub(r"\s*\(see CR [^)]+\)\s*$", "", str(text), flags=re.I).strip()
    nums = []
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        range_match = re.fullmatch(r"(\d+)\s*-\s*(\d+)", part)
        if range_match:
            start, end = int(range_match.group(1)), int(range_match.group(2))
            if end < start or end - start > 40:
                return None
            nums.extend(range(start, end + 1))
        elif re.fullmatch(r"\d+", part):
            nums.append(int(part))
        else:
            return None
    if not nums:
        return None
    return [f"{n:03d}" for n in sorted(set(nums))]


def build_idaho(feats, hunts):
    by_species = {sp: {} for sp in ID_SPECIES}
    raw_codes = {sp: set() for sp in ID_SPECIES}
    years = {sp: set() for sp in ID_SPECIES}
    skipped = 0
    for feat in feats:
        props = feat.get("properties") or {}
        game = props.get("BigGame")
        sp = next((key for key, name in ID_SPECIES.items() if name == game), None)
        if not sp:
            skipped += 1
            continue
        raw = str(props.get("HuntArea") or "").strip()
        if not raw:
            skipped += 1
            continue
        geom = as_geom(feat.get("geometry"))
        if geom is None:
            skipped += 1
            continue
        raw_codes[sp].add(raw)
        years[sp].add(props.get("Year"))
        by_species[sp].setdefault(raw, []).append(geom)
    out_dir = ROOT / "idaho"
    species_meta = {}
    codes = {}
    for sp, groups in by_species.items():
        present = raw_codes[sp]
        dissolved = {}
        for raw, parts in groups.items():
            key = canon_code(raw, present)
            geom = unary_union(parts)
            if key in dissolved:
                geom = unary_union([dissolved[key], geom])
            if not geom.is_valid:
                geom = make_valid(geom)
            dissolved[key] = geom
        features = []
        for key, geom in sorted(dissolved.items(), key=lambda kv: (len(kv[0]), kv[0])):
            features.append({
                "type": "Feature",
                "properties": {"u": key, "a": round(geom.area, 6)},
                "geometry": mapping(geom),
            })
        path = out_dir / f"{sp}.json"
        write_topo(features, path)
        codes[sp] = set(dissolved)
        species_meta[sp] = {
            "file": f"{sp}.json",
            "big_game": ID_SPECIES[sp],
            "areas": len(features),
            "bytes": path.stat().st_size,
            "years": sorted(y for y in years[sp] if y is not None),
        }
        print(sp, len(features), path.stat().st_size, flush=True)
    linked = 0
    missed = []
    by_sp = {sp: {"hunts": 0, "linked": 0, "missing": {}} for sp in ID_SPECIES}
    for hunt in hunts:
        sp = hunt["sp"]
        by_sp[sp]["hunts"] += 1
        ids = idaho_ids(codes.get(sp, set()), hunt["area"])
        if ids:
            linked += 1
            by_sp[sp]["linked"] += 1
        else:
            missed.append({"sp": sp, "area": hunt["area"]})
            bag = by_sp[sp]["missing"]
            bag[hunt["area"]] = bag.get(hunt["area"], 0) + 1
    return {
        "areas": sum(row["areas"] for row in species_meta.values()),
        "hunts": len(hunts),
        "linked": linked,
        "unlinked": len(hunts) - linked,
        "species": species_meta,
        "by_species": by_sp,
        "skipped_features": skipped,
    }


def build_nevada(feats, hunts):
    groups = {}
    closures = []
    for feat in feats:
        props = feat.get("properties") or {}
        name = str(props.get("display_name") or "").strip()
        active = str(props.get("is_active")).lower() == "true"
        if not active or not (len(name) == 3 and name.isdigit()):
            closures.append(name)
            continue
        geom = as_geom(feat.get("geometry"))
        if geom is None:
            continue
        groups.setdefault(name, []).append(geom)
    features = []
    for key in sorted(groups):
        geom = unary_union(groups[key])
        if not geom.is_valid:
            geom = make_valid(geom)
        features.append({
            "type": "Feature",
            "properties": {"u": key, "a": round(geom.area, 6)},
            "geometry": mapping(geom),
        })
    path = ROOT / "nevada" / "units.json"
    write_topo(features, path)
    have = set(groups)
    linked = 0
    missing_units = {}
    unparsed = {}
    for hunt in hunts:
        ids = nv_key(hunt["units"])
        if ids is None:
            unparsed[hunt["units"]] = unparsed.get(hunt["units"], 0) + 1
            continue
        gone = [n for n in ids if n not in have]
        if gone:
            missing_units[hunt["units"]] = gone
            continue
        linked += 1
    return {
        "units": len(features),
        "bytes": path.stat().st_size,
        "closures_left_off": sorted(set(closures)),
        "hunts": len(hunts),
        "linked": linked,
        "unlinked": len(hunts) - linked,
        "unparsed": unparsed,
        "missing_unit_ids": missing_units,
    }


def main():
    print("Idaho download", flush=True)
    id_feats = query_geojson(ID_LAYER, "BigGame,HuntArea,Year")
    print("Nevada download", flush=True)
    nv_feats = query_geojson(NV_LAYER, "display_name,is_active,is_open", page=200)
    hunts = load_hunts()
    print("building Idaho", flush=True)
    idaho = build_idaho(id_feats, hunts["id"])
    print("building Nevada", flush=True)
    nevada = build_nevada(nv_feats, hunts["nv"])
    (ROOT / "idaho" / "bounds-sources.json").write_text(json.dumps({
        "retrieved": "2026-11-18",
        "credit": "Controlled hunt area boundaries: Idaho Department of Fish and Game.",
        "url": ID_LAYER,
        "item": "https://www.arcgis.com/home/item.html?id=2384064cb26f451f92cada96ce6dd340",
        "owner": "idahofishandgame",
        "license": "Refer to the boundaries published in the current IDFG regulation booklets before hunting or pursuing game animals. The data in this file is true and accurate to the best of our knowledge but is considered a best representation only. Users must assume responsibility in determining the usability of this data for their purposes. IDFG does not assume liability. No warranty expressed or implied is made by IDFG regarding the utility of the data on any other system, nor shall the act of distribution constitute such warranty.",
        "format": "ArcGIS FeatureServer polygon, downloaded as GeoJSON in WGS84.",
        "note": "Lines are simplified. The layer is IDFG's current controlled hunt areas, drawn from the legal descriptions in the hunting regulations. The year field is 2025 for big game and 2026 for turkey. A trailing star on a hunt area is dropped when that species has no separate polygon without the star. An extra-tag hunt uses the area without the X. A comma list is drawn only when every named area has a polygon. The written boundary is the one that counts.",
        "match": idaho,
    }, indent=1) + "\n")
    (ROOT / "nevada" / "bounds-sources.json").write_text(json.dumps({
        "retrieved": "2026-11-18",
        "credit": "Hunt unit boundaries: Nevada Department of Wildlife.",
        "url": NV_LAYER,
        "item": "https://www.arcgis.com/home/item.html?id=63f5d9da297f4422a646cd8bdf8cd9a5",
        "owner": "NDOW_DEV",
        "license": "This data is considered public information and is available for download without restrictions. No warranty is made by the Nevada Department of Wildlife as to the accuracy, reliability, or completeness of the data provided for individual use or aggregate use with other data.",
        "format": "ArcGIS FeatureServer polygon, downloaded as GeoJSON in WGS84.",
        "note": "Lines are simplified. A unit is kept when is_active is true and display_name is three digits. Named closures are not hunt units. A hunt links only when every unit it names is in this layer. Wording that is only part of a unit is not given the whole unit's shape. The written boundary is the one that counts.",
        "match": nevada,
    }, indent=1) + "\n")
    print(json.dumps({
        "idaho_areas": idaho["areas"],
        "idaho_linked": idaho["linked"],
        "idaho_hunts": idaho["hunts"],
        "nevada_units": nevada["units"],
        "nevada_linked": nevada["linked"],
        "nevada_hunts": nevada["hunts"],
    }))


if __name__ == "__main__":
    main()
