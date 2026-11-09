// Skiing (双板) for the character templates: the gear (assets/riders/ski_gear.glb: two skis with their bindings on
// the feet, two poles in the palms, hard-shell ski boots on the feet and shins; rigid meshes, one light set for the
// full and the light riders alike) and the Ski_ clips (assets/riders/tpl_f_ski.glb / tpl_m_ski.glb: skeleton only,
// like the ride's clips).
// docs/SKI_RIDERS.md is the contract: file, node and material names, the clips, the axes.
//   const C = await makeCharacter("F"); await addSki(C); C.ski(true); C.play("Ski_Glide");
// addSki loads both files once, merges the Ski_ clips into C.clips and puts the gear, hidden, on C's bones (each
// gear node's extras.attach.F / .M: its bone and its place in that bone's frame, the template's size included);
// C.ski(true) shows the gear (skis, poles, ski boots) and hides the board, its bindings and the snowboard boots;
// C.ski(false) the reverse. Not for the rigged animals (C.pet): it does nothing for them.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/"));
let gearFile = null; const clipFiles = {};
export const loadSki = (tpl) => Promise.all([gearFile ||= loader.loadAsync("assets/riders/ski_gear.glb?v=4"),
  clipFiles[tpl] ||= loader.loadAsync(`assets/riders/tpl_${tpl.toLowerCase()}_ski.glb?v=4`)]);
// Hidden while on skis: the board, its bindings, and the snowboard boots (the gear brings ski boots).
export const ON_BOARD = /^(Board_|Bindings_|Boots_)/;
// The clips, by what they are (durations and loops: docs/SKI_RIDERS.md).
export const SKI_CLIPS = ["Ski_Stand", "Ski_Glide", "Ski_Turn_L", "Ski_Turn_R", "Ski_Pole_Plant_L", "Ski_Pole_Plant_R", "Ski_Tuck",
  "Ski_Snowplough", "Ski_Hockey_Stop", "Ski_Push", "Ski_Fall_L", "Ski_Fall_R", "Ski_GetUp_L", "Ski_GetUp_R", "Ski_Jump", "Ski_Chair_Sit", "Ski_Wave"];

export async function addSki(C) {
  if (C.pet || C.skiGear) return C;
  const [g, k] = await loadSki(C.tpl);
  if (C.skiGear) return C; // added meanwhile
  for (const c of k.animations) C.clips[c.name] = c;
  C.skiGear = [];
  for (const src of g.scene.children) {
    const a = src.userData.attach?.[C.tpl], bone = a && C.bones[a.bone.replace(".", "")]; // the loader drops the dot
    if (!bone) continue;
    const o = src.clone(); o.position.fromArray(a.position); o.quaternion.fromArray(a.quaternion); o.scale.setScalar(a.scale);
    // Its own materials, so a rider's colours (ch.colors.MAT_ski_top, ...) stay theirs.
    o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; m.material = [].concat(m.material).map((x) => x.clone()); if (m.material.length === 1) m.material = m.material[0]; } });
    o.visible = false; bone.add(o); C.skiGear.push(o);
  }
  C.onSki = false;
  C.ski = (on = true) => {
    C.onSki = !!on; for (const o of C.skiGear) o.visible = C.onSki;
    C.root.traverse((o) => { if (o.isMesh && ON_BOARD.test(o.name)) o.visible = !C.onSki; });
  };
  return C;
}
