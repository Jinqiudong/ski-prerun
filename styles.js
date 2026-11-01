// Art styles. The resort, routes and physics stay the same; only how the scene is drawn changes.
//   lowpoly   – soft low-poly with sun shadows (default)
//   ink       – illustrated: toon shading, ink outlines, warm evening light
//   mood      – atmospheric: flat colors, layered haze, mountains as silhouettes
//   satellite – real aerial imagery draped on the terrain (Esri World Imagery)
//   real      – toward realism: physically based snow, ACES tone mapping, crisp light
import * as THREE from "three";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";
import { Sky } from "three/addons/objects/Sky.js";
import { SUN_DIR, drawSymbol } from "./world.js";

export const STYLES = {
  semi: "半写实",
  lowpoly: "低多边形柔和",
  ink: "描边插画",
  mood: "剪影氛围",
  satellite: "卫星实景",
  real: "写实",
  diorama: "微缩沙盘",
  cartoon: "卡通 3D",
  painterly: "手绘水彩",
  topo: "地形图",
  voxel: "体素方块",
};

const toonRamp = (() => {
  const data = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

function eachMesh(root, fn) { root.traverse((o) => { if (o.isMesh && !(o.material instanceof THREE.ShaderMaterial)) fn(o); }); }
function swap(mesh, make) {
  const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const next = list.map((m) => (m.isMeshLambertMaterial ? make(m) : m));
  mesh.material = Array.isArray(mesh.material) ? next : next[0];
}
const setSky = (skyMesh, top, mid, low, glow) => {
  const u = skyMesh.material.uniforms;
  u.top.value.set(top); u.mid.value.set(mid); u.low.value.set(low); u.glow.value.set(glow);
};

// Returns the render function for the chosen style. Every style gets the miniature look-around
// (scene.userData.onArrive); a style may stage it its own way.
export async function applyStyle(name, ctx) {
  const draw = await styled(name, ctx);
  if (!ctx.scene.userData.onArrive) {
    const { renderer, scene, skyMesh, terrain } = ctx;
    const build = miniature(renderer, scene, terrain);
    const far = () => scene.getObjectByName("far") || { visible: true };
    scene.userData.onArrive = (x, z, title, half = 520) => { skyMesh.visible = false; far().visible = false; scene.background = new THREE.Color(0xe3e8ee); scene.fog.near = 1e6; scene.fog.far = 2e6; build(x, z, half, title); };
    scene.userData.onSlope = scene.userData.onMap = () => { build(null); skyMesh.visible = true; far().visible = true; scene.background = null; };
  }
  return draw;
}

async function styled(name, { renderer, scene, skyMesh, terrainMesh, terrain, sun, hemi }) {
  const plain = (s, c) => renderer.render(s, c);
  if (name === "diorama") return diorama({ renderer, scene, skyMesh, terrainMesh, terrain, sun, hemi });
  if (name === "semi") return semi({ renderer, scene, skyMesh, terrainMesh, terrain, sun, hemi });
  if (name === "cartoon") {
    const forestGroup = scene.getObjectByName("forest");
    eachMesh(scene, (m) => swap(m, (old) => new THREE.MeshToonMaterial({ color: old.color, vertexColors: old.vertexColors, map: old.map, transparent: old.transparent, opacity: old.opacity, gradientMap: toonRamp })));
    forestGroup.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshToonMaterial({ color: 0x3fbf6a, gradientMap: toonRamp }); });
    forestGroup.scale.set(1, 1, 1);
    forestGroup.traverse((o) => { if (o.isInstancedMesh) { const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); m.decompose(p, q, sc); sc.multiply(new THREE.Vector3(1.5, 1.0, 1.5)); m.compose(p, q, sc); o.setMatrixAt(i, m); } o.instanceMatrix.needsUpdate = true; } });
    const col = terrainMesh.geometry.attributes.color, c = new THREE.Color();
    for (let i = 0; i < col.count; i++) { c.setRGB(col.getX(i), col.getY(i), col.getZ(i)); c.lerp(new THREE.Color(0xffffff), 0.35); c.offsetHSL(0.02, 0.15, 0); col.setXYZ(i, c.r, c.g, c.b); }
    col.needsUpdate = true;
    setSky(skyMesh, 0x3f9cff, 0x9fd3ff, 0xe8f6ff, 0xfff6c8);
    scene.fog.color.set(0xcfeaff);
    sun.color.set(0xffffff); sun.intensity = 2.8;
    hemi.color.set(0xd6ecff); hemi.groundColor.set(0xa8b8e8);
    return plain;
  }
  if (name === "painterly") {
    eachMesh(scene, (m) => swap(m, (old) => new THREE.MeshToonMaterial({ color: old.color, vertexColors: old.vertexColors, map: old.map, transparent: old.transparent, opacity: old.opacity, gradientMap: ramp4 })));
    // Brushy color: break up the snow with soft blotches of warm and cool tints.
    const pos = terrainMesh.geometry.attributes.position, col = terrainMesh.geometry.attributes.color, c = new THREE.Color();
    const warm = new THREE.Color(0xf7dcc7), cool = new THREE.Color(0xa9b4e6);
    for (let i = 0; i < col.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const w = 0.5 + 0.5 * Math.sin(x / 90 + Math.sin(z / 130) * 2) * Math.cos(z / 110 + Math.sin(x / 70));
      c.setRGB(col.getX(i), col.getY(i), col.getZ(i)).lerp(w > 0.5 ? warm : cool, Math.abs(w - 0.5) * 0.7);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    setSky(skyMesh, 0x8fa6d8, 0xe9c9d6, 0xfde6cf, 0xffd6a0);
    scene.fog.color.set(0xeed6d6);
    renderer.domElement.style.filter = "saturate(1.05) contrast(0.95) blur(0.5px)";
    paperOverlay();
    return plain;
  }
  if (name === "topo") {
    const forestGroup = scene.getObjectByName("forest");
    forestGroup.visible = false;
    const pos = terrainMesh.geometry.attributes.position, col = terrainMesh.geometry.attributes.color, n = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < col.count; i++) {
      const forest = col.getX(i) < 0.9 && col.getZ(i) > col.getX(i); // forest floor and shade carry a cooler tint
      terrain.normalAt(pos.getX(i), pos.getZ(i), n);
      const shade = 0.78 + 0.22 * Math.max(0, n.dot(new THREE.Vector3(-0.5, 0.8, -0.3).normalize()));
      c.set(forest ? 0xdbe8d4 : 0xfbfbf8).multiplyScalar(shade);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    terrainMesh.material = new THREE.MeshBasicMaterial({ vertexColors: true });
    terrainMesh.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying float vH;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvH = position.y;");
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vH;").replace("#include <dithering_fragment>", `#include <dithering_fragment>
        float minor = abs(fract(vH / 20.0 - 0.5) - 0.5) / fwidth(vH / 20.0);
        float major = abs(fract(vH / 100.0 - 0.5) - 0.5) / fwidth(vH / 100.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.62, 0.52, 0.42), (1.0 - min(minor, 1.0)) * 0.45);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.45, 0.33, 0.25), (1.0 - min(major / 1.4, 1.0)) * 0.8);`);
    };
    setSky(skyMesh, 0xe9eef2, 0xf4f6f7, 0xffffff, 0xffffff);
    scene.fog.color.set(0xf2f4f5);
    renderer.shadowMap.enabled = false;
    return plain;
  }
  if (name === "voxel") return voxel({ renderer, scene, skyMesh, terrainMesh, terrain, sun, hemi });
  if (name === "ink") {
    eachMesh(scene, (m) => swap(m, (old) => new THREE.MeshToonMaterial({ color: old.color, vertexColors: old.vertexColors, map: old.map, transparent: old.transparent, opacity: old.opacity, gradientMap: toonRamp })));
    setSky(skyMesh, 0xc9a7c7, 0xf2c9b8, 0xfbe3c4, 0xffc58a);
    scene.fog.color.set(0xf0d4c4);
    sun.color.set(0xffcf9e); sun.intensity = 2.4;
    hemi.color.set(0xf6e1ff); hemi.groundColor.set(0x9b8fc4);
    const outline = new OutlineEffect(renderer, { defaultThickness: 0.0035, defaultColor: [0.14, 0.13, 0.2], defaultAlpha: 0.9 });
    return (s, c) => outline.render(s, c);
  }
  if (name === "mood") {
    // Color by altitude, no lighting: mountains read as layered shapes fading into haze.
    const pos = terrainMesh.geometry.attributes.position, col = terrainMesh.geometry.attributes.color;
    const lowC = new THREE.Color(0x5b5f97), highC = new THREE.Color(0xf3c6c9), c = new THREE.Color();
    const top = terrain.h.reduce((a, b) => Math.max(a, b), 0);
    for (let i = 0; i < pos.count; i++) { c.copy(lowC).lerp(highC, Math.pow(pos.getY(i) / top, 0.8)); col.setXYZ(i, c.r, c.g, c.b); }
    col.needsUpdate = true;
    eachMesh(scene, (m) => swap(m, (old) => new THREE.MeshBasicMaterial({ color: old === terrainMesh.material ? 0xffffff : 0x2b2d4f, vertexColors: old === terrainMesh.material, transparent: old.transparent, opacity: old.opacity })));
    terrainMesh.material = new THREE.MeshBasicMaterial({ vertexColors: true });
    setSky(skyMesh, 0x3a3f7a, 0xc77d9a, 0xffb38a, 0xffe0a0);
    scene.fog.color.set(0xd99a9f);
    scene.userData.fogScale = 0.45; // thicker haze
    renderer.shadowMap.enabled = false;
    return plain;
  }
  if (name === "satellite") {
    const tex = await satelliteTexture(terrain);
    const geo = terrainMesh.geometry, pos = geo.attributes.position, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) - terrain.x0) / (terrain.x1 - terrain.x0);
      uv[i * 2 + 1] = 1 - (pos.getZ(i) - terrain.z0) / (terrain.z1 - terrain.z0);
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    terrainMesh.material = new THREE.MeshLambertMaterial({ map: tex });
    scene.getObjectByName("forest").visible = false; // the imagery already shows the forest
    setSky(skyMesh, 0x6f9fd8, 0xbcd6ef, 0xe8eef4, 0xfff1d6);
    scene.fog.color.set(0xc9d9ea);
    sun.color.set(0xffffff); sun.intensity = 1.6;
    hemi.intensity = 1.6;
    return plain;
  }
  if (name === "real") {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const sparkle = snowNormalMap();
    eachMesh(scene, (m) => swap(m, (old) => new THREE.MeshStandardMaterial({ color: old.color, vertexColors: old.vertexColors, map: old.map, transparent: old.transparent, opacity: old.opacity, roughness: 0.9, metalness: 0 })));
    terrainMesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, normalMap: sparkle, normalScale: new THREE.Vector2(0.35, 0.35) });
    const pos = terrainMesh.geometry.attributes.position, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) / 6; uv[i * 2 + 1] = pos.getZ(i) / 6; }
    terrainMesh.geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    setSky(skyMesh, 0x2f6fc4, 0x8fb8e6, 0xdfe9f3, 0xfff3dc);
    scene.fog.color.set(0xc4d6ea);
    sun.color.set(0xfff4e6); sun.intensity = 3.4;
    hemi.color.set(0xbcd4ff); hemi.groundColor.set(0x8a8fa6); hemi.intensity = 1.1;
    return plain;
  }
  return plain;
}

const ramp4 = (() => {
  const t = new THREE.DataTexture(new Uint8Array([70, 135, 200, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

// Watercolor paper grain over the canvas.
function paperOverlay() {
  const div = document.createElement("div");
  div.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:1;mix-blend-mode:multiply;opacity:.35;" +
    "background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/><feColorMatrix values='0 0 0 0 0.55  0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0.9 0'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>\")";
  document.body.appendChild(div);
}

// Miniature model: the resort (or the area around a lift top) cut out as a block on a plinth.
function diorama({ renderer, scene, skyMesh, terrainMesh, terrain, sun, hemi }) {
  skyMesh.visible = false;
  const farMesh = scene.getObjectByName("far");
  if (farMesh) farMesh.visible = false;
  scene.fog.near = 1e6; scene.fog.far = 2e6;
  scene.userData.noFog = true;
  scene.background = new THREE.Color(0xe9e7e3);
  const build = miniature(renderer, scene, terrain);
  scene.userData.onMap = () => build(0, 0, 1e5, "Copper Mountain");
  scene.userData.onArrive = (x, z, title, half = 520) => build(x, z, half, title);
  scene.userData.onSlope = () => build(null);
  scene.userData.onMap();
  scene.userData.mapScale = 2.4;
  sun.intensity = 2.2;
  hemi.color.set(0xffffff); hemi.groundColor.set(0xc9c6d6);
  return (s, c) => renderer.render(s, c);
}

// A block of terrain cut out around (cx, cz) and set on a plinth with a name plate; build(null) removes it.
export function miniature(renderer, scene, terrain, look = {}) {
  renderer.localClippingEnabled = true;
  const base = -220;
  let block = null;
  const build = (cx, cz, half, title) => {
    if (block) { scene.remove(block); block.traverse((o) => o.geometry?.dispose()); block = null; }
    if (cx === null) { renderer.clippingPlanes = []; return; }
    const x0 = Math.max(terrain.x0, cx - half), x1 = Math.min(terrain.x1, cx + half), z0 = Math.max(terrain.z0, cz - half), z1 = Math.min(terrain.z1, cz + half);
    renderer.clippingPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), x1),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -z0), new THREE.Plane(new THREE.Vector3(0, 0, -1), z1),
    ];
    const bottom = Math.min(...[[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => terrain.heightAt(x, z))) + base;
    block = new THREE.Group();
    const soil = new THREE.MeshLambertMaterial({ color: 0xf3f1ed });
    const edge = (ax, az, bx, bz) => {
      const steps = 80, pos = [], idx = [];
      for (let i = 0; i <= steps; i++) {
        const x = ax + ((bx - ax) * i) / steps, z = az + ((bz - az) * i) / steps;
        pos.push(x, terrain.heightAt(x, z), z, x, bottom, z);
        if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      block.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, clippingPlanes: [] })));
    };
    edge(x0, z0, x1, z0); edge(x1, z0, x1, z1); edge(x1, z1, x0, z1); edge(x0, z1, x0, z0);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 30, 160, z1 - z0 + 30), new THREE.MeshLambertMaterial({ color: look.plinth ?? 0xdedbd5, clippingPlanes: [] }));
    plinth.position.set((x0 + x1) / 2, bottom - 80, (z0 + z1) / 2);
    block.add(plinth);
    const c = document.createElement("canvas"); c.width = 1024; c.height = 160;
    const g = c.getContext("2d");
    g.fillStyle = look.plate ?? "#5d616e"; g.fillRect(0, 0, 1024, 160);
    g.fillStyle = "#f2f2f2"; g.font = "bold 84px Helvetica, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(title, 512, 84);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(x1 - x0, 1600) * 0.6, Math.min(x1 - x0, 1600) * 0.6 * 0.156), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), clippingPlanes: [] }));
    plate.position.set((x0 + x1) / 2, bottom - 80, z0 - 16);
    plate.rotation.y = Math.PI;
    block.add(plate);
    scene.add(block);
  };
  return build;
}

// Semi-realistic: physical sky and image-based light, textured snow with rock on steep ground,
// snow-laden conifers, modern resort signage and stations. The lift-top look-around is a miniature.
async function semi({ renderer, scene, skyMesh, terrainMesh, terrain, sun, hemi }) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.classList.add("theme-semi");
  // A deep winter-blue sky to look at; the physical sky lights the scene from the same sun.
  setSky(skyMesh, 0x1d5cc0, 0x6ea6ea, 0xdcebf8, 0xfff2dc);
  const sky = new Sky();
  sky.scale.setScalar(45000);
  const u = sky.material.uniforms;
  u.turbidity.value = 1.6; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
  u.sunPosition.value.copy(SUN_DIR).multiplyScalar(1000);
  const envScene = new THREE.Scene();
  envScene.add(sky.clone());
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0.04).texture;
  scene.environmentIntensity = 0.55;
  scene.fog.color.set(0xcfe1f4);
  scene.userData.fogScale = 4; // see the ranges 30 km away through a light blue haze
  sun.color.set(0xfff3e6); sun.intensity = 3.6;
  hemi.color.set(0xcfe0ff); hemi.groundColor.set(0x7d8aa6); hemi.intensity = 0.45;

  const load = (f, srgb) => new Promise((res) => new THREE.TextureLoader().load(`assets/tex/${f}`, (t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    res(t);
  }));
  const [snowD, snowN, rockD] = await Promise.all([load("snow_02_diff_1k.jpg", true), load("snow_02_nor_gl_1k.jpg"), load("aerial_rocks_02_diff_1k.jpg", true)]);

  // Terrain: baked sun shadow stays in the vertex colors; texture by world position, rock where steep,
  // fading to a flat snow tone in the distance so the far mountain does not shimmer.
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { snowD: { value: snowD }, snowN: { value: snowN }, rockD: { value: rockD } });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP; varying vec3 vWN;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform sampler2D snowD, snowN, rockD; varying vec3 vWP; varying vec3 vWN;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float fade = smoothstep(350.0, 2600.0, length(vWP - cameraPosition));
        vec3 sn = mix(texture2D(snowD, vWP.xz / 7.0).rgb * 1.08, vec3(0.93, 0.94, 0.96), fade);
        vec3 rk = mix(texture2D(rockD, vWP.xz / 45.0).rgb, vec3(0.42, 0.40, 0.40), fade * 0.6);
        float rockW = smoothstep(0.30, 0.48, 1.0 - vWN.y);
        diffuseColor.rgb *= mix(sn, rk * 1.4, rockW);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        vec3 nt = texture2D(snowN, vWP.xz / 7.0).xyz * 2.0 - 1.0;
        normal = normalize(normal + (viewMatrix * vec4(nt.x, 0.0, -nt.y, 0.0)).xyz * 0.45 * (1.0 - fade));`);
  };
  // Vertex colors: keep the mountain shadow, drop the stylized rock tint (the rock texture does that now).
  const pos = terrainMesh.geometry.attributes.position, col = terrainMesh.geometry.attributes.color;
  const shade = new THREE.Color(0x8fa0cf), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const s0 = terrain.sunShadow(pos.getX(i), pos.getZ(i), pos.getY(i));
    c.set(0xffffff).lerp(shade, s0 * 0.5);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
  terrainMesh.material = mat;

  // Snow-laden conifers: five narrow tiers, white on the upper faces.
  scene.getObjectByName("forest").traverse((o) => {
    if (!o.isInstancedMesh) return;
    o.geometry = conifer();
    o.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  });
  // Everything else to physically based materials; modern station colors.
  scene.traverse((o) => {
    if (!o.isMesh || o === terrainMesh || o.material instanceof THREE.ShaderMaterial) return;
    const m = o.material;
    if (m.isMeshLambertMaterial) {
      const hex = m.color.getHex();
      o.material = new THREE.MeshStandardMaterial({
        color: hex === 0xb4483f ? 0x2f3540 : hex === 0x9a9fae ? 0xd9dde3 : hex, vertexColors: m.vertexColors, map: m.map,
        transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite, roughness: 0.7, metalness: hex === 0x7c8193 ? 0.6 : 0,
        polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits,
      });
    }
    if (o.userData.signRun) { o.material.map = signTexture(o.userData.signRun); o.material.needsUpdate = true; }
  });
  // Map: runs read as resort-map lines with a white casing.
  scene.traverse((o) => { if (o.isMesh && o.material?.color?.getHex?.() === 0xc4c8d8) { o.material.color.set(0xffffff); o.material.opacity = 0.65; } });

  const build = miniature(renderer, scene, terrain, { plinth: 0x2a3140, plate: "#11161f" });
  scene.userData.onArrive = (x, z, title, half = 520) => { skyMesh.visible = false; scene.getObjectByName("far").visible = false; scene.background = new THREE.Color(0xdfe6ee); scene.fog.near = 1e6; scene.fog.far = 2e6; build(x, z, half, title); };
  const back = () => { build(null); skyMesh.visible = true; scene.getObjectByName("far").visible = true; scene.background = null; };
  scene.userData.onSlope = back;
  scene.userData.onMap = back;
  return (s2, c2) => renderer.render(s2, c2);
}

