#!/usr/bin/env python3
"""Compute publicly huntable land share for hunt units.

Official inputs only: state hunt-unit polygons and the BLM National Surface
Management Agency layer, plus state layers that say which state land is open.
Exact shares are written to data/public-land/. The browser file find/land-data.js
stores band codes only.

A unit is skipped when the low and high estimates fall in different bands.
The high estimate adds land whose hunting status is not settled by the sources
(wildlife refuges, Bureau of Reclamation, and, in Wyoming and Nevada, undifferentiated
state land). Skipped units are omitted from the browser file.
"""
from __future__ import annotations

import json
import subprocess
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform, unary_union
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "public-land"
CACHE = Path("/tmp/land-cache")
SMA = "https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_with_PriUnk/MapServer"
CPW = "https://services5.arcgis.com/ttNGmDvKQA7oeDQ3/arcgis/rest/services/CPWAdminData/FeatureServer"
WGFD = "https://services6.arcgis.com/cWzdqIyxbijuhPLw/arcgis/rest/services"
IDFG = "https://services.arcgis.com/FjJI5xHF2dUPVrgK/arcgis/rest/services/GameManagementUnits/FeatureServer/0"
NDOW = "https://services.arcgis.com/RyxlXSfFi87rAosq/arcgis/rest/services/NDOW_Hunt_Units/FeatureServer/0"
IDL = "https://services2.arcgis.com/1cvrwLhZRFh3okEF/arcgis/rest/services/IDL_Public_Access/FeatureServer/0"
UTAH = "https://dwrmapserv.utah.gov/dwrarcgis/rest/services/hunt/Boundaries_and_Tables_for_HuntP/FeatureServer/0"

# SMA feature layers in the detailed (minScale 0) group.
SMA_LAYERS = {"BLM": 22, "USFS": 24, "FWS": 25, "BOR": 26, "ST": 29}
TOL = 0.002
TO_EQUAL = Transformer.from_crs(4326, 5070, always_xy=True)


def band_of(p):
    if p is None:
        return None
    if p >= 0.70:
        return "pub"
    if p >= 0.40:
        return "mix"
    return "priv"


def iso_from_ms(ms):
    if not ms:
        return None
    return datetime.fromtimestamp(ms / 1000, timezone.utc).date().isoformat()


def fetch_json(url, cache_name, timeout=180):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / cache_name
    if path.exists() and path.stat().st_size > 80:
        return json.loads(path.read_text())
    req = urllib.request.Request(url, headers={"User-Agent": "rokwilder-public-land-build"})
    last = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
            data = json.loads(raw)
            if isinstance(data, dict) and data.get("error"):
                raise RuntimeError(json.dumps(data["error"])[:400])
            path.write_bytes(raw)
            return data
        except Exception as exc:  # noqa: BLE001 - retry network and parse failures
            last = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"fetch failed {url[:140]}: {last}")


def query_features(base, where, fields, cache, page=1000):
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
        data = fetch_json(f"{base}/query?{qs}", f"{cache}-{offset}.json")
        batch = data.get("features") or []
        feats.extend(batch)
        exceeded = bool(data.get("exceededTransferLimit") or (data.get("properties") or {}).get("exceededTransferLimit"))
        if not batch or (not exceeded and len(batch) < page):
            break
        offset += len(batch)
        if offset > 200000:
            raise RuntimeError("pagination ran too long for " + cache)
    return feats


def service_date(url):
    try:
        meta = fetch_json(url + ("&" if "?" in url else "?") + "f=json" if url.endswith("/0") or url[-1].isdigit() else url + "?f=json", "meta-" + urllib.parse.quote(url, safe="")[-80:] + ".json")
    except Exception:
        return None
    # The URL passed in is the layer URL without query. fetch above is messy if url has no query.
    return meta


