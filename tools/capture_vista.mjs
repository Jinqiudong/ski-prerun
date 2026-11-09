// Capture a clean view of a resort from the mountain page (no UI, no runs or lifts drawn, a clear 10 am)
// for tools/watercolor.py. The paintings so far were all captured on the resort page as it was at 310d30d
// (the 3D view with sky); see AGENTS.md "Adding a resort". Needs puppeteer-core, Chrome and the site served (PORT, default 8766).
// usage: PORT=8787 node tools/capture_vista.mjs <resort id> ...   → vista_<id>.png
import puppeteer from "puppeteer-core";
const PORT = process.env.PORT || 8766;
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal"] });
const p = await b.newPage();
await p.setViewport({ width: 900, height: 700, deviceScaleFactor: 1 });
await p.goto(`http://127.0.0.1:${PORT}/start.html`); await p.evaluate(() => localStorage.setItem("prerun", JSON.stringify({ rider: "rider_a" })));
for (const r of process.argv.slice(2)) {
  await p.goto(`http://127.0.0.1:${PORT}/mountain/?resort=${r}`);
  await p.waitForFunction(() => document.querySelector("[data-wx]"), { timeout: 60000 }); await new Promise((x) => setTimeout(x, 12000));
  await p.evaluate(() => { const s = document.getElementById("hour"); s.value = 10; s.dispatchEvent(new Event("input")); document.querySelector("[data-wx=clear]").click(); for (const id of ["runs", "lifts"]) { const b = document.getElementById(id); if (b?.classList.contains("on")) b.click(); }
    const st = document.createElement("style"); st.textContent = "body *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }"; document.head.append(st); });
  await new Promise((x) => setTimeout(x, 2500));
  await p.screenshot({ path: `vista_${r}.png` });
}
await b.close();
