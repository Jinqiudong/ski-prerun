// The first screen: pick a rider (a default one, or one you dressed and named before), recolour its
// jacket, pants, helmet and goggles, then pick a resort. Riders are saved on this phone only.
import * as THREE from "three";
import { RIDERS, PART_ZH, loadBoarder, boarderModel, poseBoarder, dressRider } from "./boarder.js?v=3";

const $ = (id) => document.getElementById(id);
const DEFAULT_SLOTS = 4; // the four default riders; the ones not made yet show as coming
// A muted outdoor palette (stone, sage, slate, clay...): nothing loud, and any mix of them goes together.
const SWATCHES = {
  jacket: ["#464e3f", "#6f7a62", "#8e9681", "#4a5a6e", "#2f3a4c", "#7b8a96", "#a39d8f", "#c2b49a", "#a8674f", "#8e4a36", "#a88584", "#6e5f6e", "#3b3d40", "#dcd7cc"],
  pants: ["#c5c4b6", "#dcd7cc", "#a39d8f", "#8f8670", "#4f5645", "#4a5a6e", "#2f3a4c", "#9c6a55", "#3b3d40", "#222326"],
  helmet: ["#161819", "#3b3d40", "#d9d6ce", "#8f8b82", "#4a5a6e", "#55604b", "#b8a98c", "#9a5f4a"],
  lens: ["#ad5599", "#3a3c42", "#b8873e", "#b78473", "#7f9fb8", "#6f8f7a", "#9aa1a8"],
};

// ---- Saved state: { kind, rider (an id or a default's key), riders: [{ id, base, name, colors }] }
const load = () => { try { return JSON.parse(localStorage.getItem("prerun") || "{}"); } catch { return {}; } };
const st = load();
st.riders ||= [];
const save = () => localStorage.setItem("prerun", JSON.stringify(st));
const chosen = () => st.riders.find((r) => r.id === st.rider) || { id: st.rider in RIDERS ? st.rider : "rider_a", base: st.rider in RIDERS ? st.rider : "rider_a", name: RIDERS[st.rider]?.name || RIDERS.rider_a.name, colors: {}, isDefault: true };

// ---- The 3D preview: the rider on a little snow disc, turning slowly; drag to turn it yourself.
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
scene.add(new THREE.HemisphereLight(0xdfeaff, 0x8a96a8, 1.6));
const sun = new THREE.DirectionalLight(0xfff3e2, 2.4);
sun.position.set(2, 4, 3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 });
scene.add(sun);
const disc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 48), new THREE.MeshStandardMaterial({ color: 0xf6f8fb, roughness: 0.9 }));
disc.rotation.x = -Math.PI / 2; disc.receiveShadow = true;
scene.add(disc);
const turntable = new THREE.Group();
scene.add(turntable);
let rider = null, spin = 0.6, drag = null;
const still = { x: 0, y: 0, z: 0, n: new THREE.Vector3(0, 1, 0), heading: 0, steer: 0, lean: 0, skid: 0, tuck: 0, speed: 0, dt: 1 / 30 };
function resize() {
  const w = innerWidth, h = innerHeight * 0.58;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  camera.position.set(0, 1.3, 5.4); camera.lookAt(0, 0.62, 0);
}
addEventListener("resize", resize); resize();
canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, a: turntable.rotation.y }; });
addEventListener("pointermove", (e) => { if (drag) turntable.rotation.y = drag.a + (e.clientX - drag.x) / 120; });
addEventListener("pointerup", () => { drag = null; });
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!drag) turntable.rotation.y += spin * dt;
  if (rider) poseBoarder(rider, still);
  renderer.render(scene, camera);
});

async function show(r) {
  await loadBoarder(RIDERS[r.base].file);
  if (!rider) {
    rider = boarderModel();
    rider.rotation.y = Math.PI / 2; // the board across the view, the rider facing the camera
    turntable.add(rider);
    $("status").hidden = true;
  }
  dressRider(rider.userData.model, r.base, r.colors);
  $("who").textContent = r.name;
}

