// Where each run and lift falls on a resort's watercolour (assets/wc/<id>.jpg), so the ride's painted map
// can ink the runs you've skied onto the painting. Same view as tools/capture_vista.mjs, the same crop and
// width as tools/watercolor.py. Needs puppeteer-core, Chrome and the site served (PORT, default 8766).
//
// The mountain page turns slowly on its own, so the painting was taken at some unknown turn of the hero
// view. With the raw capture the painting was made from (vista_<id>.png from capture_vista.mjs, in --ref),
// we find that turn: render the hero view turned by `az` and keep the az whose picture matches the capture
// best. The az is written to the output, and reused on the next bake when no capture is given.
// Besides the runs and lifts, a grid of the terrain's projection (`grid`) lets the game place any point
// (you, friends, a tap) on the painting and back.
//
// usage: PORT=8787 node tools/bake_vista_lines.mjs [--ref dir] <resort id> ...   → data/vista/<id>.json
import puppeteer from "puppeteer-core";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
const CROP = [120, 150, 830, 620], W = 700; // watercolor.py: crop, then resize to W wide
const PORT = process.env.PORT || 8766, URL = `http://127.0.0.1:${PORT}`;
const args = process.argv.slice(2), ri = args.indexOf("--ref"), REF = ri >= 0 ? args.splice(ri, 2)[1] : null;
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal"] });
const p = await b.newPage();
await p.setViewport({ width: 900, height: 700, deviceScaleFactor: 1 });
await p.goto(`${URL}/start.html`); await p.evaluate(() => localStorage.setItem("prerun", JSON.stringify({ rider: "rider_a" })));
mkdirSync("data/vista", { recursive: true });
for (const id of args) {
  await p.goto(`${URL}/mountain/?resort=${id}`);
  await p.waitForFunction(() => window.__mtn && !document.getElementById("status") && document.querySelector("[data-wx]"), { timeout: 180000, polling: 1000 });
  await new Promise((x) => setTimeout(x, 6000));
  // As capture_vista.mjs: a clear 10 am, no runs or lifts drawn; and the turning stopped (#spin toggles it).
  await p.evaluate(() => {
    const s = document.getElementById("hour"); s.value = 10; s.dispatchEvent(new Event("input")); document.querySelector("[data-wx=clear]").click();
    for (const b of document.querySelectorAll("button")) if (["雪道", "缆车"].includes(b.textContent.trim())) b.click();
    const sp = document.getElementById("spin"); sp.click(); sp.click();
    document.querySelector("[data-view=hero]")?.click();
  });
  await new Promise((x) => setTimeout(x, 2500));
  // Once more, now that the turning's damping has died out; then stop drawing, so the camera stays ours.
  await p.evaluate(() => { document.querySelector("[data-view=hero]")?.click(); });
  await new Promise((x) => setTimeout(x, 400));
  await p.evaluate(() => window.__mtn.renderer.setAnimationLoop(null));
  const file = `data/vista/${id}.json`, old = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  const ref = REF && existsSync(`${REF}/vista_${id}.png`) ? `data:image/png;base64,${readFileSync(`${REF}/vista_${id}.png`).toString("base64")}` : null;
  // Remember the hero pose, then turn about the target by az (radians, positive = the way autoRotate turns).
  await p.evaluate(() => { const { camera } = window.__mtn; window.__hero = { pos: camera.position.clone(), q: camera.quaternion.clone() }; });
  const score = (az) => p.evaluate(async (az) => {
    const { camera, scene, renderer, THREE } = window.__mtn, h = window.__hero;
    const t = window.__mtn.controls.target, off = h.pos.clone().sub(t).applyAxisAngle(new THREE.Vector3(0, 1, 0), -az);
    camera.position.copy(t).add(off); camera.quaternion.copy(h.q).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -az));
    camera.updateMatrixWorld(true);
    if (!window.__ref) return 0;
    renderer.render(scene, camera);
    const c = window.__cmp || (window.__cmp = Object.assign(document.createElement("canvas"), { width: 180, height: 140 })), g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(renderer.domElement, 0, 0, 180, 140);
    const a = g.getImageData(0, 0, 180, 140).data, r = window.__ref;
    let e = 0; for (let k = 0; k < a.length; k += 4) { const d = (a[k] + a[k + 1] + a[k + 2]) - r[k / 4]; e += d * d; }
    return e / (a.length / 4);
  }, az);
  let az = old?.az ?? 0;
  if (ref) {
    await p.evaluate(async (src) => {
      const im = new Image(); im.src = src; await im.decode();
      const c = Object.assign(document.createElement("canvas"), { width: 180, height: 140 }), g = c.getContext("2d"); g.drawImage(im, 0, 0, 180, 140);
      const d = g.getImageData(0, 0, 180, 140).data, r = new Float32Array(180 * 140); for (let k = 0; k < r.length; k++) r[k] = d[k * 4] + d[k * 4 + 1] + d[k * 4 + 2];
      window.__ref = r;
    }, ref);
    let best = [Infinity, 0];
    for (let a = -0.9; a <= 0.9 + 1e-9; a += 0.02) { const s = await score(a); if (s < best[0]) best = [s, a]; }
    for (let step = 0.01; step > 0.0005; step /= 2) for (const a of [best[1] - step, best[1] + step]) { const s = await score(a); if (s < best[0]) best = [s, a]; }
    az = Math.round(best[1] * 10000) / 10000;
    console.log(id, "az", az, "score", Math.round(best[0]), "(at 0:", Math.round(await score(0)), ")");
  }
  await score(az);
  const out = await p.evaluate((CROP, W) => {
    const { camera, world, T, R, THREE } = window.__mtn, v = new THREE.Vector3(), k = W / (CROP[2] - CROP[0]);
    world.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const to2 = ([x, z]) => { world.localToWorld(v.set(x, T.heightAt(x, z), z)).project(camera);
      return [Math.round(((v.x + 1) / 2 * innerWidth - CROP[0]) * k * 10) / 10, Math.round(((1 - v.y) / 2 * innerHeight - CROP[1]) * k * 10) / 10]; };
    const runs = {}, lifts = {};
    for (const r of R.runs) runs[r.id] = r.pts.filter((_, i, a) => i % 2 === 0 || i === a.length - 1).map(to2);
    for (const l of R.lifts) lifts[l.id] = [to2(l.pts[0]), to2(l.pts[l.pts.length - 1])];
    // The terrain's projection on a grid, n × m nodes from (x0, z0) to (x1, z1), row by row (z), as [u, v].
    const n = 96, m = Math.max(16, Math.round(n * (T.z1 - T.z0) / (T.x1 - T.x0))), uv = [];
    for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) uv.push(...to2([T.x0 + (T.x1 - T.x0) * i / (n - 1), T.z0 + (T.z1 - T.z0) * j / (m - 1)]));
    return { w: W, h: Math.round((CROP[3] - CROP[1]) * k), runs, lifts, grid: { x0: T.x0, z0: T.z0, x1: T.x1, z1: T.z1, n, m, uv } };
  }, CROP, W);
  writeFileSync(file, JSON.stringify({ az, ...out }));
  console.log(id, Object.keys(out.runs).length, "runs");
}
await b.close();
