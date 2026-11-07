# Animal riders: what the game needs from the character pipeline

The owner wants riders to be either a person (the two templates, `tpl_f` / `tpl_m`) or a small animal in snowboard gear. The style reference is the owner's "Rider Pets" sheet: chibi animals in puffy jackets, goggles pushed up on the helmet, mittens, boots, a board. Its pose, expression and outfit rows are part of the reference. The image is `~/Desktop/SnowboardGame/handoff/rider_pets_reference.png`.

They ride in the 3D game: on the chair, turning, carving, jumping, falling. They must be **3D and rigged on the riders' skeleton**, so every clip we already have plays on them. A 2D sprite can't do this in a 3D ride: it would need every pose drawn from 8 directions.

## 1. Who (in two batches)
- **Batch A (the owner's sheet):** `capybara`, `penguin`, `shark` (a cute shark in a hoodie), `red_panda`, `bunny`.
- **Batch B (the resort animals and avatars already in the game):** `fox`, `bear`, `marmot`, `elk`, `moose`, `pika`, `bighorn` (sheep), `ptarmigan`.
  - The existing 3D desk-pet animals are in `assets/animals/3d/*.glb` and are a good colour and character reference. They are a different, simpler style; don't reuse their meshes.

Start with Batch A. Deliver one animal first, `capybara`, so the game can check it, then the rest.

## 2. Style
- **Proportions:** chibi, as on the sheet: big head (about 40% of the height), short limbs, round body, about 1.0–1.2 m tall in game metres next to a 1.6 m person.
- **Look:** soft stylized 3D. Fur is a painted texture with gentle gradients, not hair cards. There are no toon outlines.
- **Palette:** calm and slightly muted, matching the game's paper and watercolour UI and the reference sheet.
- **Faces:** visible and friendly. The no-real-faces rule is for people, not cartoon animals.
- **Gear:** sits on top of the animal, as on the sheet:
  - helmet or beanie
  - goggles
  - puffy jacket and pants
  - mittens and boots
  - a board

## 3. Contract (so the game code needs no special cases)
- **Skeleton:** the same 22 bones, the same names and the same rest-orientation conventions as `tpl_f` / `tpl_m`:
  - `Board`, `Hips`, `Spine`, `Chest`, `Neck`, `Head`
  - `Shoulder.L/R`, `UpperArm.L/R`, `Forearm.L/R`, `Hand.L/R`, `Hand_R_Socket`, `Hand_L_Socket`
  - `Thigh.L/R`, `Shin.L/R`, `Foot.L/R`

  With this skeleton, the clips in `tpl_*_ride.glb` and the rider-page clips in `tpl_*.glb` play by bone name. Check each one on each animal.
  - **Extra bones** for ears, tails and fins are welcome: `Ear.L/R`, `Tail_1..n`. No clip keys them; the game may add a little sway.
- **Clip fixes:** where short arms can't reach in an existing clip (grabs, `Board_Hold`, `Radio_Talk_*`, `Pose_Hold_Photo`), send a per-animal override clip named `<Clip>__<animal>`, e.g. `Melon_Grab__penguin`. The game plays the override when one exists.
  - Penguin flippers and bird wings count as hands. `Hand_*_Socket` goes where the "hand" holds things.
- **Root and facing:** as the templates. Metres, root at the board's base, facing the same way.
- **Materials:** use the same names as the templates wherever the part exists, so the game's colour editor works unchanged:
  - `MAT_jacket`, `MAT_pants`, `MAT_helmet`, `MAT_lens`, `MAT_goggle_frame`, `MAT_goggle_strap`, `MAT_mitten`, `MAT_boot_*`, `MAT_board_top/base`
  - Fur: `MAT_fur` (main) and `MAT_fur_2` (belly, face or patches). The game may let the player tint them a little.
- **Accessories (toggled by the game):**
  - `ACC_Hood`, `ACC_Vest`, `ACC_Visor`, `ACC_Stickers` where they fit
  - from the sheet: `ACC_Beanie` (bobble hat; hides the helmet when on), `ACC_Backpack`, `ACC_Balaclava`, `ACC_Earflap_Hat`
  - Hats must fit around ears: a bunny's ears go through the beanie.
- **Expressions** (nice to have): shape keys `face_blink`, `face_happy`, `face_surprised`, `face_sleepy`, as in the sheet's expression row. A face texture swap also works; say which.
- **Morphs:** body sliders are not needed for animals. Keep `jacket_ease` / `pants_ease` if cheap.
- **Budget:**
  - ≤ 30k triangles drawn per animal
  - one Draco GLB per animal of ≤ 1.5 MB, using `KHR_mesh_quantization` like the templates
  - textures ≤ 1024 px
  - The same file serves the rider page and the ride, so no separate LOD.

## 4. Deliver
- **Folder:** `~/Desktop/SnowboardGame/handoff/animals_A/`.
- **Files:**
  - `<animal>.glb` per animal, no clips inside unless they are `__<animal>` overrides
  - `animals.json`: id, zh / en name, default colours (`MAT_*` → hex), which accessories it has, and its height
- **Note:** a short `HANDOFF_animals_A.md` with md5s, bone and material lists, triangle counts and the overrides.
- **Contact sheet:** rendered with the game's own `src/rider/character.js` in real colours:
  - each animal standing, `Board_Hold`, `Chairlift_Sit`, a carve (`Toeside_Carve`), `Indy_Grab`, `Fall_Toe`
  - front and three-quarter views

## 5. The game side (not the character AI's job)
- **Rider page:**
  - the first-run pick shows people and animals together
  - the body row gets the animals next to 体形 1 / 体形 2
  - the colour editor works through the same `MAT_*` names
- **Ride and riding together:** a friend's `look` carries the animal id.
- **Avatar icons:** the round avatars (`assets/icons/av_*.png`) get each animal in gear, in the sheet's style. These are painted by the owner, like every icon. Wanted:
  - new: `av_capybara`, `av_penguin`, `av_shark`, `av_red_panda`, `av_bunny`
  - repainted in gear: `av_fox`, `av_hare`, `av_marmot`, `av_elk`, `av_bear`
