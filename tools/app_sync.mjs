// The iOS app's web folder: copies only the served site into www/ (gitignored), with three.js bundled so the
// app opens offline, then runs `npx cap sync ios`. The website itself is untouched: the pages keep loading
// three.js from the CDN; only the copies in www/ point at www/vendor/three/. See docs/IOS_APP.md.
// usage: node tools/app_sync.mjs [--no-cap]   (npm run app:sync)
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, normalize } from "node:path";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const WWW = join(ROOT, "www");
const THREE = join(ROOT, "node_modules/three");
const CDN = "https://cdn.jsdelivr.net/npm/three@0.170.0/";
const VENDOR = "/vendor/three/"; // absolute: the app's pages live at capacitor://localhost/ and /mountain/

// What GitHub Pages serves and the pages load. Not tools/, tests/, docs/, node_modules/, the Blender sources.
const SERVED = ["index.html", "start.html", "look.html", "sound.html", "manifest.webmanifest", "src", "assets", "data", "models", "mountain"];
const SKIP = [/^models\/facilities\/blender(\/|$)/, /\.(py|md|blend1?|DS_Store)$/, /(^|\/)\.DS_Store$/];

if (!existsSync(join(THREE, "package.json"))) { console.error("node_modules/three missing: run npm install first"); process.exit(1); }
const v = JSON.parse(readFileSync(join(THREE, "package.json"), "utf8")).version;
if (v !== "0.170.0") { console.error(`node_modules/three is ${v}; the pages use 0.170.0`); process.exit(1); }

rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW);
for (const p of SERVED) cpSync(join(ROOT, p), join(WWW, p), { recursive: true, filter: (src) => !SKIP.some((re) => re.test(relative(ROOT, src))) });

// three.js and the addons the site imports (with their own relative imports), and the Draco decoder.
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const texts = walk(WWW).filter((f) => /\.(html|m?js|css)$/.test(f));
const need = new Set(["build/three.module.js"]);
for (const f of texts) {
  const s = readFileSync(f, "utf8");
  for (const m of s.matchAll(/three\/addons\/([\w/.-]+\.js)/g)) need.add(`examples/jsm/${m[1]}`);
  for (const m of s.matchAll(/three@0\.170\.0\/([\w/.-]+\.js)/g)) need.add(m[1]);
}
const queue = [...need];
while (queue.length) {
  const rel = queue.pop(), s = readFileSync(join(THREE, rel), "utf8");
  for (const m of s.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[\w/.-]+\.js)['"]/g)) {
    const dep = normalize(join(dirname(rel), m[1]));
    if (!need.has(dep)) { need.add(dep); queue.push(dep); }
  }
}
for (const rel of need) cpSync(join(THREE, rel), join(WWW, "vendor/three", rel));
cpSync(join(THREE, "examples/jsm/libs/draco/gltf"), join(WWW, "vendor/three/examples/jsm/libs/draco/gltf"), { recursive: true, filter: (s) => !/encoder/.test(s) });
cpSync(join(THREE, "LICENSE"), join(WWW, "vendor/three/LICENSE"));

// Point the copies at the bundled three.js (import maps and the Draco decoder path).
let rewired = 0;
for (const f of texts) {
  const s = readFileSync(f, "utf8");
  if (s.includes(CDN)) { writeFileSync(f, s.split(CDN).join(VENDOR)); rewired++; }
}
const left = walk(WWW).filter((f) => /\.(html|m?js)$/.test(f) && readFileSync(f, "utf8").includes("cdn.jsdelivr.net"));
if (left.length) { console.error("still loading from the CDN:\n  " + left.map((f) => relative(WWW, f)).join("\n  ")); process.exit(1); }

const size = (d) => walk(d).reduce((n, f) => n + statSync(f).size, 0);
const mb = (n) => (n / 1048576).toFixed(1) + " MB";
console.log(`www/: ${mb(size(WWW))} (${need.size} three.js files bundled, ${rewired} files rewired off the CDN)`);
for (const d of ["assets", "data", "models", "src", "vendor"]) console.log(`  ${d.padEnd(7)} ${mb(size(join(WWW, d)))}`);

if (!process.argv.includes("--no-cap")) execFileSync("npx", ["cap", "sync", "ios"], { cwd: ROOT, stdio: "inherit" });
