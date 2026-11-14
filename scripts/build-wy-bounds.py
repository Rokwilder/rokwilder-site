#!/usr/bin/env python3
"""Build simplified Wyoming hunt-area topologies from WGFD Feature Services.

Official polygons only. A hunt area number that is not in the layer is omitted.
General and region licenses are not given a shape here.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.ops import unary_union
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "wyoming"
BASE = "https://services6.arcgis.com/cWzdqIyxbijuhPLw/arcgis/rest/services"
UA = "rokwilder-wy-bounds"

# Same services the public-land build already cites, plus the regulation map PDFs.
LAYERS = {
    "elk": {
        "service": "ElkHuntAreas",
        "gis_year": "2025",
        "pdf": "https://wgfd.wyo.gov/media/33717/download?inline",
        "pdf_label": "WGFD elk hunt area map",
    },
    "deer": {
        "service": "2026_Deer_Hunt_Areas",
        "gis_year": "2026",
        "pdf": "https://wgfd.wyo.gov/media/33716/download?inline",
        "pdf_label": "WGFD deer hunt area map",
    },
    "pronghorn": {
        "service": "AntelopeHuntAreas",
        "gis_year": "2025",
        "pdf": "https://wgfd.wyo.gov/media/33715/download?inline",
        "pdf_label": "WGFD antelope hunt area map",
    },
    "moose": {
        "service": "2026_Moose_Hunt_Areas",
        "gis_year": "2023",
        "pdf": "https://wgfd.wyo.gov/media/33718/download?inline",
        "pdf_label": "WGFD moose hunt area map",
    },
    "sheep": {
        "service": "BighornSheepHuntAreas",
        "gis_year": "2023",
        "pdf": "https://wgfd.wyo.gov/media/33719/download?inline",
        "pdf_label": "WGFD bighorn sheep hunt area map",
    },
    "goat": {
        "service": "RockyMountainGoatHuntAreas",
        "gis_year": "2021",
        "pdf": "https://wgfd.wyo.gov/media/33720/download?inline",
        "pdf_label": "WGFD mountain goat hunt area map",
    },
    "bison": {
        "service": "BisonHuntAreas",
        "gis_year": "2016",
        "pdf": "https://wgfd.wyo.gov/media/33721/download?inline",
        "pdf_label": "WGFD wild bison hunt area map",
    },
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode())


def query(service):
    layer = f"{BASE}/{service}/FeatureServer/0"
    feats = []
    offset = 0
    while True:
        qs = urllib.parse.urlencode({
            "where": "1=1",
            "outFields": "HUNTAREA",
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "geojson",
            "resultOffset": str(offset),
            "resultRecordCount": "2000",
        })
        data = fetch(f"{layer}/query?{qs}")
        batch = data.get("features") or []
        feats.extend(batch)
        exceeded = bool(data.get("exceededTransferLimit") or (data.get("properties") or {}).get("exceededTransferLimit"))
        if not batch or (not exceeded and len(batch) < 2000):
            break
        offset += len(batch)
    return layer, feats


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


def main():
    sources = {"retrieved": "2026-11-14", "species": {}}
    for sp, spec in LAYERS.items():
        layer, feats = query(spec["service"])
        groups = {}
        skipped = []
        for feat in feats:
            key = area_number((feat.get("properties") or {}).get("HUNTAREA"))
            geom = as_geom(feat)
            if not key or geom is None:
                skipped.append((feat.get("properties") or {}).get("HUNTAREA"))
                continue
            groups.setdefault(key, []).append(geom)
        features = []
        for key, parts in sorted(groups.items(), key=lambda kv: int(kv[0])):
            geom = unary_union(parts)
            if not geom.is_valid:
                geom = make_valid(geom)
            features.append({"type": "Feature", "properties": {"u": key}, "geometry": mapping(geom)})
        fc = {"type": "FeatureCollection", "features": features}
        raw_path = Path("/tmp") / f"wy-{sp}.geojson"
        raw_path.write_text(json.dumps(fc))
        sources["species"][sp] = {
            "service": spec["service"],
            "url": layer,
            "gis_described_as": spec["gis_year"],
            "pdf": spec["pdf"],
            "pdf_label": spec["pdf_label"],
            "areas": len(features),
            "features_read": len(feats),
            "features_without_area_number": len(skipped),
        }
        print(sp, len(feats), "features", len(features), "areas", "skipped", len(skipped))
    (OUT / "bounds-sources.json").write_text(json.dumps(sources, indent=1) + "\n")
    print("wrote", OUT / "bounds-sources.json")


if __name__ == "__main__":
    main()
