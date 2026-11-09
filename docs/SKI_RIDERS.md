# Ski riders (双板): the character side's contract

The two people stay as they are (`tpl_f` / `tpl_m`: bodies, faces, outfits, sliders unchanged). Skiing adds
gear (two skis with bindings, two poles, a pair of hard-shell ski boots) and a set of `Ski_` clips on the same
22-bone skeleton. The gear and clip scripts are kept outside this repo with the character AI's tools, by the
owner's choice; this page is what the game can rely on.

## Files (`assets/riders/`)
| file | what | loaded by |
|---|---|---|
| `ski_gear.glb` (56 KB) | the gear, rigid (not skinned) meshes, Draco: one light set (6.5k triangles for all eight pieces) for both templates, the rider page and the ride | `src/rider/ski.js` `addSki(C)` |
| `tpl_f_ski.glb`, `tpl_m_ski.glb` (352 KB each) | skeleton only (the same 22 bones and names), the 18 `Ski_` clips, no meshes, like `tpl_*_ride.glb` (same export and key-reduction pass) | `src/rider/ski.js` `addSki(C)` |

Why this split: the clips key every bone's position at that template's proportions, so they are per template
(as the ride clips are); the gear is the same for both, rigid on bones, so one small file serves the full and
the light (LOD) riders alike, with no second skin to bind.

## Loader (`src/rider/ski.js`, a module of its own: `character.js` is untouched, so no `?v=` cascade)
- `import { addSki, SKI_CLIPS, loadSki, ON_BOARD } from "../rider/ski.js?v=1"`.
- `await addSki(C)` on any `makeCharacter` result (full, `{ ride: true }` or `{ lod: true }`, F or M): loads the
  two files once (`loadSki(tpl)` preloads them), merges the `Ski_` clips into `C.clips` (so `C.play("Ski_Glide")`
  and `C.mixer.clipAction(C.clips.Ski_Glide)` work), attaches a clone of the gear to `C.bones`, hidden, with its
  own materials (`C.skiGear`). Returns `C`; calling it twice is harmless.
- `C.ski(true)`: shows the gear and hides the meshes whose names match `ON_BOARD` (`Board_*`, `Bindings_*` and the
  snowboard boots `Boots_*`); `C.ski(false)` the reverse; `C.onSki` says which. Nothing else changes (colours,
  sliders, parts).
- Rigged animals (the capybara): `addSki` does nothing for `C.pet`.
- `boarder.js` puts the model's lowest point on the snow (`box.min.y`); with skis on, that is the skis' base, on
  the same snow plane as the board's base.

## Nodes and materials (in `ski_gear.glb`)
| node | parent bone (three.js name) | material(s) |
|---|---|---|
| `Ski_L`, `Ski_R` | `Foot.L`, `Foot.R` (`FootL`, `FootR`) | `MAT_ski_top` (a 128x1024 cream / pine / slate graphic), `MAT_ski_base`, `MAT_ski_binding`, `MAT_ski_binding_accent` |
| `Pole_L`, `Pole_R` | `Hand_L_Socket`, `Hand_R_Socket` | `MAT_pole`, `MAT_pole_grip`, `MAT_pole_basket` |
| `SkiBoot_L`, `SkiBoot_R` (the lower shell and sole) | `Foot.L`, `Foot.R` | `MAT_skiboot_shell` (slate), `MAT_skiboot_buckle`, `MAT_skiboot_sole` |
| `SkiBoot_Cuff_L`, `SkiBoot_Cuff_R` (the cuff and power strap) | `Shin.L`, `Shin.R` (`ShinL`, `ShinR`) | `MAT_skiboot_shell`, `MAT_skiboot_sole` |

Each node carries `extras.attach = { F: { bone, position, quaternion, scale }, M: { … } }`: its transform in
that bone's local frame (three.js, metres), fitted per template; `addSki` applies it.
- The skis sit under the boot soles with their base on the snow plane; the boots are sized round the snowboard
  boots they replace, so the pants' hem sits over the cuff as before. The boot is two rigid parts, as a real
  one is: the shell follows the foot, the cuff the shin, overlapping at the ankle.
- The pole's grip is centred in the palm with its cap 13 cm up the shaft, clear above the mitten.
- M's gear is F's scaled by 181 / 164 (skis 1.56 m and 1.72 m, poles 1.12 m and 1.24 m).
- Material names are unique to the gear, so `applyCharacter` leaves them alone; recolour with `material.color`
  on `C.skiGear` if wanted.

