// The way home from the mountain page and the ride: the start page's four tabs, and the settings.
import { t, openSettings } from "./i18n.js?v=7";

const ICONS = {
  rider: `<svg viewBox="0 0 32 32"><g filter="url(#wct)"><path d="M10 30 L11 19 C11 15 21 15 21 19 L22 30Z" fill="#7f9e88"/><circle cx="16" cy="10.5" r="6.2" fill="#22344d"/><rect x="10.4" y="9" width="11.2" height="3.6" rx="1.8" fill="#c98f9f"/><path d="M6 30 h20" stroke="#8eaec4" stroke-width="2.6" stroke-linecap="round"/></g></svg>`,
  resort: `<svg viewBox="0 0 32 32"><g filter="url(#wct)"><path d="M2 28 L12 11 L17 18 L21 12 L30 28Z" fill="#8eaec4"/><path d="M12 11 L15 16 L13.5 15.5 L12 17 L10 15Z M21 12 L23.5 16.5 L21.5 15.5 L20 17 L19 15.5Z" fill="#fbfaf7"/><path d="M2 28 L12 11 L17 18 L21 12 L30 28" fill="none" stroke="#22344d" stroke-width="1.3" stroke-linejoin="round"/><path d="M4 28 h24" stroke="#4a6a5c" stroke-width="2" stroke-linecap="round"/></g></svg>`,
  trip: `<svg viewBox="0 0 32 32"><g filter="url(#wct)"><rect x="3" y="9" width="26" height="15" rx="2" fill="#efe6d6" stroke="#22344d" stroke-width="1.2"/><rect x="3" y="9" width="26" height="4.2" rx="1.5" fill="#22344d"/><path d="M22 13.5 V24" stroke="#b9a98f" stroke-width="1.1" stroke-dasharray="1.6 1.6"/><path d="M7 19 h7 M7 21.5 h5" stroke="#6e2f36" stroke-width="1.4" stroke-linecap="round"/><path d="M14 18 l3 -2 l1.5 .6 l-2.6 2.2" fill="#b6463b"/></g></svg>`,
  log: `<svg viewBox="0 0 32 32"><g filter="url(#wct)"><rect x="7" y="4" width="18" height="20" rx="2" fill="#d9e2ea" transform="rotate(-8 16 14)"/><rect x="6" y="7" width="20" height="22" rx="2" fill="#fbfaf7" stroke="#22344d" stroke-width="1.2"/><path d="M8.5 22 L13 15 L16 19 L19 14.5 L23.5 22Z" fill="#8eaec4"/><circle cx="21" cy="11.5" r="2" fill="#b6463b" opacity=".85"/></g></svg>`,
};
const FILTER = `<svg width="0" height="0" style="position:absolute"><defs><filter id="wct" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="1.2" result="d"/><feGaussianBlur in="d" stdDeviation=".25"/></filter></defs></svg>`;
const TABS = [["rider", "人物"], ["resort", "雪场"], ["trip", "行程"], ["log", "记录"]];
// A row of the four tabs, linking back to the start page (base: the path to it from this page).
export function navRow(base = "") {
  if (!document.getElementById("wct")) document.body.insertAdjacentHTML("afterbegin", FILTER);
  return `<div class="navrow">${TABS.map(([k, zh]) => `<a href="${base}start.html?tab=${k}">${ICONS[k]}${t(zh)}</a>`).join("")}</div>`;
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
