// The sound drawer (from the ride's menu): sound on or off, music and effects volumes, what's playing
// (and "next"), and where each track comes from with its licence. Same drawer as Settings (i18n.js).
import { EN_ON } from "../core/i18n.js?v=27";
import { settings, set, rideSound, current } from "./index.js?v=4";

const EN = { 声音: "Sound", 开: "On", 关: "Off", 音乐: "Music", 音效: "Board, wind, lift", 正在播放: "Now playing", 换一首: "Next", 音乐来源: "Music credits", 现场录音: "Field recordings",
  "iPhone 的静音键打开时听不到声音": "With the iPhone's silent switch on, there is no sound", 应用内生成: "made in the app", 还没有音乐: "No music yet" };
const tt = (zh) => (EN_ON ? EN[zh] ?? zh : zh);
const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
const H = "font:16px 'Cormorant Garamond','Noto Serif SC',serif;color:#6f675e;margin:12px 0 6px";
const btn = (on) => `flex:1;font:600 17px 'Cormorant Garamond','Noto Serif SC',serif;padding:10px;border-radius:6px;border:1px solid ${on ? "#22344d" : "#cbbfa9"};background:${on ? "#22344d" : "#f6f1e7"};color:${on ? "#fdfbf6" : "#22344d"}`;

export function openSoundPanel() {
  const rs = rideSound(), el = document.createElement("div");
  el.style.cssText = "position:fixed;inset:0;z-index:60;background:rgba(40,34,28,0);display:flex;align-items:flex-end;transition:background .3s";
  const tracks = rs?.music.rotation() || [];
  el.innerHTML = `<div data-drawer style="width:100%;box-sizing:border-box;max-height:82vh;overflow:auto;background:#fdfbf6;border-radius:18px 18px 0 0;padding:10px 18px calc(28px + env(safe-area-inset-bottom));transform:translateY(100%);transition:transform .3s cubic-bezier(.2,.9,.3,1);box-shadow:0 -6px 20px rgba(40,25,10,.25);font-family:'Noto Serif SC',serif;color:#33302c">
    <div style="width:44px;height:5px;border-radius:3px;background:#d6cdbf;margin:0 auto 12px"></div>
    <div style="font:500 10px Oswald,sans-serif;letter-spacing:.3em;color:#8a8278">SOUND</div>
    <div style="font:600 28px 'Cormorant Garamond','Noto Serif SC',serif;color:#22344d;margin:2px 0 10px">${tt("声音")}</div>
    <div style="display:flex;gap:8px"><button data-on="1" style="${btn(settings.on)}">${tt("开")}</button><button data-on="0" style="${btn(!settings.on)}">${tt("关")}</button></div>
    <div style="${H}">${tt("音乐")}</div><input data-vol="music" type="range" min="0" max="100" value="${Math.round(settings.music * 100)}" style="width:100%;accent-color:#22344d">
    <div style="${H}">${tt("音效")}</div><input data-vol="sfx" type="range" min="0" max="100" value="${Math.round(settings.sfx * 100)}" style="width:100%;accent-color:#22344d">
    <div style="${H}">${tt("正在播放")}</div>
    <div style="display:flex;gap:10px;align-items:center"><b data-now style="flex:1;font:600 17px 'Cormorant Garamond','Noto Serif SC',serif;color:#22344d"></b><button data-next style="${btn(false)};flex:none;padding:6px 14px">${tt("换一首")} ›</button></div>
    <div style="${H}">${tt("音乐来源")}</div>
    <div style="font:13px/1.5 'Noto Serif SC',serif;color:#6f675e">${tracks.length ? tracks.map((x) => `<div>${esc(x.title)} — ${esc(x.gen ? `Ski Pre-Run (${tt("应用内生成")})` : x.artist)} · ${esc(x.licence)}${x.file && x.source ? ` · <a href="${esc(x.source)}" target="_blank" rel="noopener" style="color:#22344d">source</a>` : ""}</div>`).join("") : tt("还没有音乐")}</div>
    <div style="${H}">${tt("现场录音")}</div>
    <div data-rec style="font:13px/1.5 'Noto Serif SC',serif;color:#6f675e"></div>
    <p style="font:12px 'Noto Serif SC',serif;color:#8a8278;margin:14px 0 0">${tt("iPhone 的静音键打开时听不到声音")}</p>
  </div>`;
  document.body.append(el);
  // The real recordings the ride plays (CC0; their sources, all the same).
  fetch("assets/audio/game/manifest.json").then((r) => r.json()).then(({ items }) => { el.querySelector("[data-rec]").innerHTML = items.map((x) => `<div>${esc(x.title)} — ${esc(x.author)} · ${esc(x.licence)} · <a href="${esc(x.source)}" target="_blank" rel="noopener" style="color:#22344d">Freesound</a></div>`).join(""); }).catch(() => {});
  const dr = el.querySelector("[data-drawer]"), now = el.querySelector("[data-now]");
  const showNow = () => { const c = current(); now.textContent = c ? c.title : "—"; };
  showNow(); const tick = setInterval(showNow, 1000);
  const close = () => { clearInterval(tick); dr.style.transition = "transform .25s ease-in"; dr.style.transform = "translateY(100%)"; el.style.background = "rgba(40,34,28,0)"; setTimeout(() => el.remove(), 260); };
  el.onclick = (e) => {
    const on = e.target.dataset?.on;
    if (on != null) { set({ on: on === "1" }); for (const b of el.querySelectorAll("[data-on]")) b.style.cssText = btn((b.dataset.on === "1") === settings.on); return; }
    if (e.target.closest?.("[data-next]")) { rs?.music.next(); setTimeout(showNow, 50); return; }
    if (e.target === el) close();
  };
  for (const r of el.querySelectorAll("[data-vol]")) r.oninput = () => set({ [r.dataset.vol]: r.value / 100 });
  requestAnimationFrame(() => requestAnimationFrame(() => { dr.style.transform = "translateY(0)"; el.style.background = "rgba(40,34,28,.35)"; }));
}

// For the page's credit line: CC-BY tracks by name (their licence asks for it), and a word on the rest.
export function creditLine(tracks) {
  const by = tracks.filter((x) => x.file && /^CC-BY/i.test(x.licence || ""));
  const parts = [...(tracks.some((x) => x.gen) ? [EN_ON ? "Music made in the app" : "音乐 应用内合成"] : []), EN_ON ? "Field recordings from Freesound (CC0)" : "现场录音 Freesound (CC0)", ...by.map((x) => `${EN_ON ? "Music" : "音乐"} “${x.title}” ${x.artist} (${x.licence})`)];
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}
