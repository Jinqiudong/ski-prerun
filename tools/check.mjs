// Static checks for a site with no build step: every module parses, and every relative import, script, stylesheet and asset path
// written literally in src/, the pages and the model catalogue points at a file that exists.
// usage: node tools/check.mjs   (exit 1 on a broken path)
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, normalize, relative } from "node:path";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "..");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const PAGES = ["index.html", "start.html", "look.html", "sound.html", "mountain/index.html", "models/facilities/index.html"].map((p) => join(ROOT, p));
const files = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "models/facilities")).filter((f) => /\.(js|html)$/.test(f)), ...PAGES, join(ROOT, "tests/route.test.mjs")];
const bad = [];
for (const f of files) {
  const s = readFileSync(f, "utf8"), page = f.endsWith(".html");
  // Module imports and page links resolve against the file; asset strings in modules against the page
  // that loads them, so those are checked against every page directory that could.
  const refs = [...s.matchAll(/(?:from\s+|import\s*\(?\s*|src=|href=)["'`](\.{0,2}\/?[\w./-]+\.(?:m?js|css|html))(?:\?[^"'`]*)?["'`]/g)].map((m) => m[1]);
  for (const r of refs) {
    if (/^(https?:|\/\/)/.test(r) || r.startsWith("three")) continue;
    const t = normalize(join(dirname(f), r));
    if (!existsSync(t)) bad.push(`${relative(ROOT, f)} → ${r}`);
  }
  if (page) continue;
  for (const m of s.matchAll(/["'`]((?:\.\.\/)*(?:assets|data)\/[\w./-]+\.\w+)(?:\?[^"'`]*)?["'`]/g)) {
    const r = m[1].replace(/^(\.\.\/)+/, "");
    if (!existsSync(join(ROOT, r)) && !existsSync(join(ROOT, "models/facilities", m[1]))) bad.push(`${relative(ROOT, f)} → ${m[1]}`);
  }
}
// One module, one cache key: the same file imported with two ?v= numbers loads twice (two copies of its state).
const keys = new Map();
for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/["'`](\.{0,2}\/?[\w./-]+\.m?js)\?v=(\d+)["'`]/g)) {
  const t = normalize(join(dirname(f), m[1])), k = keys.get(t);
  if (k && k.v !== m[2]) bad.push(`${relative(ROOT, t)} is imported as ?v=${k.v} (${k.f}) and ?v=${m[2]} (${relative(ROOT, f)})`);
  else if (!k) keys.set(t, { v: m[2], f: relative(ROOT, f) });
}
// Every module must at least parse.
for (const f of files.filter((f) => /\.m?js$/.test(f))) {
  try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
  catch (e) { bad.push(`${relative(ROOT, f)}: ${String(e.stderr).split("\n").find((l) => /Error/.test(l)) || "syntax error"}`); }
}
if (bad.length) { console.error("Broken paths:\n  " + bad.join("\n  ")); process.exit(1); }
console.log(`ok: ${files.length} files, every literal path resolves, every module parses`);
