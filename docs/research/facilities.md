# Real facilities of the 9 Colorado resorts

Researched 2026-11-05 for the 3D scenes. The data is in `data/facilities/<id>.json`:

- `lifts` uses the same keys as `data/<id>.json`, which are OSM way ids.
- `buildings` gives local x/z from the same origin, the OSM element and its footprint where OSM has one, the real look, and the kit model that fits.
- `signature` lists what people would recognise at each resort.

Anything I couldn't confirm is marked `"verified": false`. Nothing here adds lifts, runs or connections to the game data.

**Sources**
- Lift type, maker and year come from [liftblog.com](https://liftblog.com) lift pages, skiresort.info lift lists and the Wikipedia resort articles.
- Colours are read from the dated liftblog photos (2015–2026). They are approximate hex values, so treat them as paint hints, not brand colours.
- Building positions come from OpenStreetMap (Overpass, Nov 2026). Each one was checked against the baked `places`, and all match within 10 m, except village places that sit on a lift bottom.
- Building looks come from the resorts' own dining pages and from liftblog photos.

**Kit**
- Lifts the kit can already draw: `chair2`, `chair3`, `chair4_fixed`, `chair4`, `chair6`, `chair6_bubble`, `chair8_bubble`, `gondola` (8 seats), `gondola6`, `gondola10`, `cabriolet`, `tbar`, `platter`, `magic_carpet`, `terminal_detach(_top)`, `terminal_fixed`, `gondola_station`.
- Buildings the kit can already draw: `restaurant`, `base_lodge`, `warming_hut`, `yurt`, `restroom`, `ticket_office`, `firstaid`.
- Carriers and terminals have `paint` parts, so most per-lift colour is data rather than modelling.

## Copper Mountain

**23 lifts** (19 verified):
- 1 chondola
- detachable chairs: 3 six-seat, 3 four-seat
- fixed-grip chairs: 5 triples, 4 doubles
- surface lifts: 2 T-bar / J-bar, 1 platter, 4 carpets

**Lifts**
- **American Flyer** (Leitner-Poma, 2018) is the world's longest bubble chair: 182 six-seat chairs with **bright blue bubbles**.
- **American Eagle** (Leitner-Poma, 2018) is a **chondola**: six-seat chairs, with a charcoal 8-passenger Sigma Diamond cabin (white Copper "C") every fifth carrier.
  - OSM tags it `bubble=yes`, but the photos show open chairs.
- Both leave Center Village from long silver LPA terminals with a **copper-coloured band**. Timberline Express (Leitner-Poma six, 2024) has the same look.
- The 1998 Poma Omega lifts (Super Bee six, Excelerator) and Kokomo Express (Doppelmayr Uni-G, 2017) wear Copper's **dark green** hood. So do the fixed-grip Alpha stations (Resolution, Three Bears 2019).
- Old Yan doubles have coloured chairs:
  - Alpine and Pitchfork: copper.
  - Lumberjack: orange-red.
  - Blackjack and Mountain Chief: red.

**Buildings**
- **The Aerie** (2023) is at the top of American Eagle. It's a two-storey, 25,000 sq ft modern lodge: charcoal cladding, a stone base, timber soffits and floor-to-ceiling glass. The chondola unloads onto its upper deck. It replaced Solitude Station.
- **Flyer's** is a small shack and bar near the top of American Flyer.
- **Koko's Hut** is at the top of Kokomo Express.
- **T-Rex Grill** is a tiny grill hut at the bottom of Timberline Express.
- **Union Creek lodge** is the West Village base building.
- Center Village and East Village are condo and hotel blocks.
- Three patrol huts: Timberline, Patrol HQ, and Tucker Mountain.

## Winter Park

**25 lifts** (24 verified):
- cabin lifts: 1 gondola, 1 cabriolet
- detachable chairs: 4 six-seat, 5 four-seat
- fixed-grip chairs: 3 triples, 6 doubles
- surface lifts: 1 platter, 1 rope tow, 3 carpets

**Lifts**
- **The Gondola** (Leitner-Poma, 2018) runs silver 10-passenger Sigma Diamond cabins with a maroon "Winter Park" band from the Village to Sunspot.
- **Village Cabriolet** (Leitner-Poma, 2008) runs **red open-top standing cabins** from the Vintage parking lot into the Village. It serves no terrain.
- Gemini, Olympia and Explorer are Poma Omega quads in **pine green**.
- The six-seat lifts are Leitner-Poma:
  - Panoramic (2007) and Super Gauge (2005) are grey.
  - Sunnyside (2019) has a bronze hood.
  - Wild Spur (2023) has a champagne hood and a mid-load station.
- Mary Jane has four parallel Heron-Poma doubles from 1974: Iron Horse, Pony Express, Galloping Goose and Challenger.
- Looking Glass (1966) is the last Riblet, with centre-pole chairs.

**Buildings**
- **The Lodge at Sunspot** is at the Gondola top. It's a big rustic log-and-stone lodge with heavy timber gables, a stone chimney tower with a cupola, and a log-railed deck.
- **Lunch Rock** (16,000 sq ft) is at the top of Mary Jane. It has dark board cladding over a stone base.
- **Snoasis** is mid-mountain. It has white walls, a tall timber-mullioned glass front and a shed roof.
- At the bases: Mary Jane Base Complex, Balcony House (look unconfirmed), and the Zephyr Mountain Lodge hotel blocks.

## Steamboat

**23 lifts** (19 verified):
- 3 gondolas
- detachable chairs: 1 six-seat, 8 four-seat
- fixed-grip chairs: 4 triples, 2 doubles
- 5 carpets

**Lifts**
- **Wild Blue Gondola** (Doppelmayr D-Line, 2022/2023) runs **navy 10-seat Omega V cabins** with the white Steamboat logo. Its grey towers have **red bases**. It runs from the base via the Greenhorn Ranch angle station to Sunshine Peak, with very high spans.
- **Steamboat Gondola** (Doppelmayr, 2019) runs navy Omega IV cabins (137 of them, plus one white wedding cabin) up to Thunderhead Lodge, which the top terminal is built into.
- Christie Peak Express (Leitner-Poma six, 2007) has a **maroon Omega hood with white stripes**.
- Storm Peak, Sundown and Thunderhead Express are 1990s Doppelmayr lifts: silver hoods with a red roof band. Storm Peak and Sundown are former bubble chairs.
- The newer Doppelmayr quads (Elkhead, Greenhorn Ranch) are navy.

**Buildings**
- **Thunderhead Lodge** is at the gondola top.
- **Four Points Lodge** is a two-storey timber-framed gabled cabin (OSM tags).
- **Rendezvous Saddle Lodge**.
- The Gondola Square base village: The Range food hall, One Steamboat Place, Gravity Haus.
- **Greenhorn Ranch** learning centre at the Wild Blue angle station. Its footprint isn't in OSM.
- The Storm Peak Research Laboratory near the Morningside top.

The Wildhorse Gondola (a pulse gondola) isn't in the baked data.

## Arapahoe Basin

**9 lifts** (8 verified):
- detachable chairs: 1 six-seat, 1 four-seat
- fixed-grip chairs: 3 quads, 1 double
- surface lifts: 1 rope tow, 2 carpets

**Lifts**
- Every chairlift is Leitner-Poma.
- Lenawee Express (six, 2022) and the Alpha stations of Pallavicini and Molly Hogan (both 2020) are **dark A-Basin green**.
- Black Mountain Express (2010) has an olive-green Omega hood.
- Beavers (2018) and Zuma (2007) are fixed quads.

**Buildings**
- **Black Mountain Lodge** is at the top of Black Mountain Express. It has dark green-charcoal lap siding and a gabled metal roof.
- **il Rifugio** is at 12,456 ft: a small dark-green lap-sided bistro.
- **Steilhang Hut** has charcoal board walls, a stone base and a blue door.
- The **Base Lodge** has Legends Cafe and the 6th Alley bar. It has rust-red vertical board siding and a long deck.
- Guest Services and the Kids Center are also at the base.
- The A-Frame and "The Beach" tailgating lot aren't in OSM.

## Eldora

**10 lifts** (7 verified):
- 1 detachable six-seat chair
- fixed-grip chairs: 2 quads, 1 triple, 3 doubles
- surface lifts: 1 platter, 2 carpets

**Lifts**
- **Alpenglow** (Doppelmayr Uni-G six, 2017) has a striking **orange-red hood with a black top**.
- Corona and Indian Peaks are 1998 Garaventa CTEC quads.
- Little Hawk (Miner-Denver, 1967) is the oldest operating chairlift in Colorado.

**Buildings**
- All at the base: Timbers Lodge & Taphouse, West Wing, Indian Peaks Lodge (two storeys, with a timber-truss dining hall upstairs), Caribou Lodge, and the patrol building.
- Lookout Grill is at the top of Corona.
- I couldn't confirm the exteriors from a photo.

## Snowmass

**18 lifts** (15 verified):
- 2 gondolas
- detachable chairs: 3 six-seat, 6 four-seat
- fixed-grip chairs: 2 quads, 1 double
- surface lifts: 1 T-bar, 3 platters, two of them private

**Lifts**
- **Elk Camp Gondola** (2006) runs **black Omega III cabins** with "Snowmass" lettering.
- **Sky Cab** is a pulse gondola from Base Village to the Mall: groups of **yellow, blue and green** Sigma Diamond cabins.
- The six-seat lifts:
  - Big Burn (2020).
  - Elk Camp (2025, charcoal).
  - Village Express (2005), which has a mid-unload.
- Coney Express (2024) has a brown-charcoal hood and a mid-station. A third of its chairs have red headrests.
- High Alpine has a slate-blue LPA hood.
- Pines Upper and Pines Lower are **private homeowners' platters**.

**Buildings**
- **Elk Camp** is at the gondola top: boxy ochre-tan render and dark timber.
- **Sam's** (2019) is on Sam's Knob: a steep gable with exposed dark timber trusses and a glass gable end.
- **High Alpine** is a multi-gable timber lodge.
- Up4pizza and Ullrhof (looks unconfirmed).
- A patrol hut.
- At the bases: Base Village and the Mall.

## Aspen Mountain

**6 lifts** (5 verified):
- 1 gondola
- detachable chairs: 3 quads, 1 **detachable triple** (Ruthie's, one of two left in North America)
- 1 fixed-grip double

**Lifts**
- **Silver Queen Gondola** rises straight out of downtown Aspen. It has **black 6-seat Omega III cabins** reading "ASPEN" and very tall **lattice towers**. The stations are grey metal with red trim.
- Nell Bell (Leitner-Poma, 2026) is listed only by skiresort.info.
- Shadow Mountain is real but isn't in the baked data.

**Buildings**
- **The Sundeck** (1999) is at the summit: a long timber-framed lodge with a tall central timber-and-glass gable, stone siding and a galvanized metal roof.
- The Silver Queen top terminal and the patrol building are beside it.
- **Bonnie's** is mid-mountain, with a deck of red Adirondack chairs.
- **Ruthie's**.
- Gondola Plaza is at the base.

## Aspen Highlands

**7 lifts** (5 verified):
- detachable chairs: 3 Poma quads, dark green
- fixed-grip chairs: 2 triples
- 2 lifts that are also in Buttermilk's data:
  - Five Trees, a private double for the Five Trees homes.
  - An unidentified rope tow.

**Lifts**
- The towers stand on **teal-green bases**.
- Loge Peak goes to the top of the lift-served mountain and the start of the **Highland Bowl** hike.
- Deep Temerity comes out of the bottom of the bowl.

**Buildings**
- **Merry-Go-Round** is mid-mountain: a long low single-storey restaurant with a broad shallow roof, a glass front and a big south deck, where the main lifts meet.
- **Cloud Nine Alpine Bistro** is a tiny red-roofed wooden chalet, a former patrol hut, with a packed deck facing the Maroon Bells.
- Highlands Village is at the base.

## Buttermilk

**9 lifts** (4 verified):
- detachable chairs: 3 quads
  - Summit Express, Poma 1993.
  - Tiehack Express, Leitner-Poma 2011: silver hood with a blue band.
  - West Buttermilk Express, 2004.
- fixed-grip chairs: Panda Peak and Five Trees
- surface lifts: 2 tows, 2 carpets

**Buildings**
- **Cliffhouse** is at the top of Summit Express: a dark green board-and-batten cabin with a red door. It isn't in OSM, so it's placed at the Summit Express top.
- **Buttermilk Mountain Lodge** (formerly Bumps, renovated 2022/23) is at the base.
- The Tiehack base.

## Gap list: what the kit can't show yet

Ranked by how much it matters for recognising the resort. Each line is a build brief for the modelling agent, following the semi-realistic rules and palette in `models/facilities/blender/README.md`.

1. **Chondola layout plus a charcoal Sigma Diamond cabin** (Copper, American Eagle).
   - On one rope, one 8-passenger cabin follows every four six-seat chairs, sharing the LPA grip and hanger height.
   - The cabin is a rounded box (size approximate; take it from the kit's `gondola`) with tall side windows, dark charcoal `paint`, a white "C" logo decal, and outside ski racks.
2. **Base village block** (all 9 resorts: Center Village, Gondola Square, Snowmass Base Village, Highlands Village, Winter Park Village).
   - A 4–6 storey condo/hotel block about 40 × 20 m.
   - Ground floor in stone, upper floors in tan render and timber, with balconies.
   - Steep gabled roofs with dormers and heavy snow; lit windows.
   - Variants by length so blocks can be lined up around a plaza.
3. **The Lodge at Sunspot** (Winter Park, the Gondola top).
   - A log-and-stone lodge. The size isn't confirmed: OSM has only a point for it.
   - Honey round logs, three steep heavy-timber front gables, and a stacked-stone chimney tower with a small cupola.
   - Cedar roof under deep snow, and a log-railed deck facing the Divide.
4. **Thunderhead Lodge with a gondola terminal built in** (Steamboat).
   - A large mid-mountain lodge. The storey count, cladding and size aren't confirmed: OSM has only a point for it.
   - The navy Omega IV cabins enter a covered terminal hall on one side.
   - A timber-gabled exit roof matching the main entrance, and a wide deck.
   - Check a photo before modelling the detail.
5. **Detachable terminal hood variants.** Every lift has one, and the shape is what tells lifts apart.
   - (a) LPA: long, low, rounded hood with a glass roof strip and a band for paint.
   - (b) Poma Omega: arched hood on a tri-leg, with the lift name on the side.
   - (c) Doppelmayr Uni-G: rounded hood with a porch roof.
   - (d) 1990s Doppelmayr Uni / Spacejet: flat hood with a red roof band.
   - Each needs `paint` regions for the hood and for the band or stripe.
6. **The Sundeck** (Aspen Mountain summit).
   - A long low timber-framed lodge about 70 × 35 m.
   - A tall central gable of heavy timber and glass, stone-clad walls, a galvanized metal roof, and a deck.
   - Next to it, the Silver Queen top terminal: a grey corrugated-metal box with red trim.
7. **Lattice tower** (Silver Queen Gondola).
   - A tall steel lattice gondola tower, 30–60 m, stretchable, with a twin-sheave head.
   - Plus black Omega III 6-seat cabins with a white "ASPEN" decal (this part is paint on `gondola6`).
8. **The Aerie** (Copper, top of American Eagle).
   - A modern two-storey lodge about 56 × 35 m: charcoal panel cladding over a stone base, warm timber soffits, and floor-to-ceiling glass on the view side.
   - A steel-framed covered upper deck with glass rails that the chondola unloads onto.
9. **Merry-Go-Round** (Highlands mid-mountain).
   - A long low single-storey restaurant about 50 × 34 m under one broad, shallow-pitched roof.
   - Glass all along the south front, a big deck with tables, and ski racks.
10. **Highland Bowl ridge** (Highlands).
    - A bootpack line of footsteps up a narrow treeless ridge, strings of prayer flags, and a small summit cairn and sign at 12,392 ft.
    - The position needs real DEM and track data; it isn't in our OSM bake.
11. **Wild Blue angle station and Greenhorn Ranch** (Steamboat).
    - A long Doppelmayr D-Line station where cabins turn about 30°: flat steel roof, two operator houses, outdoor cabin storage.
    - Beside it, a single-storey learning-centre lodge.
12. **Dark timber lodges with lap siding** (A-Basin: Black Mountain Lodge, il Rifugio, Steilhang Hut; Winter Park: Lunch Rock).
    - A restaurant variant with dark green or charcoal horizontal lap siding, a stone base, a gabled metal roof, and a sign board.
    - Steilhang Hut has a blue door.
13. **Sam's** (Snowmass).
    - A modern rifugio (size unconfirmed: OSM has only a point): one steep gable with exposed dark timber trusses, a glazed gable end, dark board and metal cladding, and a stone base.
14. **Elk Camp restaurant** (Snowmass, gondola top).
    - Boxy one-to-two-storey volumes in ochre-tan render and dark timber, flat and low roofs, and a deck for 150.
15. **Small coloured huts**, as `warming_hut` variants.
    - Cloud Nine: dark wood, red roof.
    - Cliffhouse: dark green board-and-batten, white trim, red door.
    - Flyer's and Koko's at Copper (look unconfirmed).
16. **Snoasis** (Winter Park mid-mountain).
    - White walls, a tall timber-mullioned glass front, and a deep shed roof.
17. **Detachable triple chair** (Ruthie's, Aspen Mountain).
    - A three-seat padded detachable chair. The kit's `chair3` is a fixed-grip chair with a slatted seat.
18. **Pulse gondola grouping** (Sky Cab).
    - This is a layout, not a model: groups of three cabins with group colours (yellow, blue, green) and wide gaps between groups.
19. **Riblet centre-pole double** (Looking Glass).
    - An old-style chair hung from a single centre pole.

**Paint or data only (no new model):**
- American Flyer's blue bubbles on `chair6_bubble`.
- Village Cabriolet's red cabins on `cabriolet`.
- Wild Blue's navy cabins and red tower bases.
- The Elk Camp Gondola's black cabins.
- Alpenglow's orange hood.
- Christie Peak's maroon hood.
- The green hoods at Copper, Winter Park, A-Basin and Highlands.
- Highlands' teal tower bases.

`src/ride/ride.js` only uses `LIFT_KIND` for Copper. The new files could feed `seats` / `bubble` / `color` to every resort.

## Couldn't find or confirm

- Exterior photos for these buildings:
  - Thunderhead Lodge, Rendezvous Saddle Lodge, Koko's, Flyer's, T-Rex.
  - The Eldora lodges, Ullrhof, Up4pizza, Bonnie's building, and Balcony House.
- Missing from OSM, so not placed:
  - Cliffhouse and Buttermilk Mountain Lodge footprints (placed at the lift ends instead).
  - A-Basin's A-Frame, Snowmass's Lynn Britt Cabin and The Cabin, the Aspen Mountain Club, and Buckhorn Cabin.
  - The Greenhorn Ranch lodge footprint.
- Lift details I couldn't confirm:
  - Makers or years for most magic carpets and the small tows: Rug Rat, Slingshot, Tubing, Buckaroo, Two Whoops, Sun Kid, Tenderfoot, Lazy J, the Buttermilk tows.
  - The type of Gem (J-bar or drag) and of Celebrity Ridge (platter or J-bar).
  - The Village Cabriolet's capacity.
  - Sky Cab's seats (6 or 8) and its fourth cabin colour.
  - Nell Bell beyond a skiresort.info listing.
  - Thunderbowl's colour.
  - The unnamed rope tow (OSM 1211521065) between Highlands and Buttermilk.
- Photos up to 2026 show these lifts as they are now, but older lifts' colours come from photos taken in 2015–2017.
