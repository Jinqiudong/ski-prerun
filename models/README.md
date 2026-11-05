# Models

Everything the game shows that is modelled, apart from the terrain. Facilities are built from code
(three.js, metres, no build step) so one model can take each lift's real seats, bubble and paint from
OpenStreetMap. Characters will move here as `models/characters/` (Blender sources stay off Git).

- `facilities/` — lifts, stations, signs, buildings. Open `facilities/index.html` for the catalogue:
  two looks under review (A miniature, B ink and wash) and set views.
  - `kit.js` materials by role, the looks, helpers · `lifts.js` · `signs.js` · `buildings.js` · `viewer.js`

## Facility inventory

Counts are what the 9 ready resorts have in OpenStreetMap. P0 = needed for the friends beta.

| Family | Item | Variants | In our data | Status | P |
|---|---|---|---|---|---|
| Chairs | Fixed-grip chair | 2 / 3 / 4 seats, slatted or padded | 75 | sample (2) | P0 |
| Chairs | Detachable chair | 4 / 6 / 8 seats, bubble or not, resort paint | 13 six + quads | sample (6 bubble, 4) | P0 |
| Cabins | Gondola cabin | 6 / 8 / 10 seats, resort paint | 8 | sample (8, 10) | P0 |
| Cabins | Cabriolet (open standing) | Winter Park Village Cabriolet | 1 | — | P1 |
| Cabins | Chondola (chairs + cabins on one rope) | mixed_lift | 1 | — | P1 |
| Cabins | Aerial tram | — | 0 | — | P2 |
| Surface | T-bar / J-bar | | 3 | sample (T) | P1 |
| Surface | Platter (Poma) | | 5 | — | P1 |
| Surface | Rope tow, handle tow | | 6 | — | P2 |
| Surface | Magic carpet with its tunnel | | 18 | — | P1 |
| Line | Tower | support, compression, height, gauge, ladder, catwalk, number | every lift | sample | P0 |
| Line | Haul rope, sag between towers | | every lift | sample | P0 |
| Stations | Detachable terminal | bottom / top, hood in resort paint, loading carpet, maze, operator hut | most quads up | sample | P0 |
| Stations | Fixed-grip terminal | open bullwheel, drive or return | doubles, triples | sample | P0 |
| Stations | Gondola station | a building the cabins pass through | 8 | — | P0 |
| Stations | Mid station / angle station | | few | — | P2 |
| Stations | Lift name board, lift line maze, singles line | | every lift | name board done | P0 |
| Signs | Run sign | green / blue / black / double black / park, name | every run | sample | P0 |
| Signs | Junction post | 2–4 arrow boards | every junction | sample | P0 |
| Signs | Lift signs | prepare to unload, raise the bar, keep tips up, unload here | every lift | sample (1) | P0 |
| Signs | Slow zone, closed, boundary rope, hazard cross, bamboo and disc markers | | — | sample (slow, closed) | P1 |
| Signs | Trail map board | at bases and lift tops | — | sample | P1 |
| Buildings | Mountain restaurant | small / large, deck, tables, parasols, racks | 101 food places | sample | P0 |
| Buildings | Base lodge / village block | | 14 villages | — | P1 |
| Buildings | Warming hut, yurt | | — | sample (yurt) | P1 |
| Buildings | Patrol hut at the top (red cross), ticket window, rental shop | | — | — | P2 |
| Props | Picnic table, board rack, bench, fire pit, flags | | — | sample | P1 |
| Props | Snowcat, snowmobile, snow fence, snow gun | | — | — | P2 |
| Park | Kicker, box, rail, jump line | | — | kicker in the entrance | P2 |