function conifer() {
  const tiers = [[0.8, 5, 3.4], [3.4, 5, 2.9], [6.0, 4.6, 2.3], [8.4, 4.2, 1.7], [10.6, 3.6, 1.1]];
  const pos = [], colr = [];
  const green = new THREE.Color(0x1d3a2c), snow = new THREE.Color(0xeef3fa), c = new THREE.Color();
  for (const [y, h, r] of tiers) {
    const g = new THREE.ConeGeometry(r, h, 8, 1, true).toNonIndexed();
    g.translate(0, y + h / 2, 0);
    g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      const top = (p.getY(i) - y) / h;
      c.copy(green).lerp(snow, Math.min(0.85, Math.max(0, n.getY(i)) * 0.7 * (0.35 + top * 0.65) + (top > 0.98 ? 0.3 : 0)));
      colr.push(c.r, c.g, c.b);
    }
  }
  const trunk = new THREE.CylinderGeometry(0.25, 0.35, 1.2, 6).toNonIndexed();
  trunk.translate(0, 0.6, 0);
  for (let i = 0; i < trunk.attributes.position.count; i++) { pos.push(...trunk.attributes.position.array.slice(i * 3, i * 3 + 3)); colr.push(0.24, 0.17, 0.12); }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(colr, 3));
  out.computeVertexNormals();
  return out;
}

