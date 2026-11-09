# 雪场预滑 · Ski Pre-Run

Ride a real ski resort the night before you go, so tomorrow you know the way. Fifteen Ikon resorts,
nine in Colorado and six around Salt Lake City, from OpenStreetMap and real terrain. A prototype for Venture Lab idea
[#48](https://github.com/Jinqiudong/venture-lab/issues/48).

**Play:** https://jinqiudong.github.io/ski-prerun/ — on a phone, add it to the home screen.

- **Pick your rider**: four friends with their own boards, colours and an entrance each; change body, fit and moves.
- **Pick a resort** on a 3D map of central Colorado or the Wasatch; the runs you've skied light up.
- **Ride it**: choose a base and a lift on the resort miniature, ride the chair with the runs named below, choose where to go at the top and snowboard down with arrows on the snow, junction cards and a trail map.
- **Plan a trip** with friends: dates, resorts, who's coming; share it as a link.

## Run and test

```sh
npm run serve        # http://localhost:8766/start.html
npm run check        # every import, script, stylesheet and asset path resolves
npm test             # route planner tests
npm run models       # rebuild the facility models in Blender
```

No build step: the pages load ES modules from `src/` directly. The layout and conventions are in
[AGENTS.md](AGENTS.md).

## Data

`tools/bake.py` turns an Overpass export (pistes and aerialways), AWS Terrain Tiles (terrarium, z14)
and an optional points-of-interest export into `data/<resort>.json`: a heightmap, runs, lifts and a tree
mask. `tools/fetch_resort.py` downloads everything for one resort of `tools/resorts.json` and bakes it.

Runs and lifts © OpenStreetMap contributors (ODbL). Terrain: AWS Terrain Tiles (Mapzen, USGS).
Textures: Poly Haven (CC0).

A prototype for getting familiar with a resort. Always use the resort's official trail map on the mountain.
