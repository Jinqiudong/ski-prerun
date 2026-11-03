"""Bake a resort into one JSON the game loads: heightmap, runs, lifts and a tree mask.

Inputs: an Overpass JSON export (pistes + aerialways), AWS Terrain Tiles (terrarium, z14) for the area, and
optionally an Overpass export of points of interest (restaurants, cafes) used as route destinations.
Coordinates are local meters: x east, z south, origin at the bbox center; heights in meters.
"""
import base64, json, math, sys
from array import array
from pathlib import Path
from PIL import Image

def packbits(bits):
    """Eight flags to a byte, first flag in the high bit (like numpy.packbits)."""
    out = bytearray((len(bits) + 7) // 8)
    for k, v in enumerate(bits):
        if v: out[k >> 3] |= 0x80 >> (k & 7)
    return bytes(out)

osm_path, tiles_dir, out_path = sys.argv[1:4]
poi_path = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "-" else None
forest_path = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] != "-" else None  # Overpass export of natural=wood / landuse=forest
# The resort: an entry of tools/resorts.json (name, bbox S,W,N,E, base villages). Copper when not given.
CFG = json.load(open(sys.argv[6])) if len(sys.argv) > 6 else {
    "name": "Copper Mountain", "bbox": [39.452, -106.197, 39.503, -106.124],
    "villages": [["Center Village", "American Eagle"], ["Union Creek", "Union Creek"], ["East Village", "Super Bee"]], "grid": [448, 400]}
Z = 14
S, W, N, E = CFG["bbox"]
LAT0, LON0 = (S + N) / 2, (W + E) / 2
MX = 111320 * math.cos(math.radians(LAT0))
MZ = 110574
# Heightmap grid: ~14 m cells.
GW, GH = CFG.get("grid") or (min(640, round((E - W) * MX / 14)), min(640, round((N - S) * MZ / 14)))

def to_local(lat, lon):
    return (lon - LON0) * MX, -(lat - LAT0) * MZ

x0, z0 = to_local(N, W); x1, z1 = to_local(S, E)

def tile_xy(lat, lon):
    n = 2 ** Z
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n

# Mosaic the terrarium tiles.
files = sorted(Path(tiles_dir).glob("*.png"))
xs = sorted({int(f.stem.split("_")[0]) for f in files}); ys = sorted({int(f.stem.split("_")[1]) for f in files})
# Plain Python (no numpy): each tile's elevations as a flat list, 256 x 256, row by row.
mosaic = {}
for f in files:
    tx, ty = map(int, f.stem.split("_"))
    raw = Image.open(f).convert("RGB").tobytes()
    mosaic[(tx - xs[0], ty - ys[0])] = [raw[k] * 256 + raw[k + 1] + raw[k + 2] / 256 - 32768 for k in range(0, len(raw), 3)]