// Modern resort trail sign: dark panel, difficulty symbol, run name, arrow.
function signTexture(run) {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 128;
  const g = cv.getContext("2d");
  g.fillStyle = "#18202b"; g.fillRect(0, 0, 512, 128);
  g.fillStyle = "#f4f6f8"; g.fillRect(0, 118, 512, 10);
  g.fillStyle = "#f4f6f8"; g.beginPath(); g.arc(64, 60, 40, 0, Math.PI * 2); g.fill();
  drawSymbol(g, run.level, 64, 60, 28);
  g.fillStyle = "#ffffff"; g.font = "600 46px Helvetica, Arial, sans-serif"; g.textBaseline = "middle";
  let t = run.name;
  while (g.measureText(t).width > 330 && t.length > 3) t = t.slice(0, -2) + "…";
  g.fillText(t, run.level === "expert" ? 150 : 124, 62);
  g.font = "600 52px Helvetica, Arial, sans-serif"; g.fillText("→", 458, 60);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Voxel: the mountain rebuilt from blocks, trees as stacked cubes.
function voxel({ renderer, scene, skyMesh, terrainMesh, terrain, sun, hemi }) {
  const cell = 16, step = 3;
  const nx = Math.floor((terrain.x1 - terrain.x0) / cell), nz = Math.floor((terrain.z1 - terrain.z0) / cell);
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(cell, 1, cell), new THREE.MeshLambertMaterial(), nx * nz);
  const m = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const col = terrainMesh.geometry.attributes.color;
  let k = 0;
  for (let i = 0; i < nz; i++) {
    for (let j = 0; j < nx; j++) {
      const x = terrain.x0 + (j + 0.5) * cell, z = terrain.z0 + (i + 0.5) * cell;
      const top = Math.round(terrain.heightAt(x, z) / step) * step;
      p.set(x, top - 30, z); s.set(1, 60, 1);
      m.compose(p, q, s);
      mesh.setMatrixAt(k, m);
      const gj = Math.round(((x - terrain.x0) / (terrain.x1 - terrain.x0)) * (terrain.gw - 1)), gi = Math.round(((z - terrain.z0) / (terrain.z1 - terrain.z0)) * (terrain.gh - 1));
      const v = gi * terrain.gw + gj;
      c.setRGB(col.getX(v), col.getY(v), col.getZ(v));
      mesh.setColorAt(k++, c);
    }
  }
  mesh.receiveShadow = true;
  scene.add(mesh);
  terrainMesh.material.visible = false;
  scene.getObjectByName("forest").traverse((o) => {
    if (!o.isInstancedMesh) return;
    o.geometry = (() => {
      const g = new THREE.BoxGeometry(7, 7, 7); g.translate(0, 5, 0);
      const top = new THREE.BoxGeometry(4, 6, 4); top.translate(0, 11, 0);
      const pos = [...g.toNonIndexed().attributes.position.array, ...top.toNonIndexed().attributes.position.array];
      const out = new THREE.BufferGeometry();
      out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(0).map((_, i) => [0.2, 0.42, 0.3][i % 3]), 3));
      out.computeVertexNormals();
      return out;
    })();
  });
  setSky(skyMesh, 0x7fb6f0, 0xc7e2f7, 0xf0f6fa, 0xffffff);
  scene.fog.color.set(0xd8e8f4);
  return (s2, c2) => renderer.render(s2, c2);
}