// ---- Picking
const dots = (r) => `<span class="dots">${Object.keys(RIDERS[r.base].parts).map((p) => `<i style="background:${r.colors?.[p] || RIDERS[r.base].parts[p].color}"></i>`).join("")}</span>`;
function renderPick() {
  const cur = chosen();
  $("defaults").innerHTML = "";
  const keys = Object.keys(RIDERS);
  for (let i = 0; i < DEFAULT_SLOTS; i++) {
    const key = keys[i], b = document.createElement("button");
    b.className = "card" + (key && cur.isDefault && cur.base === key ? " on" : "");
    if (key) {
      b.innerHTML = `<b>${RIDERS[key].name}</b>${dots({ base: key, colors: {} })}<small>单板</small>`;
      b.onclick = () => { st.rider = key; save(); renderPick(); show(chosen()); };
    } else { b.disabled = true; b.innerHTML = `<b>制作中</b><small>新人物</small>`; }
    $("defaults").append(b);
  }
  $("mine").innerHTML = st.riders.length ? "" : `<div class="card" style="flex-basis:100%;height:auto;cursor:default"><small>还没有。选一个默认人物，点「换装」改颜色、取名字，就会存到这里。</small></div>`;
  for (const r of st.riders) {
    const b = document.createElement("div");
    b.className = "card" + (r.id === cur.id ? " on" : "");
    b.innerHTML = `<b>${escape(r.name)}</b>${dots(r)}<small>${RIDERS[r.base].name}</small><button class="del" aria-label="删除">🗑</button>`;
    b.onclick = (e) => {
      if (e.target.closest(".del")) {
        if (!confirm(`删除「${r.name}」？`)) return;
        st.riders = st.riders.filter((x) => x !== r);
        if (st.rider === r.id) st.rider = r.base;
        save(); renderPick(); show(chosen()); return;
      }
      st.rider = r.id; save(); renderPick(); show(r);
    };
    $("mine").append(b);
  }
  $("editBtn").textContent = cur.isDefault ? "🎨 换装 · 存成新人物" : "🎨 换装";
}
const escape = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---- Dressing: a draft copy, previewed live; saving a default's draft makes a new rider of yours.
let draft = null;
function openEdit() {
  const cur = chosen();
  draft = { id: cur.isDefault ? null : cur.id, base: cur.base, name: cur.isDefault ? "" : cur.name, colors: { ...cur.colors } };
  const parts = RIDERS[draft.base].parts;
  $("parts").innerHTML = "";
  for (const [part, p] of Object.entries(parts)) {
    const wrap = document.createElement("div");
    wrap.className = "part";
    wrap.innerHTML = `<div class="lbl">${PART_ZH[part]}</div><div class="row"></div>`;
    const row = wrap.querySelector(".row");
    const list = [...new Set([p.color, ...(SWATCHES[part] || [])])];
    const mark = () => { for (const s of row.children) s.classList.toggle("on", s.dataset.c === (draft.colors[part] || p.color)); };
    for (const c of list) {
      const s = document.createElement("button");
      s.className = "sw"; s.style.background = c; s.dataset.c = c;
      s.onclick = () => { draft.colors[part] = c; mark(); show(draft); };
      row.append(s);
    }
    mark();
    $("parts").append(wrap);
  }
  $("name").value = draft.name;
  view("edit");
}
$("editBtn").onclick = openEdit;
$("cancelBtn").onclick = () => { view("pick"); show(chosen()); };
$("saveBtn").onclick = () => {
  const name = $("name").value.trim();
  if (!name) { $("name").focus(); $("name").placeholder = "先取个名字"; return; }
  draft.name = name;
  if (draft.id) Object.assign(st.riders.find((r) => r.id === draft.id), draft);
  else { draft.id = "r" + Date.now().toString(36); st.riders.push(draft); }
  st.rider = draft.id; save();
  view("pick"); renderPick(); show(chosen());
};

// ---- Resorts
$("useBtn").onclick = async () => {
  st.kind = "board"; save();
  view("resort");
  const list = await (await fetch("data/resorts.json")).json();
  $("resorts").innerHTML = "";
  for (const r of list) {
    const b = document.createElement("button");
    b.className = "resort"; b.disabled = !r.ready;
    b.innerHTML = `<span><b>${r.name}</b><small>${r.zh} · ${r.state}${r.ready ? "" : " · 即将加入"}</small></span><span>${r.ready ? "›" : ""}</span>`;
    b.onclick = () => { st.resort = r.id; save(); location.href = `mountain/?resort=${encodeURIComponent(r.id)}`; };
    $("resorts").append(b);
  }
};
$("backBtn").onclick = () => view("pick");
function view(v) {
  $("pickView").hidden = v !== "pick"; $("editView").hidden = v !== "edit"; $("resortView").hidden = v !== "resort";
  $("headTitle").textContent = { pick: "选你的 Rider", edit: "换装", resort: "去哪个雪场" }[v];
  $("headSub").textContent = { pick: "先选人物，再选雪场", edit: "改颜色，取个名字，保存到这台手机", resort: `${chosen().name} · 单板` }[v];
}

renderPick();
show(chosen()).catch((e) => { $("status").textContent = "人物没加载出来，刷新试试"; console.warn(e); });