## Axes and facing (three.js frame of the model, before the ride's own `model.rotation.y`)
- Up is +y; the snow is the same plane as under the board: the skis' base is where the board's base is
  (y = -0.061 at rest in the model, before `applyCharacter`'s height scale).
- **Forward (down the fall line, ski tips) is +x**, the same axis as the board's nose, so `trace` and the
  ride's `model.rotation.y = -π/2` (board +x to root +z) give the skier the same heading. The skier's chest
  faces +x; their right is +z, their left is -z.
- The `Board` bone in the `Ski_` clips is the skis' mean frame: between the feet, on the snow, its +x along the
  skis, rolled with their edge angle (tilted toward +z = on the right edges = turning right). The board mesh
  is hidden, so this only matters to code that reads the bone. It keeps `trace` meaningful: at 7 m/s,
  `trace("Ski_Turn_L")` curves to -z (the skier's left), `Ski_Turn_R` to +z, `Ski_Glide` runs straight along +x,
  `Ski_Hockey_Stop` stops steering once the skis are across, and `Ski_Jump`'s `by` peaks at 0.43 m.
- Exception, on the chair: `Ski_Chair_Sit` and `Ski_Wave` face the way `Chairlift_Sit` does (chest +z, legs
  toward +z), so `sitBoarder`'s seat and facing work unchanged.

## Clips (`tpl_*_ski.glb`, 30 fps, the same names and durations for F and M)
"hold" clips keep one pose, with a slow breath, and start and end on the same frame: they loop seamlessly, and
the ride can hold them at mid-duration as it does the board's. "once" clips play through and the game holds the
last frame (or crossfades out). Times are seconds from the clip's start.

| clip | s | loop | what |
|---|---|---|---|
| `Ski_Stand` | 2.00 | hold | standing on skis, light knee bend, both pole tips planted ahead and outside the skis |
| `Ski_Glide` | 2.00 | hold | parallel, neutral: knees and ankles flexed, hips over the feet, hands forward and wide, poles trailing back |
| `Ski_Turn_L`, `Ski_Turn_R` | 2.00 | hold | carved parallel turn at its apex: skis on edge (32°), hips in toward the turn, chest more upright (angulation) and turned a little to the outside, inside ski a little ahead, inside pole forward and ready. Blend from `Ski_Glide` by the turn's strength |
| `Ski_Pole_Plant_L`, `Ski_Pole_Plant_R` | 0.87 | once | from the glide pose: the pole swings forward, its tip touches the snow at 0.33 s ahead of the boot, slides back to the boot by 0.53 s (the skier passing it), back to the glide pose at the end (layer it at a turn's end, or crossfade) |
| `Ski_Tuck` | 2.00 | hold | the speed tuck: low, chest over the thighs, hands together in front, poles under the arms |
| `Ski_Snowplough` | 2.00 | hold | the wedge (bunny pace and braking): tips together, tails apart (14° each), skis on their inside edges, knees in |
| `Ski_Hockey_Stop` | 1.20 | once | from the glide: a rise (0.2 s), the skis swing 78° across to the right with their uphill edges set and the hips low (0.47 s), held to the end; the chest keeps facing down the hill (+x) |
| `Ski_Push` | 1.20 | loop | the flats: a double-pole push (arms up and forward, plant at 0.2 s, crunch and push back to 0.53 s, release, recover). Stands in for `Ski_Skate` |
| `Ski_Fall_L`, `Ski_Fall_R` | 1.40 | once | from the glide: tipping to that side (0.3 s), down on that hip (0.6 s), lying on that side by 1.0 s (shoulder and head on the snow, skis together on their edges below the body, the lower arm out along the snow), held to the end |
| `Ski_GetUp_L`, `Ski_GetUp_R` | 1.93 | once | from the matching fall's last frame: up onto the hip with the near hand on the snow (0.47 s), skis swung under and knees up (0.93 s), up over the skis on the poles (1.4 s), ending in `Ski_Stand`'s pose (1.93 s), so it hands on to `Ski_Stand` or `Ski_Glide`. This is the asked-for `Ski_GetUp`, split by side because a get-up has to start from its own fall's end pose |
| `Ski_Fall` | 1.40 | once | the same as `Ski_Fall_L`, kept so code written against the first delivery still works; prefer the sided names |
| `Ski_Jump` | 1.40 | once | a straight air: crouch (0.2 s), pop (0.33 s), peak at 0.63 s with the skis 0.42 m up (the Board bone rises with them), knees pulled up, touchdown at 0.9 s, absorb (1.03 s), glide pose at the end |
| `Ski_Chair_Sit` | 2.00 | hold | on the chair: `Chairlift_Sit` above the hips, the legs hanging, skis parallel, hip-width, tips dropped 22°, hands on the outside of the lap, poles down past the knees |
| `Ski_Wave` | 1.60 | once | `Chairlift_Wave`'s arm (the right) with the skier's legs; the waving hand holds its pole loosely, trailing down along the forearm past the elbow, outside the shoulder |

## Known gaps
- The skis and poles are the same for everyone (one cream / pine / slate graphic, slate boots); they do not follow
  `ch.board` or the rider's colours.
- The baggy pants make the knees read wider apart than they are, most on M.
- The turns are one pose each (apex); there is no edge-change / transition clip, and no inclination beyond the
  clip's own 32°: if the ride also leans the root (as it does for the board), it should lean less for skis.
- The boot cuff is rigid on the shin and the shell on the foot: at deep ankle bends (tuck, get-up) they overlap a
  little more at the ankle, hidden under the pants.
- Rigged animals (the capybara) cannot ski.
