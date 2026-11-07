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
| Wardrobe (drawn by the game agent in the house style) | `look_mirror` (hand mirror: the 外形 item, hair and build) |
| Voice (drawn by the game agent in the house style) | `voice_mic` (mic on) `voice_mic_off` (mic crossed out: off, a muted friend) `voice_radio` (walkie-talkie: hold-to-talk, a friend on the radio) `voice_speaking` (bubble with sound waves: a friend speaking) |
| Riding together (drawn by the game agent in the house style) | `msg_chat` (quick-message button) `msg_wait` (raised glove, 等我) `msg_meet` (lift station and map pin, 缆车站见) `msg_good` (thumbs up with snowflakes, 这条好滑) `msg_down` (a rider dropping in, 我先下去了) `msg_coming` (paper plane with a dashed trail, 去找你 and the fly-over) |
| Tricks (drawn by the game agent in the house style) | `trick` (a board in the air with a sparkle: the ride's 动作 button) `trick_ollie` `trick_spin` `trick_indy` `trick_melon` `trick_tailgrab` (grabs: the board from above, a mitten on the edge it holds) `trick_nose` `trick_tailpress` (presses: one end in the snow): the trick wheel |
| Practice (drawn by the game agent in the house style) | `practice` (a gentle bunny hill with an S of turns between two training cones and a flag: 宝宝坡, the practice's entry and card) |
| Snow (drawn by the game agent in the house style) | `moguls` (round snow bumps on a slope with a tiny red mushroom: 蘑菇道, a mogul run; the HUD's 前方蘑菇道 cue, the run cards, the roadbook, the resort page). Powder uses the owner's `powder`. |
| Way-finding (drawn by the game agent in the house style) | `nav_left` `nav_right` `nav_straight` (fat gold arrows: the turn-off ahead, in the guide animal's bubble) `nav_here` (an arrow down into a spot: this way, now, into the trees) `nav_back` (a pink U-turn: the wrong way) `hud_speed` (a dial, green to red: the ride's speed in the HUD strip) |

Icons marked "drawn by the game agent in the house style" were drawn with code, not painted by the owner:
`node tools/draw_icons.mjs [name ...]` (needs `npm i --no-save puppeteer-core` and Chrome) redraws them and the
side-by-side check `docs/art/icons/new_icons_review.png`. Swap in a painted one any time under the same name.

Animals for the map: `assets/animals/<name>.png` (painted cut-outs) and `assets/animals/3d/<name>.glb`
(rigged, walking; `tools/build_animals.py`).

Mountain page (cut from the owner's Copper Mountain mock): `back` `bookmark` `snow_now` `refresh` `compass_n`
`view_close` `view_top` `autorotate` `layer_runs` `layer_lifts` `compass_rose` (painted compass, needle leans 38° east)

| Animation | `ride_crayon_0` crouch, `ride_crayon_1` hop, `ride_crayon_2` hop and cheer — the crayon rider on the rider page's go button when there is a pre-run to go back to (from the owner's GIF) |

Wanted (pets' emote bubbles on the map, `src/start/pets.js` `EMOTES` uses stand-ins until they arrive): `emo_heart` (比心 hand heart), `emo_happy` (happy sparkle star), `emo_music` (music notes), `emo_surprise` (!), `emo_question` (?), `emo_sleepy` (zzz with a moon), `emo_snow` (snowflake; `season` stands in), `emo_sweat` (a sweat drop, puffing; `hike` + a CSS drop stand in), `emo_sun` (basking in the sun; `sunny` stands in), `emo_relieved` (phew, home again; `rest` + "呼~" stand in). `emo_homesick` (想回家, looking up at home from below its cliff; `lodge` + text stand in), `emo_missing` (想家, missing its own mountain from someone else's; `resorts` + text stand in), `emo_huff` (哼, a huffy puff; `windy` + text stand in), `emo_lost` (找不着北, lost; `compass_rose` + text stand in), `emo_ladder` (想要梯子, wants a ladder; `lift` + text stand in). `emo_music` uses `palette` for now.



