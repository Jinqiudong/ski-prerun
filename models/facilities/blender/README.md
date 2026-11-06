# Facility models in Blender

`build.py` runs inside Blender and writes one GLB per model into `../glb/`:

    /Applications/Blender.app/Contents/MacOS/Blender -b -P models/facilities/blender/build.py -- models/facilities/glb [model ...]

Then add the model to its family's list `../glb/<family>.json` (`[{"name", "label", "hang"?}]`, label in
Chinese) and look at it in `../index.html` (button per family; ‹ › steps through the models; the snow
buttons switch between deep, light and no snow).

## Look: semi-realistic
Real proportions and real materials (Poly Haven textures in `tex/`, CC0), lit live by the game's sun and
sky. Not cartoon, not painterly. The reference is a detailed resort render: timber, stone, glass,
heavy snow on roofs, warm light in the windows. Detail comes from geometry (frames, trims, rails,
bolts, ladders, sheaves) and from the textures — never from saturated colour.

Palette (keep to it): honey logs, weathered grey-brown timber, warm grey stone, charcoal shingles and
steel, silver trim. Accents only: pine green `#3f5a4a`, brick red `#8e3b32` / `#9b3a30`, cream
`#ece2cd`, muted blue `#36506e`, ochre `#c9a65a`. Signs follow real US conventions (green circle, blue
square, black diamond, orange for parks, yellow for slow).

## Conventions
- Metres. Blender Z up; the model's front faces Blender −Y (it becomes +Z in the game). Origin on the
  ground at the model's foot, or at the rope for carriers (the carrier hangs below z = 0).
- Lift line: the rope runs along Blender −Y (the way up) for carriers, towers and terminals.
- Every part gets a `kind`:
  - `bake` (default): joined and baked into one atlas (colour × occlusion, plus normals).
  - `snow`: any part with the `snow()` material, or made by `blob()` / `slab()`. Kept as its own mesh,
    occlusion in vertex colours, so the game can thin it or take it away. Put snow on everything that
    would hold it: roofs (`slab`), rails, sills, tops of signs and tables, drifts against walls (`blob`).
  - `glass` (transparent), `lit` (windows: dark glass with a lit room behind, see `catalog.js`), `lamp`
    (glows), `flat` (lettering), `paint` (a part the game recolours per resort: lift paint, cabin colour).
    These are exported as their own meshes, named `<model>_<kind>`.
- Helpers in `lib.py`: `box`, `cyl`, `blob`, `slab`, `tri`, `curve_pipe`, `text`; materials `textured`,
  `wood(name, …)` (names in `SPEC` map to textures), `stone`, `flat`, `snow`, `glass`, `lit`. End each
  model with `finalize(name, size)`.
- `signature.py` holds the real resorts' landmark buildings (village blocks, Sunspot, Thunderhead, the Sundeck,
  the Aerie, Merry-Go-Round, …). Each entry in `../glb/<family>.json` may carry `"for"`: the research
  building or lift names (`data/facilities/<id>.json`) it stands for, so the game can pick it by name.
- Maker hoods (`terminal_detach_lpa`, `_omega`, `_unig`, `_dopp90`) keep the kit terminal's rope and have two
  paint regions: material `paint_hood` (the shell) and `paint_band` (band, stripe or top).
- Each family module lists its models in `MODELS = {"name": fn}`. In a family module use `lib.COL`
  and `lib._link` (module state), and `from lib import *` for the helpers.

## Budgets (phone browser)
- Faces: building ≤ 40k, carrier ≤ 8k (there are hundreds), tower ≤ 6k, sign or prop ≤ 4k.
- Atlas: 2048 for a big building, 1024 for stations and vehicles, 512 for carriers, signs and props.
- Things with real per-lift variety (seats, bubble, height, text) are built as variants or parts, e.g.
  `chair4`, `chair6_bubble`, a tower `head` plus a `shaft` the game stretches, sign blanks whose text
  the game paints.
