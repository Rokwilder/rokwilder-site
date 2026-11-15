#!/usr/bin/env python3
"""Simplified 2026-2027 Montana hunting district topologies from FWP.

Official polygons only. A district number that is not in the layer is omitted.
Reservation and park polygons without a district number are omitted.
The written legal description is the boundary that counts.
"""
from __future__ import annotations

import json
from pathlib import Path

from shapely.geometry import mapping, shape
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
GIS = Path("/tmp/mt-src/gis")
OUT = ROOT / "montana"
NODE = "/tmp/mt-tools/node_modules/topojson-server/dist/topojson-server.js"
LAYERS = {
    "deer": "deerelk",
    "antelope": "antelope",
    "moose": "moose",
    "sheep": "sheep",
    "goat": "goat",
    "bison": "bison",
}
# Elk uses the deer and elk layer. Bear permits are not on that layer as their own polygons.
SERVICE = "https://services3.arcgis.com/Cdxz8r11hT0MGzg1/arcgis/rest/services/{name}/FeatureServer/0"
NAMES = {
    "deerelk": "ADMBND_HD_DEERELKLION",
    "antelope": "ADMBND_HD_ANTELOPE",
    "moose": "ADMBND_HD_MOOSE",
    "sheep": "ADMBND_HD_SHEEP",
    "goat": "ADMBND_HD_GOAT",
    "bison": "ADMBND_HD_BISON",
}


def features_for(path):
    raw = json.loads(path.read_text())
    groups = {}
    for feat in raw.get("features") or []:
        dist = str((feat.get("properties") or {}).get("DISTRICT") or "").strip()
        if not dist.isdigit():
            continue
        geom = feat.get("geometry")
        if not geom:
            continue
        try:
            g = shape(geom)
        except Exception:
            continue
        if g.is_empty:
            continue
        if not g.is_valid:
            g = make_valid(g)
        g = g.simplify(0.002, preserve_topology=True)
        groups.setdefault(str(int(dist)), []).append(g)
    out = []
    for key in sorted(groups, key=int):
        geom = groups[key][0]
        if len(groups[key]) > 1:
            from shapely.ops import unary_union
            geom = unary_union(groups[key])
        out.append({"type": "Feature", "properties": {"u": key}, "geometry": mapping(geom)})
    return out


def main():
    import subprocess
    import tempfile
    sources = {
        "retrieved": "2026-11-15",
        "credit": "Hunting district boundaries: Montana Fish, Wildlife and Parks.",
        "legal": "https://fwp.mt.gov/binaries/content/assets/fwp/hunt/regulations/2026/2026-2027-legal-descriptions-finalfor-web.pdf",
        "note": "Boundaries adopted for the 2026 and 2027 seasons. Lines are simplified. The written legal description is the one that counts.",
        "species": {},
    }
    OUT.mkdir(exist_ok=True)
    for sp, layer in LAYERS.items():
        feats = features_for(GIS / f"{layer}.geojson")
        fc = {"type": "FeatureCollection", "features": feats}
        with tempfile.NamedTemporaryFile("w", suffix=".geojson", delete=False) as tmp:
            json.dump(fc, tmp)
            tmp_path = tmp.name
        node = f"""
import {{readFileSync, writeFileSync}} from 'node:fs';
import {{topology}} from '{NODE}';
const fc = JSON.parse(readFileSync({json.dumps(tmp_path)}, 'utf8'));
const topo = topology({{area: fc}});
writeFileSync({json.dumps(str(OUT / (sp + '.json')))}, JSON.stringify(topo));
"""
        subprocess.check_call(["node", "--input-type=module", "-e", node])
        sources["species"][sp] = {
            "service": NAMES[layer],
            "url": SERVICE.format(name=NAMES[layer]),
            "districts": len(feats),
            "file": sp + ".json",
        }
        print(sp, len(feats), (OUT / (sp + ".json")).stat().st_size)
    # Elk shares the deer and elk hunting district layer.
    deer = json.loads((OUT / "deer.json").read_text())
    (OUT / "elk.json").write_text(json.dumps(deer))
    sources["species"]["elk"] = dict(sources["species"]["deer"])
    sources["species"]["elk"]["file"] = "elk.json"
    sources["species"]["elk"]["note"] = "Same 2026-2027 deer and elk hunting district layer."
    (OUT / "bounds-sources.json").write_text(json.dumps(sources, indent=1) + "\n")


if __name__ == "__main__":
    main()
