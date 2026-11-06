# Icon library

The owner's hand-painted icons (soft watercolour, navy ink lines). **Use these before drawing anything new**;
when a new one is needed, ask the owner for it in the same style and add it here.
All are 128×128 PNG with transparent backgrounds. Load as `assets/icons/<name>.png?v=1`.

| Group | Names |
|---|---|
| Tabs | `rider` `resorts` `trips` `memory` |
| Gear (colour editor parts) | `jacket` `pants` `helmet` `lens` `gloves` `boots` `board` |
| Tools | `shuffle` `star` `hanger` `palette` `sliders` `reset` |
| Weather | `sunny` `partly` `cloudy` `lightsnow` `snow` `heavysnow` `snowsun` `windy` `fog` |
| Resort clues | `lift` `trees` `alpine` `powder` `groomed` `park` `hotspring` `lodge` `camp` |
| Activities | `ski` `snowboard` `snowshoe` `hike` `photo` `dining` `rest` `shop` `nightski` |
| Stamps | `st_prerun` `st_booked` `st_ontrip` `st_done` `st_favorite` `st_notyet` `st_cancelled` |
| Crew avatars | `av_rider` `av_girl` `av_fox` `av_hare` `av_marmot` `av_elk` `av_bear` |
| More | `snowreport` `difficulty` `trailmap` `challenge` `packing` `budget` `season` |

Animals for the map: `assets/animals/<name>.png` (painted cut-outs) and `assets/animals/3d/<name>.glb`
(rigged, walking; `tools/build_animals.py`).

Mountain page (cut from the owner's Copper Mountain mock): `back` `bookmark` `snow_now` `refresh` `compass_n`
`view_close` `view_top` `autorotate` `layer_runs` `layer_lifts` `compass_rose` (painted compass, needle leans 38° east)

| Animation | `ride_crayon_0` crouch, `ride_crayon_1` hop, `ride_crayon_2` hop and cheer — the crayon rider on the rider page's go button when there is a pre-run to go back to (from the owner's GIF) |

Wanted (pets' emote bubbles on the map, `src/start/pets.js` `EMOTES` uses stand-ins until they arrive): `emo_heart` (比心 hand heart), `emo_happy` (happy sparkle star), `emo_music` (music notes), `emo_surprise` (!), `emo_question` (?), `emo_sleepy` (zzz with a moon), `emo_snow` (snowflake; `season` stands in), `emo_sweat` (a sweat drop, puffing; `hike` + a CSS drop stand in), `emo_sun` (basking in the sun; `sunny` stands in), `emo_relieved` (phew, home again; `rest` + "呼~" stand in). `emo_music` uses `palette` for now.