def layer_meta(layer_url, cache):
    meta = fetch_json(layer_url + "?f=json", cache)
    edit = (meta.get("editingInfo") or {}).get("lastEditDate")
    return {
        "name": meta.get("name"),
        "description": " ".join((meta.get("description") or "").split())[:500],
        "copyright": meta.get("copyrightText") or "",
        "last_edit": iso_from_ms(edit),
        "url": layer_url,
    }


def as_geom(feat):
    raw = feat.get("geometry")
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
    return geom


def project(geom):
    out = transform(TO_EQUAL.transform, geom)
    if not out.is_valid:
        out = make_valid(out)
    return out


def union_projected(geoms):
    parts = []
    for geom in geoms:
        if geom is None or geom.is_empty:
            continue
        projected = project(geom)
        if projected is not None and not projected.is_empty:
            parts.append(projected)
    if not parts:
        return None
    merged = unary_union(parts)
    if not merged.is_valid:
        merged = make_valid(merged)
    return merged


def measure(unit, known, high):
    area = unit.area
    if area <= 10000:  # under one hectare
        return None
    low = unit.intersection(known).area / area if known is not None else 0.0
    hi = unit.intersection(high).area / area if high is not None else low
    low = max(0.0, min(1.0, low))
    hi = max(low, min(1.0, hi))
    return low, hi, area


def decide(low, hi):
    if abs(hi - low) <= TOL:
        mid = (low + hi) / 2
        return {"status": "computed", "band": band_of(mid), "pct": round(mid, 6), "low": round(low, 6), "high": round(hi, 6)}
    b1, b2 = band_of(low), band_of(hi)
    if b1 == b2:
        return {"status": "computed", "band": b1, "pct": None, "low": round(low, 6), "high": round(hi, 6)}
    return {"status": "skipped", "reason": "uncertain land could move the band", "band": None, "pct": None, "low": round(low, 6), "high": round(hi, 6)}


def load_sma(state):
    """Return (known agency geoms by code, metadata)."""
    out = {}
    metas = []
    for code, layer in SMA_LAYERS.items():
        url = f"{SMA}/{layer}"
        metas.append(layer_meta(url, f"sma-meta-{layer}.json"))
        feats = query_features(url, f"ADMIN_ST='{state}'", "ADMIN_AGENCY_CODE,ADMIN_ST", f"sma-{state}-{code}")
        geoms = [as_geom(f) for f in feats]
        geoms = [g for g in geoms if g is not None]
        out[code] = geoms
        print(f"  SMA {state} {code}: {len(geoms)} feature(s)", flush=True)
    if not out["BLM"] and not out["USFS"]:
        raise RuntimeError(f"no BLM or Forest Service polygons for {state}")
    return out, metas


