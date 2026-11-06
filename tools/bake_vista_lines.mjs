// Where each run and lift falls on a resort's watercolour (assets/wc/<id>.jpg), so the ride's little map
// can ink the runs you've skied onto the painting. Same view as tools/capture_vista.mjs, the same crop and
// width as tools/watercolor.py. Needs puppeteer-core, Chrome and the site served on :8766.
// usage: node tools/bake_vista_lines.mjs <resort id> ...   → data/vista/<id>.json
import puppeteer from "puppeteer-core";
import { writeFileSync, mkdirSync } from "node:fs";
const CROP = [120, 150, 830, 620], W = 700; // watercolor.py: crop, then resize to W wide
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal"] });
const p = await b.newPage();
await p.setViewport({ width: 900, height: 700, deviceScaleFactor: 1 });
await p.goto("http://127.0.0.1:8766/start.html"); await p.evaluate(() => localStorage.setItem("prerun", JSON.stringify({ rider: "rider_a" })));
mkdirSync("data/vista", { recursive: true });
for (const id of process.argv.slice(2)) {
  await p.goto(`http://127.0.0.1:8766/mountain/?resort=${id}`);
  await p.waitForFunction(() => window.__mtn && !document.getElementById("status"), { timeout: 180000, polling: 1000 }); await new Promise((x) => setTimeout(x, 12000));
  const out = await p.evaluate((CROP, W) => {
    const { camera, world, T, R, THREE } = window.__mtn, v = new THREE.Vector3(), k = W / (CROP[2] - CROP[0]);
    world.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const to2 = ([x, z]) => { world.localToWorld(v.set(x, T.heightAt(x, z), z)).project(camera);
      return [Math.round(((v.x + 1) / 2 * innerWidth - CROP[0]) * k * 10) / 10, Math.round(((1 - v.y) / 2 * innerHeight - CROP[1]) * k * 10) / 10]; };
    const runs = {}, lifts = {};
    for (const r of R.runs) runs[r.id] = r.pts.filter((_, i, a) => i % 2 === 0 || i === a.length - 1).map(to2);
    for (const l of R.lifts) lifts[l.id] = [to2(l.pts[0]), to2(l.pts[l.pts.length - 1])];
    return { w: W, h: Math.round((CROP[3] - CROP[1]) * k), runs, lifts };
  }, CROP, W);
  writeFileSync(`data/vista/${id}.json`, JSON.stringify(out));
  console.log(id, Object.keys(out.runs).length, "runs");
}
await b.close();
