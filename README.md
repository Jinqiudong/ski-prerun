# 雪场预滑 · Ski Pre-Run

A playable version of real ski resorts: pick your rider, ride the lifts and ski the runs the night before you go, so you know the way tomorrow. Prototype for Venture Lab idea [#48](https://github.com/Jinqiudong/venture-lab/issues/48). Nine Colorado Ikon resorts.

- **Pick a resort** on a 3D map of central Colorado: the runs you've skied light up in colour; ski all of one and it flowers.
- **Ride it**: choose a base and a lift on the resort miniature, sit on the chair with the runs below named, then at the top choose where to go and snowboard down with gold arrows on the snow, junction cards, a heading-up map and a full trail map.
- **Plan a trip**: dates, resorts, pass and who's coming, a lift ticket per day; share it as a link.
- **Rider A** snowboards, regular or goofy, in colours you choose.

Run locally: `python3 -m http.server 8765`, then open http://localhost:8765/start.html. Tests: `node --test tests/route.test.mjs`.

## Data

`tools/bake.py` turns an Overpass export (downhill pistes and aerialways) and AWS Terrain Tiles (terrarium, z14) and an optional points-of-interest export (restaurants) into `data/<resort>.json`: a heightmap, runs, lifts and a tree mask. Runs outside the bounding box are dropped (Copper's Overpass box also catches Breckenridge). Glades and bowls mapped as outlines are skied from their highest to their lowest point.

```sh
# pistes and lifts for the resort's bounding box (S,W,N,E)
curl -A "ski-prerun" https://overpass-api.de/api/interpreter \
  --data-urlencode 'data=[out:json];(way["piste:type"="downhill"](S,W,N,E);way["aerialway"](S,W,N,E););out geom;' -o osm.json
# terrain tiles: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/14/{x}/{y}.png saved as tiles/{x}_{y}.png
python tools/bake.py osm.json tiles data/copper.json poi.json   # needs numpy and pillow; set the bbox at the top of bake.py
```

Runs and lifts © OpenStreetMap contributors (ODbL). Terrain: AWS Terrain Tiles (Mapzen, USGS).

A prototype for getting familiar with a resort. Always use the resort's official trail map on the mountain.