def area_number(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    if not number.is_integer():
        return None
    return str(int(number))


def index_units(feats, key_fn):
    groups = {}
    for feat in feats:
        props = feat.get("properties") or {}
        key = key_fn(props)
        if not key:
            continue
        geom = as_geom(feat)
        if geom is None:
            continue
        groups.setdefault(key, []).append(geom)
    projected = {}
    for key, geoms in groups.items():
        merged = union_projected(geoms)
        if merged is not None and merged.area > 10000:
            projected[key] = merged
    return projected


def eval_units(units, known, uncertain, prefix=""):
    high_src = [g for g in (known, uncertain) if g is not None]
    high = unary_union(high_src) if high_src else known
    if high is not None and not high.is_valid:
        high = make_valid(high)
    results = {}
    for key, geom in units.items():
        measured = measure(geom, known, high)
        if measured is None:
            results[prefix + key] = {"status": "skipped", "reason": "geometry area too small or invalid", "band": None}
            continue
        low, hi, area = measured
        row = decide(low, hi)
        row["acres"] = round(area / 4046.8564224, 1)
        results[prefix + key] = row
    return results


def union_keys(units, keys):
    parts = []
    missing = []
    for key in keys:
        geom = units.get(key)
        if geom is None:
            missing.append(key)
        else:
            parts.append(geom)
    if missing or not parts:
        return None, missing
    if len(parts) == 1:
        return parts[0], []
    merged = unary_union(parts)
    if not merged.is_valid:
        merged = make_valid(merged)
    return merged, []


def norm_sg(code):
    text = str(code).strip().upper()
    if len(text) < 2 or text[0] not in "SG":
        return None
    digits = text[1:]
    if not digits.isdigit():
        return None
    return text[0] + str(int(digits))


def norm_idfg(value):
    text = str(value).strip().upper()
    import re
    match = re.fullmatch(r"0*(\d+)([A-Z]?)", text)
    if not match:
        return None
    return str(int(match.group(1))) + match.group(2)


def norm_nv_key(text):
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
    return "+".join(f"{n:03d}" for n in sorted(set(nums)))


def dump_requests():
    script = r'''
import {readFileSync} from "node:fs";
import vm from "node:vm";
const root = process.env.ROOT;
const read = f => readFileSync(root + "/" + f, "utf8");
const box = {window:{}};
vm.createContext(box);
vm.runInContext(read("drawodds/lite.js")+"\n"+read("find/labels.js")+"\n"+read("drawodds/oial.js")+"\nglobalThis.D=D; globalThis.FL=FL;", box);
const co = {gmu:new Set(), sheep:new Set(), goat:new Set(), groups:[]};
const sg = code => { const m=String(code).trim().toUpperCase().match(/^([SG])0*(\d+)$/); return m?m[1]+String(+m[2]):null; };
for (const [k,d] of Object.entries(box.D)) {
  const f=box.FL[k];
  const units=(f&&f[2]&&f[2].length)?f[2]:[d[1]];
  const sp=d[0];
  if (sp==="sheep"||sp==="dsheep") {
    const ids=units.map(sg).filter(Boolean).sort();
    if (ids.length) co.groups.push(["sheep", ids]);
    ids.forEach(id=>co.sheep.add(id));
  } else if (sp==="goat") {
    const ids=units.map(sg).filter(Boolean).sort();
    if (ids.length) co.groups.push(["goat", ids]);
    ids.forEach(id=>co.goat.add(id));
  } else {
    const ids=[...new Set(units.map(x=>String(+x)).filter(x=>x!=="NaN"))].sort((a,b)=>+a-+b);
    if (ids.length) co.groups.push(["gmu", ids]);
    ids.forEach(id=>co.gmu.add(id));
  }
}
const uniq = rows => [...new Set(rows.map(r=>r[0]+":"+r[1].join("+")))].map(s=>{const i=s.indexOf(":"); return [s.slice(0,i), s.slice(i+1).split("+")];});
const wyBox={window:{}}; vm.createContext(wyBox);
vm.runInContext(read("wyoming/data.js")+"\nglobalThis.WH=WH;", wyBox);
const wy={};
for (const h of Object.values(wyBox.WH)) {
  (wy[h.sp]||(wy[h.sp]=new Set()));
  wy[h.sp].add(String(h.area));
}
const idBox={window:{}}; vm.createContext(idBox);
vm.runInContext(read("idaho/data.js")+"\nglobalThis.IH=IH;", idBox);
const idAreas=[...new Set(Object.values(idBox.IH).map(h=>h.area))];
const nvBox={window:{}}; vm.createContext(nvBox);
vm.runInContext(read("nevada/data.js")+"\nglobalThis.NH=NH;", nvBox);
const nv=[...new Set(Object.values(nvBox.NH).map(h=>h.units))];
const utBox={window:{}}; vm.createContext(utBox);
vm.runInContext(read("utah/data.js")+"\nglobalThis.UH=UH;", utBox);
const ut=[...new Set(Object.values(utBox.UH).map(h=>h.b.slice().sort((a,b)=>a-b).join("+")))];
const out={
  co:{gmu:[...co.gmu], sheep:[...co.sheep], goat:[...co.goat], groups:uniq(co.groups)},
  wy:Object.fromEntries(Object.entries(wy).map(([k,v])=>[k,[...v]])),
  id:idAreas,
  nv,
  ut
};
process.stdout.write(JSON.stringify(out));
'''
    env = dict(**{k: v for k, v in __import__("os").environ.items()})
    env["ROOT"] = str(ROOT)
    raw = subprocess.check_output(["node", "--input-type=module", "-e", script], env=env, cwd=ROOT)
    return json.loads(raw)


def main():
    t0 = time.time()
    print("reading hunt keys", flush=True)
    requests = dump_requests()
    print("downloading Colorado units", flush=True)
    gmu_feats = query_features(f"{CPW}/6", "1=1", "GMUID", "cpw-gmu")
    sheep_feats = query_features(f"{CPW}/7", "HUNTING='YES'", "BSGMU,HUNTING", "cpw-sheep")
    goat_feats = query_features(f"{CPW}/8", "HUNTING='YES'", "MGGMU,HUNTING", "cpw-goat")
    prop_feats = query_features(
        f"{CPW}/5",
        "PropType IN ('SWA','STL','Hunting Access (Non-STL)')",
        "PropType,PropName",
        "cpw-open",
    )
    cpw_meta = [layer_meta(f"{CPW}/{i}", f"cpw-meta-{i}.json") for i in (5, 6, 7, 8)]
    print(f"  GMU {len(gmu_feats)} sheep {len(sheep_feats)} goat {len(goat_feats)} open properties {len(prop_feats)}", flush=True)

    def finish_state(code, results, notes, sources):
        return {"results": results, "notes": notes, "sources": sources}

    states = {}

    print("Colorado surface management", flush=True)
    sma_co, sma_meta = load_sma("CO")
    known_co = union_projected(sma_co["BLM"] + sma_co["USFS"] + [as_geom(f) for f in prop_feats])
    unc_co = union_projected(sma_co["FWS"] + sma_co["BOR"])
    gmu_units = index_units(gmu_feats, lambda p: str(int(p["GMUID"])) if p.get("GMUID") is not None else None)
    sheep_units = index_units(sheep_feats, lambda p: norm_sg(p.get("BSGMU") or ""))
    goat_units = index_units(goat_feats, lambda p: norm_sg(p.get("MGGMU") or ""))
    co_results = {}
    co_results.update(eval_units(gmu_units, known_co, unc_co, "gmu:"))
    co_results.update(eval_units(sheep_units, known_co, unc_co, "sheep:"))
    co_results.update(eval_units(goat_units, known_co, unc_co, "goat:"))
    catalogs = {"gmu": gmu_units, "sheep": sheep_units, "goat": goat_units}
    for kind, ids in requests["co"]["groups"]:
        key = f"{kind}:{ '+'.join(ids) }"
        if len(ids) == 1:
            continue
        merged, missing = union_keys(catalogs[kind], ids)
        if merged is None:
            co_results[key] = {"status": "skipped", "reason": "missing unit polygon: " + ",".join(missing), "band": None}
            continue
        measured = measure(merged, known_co, unc_co)
        if measured is None:
            co_results[key] = {"status": "skipped", "reason": "group geometry invalid", "band": None}
            continue
        low, hi, area = measured
        row = decide(low, hi)
        row["acres"] = round(area / 4046.8564224, 1)
        co_results[key] = row
    states["co"] = finish_state("co", co_results, {
        "counted": "BLM, USFS, and CPW public-access properties of type SWA, STL, and Hunting Access (Non-STL)",
        "not_counted": "NPS, DOD, BIA/tribal, local, private, undifferentiated SMA state land (Colorado State Land Board land is not open unless it is in the CPW public-access layer)",
        "uncertain": "FWS and BOR. A unit is skipped when adding that land would change the band.",
        "sheep_goat": "Only CPW sheep and goat units with HUNTING = YES",
    }, cpw_meta + sma_meta)

    def hunt_species(state_code, species_layers):
        print(state_code, "surface management", flush=True)
        sma, meta = load_sma(state_code)
        known = union_projected(sma["BLM"] + sma["USFS"])
        return sma, meta, known

    print("Wyoming", flush=True)
    sma_wy, sma_meta_wy = load_sma("WY")
    known_wy = union_projected(sma_wy["BLM"] + sma_wy["USFS"])
    unc_wy = union_projected(sma_wy["FWS"] + sma_wy["BOR"] + sma_wy["ST"])
    wy_services = {
        "elk": "ElkHuntAreas",
        "deer": "2026_Deer_Hunt_Areas",
        "pronghorn": "AntelopeHuntAreas",
        "moose": "2026_Moose_Hunt_Areas",
        "sheep": "BighornSheepHuntAreas",
        "goat": "RockyMountainGoatHuntAreas",
        "bison": "BisonHuntAreas",
    }
    wy_results = {}
    wy_meta = []
    for sp, service in wy_services.items():
        url = f"{WGFD}/{service}/FeatureServer/0"
        wy_meta.append(layer_meta(url, f"wy-meta-{sp}.json"))
        feats = query_features(url, "1=1", "HUNTAREA", f"wy-{sp}")
        units = index_units(feats, lambda p: area_number(p.get("HUNTAREA")))
        # index_units key shouldn't include species; prefix added below
        part = eval_units(units, known_wy, unc_wy, f"{sp}:")
        wy_results.update(part)
        wanted = requests["wy"].get(sp, [])
        have = {k.split(":", 1)[1] for k in part}
        for area in wanted:
            if not str(area).isdigit():
                wy_results[f"{sp}:{area}"] = {"status": "skipped", "reason": "not a single numbered hunt area", "band": None}
            elif str(int(area)) not in have and f"{sp}:{int(area)}" not in part:
                wy_results[f"{sp}:{int(area)}"] = {"status": "skipped", "reason": "hunt area number is not in the WGFD layer", "band": None}
        print(f"  {sp} polygons {len(units)}", flush=True)
    states["wy"] = finish_state("wy", wy_results, {
        "counted": "BLM and USFS",
        "uncertain": "FWS, BOR, and SMA state land. Wyoming trust land is open to hunting except cultivated cropland and only where legally accessible (OSLI Chapter 13). This build does not have the cropland or access polygons, so state land can only confirm a band, not raise it.",
        "layers": wy_services,
    }, wy_meta + sma_meta_wy)

    print("Idaho", flush=True)
    sma_id, sma_meta_id = load_sma("ID")
    idl_feats = query_features(IDL, "Access='Yes'", "Access", "idl-yes")
    idl_meta = layer_meta(IDL, "idl-meta.json")
    known_id = union_projected(sma_id["BLM"] + sma_id["USFS"] + [as_geom(f) for f in idl_feats])
    unc_id = union_projected(sma_id["FWS"] + sma_id["BOR"] + sma_id["ST"])
    idfg_meta = layer_meta(IDFG, "idfg-meta.json")
    id_feats = query_features(IDFG, "1=1", "NAME", "idfg-gmu")
    id_units = index_units(id_feats, lambda p: norm_idfg(p.get("NAME") or ""))
    id_results = eval_units(id_units, known_id, unc_id, "")
    for area in requests["id"]:
        key = norm_idfg(area)
        if key is None:
            id_results["partial:" + str(area)] = {"status": "skipped", "reason": "IDFG game-management-unit layer has no polygon for this hunt-area subunit", "band": None}
        elif key not in id_units:
            id_results[key] = {"status": "skipped", "reason": "area name is not in the IDFG GMU layer", "band": None}
    print(f"  GMUs {len(id_units)} IDL yes {len(idl_feats)}", flush=True)
    states["id"] = finish_state("id", id_results, {
        "counted": "BLM, USFS, and IDL Public Access features with Access = Yes",
        "uncertain": "FWS, BOR, and SMA state land that may sit outside the IDL yes layer. A band is kept only when that extra land would not change it.",
        "skipped_subunits": "Hunt areas such as 36A-1 are not in the GMU polygon layer",
    }, [idfg_meta, idl_meta] + sma_meta_id)

    print("Nevada", flush=True)
    sma_nv, sma_meta_nv = load_sma("NV")
    known_nv = union_projected(sma_nv["BLM"] + sma_nv["USFS"])
    unc_nv = union_projected(sma_nv["FWS"] + sma_nv["BOR"] + sma_nv["ST"])
    ndow_meta = layer_meta(NDOW, "ndow-meta.json")
    nv_feats = query_features(NDOW, "is_active='true'", "display_name,is_active,is_open", "ndow-units")
    nv_units = index_units(nv_feats, lambda p: p.get("display_name") if isinstance(p.get("display_name"), str) and len(p["display_name"]) == 3 and p["display_name"].isdigit() else None)
    nv_results = {}
    for text in requests["nv"]:
        key = norm_nv_key(text)
        if key is None:
            nv_results["bad:" + str(text)] = {"status": "skipped", "reason": "unit list could not be read", "band": None}
            continue
        ids = key.split("+")
        merged, missing = union_keys(nv_units, ids)
        if merged is None:
            nv_results[key] = {"status": "skipped", "reason": "missing NDOW unit polygon: " + ",".join(missing), "band": None}
            continue
        measured = measure(merged, known_nv, unc_nv)
        if measured is None:
            nv_results[key] = {"status": "skipped", "reason": "geometry invalid", "band": None}
            continue
        low, hi, area = measured
        row = decide(low, hi)
        row["acres"] = round(area / 4046.8564224, 1)
        nv_results[key] = row
    print(f"  numeric units {len(nv_units)} hunt strings {len(requests['nv'])}", flush=True)
    states["nv"] = finish_state("nv", nv_results, {
        "counted": "BLM and USFS",
        "uncertain": "FWS, BOR, and SMA state land. Nevada has little state land; a band is kept only when that land would not change it.",
        "units": "NDOW hunt units with a three-digit display name and is_active true. Named closures (parks, ranges) are not units.",
    }, [ndow_meta] + sma_meta_nv)

    print("Utah", flush=True)
    sma_ut, sma_meta_ut = load_sma("UT")
    known_ut = union_projected(sma_ut["BLM"] + sma_ut["USFS"])
    unc_ut = union_projected(sma_ut["FWS"] + sma_ut["BOR"])
    ut_meta = layer_meta(UTAH, "utah-meta.json")
    ut_feats = query_features(UTAH, "1=1", "BoundaryID,Boundary_Name,Status", "utah-bounds", page=20)
    ut_units = index_units(ut_feats, lambda p: str(int(p["BoundaryID"])) if p.get("BoundaryID") is not None and str(p.get("Status") or "Active").strip().lower() in ("active", "") else None)
    ut_results = {}
    for key in requests["ut"]:
        ids = [part for part in key.split("+") if part]
        merged, missing = union_keys(ut_units, ids)
        if merged is None:
            ut_results[key] = {"status": "skipped", "reason": "missing DWR hunt boundary: " + ",".join(missing), "band": None}
            continue
        measured = measure(merged, known_ut, unc_ut)
        if measured is None:
            ut_results[key] = {"status": "skipped", "reason": "geometry invalid", "band": None}
            continue
        low, hi, area = measured
        row = decide(low, hi)
        row["acres"] = round(area / 4046.8564224, 1)
        ut_results[key] = row
    print(f"  boundaries {len(ut_units)} hunt keys {len(requests['ut'])}", flush=True)
    states["ut"] = finish_state("ut", ut_results, {
        "counted": "BLM and USFS inside the DWR hunt boundary",
        "not_counted": "SITLA / SMA state land is not counted. Utah trust land is not public hunting land unless a separate access program covers it, and this build does not have that enrollment layer. NPS, DOD, BIA, local, and private are not counted.",
        "uncertain": "FWS and BOR. A boundary is skipped when adding that land would change the band.",
        "wma": "UDWR wildlife management areas were not unioned as their own layer. They are not subtracted, and they are not added beyond whatever BLM or Forest Service land they do not overlap.",
    }, [ut_meta] + sma_meta_ut)

    public = {st: {} for st in states}
    exact = {st: {} for st in states}
    coverage = {}
    for st, blob in states.items():
        reasons = {}
        computed = 0
        for key, row in blob["results"].items():
            exact[st][key] = row
            if row.get("status") == "computed" and row.get("band"):
                public[st][key] = row["band"]
                computed += 1
            else:
                reason = row.get("reason") or "no band"
                reasons[reason] = reasons.get(reason, 0) + 1
        coverage[st] = {
            "computed": computed,
            "skipped": sum(reasons.values()),
            "skip_reasons": reasons,
        }
        print(st, coverage[st], flush=True)

    OUT.mkdir(parents=True, exist_ok=True)
    provenance = {
        "retrieved": datetime.now(timezone.utc).date().isoformat(),
        "method": "Unit polygons and surface-management polygons are projected to EPSG:5070 (NAD83 / Conus Albers). The share is the intersection area divided by the unit area. Counted land is BLM and U.S. Forest Service, plus the state-open layers named below. A second, higher share adds uncertain land. If the two shares fall in different bands, the unit is omitted. Bands are 70 percent or more (mostly public), 40 up to 70 percent (mixed), and under 40 percent (mostly private). Gap of 0.2 percentage points or less is treated as the same share.",
        "bands": {"pub": ">= 0.70", "mix": ">= 0.40 and < 0.70", "priv": "< 0.40"},
        "tolerance": TOL,
        "landlocked": {
            "status": "skipped",
            "reason": "No official layer used here marks public parcels that have no legal public-road access. A road-buffer estimate would not be a reliable access determination, so landlocked parcels are not flagged."
        },
        "policy": [
            {"state": "CO", "rule": "State Land Board land is not counted unless the parcel is in CPW's public-access property layer (STL, SWA, or Hunting Access).", "url": "https://cpw.state.co.us/maps-and-gis"},
            {"state": "WY", "rule": "State trust land is open to hunting, fishing, and recreation except cultivated cropland, and only where legally accessible.", "url": "https://lands.wyo.gov/resources/frequently-asked-questions"},
            {"state": "ID", "rule": "Only IDL features marked Access = Yes are counted as open state land.", "url": IDL},
            {"state": "UT", "rule": "Undifferentiated state trust land is not counted.", "url": "https://trustlands.utah.gov/"},
            {"state": "NV", "rule": "No state-trust hunting layer was joined. State land stays in the uncertain share.", "url": NDOW}
        ],
        "sources": {st: blob["sources"] for st, blob in states.items()},
        "notes": {st: blob["notes"] for st, blob in states.items()},
        "sma": {"service": SMA, "layers": SMA_LAYERS},
        "keys_are_traceable": "Every browser band key is a key in exact.json with status computed."
    }
    (OUT / "exact.json").write_text(json.dumps(exact, indent=1, sort_keys=True) + "\n")
    (OUT / "provenance.json").write_text(json.dumps(provenance, indent=1) + "\n")
    (OUT / "coverage.json").write_text(json.dumps(coverage, indent=1, sort_keys=True) + "\n")
    body = json.dumps(public, separators=(",", ":"), sort_keys=True)
    (ROOT / "find" / "land-data.js").write_text(
        "// Generated by scripts/build-public-land.py. Band codes only. Exact shares are in data/public-land/exact.json.\n"
        "window.RW_LAND_DATA=" + body + ";\n"
    )
    print(f"done in {time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
