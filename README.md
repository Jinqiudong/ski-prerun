# 雪场预滑 · Ski Pre-Run

A playable version of a real ski resort: plan your day, ride the lifts and ski the runs the night before you go, so you know the way tomorrow. Prototype for Venture Lab idea [#48](https://github.com/Jinqiudong/venture-lab/issues/48). First resort: Copper Mountain, Colorado (155 runs, 23 lifts).

- **Plan a route**: from a base village, restaurant or lift top to anywhere, capped at your level (green to double black). The planner chains lifts and runs (`route.js`) and shows each step with times.
- **Ride it**: sit on the chair with the runs passing below named, then ski each run with turn-by-turn cues ("前方 120 米 向左 · 进 Main Vein"), trail signs at run starts, and a heading-up minimap. 👀 auto mode skis the route for you; 🗺 pauses to look at the rest of the route from above.
- **Ski or snowboard**, set on the start screen; the rider, stance and physics change.
- Map mode: drag to orbit, pinch to zoom, tap a run, lift or place. ☰ searches everything.

Run locally: `python3 -m http.server 8765`, then open http://localhost:8765/. Tests: `node --test tests/route.test.mjs`.

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
