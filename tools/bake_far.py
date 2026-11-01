"""Bake the distant mountains around a resort: a coarse heightmap (~240 m cells) covering ~60 km,
in the same local meters as data/<resort>.json, so the horizon shows the real ranges.

usage: python tools/bake_far.py data/copper.json data/copper-far.json [half_km]
Downloads AWS Terrain Tiles (terrarium, z11) as needed.
"""
import base64, io, json, math, sys, urllib.request
import numpy as np
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
        raw = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "ski-prerun"}), timeout=60).read()
        px = np.asarray(Image.open(io.BytesIO(raw)).convert("RGB")).astype(float)
        cache[(tx, ty)] = px[..., 0] * 256 + px[..., 1] + px[..., 2] / 256 - 32768
    return cache[(tx, ty)]
def elevation(lat, lon):
    fx, fy = tile(lat, lon)
    tx, ty = int(fx), int(fy)
    return tile_px(tx, ty)[min(255, int((fy - ty) * 256)), min(255, int((fx - tx) * 256))]
h = np.zeros((N, N))
for r in range(N):
    z = -HALF + 2 * HALF * r / (N - 1)
    for c in range(N):
        x = -HALF + 2 * HALF * c / (N - 1)
        h[r, c] = elevation(LAT0 - z / MZ, LON0 + x / MX)
q = np.clip(np.round((h - d["hmin"] + 1000) * 2), 0, 65535).astype(np.uint16)  # half-meters, 1000 m below the resort base
json.dump({"half": HALF, "grid": N, "offset": -1000, "scale": 0.5, "heights": base64.b64encode(q.astype("<u2").tobytes()).decode()}, open(out, "w"))
print(f"{N}x{N} over {2 * HALF / 1000:.0f} km, {h.min():.0f}-{h.max():.0f} m, {len(cache)} tiles")