def mos(i, j):  # mosaic row i, column j
    return mosaic[(j // 256, i // 256)][(i % 256) * 256 + j % 256]

def elevation(lat, lon):
    tx, ty = tile_xy(lat, lon)
    u, v = (tx - xs[0]) * 256 - 0.5, (ty - ys[0]) * 256 - 0.5
    i, j = int(v), int(u); fv, fu = v - i, u - j
    return mos(i, j) * (1 - fu) * (1 - fv) + mos(i, j + 1) * fu * (1 - fv) + mos(i + 1, j) * (1 - fu) * fv + mos(i + 1, j + 1) * fu * fv

heights = [[0.0] * GW for _ in range(GH)]
for r in range(GH):
    lat = N - (N - S) * r / (GH - 1)
    for c in range(GW):
        heights[r][c] = elevation(lat, W + (E - W) * c / (GW - 1))
hmin = min(min(row) for row in heights)
hmax = max(max(row) for row in heights)
q = array("H", (round((h - hmin) * 10) for row in heights for h in row))  # decimeters above the lowest point
if sys.byteorder != "little": q.byteswap()

def height_at(x, z):
    c = (x - x0) / (x1 - x0) * (GW - 1); r = (z - z0) / (z1 - z0) * (GH - 1)
    c = min(max(c, 0), GW - 1.001); r = min(max(r, 0), GH - 1.001)
    i, j = int(r), int(c); fr, fc = r - i, c - j
    a, b = heights[i], heights[i + 1]
    return a[j] * (1 - fc) * (1 - fr) + a[j + 1] * fc * (1 - fr) + b[j] * (1 - fc) * fr + b[j + 1] * fc * fr

def resample(points, step):
    """Even spacing along a polyline, so ribbons and steering targets are smooth."""
    out = [points[0]]
    carry = 0.0
    for (ax, az), (bx, bz) in zip(points, points[1:]):
        seg = math.hypot(bx - ax, bz - az); d = step - carry
        while d <= seg:
            t = d / seg; out.append((ax + (bx - ax) * t, az + (bz - az) * t)); d += step
        carry = seg - (d - step)
    if math.hypot(out[-1][0] - points[-1][0], out[-1][1] - points[-1][1]) > step * 0.3:
        out.append(points[-1])
    return out

elements = json.load(open(osm_path))["elements"]
LEVELS = {"novice": "easy", "easy": "easy", "intermediate": "intermediate", "advanced": "advanced",
          "expert": "expert", "extreme": "expert", "freeride": "expert"}
runs, lifts = [], []
for e in elements:
    tags = e.get("tags", {})
    pts = [to_local(g["lat"], g["lon"]) for g in e.get("geometry", [])]
    if len(pts) < 2 or not all(x0 <= x <= x1 and z0 <= z <= z1 for x, z in pts):
        continue  # outside the resort area (the Overpass box also catches the neighbouring resort)
    if tags.get("piste:type") == "downhill":
        area = pts[0] == pts[-1] or tags.get("area") == "yes"
        pts = resample(pts, 12)
        if not area and height_at(*pts[0]) < height_at(*pts[-1]):
            pts.reverse()  # ski it downhill
        outline = None
        if area:
            # Glades and bowls are mapped as outlines: draw the outline, ski from its highest to its lowest point.
            outline = pts
            top = max(pts, key=lambda p: height_at(*p)); low = min(pts, key=lambda p: height_at(*p))
            pts = resample([top, low], 12)
        drop = height_at(*pts[0]) - min(height_at(*p) for p in pts)
        length = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))
        run = {"id": e["id"], "name": tags.get("piste:name") or tags.get("name") or "",
               "level": LEVELS.get(tags.get("piste:difficulty"), "intermediate"),
               "grooming": tags.get("piste:grooming", ""), "area": area,
               "length": round(length), "drop": round(drop),
               "pts": [[round(x, 1), round(z, 1)] for x, z in pts]}
        if outline:
            run["outline"] = [[round(x, 1), round(z, 1)] for x, z in outline]
        runs.append(run)
    elif "aerialway" in tags and tags["aerialway"] not in {"zip_line", "goods"}:
        if height_at(*pts[0]) > height_at(*pts[-1]):
            pts.reverse()  # ride it uphill
        lifts.append({"id": e["id"], "name": tags.get("name") or "Lift", "kind": tags["aerialway"],
                      "pts": [[round(x, 1), round(z, 1)] for x, z in pts],
                      "rise": round(height_at(*pts[-1]) - height_at(*pts[0]))})

# Tree mask: where the forest is (mapped woods when given, else everything below treeline),
# minus runs and lifts.
MW, MH = GW * 2, GH * 2
mask = bytearray(b"\x01" * (MW * MH))  # row by row, 1 = trees
if forest_path:
    from PIL import ImageDraw
    img = Image.new("1", (MW, MH), 0)
    draw = ImageDraw.Draw(img)
    to_px = lambda x, z: ((x - x0) / (x1 - x0) * (MW - 1), (z - z0) / (z1 - z0) * (MH - 1))
    for e in json.load(open(forest_path))["elements"]:
        rings = [e["geometry"]] if e["type"] == "way" else [m["geometry"] for m in e.get("members", []) if m.get("role") == "outer" and m.get("geometry")]
        for ring in rings:
            if len(ring) >= 3:
                draw.polygon([to_px(*to_local(g["lat"], g["lon"])) for g in ring], fill=1)
    mask = bytearray(1 if v else 0 for v in img.getdata())
def clear(x, z, radius):
    c = (x - x0) / (x1 - x0) * (MW - 1); r = (z - z0) / (z1 - z0) * (MH - 1)
    k = radius / ((x1 - x0) / (MW - 1))
    r0, r1 = int(max(r - k, 0)), int(min(r + k + 1, MH)); c0, c1 = int(max(c - k, 0)), int(min(c + k + 1, MW))
    for rr in range(r0, r1):
        mask[rr * MW + c0:rr * MW + c1] = bytes(max(0, c1 - c0))