// Wind-packed snow: fine random bumps that catch the light.
function snowNormalMap() {
  const n = 256, c = document.createElement("canvas");
  c.width = c.height = n;
  const g = c.getContext("2d"), img = g.createImageData(n, n);
  let seed = 3;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n * n; i++) {
    const x = (rand() - 0.5) * 120, y = (rand() - 0.5) * 120;
    img.data.set([128 + x, 128 + y, 255, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Esri World Imagery tiles (z15) stitched into one texture over the resort's bounds.
async function satelliteTexture(terrain) {
  const { lat, lon } = terrain.data.origin;
  const mx = 111320 * Math.cos((lat * Math.PI) / 180), mz = 110574;
  const W = lon + terrain.x0 / mx, E = lon + terrain.x1 / mx, N = lat - terrain.z0 / mz, S = lat - terrain.z1 / mz;
  const z = 15, n = 2 ** z;
  const tx = (lo) => ((lo + 180) / 360) * n;
  const ty = (la) => ((1 - Math.asinh(Math.tan((la * Math.PI) / 180)) / Math.PI) / 2) * n;
  const x0 = Math.floor(tx(W)), x1 = Math.floor(tx(E)), y0 = Math.floor(ty(N)), y1 = Math.floor(ty(S));
  const size = 2048, canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const jobs = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      jobs.push(new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          // Tile corners in texture space (linear in lon; latitude via the same mapping as the terrain).
          const lo0 = (x / n) * 360 - 180, lo1 = ((x + 1) / n) * 360 - 180;
          const la = (yy) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) * 180) / Math.PI;
          const u0 = ((lo0 - W) / (E - W)) * size, u1 = ((lo1 - W) / (E - W)) * size;
          const v0 = ((N - la(y)) / (N - S)) * size, v1 = ((N - la(y + 1)) / (N - S)) * size;
          g.drawImage(img, u0, v0, u1 - u0 + 0.5, v1 - v0 + 0.5);
          resolve();
        };
        img.onerror = resolve;
        img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
      }));
    }
  }
  await Promise.all(jobs);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
