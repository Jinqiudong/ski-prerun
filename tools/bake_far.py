"""Bake the distant mountains around a resort: a coarse heightmap (~240 m cells) covering ~60 km,
in the same local meters as data/<resort>.json, so the horizon shows the real ranges.

usage: python tools/bake_far.py data/copper.json data/copper-far.json [half_km]
Downloads AWS Terrain Tiles (terrarium, z11) as needed.
"""
import base64, io, json, math, subprocess, sys
from array import array
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
HALF = float(sys.argv[3]) * 1000 if len(sys.argv) > 3 else 30000
Z, N = 11, 256
d = json.load(open(src))
LAT0, LON0 = d["origin"]["lat"], d["origin"]["lon"]
MX, MZ = 111320 * math.cos(math.radians(LAT0)), 110574
tile = lambda lat, lon: ((lon + 180) / 360 * 2 ** Z, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2 ** Z)
cache = {}
def tile_px(tx, ty):
    if (tx, ty) not in cache:
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png"
        raw = subprocess.run(["curl", "-s", "-f", "-m", "60", "-A", "ski-prerun", url], capture_output=True, check=True).stdout
        b = Image.open(io.BytesIO(raw)).convert("RGB").tobytes()
        cache[(tx, ty)] = [b[k] * 256 + b[k + 1] + b[k + 2] / 256 - 32768 for k in range(0, len(b), 3)]
    return cache[(tx, ty)]
def elevation(lat, lon):
    fx, fy = tile(lat, lon)
    tx, ty = int(fx), int(fy)
    return tile_px(tx, ty)[min(255, int((fy - ty) * 256)) * 256 + min(255, int((fx - tx) * 256))]
h = [[0.0] * N for _ in range(N)]
for r in range(N):
    z = -HALF + 2 * HALF * r / (N - 1)
    for c in range(N):
        x = -HALF + 2 * HALF * c / (N - 1)
        h[r][c] = elevation(LAT0 - z / MZ, LON0 + x / MX)
q = array("H", (min(65535, max(0, round((v - d["hmin"] + 1000) * 2))) for row in h for v in row))  # half-meters, 1000 m below the resort base
if sys.byteorder != "little": q.byteswap()
json.dump({"half": HALF, "grid": N, "offset": -1000, "scale": 0.5, "heights": base64.b64encode(q.tobytes()).decode()}, open(out, "w"))
print(f"{N}x{N} over {2 * HALF / 1000:.0f} km, {min(map(min, h)):.0f}-{max(map(max, h)):.0f} m, {len(cache)} tiles")
