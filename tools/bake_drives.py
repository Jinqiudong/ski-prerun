"""Bake the drives between the resorts (and from Denver) for the start page's map: the road route from the
OSRM demo server (OpenStreetMap roads), its distance, and a time estimated from that distance at a
mountain-highway average (OSRM's own times run long for these roads; the estimate is labelled "about").
In winter Independence Pass is closed, so the way to Aspen from the east goes round by Glenwood Springs.

usage: python tools/bake_drives.py      → data/drives.json
"""
import json, subprocess, time

R = {r["id"]: (r["lat"], r["lon"]) for r in json.load(open("data/resorts.json"))}
DENVER, ASPEN, GLENWOOD = (39.7392, -104.9903), (39.1911, -106.8175), (39.5505, -107.3248)
# The legs worth drawing: the I-70 corridor and its branches, then hops around Aspen.
LEGS = [("denver", "eldora"), ("denver", "winterpark"), ("denver", "abasin"), ("abasin", "copper"), ("copper", "winterpark"),
        ("winterpark", "steamboat"), ("copper", "steamboat"), ("copper", "snowmass", GLENWOOD),
        ("snowmass", "buttermilk"), ("buttermilk", "highlands"), ("highlands", "aspenmountain")]
at = lambda k: DENVER if k == "denver" else R[k]

def thin(pts, step):
    out = [pts[0]]
    for p in pts[1:]:
        if abs(p[0] - out[-1][0]) + abs(p[1] - out[-1][1]) > step: out.append(p)
    return out + [pts[-1]]

out = []
for leg in LEGS:
    a, b, via = leg[0], leg[1], leg[2] if len(leg) > 2 else None
    stops = [at(a)] + ([via] if via else []) + [at(b)]
    q = ";".join(f"{lon},{lat}" for lat, lon in stops)
    url = f"https://router.project-osrm.org/route/v1/driving/{q}?overview=full&geometries=geojson"
    j = json.loads(subprocess.run(["curl", "-s", "-m", "60", "-A", "ski-prerun", url], capture_output=True, check=True).stdout)
    rt = j["routes"][0]; km = rt["distance"] / 1000
    mins = round(km / (50 if km < 25 else 85) * 60 / 5) * 5 or 5  # town roads near Aspen are slower
    line = [[round(lat, 4), round(lon, 4)] for lon, lat in rt["geometry"]["coordinates"]]
    out.append({"a": a, "b": b, "km": round(km), "min": mins, "line": thin(line, 0.01)})
    print(a, b, round(km), "km", mins, "min")
    time.sleep(1)  # the demo server asks to go easy
json.dump(out, open("data/drives.json", "w"), separators=(",", ":"))
