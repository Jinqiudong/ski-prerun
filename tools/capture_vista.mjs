// Capture a clean view of a resort from the mountain page (no UI, no runs or lifts drawn, a clear 10 am)
// for tools/watercolor.py. Needs puppeteer-core, Chrome and the site served on :8766.
// usage: node tools/capture_vista.mjs <resort id>   → vista_<id>.png
import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=metal"] });
const p = await b.newPage();
await p.setViewport({ width: 900, height: 700, deviceScaleFactor: 1 });
await p.goto("http://127.0.0.1:8766/start.html"); await p.evaluate(() => localStorage.setItem("prerun", JSON.stringify({ rider: "rider_a" })));
for (const r of process.argv.slice(2)) {
  await p.goto(`http://127.0.0.1:8766/mountain/?resort=${r}`);
  await p.waitForFunction(() => document.querySelector("[data-weather]"), { timeout: 60000 }); await new Promise((x) => setTimeout(x, 12000));
  await p.evaluate(() => { const s = document.getElementById("hour"); s.value = 10; s.dispatchEvent(new Event("input")); document.querySelector("[data-weather=clear]").click(); for (const b of document.querySelectorAll("button")) if (["雪道", "缆车"].includes(b.textContent.trim())) b.click();
    const st = document.createElement("style"); st.textContent = "body > *:not(canvas) { display: none !important; }"; document.head.append(st); });
  await new Promise((x) => setTimeout(x, 2500));
  await p.screenshot({ path: `vista_${r}.png` });
}
await b.close();
