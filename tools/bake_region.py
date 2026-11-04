"""Bake the conquest map: the real terrain of central Colorado, Denver to Aspen and Steamboat, with the
big roads, rivers and reservoirs, the towns, and every resort's runs and lifts, in one small file.

usage: python tools/bake_region.py
writes data/region.png (heights, 16 bit split over red and green, half-meters) and data/region.json.
Coordinates in region.json are km: x east, z south of (LAT0, LON0), at KX / KZ km per degree, the same
flat projection as collection.js. Terrain: AWS Terrain Tiles (terrarium, z10). Roads, rivers, water,
runs and lifts: OpenStreetMap contributors (ODbL).
"""
import io, json, math, subprocess
from PIL import Image

LAT0, LON0, KX, KZ = 39.75, -105.95, 85.3, 111
S, N, W, E = 38.98, 40.72, -107.4, -104.78
GW = 560  # grid columns; rows follow the aspect
GH = round(GW * (N - S) * KZ / ((E - W) * KX))
Z = 10
km = lambda lat, lon: [round((lon - LON0) * KX, 2), round(-(lat - LAT0) * KZ, 2)]

cache = {}
def tile_px(tx, ty):
    if (tx, ty) not in cache:
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png"
        raw = subprocess.run(["curl", "-s", "-f", "-m", "60", "-A", "ski-prerun", url], capture_output=True, check=True).stdout
        b = Image.open(io.BytesIO(raw)).convert("RGB").tobytes()
        cache[(tx, ty)] = [b[k] * 256 + b[k + 1] + b[k + 2] / 256 - 32768 for k in range(0, len(b), 3)]
    return cache[(tx, ty)]
def elevation(lat, lon):
    fx = (lon + 180) / 360 * 2 ** Z
    fy = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2 ** Z
    tx, ty = int(fx), int(fy)
    return tile_px(tx, ty)[min(255, int((fy - ty) * 256)) * 256 + min(255, int((fx - tx) * 256))]

img = Image.new("RGB", (GW, GH))
px = img.load()
lo, hi = 1e9, -1e9
for r in range(GH):
    lat = N - (N - S) * r / (GH - 1)
    for c in range(GW):
        h = elevation(lat, W + (E - W) * c / (GW - 1))
        lo, hi = min(lo, h), max(hi, h)
        v = max(0, min(65535, round(h * 2)))
        px[c, r] = (v >> 8, v & 255, 0)
img.save("data/region.png", optimize=True)
print(f"terrain {GW}x{GH}, {lo:.0f}-{hi:.0f} m, {len(cache)} tiles")

# OSM: interstates and highways, the big rivers, the reservoirs.
q = f"""[out:json][timeout:120];(
way[highway~"^(motorway|trunk|primary)$"]({S},{W},{N},{E});
way[waterway=river][name~"Colorado River|Roaring Fork|Blue River|Eagle River|Yampa|South Platte|Fraser|Clear Creek|Arkansas|Crystal River|Frying Pan|Fryingpan|Williams Fork|Boulder Creek"]({S},{W},{N},{E});
way[natural=water][name~"Dillon|Granby|Grand Lake|Green Mountain|Williams Fork|Ruedi|Shadow Mountain|Wolford|Stagecoach|Turquoise|Twin Lakes|Chatfield|Cherry Creek|Standley|Gross|Carter|Horsetooth|Lake Estes|Barker"]({S},{W},{N},{E});
);out geom;"""
raw = subprocess.run(["curl", "-s", "-f", "-m", "180", "-A", "ski-prerun", "--data-urlencode", f"data={q}", "https://overpass-api.de/api/interpreter"], capture_output=True, check=True).stdout
els = json.loads(raw)["elements"]

def thin(pts, tol):
    # Douglas-Peucker in km.
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]
    dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz) or 1e-9
    far, k = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs((pts[i][0] - a[0]) * dz - (pts[i][1] - a[1]) * dx) / L
        if d > far: far, k = d, i
    if far < tol: return [a, b]
    return thin(pts[: k + 1], tol)[:-1] + thin(pts[k:], tol)

roads, rivers, water = [], [], []
for e in els:
    t = e.get("tags", {}); pts = [km(g["lat"], g["lon"]) for g in e.get("geometry", [])]
    if len(pts) < 2: continue
    if "highway" in t:
        cls = 0 if t["highway"] == "motorway" else 1 if t["highway"] == "trunk" else 2
        ref = t.get("ref", "")
        # The plains are a tangle of city roads: there, only the freeways; in the mountains, the numbered
        # highways too (the ones you drive to the resorts on).
        if cls == 2 and not ref.startswith(("US", "CO")): continue
        if cls > 0 and pts[0][0] > 58: continue
        roads.append({"c": cls, "p": thin(pts, 0.15)})
    elif "waterway" in t:
        rivers.append(thin(pts, 0.12))
    else:
        water.append(thin(pts, 0.03))
print(f"roads {len(roads)}, rivers {len(rivers)}, water {len(water)}")

towns = [["Denver", 39.7392, -104.9903, 3], ["Boulder", 40.015, -105.2705, 2], ["Golden", 39.7555, -105.2211, 1],
         ["Idaho Springs", 39.7425, -105.5136, 1], ["Frisco", 39.5744, -106.0975, 1], ["Vail", 39.6403, -106.3742, 1],
         ["Glenwood Springs", 39.5505, -107.3248, 1], ["Aspen", 39.1911, -106.8175, 1], ["Steamboat Springs", 40.485, -106.8317, 1],
         ["Granby", 40.0861, -105.9395, 1], ["Leadville", 39.2508, -106.2925, 1], ["Breckenridge", 39.4817, -106.0384, 1],
         ["Kremmling", 40.0589, -106.3889, 1], ["Estes Park", 40.3772, -105.5217, 1], ["Nederland", 39.9614, -105.5108, 1]]

# Each resort's runs and lifts, every 4th point (~50 m), in region km.
resorts = {}
for r in json.load(open("data/resorts.json")):
    if not r.get("ready"): continue
    d = json.load(open(f"data/{r['id']}.json"))
    la0, lo0 = d["origin"]["lat"], d["origin"]["lon"]
    mx, mz = 111320 * math.cos(math.radians(la0)), 110574
    to = lambda x, z: km(la0 - z / mz, lo0 + x / mx)
    runs = []
    for run in d["runs"]:
        if run.get("area"): continue
        idx = list(range(0, len(run["pts"]), 4))
        if idx[-1] != len(run["pts"]) - 1: idx.append(len(run["pts"]) - 1)
        runs.append({"id": run["id"], "l": run["level"], "n": 1 if run["name"] else 0, "i": idx, "p": [to(*run["pts"][i]) for i in idx]})
    lifts = [[to(*p) for p in (l["pts"][0], l["pts"][-1])] for l in d["lifts"]]
    resorts[r["id"]] = {"runs": runs, "lifts": lifts}
    print(r["id"], len(runs), "runs")

json.dump({"bounds": [S, N, W, E], "grid": [GW, GH], "origin": [LAT0, LON0, KX, KZ], "towns": towns,
           "roads": roads, "rivers": rivers, "water": water, "resorts": resorts}, open("data/region.json", "w"), separators=(",", ":"))