for run in runs:
    for x, z in run.get("outline") or run["pts"]:
        clear(x, z, 22 if not run["area"] else 30)
for lift in lifts:
    for x, z in resample([tuple(p) for p in lift["pts"]], 15):
        clear(x, z, 12)
for r in range(MH):
    for c in range(MW):
        if mask[r * MW + c]:
            x = x0 + (x1 - x0) * c / (MW - 1); z = z0 + (z1 - z0) * r / (MH - 1)
            if height_at(x, z) > CFG.get("treeline", 3560):
                mask[r * MW + c] = 0  # above treeline

# Destinations: base villages (named after the lift bases they serve) and named on-mountain restaurants.
places = []
for name, anchor in CFG.get("villages") or []:
    lift = next((l for l in lifts if l["name"] == anchor), None)
    if lift:
        places.append({"name": name, "kind": "village", "x": lift["pts"][0][0], "z": lift["pts"][0][1]})
    else:
        print(f"village {name}: no lift named {anchor}")
if not CFG.get("villages"):
    # Not listed: the low lift stations are the bases. Group lift bottoms within 350 m; a group in the lowest
    # third of the bottoms' height range is a base, named after its longest lift (fix names in resorts.json).
    big = [l for l in lifts if l["kind"] not in {"magic_carpet", "rope_tow", "platter", "t-bar", "j-bar", "drag_lift"}] or lifts
    bottoms = sorted(big, key=lambda l: height_at(*l["pts"][0]))
    lo_h, hi_h = height_at(*bottoms[0]["pts"][0]), height_at(*bottoms[-1]["pts"][0])
    groups = []
    for l in bottoms:
        x, z = l["pts"][0]
        g = next((g for g in groups if math.hypot(g["x"] - x, g["z"] - z) < 350), None)
        if g: g["lifts"].append(l)
        elif height_at(x, z) <= lo_h + (hi_h - lo_h) / 3: groups.append({"x": x, "z": z, "lifts": [l]})
    for g in groups:
        main = max(g["lifts"], key=lambda l: l["rise"])
        places.append({"name": f"{main['name']} Base", "kind": "village", "x": g["x"], "z": g["z"]})
        print(f"base: {main['name']} Base  ({', '.join(l['name'] for l in g['lifts'])})")
if poi_path:
    for e in json.load(open(poi_path))["elements"]:
        tags = e.get("tags", {}); c = e.get("center") or e
        if not tags.get("name") or (tags.get("amenity") or "").split(";")[0].strip() not in {"restaurant", "cafe", "bar", "fast_food"}:
            continue
        x, z = to_local(c["lat"], c["lon"])
        if x0 <= x <= x1 and z0 <= z <= z1:
            if tags["name"] in {v[0] for v in CFG.get("villages") or []}:
                if not any(p["name"] == tags["name"] for p in places):
                    places.append({"name": tags["name"], "kind": "village", "x": round(x, 1), "z": round(z, 1)})
                continue
            places.append({"name": tags["name"], "kind": "food", "x": round(x, 1), "z": round(z, 1)})

out = {
    "name": CFG["name"], "attribution": "Runs and lifts © OpenStreetMap contributors (ODbL). Terrain: AWS Terrain Tiles (Mapzen/USGS).",
    "origin": {"lat": LAT0, "lon": LON0}, "bounds": [round(x0, 1), round(z0, 1), round(x1, 1), round(z1, 1)],
    "grid": [GW, GH], "hmin": round(hmin, 1),
    "heights": base64.b64encode(q.tobytes()).decode(),
    "trees": {"grid": [MW, MH], "bits": base64.b64encode(packbits(mask)).decode()},
    "runs": sorted(runs, key=lambda r: r["name"]), "lifts": sorted(lifts, key=lambda l: l["name"]), "places": places,
}
Path(out_path).write_text(json.dumps(out, separators=(",", ":")))
print(f"{len(runs)} runs, {len(lifts)} lifts, elevation {hmin:.0f}-{hmax:.0f} m, {Path(out_path).stat().st_size // 1024} KB, trees {sum(mask)}")
