"""Bake the drives between the resorts (and from Denver and Salt Lake City, src/core/regions.js) for the start
page's map: the road route from the OSRM demo server (OpenStreetMap roads), its distance, and a time estimated
from that distance at a mountain-highway average (OSRM's own times run long for these roads; the estimate is
labelled "about"). In winter Independence Pass is closed, so the way to Aspen from the east goes round by
Glenwood Springs. In Utah the roads up Little and Big Cottonwood are narrow canyon roads, where the highway
average is far too quick: there OSRM's own time is used. Guardsman Pass (Big Cottonwood to Park City) is
closed in winter, so no leg crosses it.

usage: python tools/bake_drives.py [--all]      → data/drives.json
Legs already in data/drives.json are kept as they are; --all routes every leg again.
"""
import json, os, subprocess, sys, time

R = {r["id"]: (r["lat"], r["lon"]) for r in json.load(open("data/resorts.json"))}
DENVER, ASPEN, GLENWOOD = (39.7392, -104.9903), (39.1911, -106.8175), (39.5505, -107.3248)
SLC = (40.7608, -111.891)
# The legs worth drawing: the I-70 corridor and its branches, then hops around Aspen.
LEGS = [("denver", "eldora"), ("denver", "winterpark"), ("denver", "abasin"), ("abasin", "copper"), ("copper", "winterpark"),
        ("winterpark", "steamboat"), ("copper", "steamboat"), ("copper", "snowmass", GLENWOOD),
        ("snowmass", "buttermilk"), ("buttermilk", "highlands"), ("highlands", "aspenmountain")]
# Utah: up each Cottonwood canyon from the city, across between the two canyons by the valley, I-80 to Park City
# and I-15 / I-84 to Ogden Valley, and Park City to Snowbasin by I-80 and I-84.
UTAH = [("slc", "snowbird"), ("snowbird", "alta"), ("slc", "solitude"), ("solitude", "brighton"), ("snowbird", "solitude"),
        ("slc", "deervalley"), ("slc", "snowbasin"), ("deervalley", "snowbasin")]
LEGS += UTAH
OSRM_TIME = {("slc", "snowbird"), ("snowbird", "alta"), ("slc", "solitude"), ("solitude", "brighton"), ("snowbird", "solitude")}
at = lambda k: DENVER if k == "denver" else SLC if k == "slc" else R[k]

def thin(pts, step):
    out = [pts[0]]
    for p in pts[1:]:
        if abs(p[0] - out[-1][0]) + abs(p[1] - out[-1][1]) > step: out.append(p)
    return out + [pts[-1]]

old = {} if "--all" in sys.argv or not os.path.exists("data/drives.json") else {(d["a"], d["b"]): d for d in json.load(open("data/drives.json"))}
out = []
for leg in LEGS:
    a, b, via = leg[0], leg[1], leg[2] if len(leg) > 2 else None
    if (a, b) in old: out.append(old[(a, b)]); continue
    stops = [at(a)] + ([via] if via else []) + [at(b)]
    q = ";".join(f"{lon},{lat}" for lat, lon in stops)
    url = f"https://router.project-osrm.org/route/v1/driving/{q}?overview=full&geometries=geojson"
    j = json.loads(subprocess.run(["curl", "-s", "-m", "60", "-A", "ski-prerun", url], capture_output=True, check=True).stdout)
    rt = j["routes"][0]; km = rt["distance"] / 1000
    mins = round((rt["duration"] / 60 if (a, b) in OSRM_TIME else km / (50 if km < 25 else 85) * 60) / 5) * 5 or 5  # town roads near Aspen are slower
    line = [[round(lat, 4), round(lon, 4)] for lon, lat in rt["geometry"]["coordinates"]]
    out.append({"a": a, "b": b, "km": round(km), "min": mins, "line": thin(line, 0.01)})
    print(a, b, round(km), "km", mins, "min")
    time.sleep(1)  # the demo server asks to go easy
json.dump(out, open("data/drives.json", "w"), separators=(",", ":"))
