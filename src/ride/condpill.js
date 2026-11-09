// The conditions in the ride's 雪况 pill: the hour, the sky and 实时, the same choice as the resort page's
// weather bar (src/core/conditions.js holds the rules and the record). The ride applies each change: the
// sun, the sky and the falling snow at once; powder from the next lift (it is worked out once per ride).
import { choose, hourIn, fmtHour, normalize, LIVE, TZ } from "../core/conditions.js?v=2";

const SKY = [["clear", "sunny", "晴"], ["cloudy", "partly", "多云"], ["overcast", "cloudy", "阴"], ["snow", "snow_now", "雪"]];

// host: the element to fill; rec: the record now; liveSky(): the forecast's sky (null offline);
// apply(rec, what): what is "drag" (the hour, still moving), "hour", "sky" or "live"; t: the copy.
export function condPill(host, { rec, liveSky = () => null, apply, t = (s) => s }) {
  let cur = normalize(rec);
  host.innerHTML = `<div class="ch"><b class="tm"></b><span class="mk">${t("自选")}</span><button class="cLive"><img src="assets/icons/refresh.png?v=1" alt="">${t("实时")}</button></div>
    <input class="hr" type="range" min="0" max="23.75" step="0.25" aria-label="${t("时间")}">
    <div class="sk">${SKY.map(([k, ic, zh]) => `<button data-sky="${k}"><img src="assets/icons/${ic}.png?v=1" alt=""><span>${t(zh)}</span></button>`).join("")}</div>
    <p class="nt"></p>`;
  const q = (s) => host.querySelector(s), hr = q(".hr");
  for (const ev of ["click", "pointerdown", "touchstart"]) host.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); // not the pill's fold
  const show = () => {
    const h = cur.live ? hourIn(new Date(), TZ) : cur.hour, sky = cur.live ? liveSky() || "clear" : cur.sky;
    if (document.activeElement !== hr) hr.value = h;
    q(".tm").textContent = fmtHour(cur.live ? Math.floor(h * 4) / 4 : h);
    host.classList.toggle("chosen", !cur.live);
    host.querySelectorAll("[data-sky]").forEach((b) => b.classList.toggle("on", b.dataset.sky === sky));
  };
  const to = (next, what) => { cur = next; show(); apply(cur, what); };
  hr.addEventListener("input", () => to(choose(cur, { hour: +hr.value }, { liveSky: liveSky() || "clear" }), "drag"));
  hr.addEventListener("change", () => to(choose(cur, { hour: +hr.value }, { liveSky: liveSky() || "clear" }), "hour"));
  host.querySelectorAll("[data-sky]").forEach((b) => b.addEventListener("click", () => to(choose(cur, { sky: b.dataset.sky }, { liveSky: liveSky() || "clear" }), "sky")));
  q(".cLive").addEventListener("click", () => to(LIVE, "live"));
  show();
  return { show, note: (s) => (q(".nt").textContent = s), get rec() { return cur; } };
}
