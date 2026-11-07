# Sound

All the ride's sound is WebAudio, made in the browser. There are no sound files: the material is
computed from seeds in `buffers.js`. Music files can be added later through the manifest.

| File | What |
| --- | --- |
| `engine.js` | One AudioContext per page. It starts on the first touch, click or key (iOS needs this) and pauses while the page is hidden. Buses `sfx`, `ambience`, `music` and `voice`, each through a duck gain, then a limiter. `voice` (friends talking, `src/ride/voice.js`) skips the master, so turning the game's sound off doesn't silence friends; `keepAwake(on)` keeps the context running for them. `duck(amount, seconds)` turns music and effects down under voice. On/off and volumes live in localStorage `prerunSound`. |
| `buffers.js` | Pure functions, seeded: snow texture (smooth, no ticks), skid spray, soft crunches, landing thump, the flump of snow off a tree, tower sheave passes, station clunk, reverb tail. |
| `snow.js` | `BoardSound`: the board on snow, driven every frame by `board.js` `Rider`. `boardMix()` is the mapping, and it is pure and tested. |
| `ambience.js` | Wind (speed plus gusts, cut by the bubble), the mountain bed, the lift's hum, tower passes, and station machinery. |
| `music.js` | `Music`: the manifest player. It crossfades by mood and has `play(id, atSeconds)`, `current()` and `follow()`. It also writes the generated tracks. |
| `real.js` | The real recordings the owner picked in the lab, from `assets/audio/game/`. A snowboard run (Nox_Sound) plays under the synth board in short carving or slowing stretches, crossfaded; `realBoardMix()` (pure, tested) sets its level from the carve or skid. Riders pass close now and then (cribbler), panned from one side to the other. The lift station (SoundsLikeYukon) plays at the bottom and on arrival at the top. A quiet ski slope (xkeril) is the mountain's bed at the top and under the ride down, replacing the synth bed. |
| `index.js` | `RideSound`, with one call per frame for each phase: `lift()`, `top()`, `ski()` and `hike()`. Also `rideSound()` (the page's single instance) and the exports `play`, `current`, `follow` and `duck`. |
| `lab.js` | The sound lab (`sound.html`). Every synth sound is played live with sliders for its parameters, next to real CC0 recordings and music candidates. Each row has a pick box; the picks are kept in localStorage `prerunSoundLab` and listed at the bottom to copy. |
| `panel.js` | The sound drawer in the ride's menu, plus the credit line. |

## How the physics drive the snow
- **Glide**: the base running flat. Lowpassed texture whose level and brightness grow with speed. It gets quieter on an edge or in a skid.
- **Carve**: the edge pressing a line through the snow, a soft full "shhh". Band-passed texture. Its level follows `|lean|` (edge angle) and speed^1.5. Its centre is 480 + 45·v + 650·edge Hz. The texture plays faster with speed, so it breathes faster too.
- **Scrape**: a skid (`rider.skid`, which is braking or pace −1). A deep, smooth spray of snow thrown off the edge, swelling a few times a second. It builds in about 0.2 s and eases out as the speed drops below 4 m/s. On ice it also chatters (a 23 Hz wobble).
- **Rumble**: the board's low body. Louder in a skid and on ice.
- **Crunches** while `pushing` or `walking`. A **thump** on landing that scales with the hop's height (a trick's hop or a mogul's). In the air the snow layers cut out.
- **A crash into a tree** (`RideSound.crash`): the body's thump, then the snow coming off the branches, a soft heavy **flump** with powder sifting after it, and a smaller one half a second later.
- **Snow type**: `groomed` (default), or `powder` (the owner's powder carve) off the piste (more than 45 m from the route) and wherever a powder day's snow lies deep (`src/ride/snow-core.js`). `?surface=ice|powder|groomed` on look.html forces one type.

Each update sets at most about 12 AudioParams, and only those that changed by more than 2 %. Nodes are made once. The only per-event nodes are one-shots (a crunch, a tower pass) and music notes, which are scheduled a bar ahead.

## Levels
These are tuned for a phone's speaker. The owner found the first mix's music too loud and the snow clicky. Defaults are music 0.16, effects 0.7 and master 0.8. Levels saved under an older mix (`v` in the settings) are reset; on/off is kept. `tests/audio.test.mjs` fails if a texture gets a click or too much top end.

## The lift's towers
Passing a tower plays a sheave train: the rope's rumble swells, then a rhythmic "ka-thunk" for each of 8 rubber-lined wheels. It is loudest up to the tower and softer past it, and the chair sways and creaks after. `towerDue()` starts it `sheaveLead()` seconds early, so the middle wheel lands as the chair passes the tower in `line.towers` (stations and terminals don't count). There is never more than one every 1.2 s, and none when the line jumps or fast-forwards. The ×1, ×2 and ×4 ride speeds each roll over the wheels at their own tempo.

## Music
`assets/audio/music/manifest.json` lists the tracks: `id`, `title`, `artist`, `licence` (SPDX), `source` and `mood` (`lift`, `ski` or `calm`). Each track also has either `file` (a file in that folder) or `gen` (`key`, `seed`, `bars`).
- Only CC0 or CC-BY files are allowed. A CC-BY track must have its artist and source in the manifest. The sound drawer and the page's credit line show them. `tests/audio.test.mjs` checks every entry.
- The phase picks the mood: calm at the top and on hikes, lift on the chair, ski on the way down. A mood change crossfades over 4 s.
- Listen together: a generated track is the same on every phone at the same second. `play(trackId, atSeconds)` lines friends up, and `current()` returns `{ id, at, ... }`. `follow()` hands the choice back to the mood.

## Listening
Render offline to WAV with an OfflineAudioContext. `makeMixer(ctx)` plus `new RideSound(ctx, mix, { timer: false })` build the same graph. Call `ski()`/`lift()` with explicit `t`, then `music.pump(seconds)` and `startRendering()`.

## The sound lab
`sound.html` is where the owner listens and chooses. The real recordings are in `assets/audio/lab/`, and `manifest.json` gives each one's author, CC0 licence, source page and excerpt. They are made by `tools/lab_audio.mjs` from the list in `tools/lab_audio.json`, using Freesound's preview mp3s and OpenGameArt files and macOS `afconvert`. Each is trimmed, faded, normalised and encoded as mono AAC at 96 kbps. All of them together stay under 8 MB, which a test checks.

## The owner's picks (applied)
- **Board:** the synth glide, carve, skid and powder, plus the real snowboard layer and other riders passing.
- **Wind, rope hum, tower pass, station machinery:** synth.
- **Real recordings:** the station at both ends of the lift, and the slope bed at the top (all through the ride, quietly).
- **Music:** only "Bubble Up" (`gen-lift-2`) in every phase. The other tracks are marked `"rotation": false` and stay in the sound lab.
- `tools/game_audio.mjs` makes `assets/audio/game/` (CC0, sources in its manifest and in the sound drawer). It also marks the board run's turn and slow stretches.
