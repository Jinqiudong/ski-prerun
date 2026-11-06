// The way home from the mountain page and the ride: the start page's four tabs, and the settings.
import { t, openSettings } from "./i18n.js?v=26";

// The owner's painted tab icons (assets/icons), relative to the start page.
const ICONS = { rider: "rider", resort: "resorts", trip: "trips", log: "memory" };
const FILTER = `<svg width="0" height="0" style="position:absolute"><defs><filter id="wct" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="1.2" result="d"/><feGaussianBlur in="d" stdDeviation=".25"/></filter></defs></svg>`;
const TABS = [["rider", "人物"], ["resort", "雪场"], ["trip", "行程"], ["log", "记录"]];
// A row of the four tabs, linking back to the start page (base: the path to it from this page).
export function navRow(base = "") {
  if (!document.getElementById("wct")) document.body.insertAdjacentHTML("afterbegin", FILTER);
  return `<div class="navrow">${TABS.map(([k, zh]) => `<a href="${base}start.html?tab=${k}"><img src="${base}assets/icons/${ICONS[k]}.png?v=1" alt="">${t(zh)}</a>`).join("")}</div>`;
}
// A small sheet with the row and the settings, for pages without a menu of their own.
export function openNav(base = "") {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;inset:0;z-index:50;background:rgba(40,34,28,.3);display:flex;align-items:flex-end";
  el.innerHTML = `<div style="width:100%;background:#fdfbf6;padding:16px 16px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -6px 20px rgba(40,25,10,.25)">${navRow(base)}
    <button data-set style="width:100%;font:16px 'Cormorant Garamond','Noto Serif SC',serif;padding:9px;border-radius:999px;border:1px solid #cbbfa9;background:#fdfbf6;color:#22344d">${t("⚙ 设置")}</button></div>`;
  document.body.append(el);
  el.onclick = (e) => { if (e.target.closest("[data-set]")) { el.remove(); openSettings(); } else if (e.target === el) el.remove(); };
}
