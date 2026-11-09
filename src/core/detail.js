// How much the 3D pages may hold on this device (no three.js; the ride and the resort page read it).
//
// A phone (a coarse pointer) gets the same scenes with lighter pictures: iOS Safari kills a page's process when
// it holds too much (a WebGL texture costs its pixels twice, decoded in the page and again on the GPU), and
// reloads it; twice in a row is "A problem repeatedly occurred". So on a phone:
//   - the kit's pictures are capped (TEX_CAP: a 2048 px building atlas drawn at 1024, its normal map at 512);
//   - lite: if the 3D page was killed last time (guard), it comes back lighter for the rest of the visit:
//     a lower pixel ratio, smaller caps, a smaller shadow map. ?lite=1 forces it (previews), ?lite=0 never.
//
// The guard: a 3D page leaves a note in sessionStorage while it's open and takes it away on pagehide (and while
// the app is in the background, where iOS may drop a page without anything going wrong). A page that finds
// its note still there was killed in the foreground: lite from now on. sessionStorage outlives the page's
// process (and is the shell's too), and is gone with the tab.
const CRUMB = "prerunOpen", LITE = "prerunLite";
const q = typeof location !== "undefined" ? location.search : "";
const store = (() => { try { return globalThis.sessionStorage || null; } catch { return null; } })();

export const PHONE = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
export let lite = /[?&]lite=1(&|$)/.test(q) || (!/[?&]lite=0(&|$)/.test(q) && store?.getItem(LITE) === "1");

// The note: call once when a 3D page starts building its world. page: a name for the note.
export function guard(page) {
  if (!store) return;
  try {
    const was = JSON.parse(store.getItem(CRUMB) || "null");
    if (was && Date.now() - was.t < 30 * 60 * 1000 && !/[?&]lite=0(&|$)/.test(q)) { store.setItem(LITE, "1"); lite = true; console.warn(`detail: ${was.page} didn't close last time; lighter from now on`); }
  } catch { /* a bad note: start again */ }
  const open = () => { try { store.setItem(CRUMB, JSON.stringify({ page, t: Date.now() })); } catch { /* storage off */ } };
  const shut = () => { try { store.removeItem(CRUMB); } catch { /* storage off */ } };
  open();
  addEventListener("pagehide", shut);
  addEventListener("pageshow", (e) => { if (e.persisted) open(); });
  document.addEventListener("visibilitychange", () => (document.visibilityState === "hidden" ? shut() : open()));
}

// The longest side a texture keeps, by what it is ("map": colour, "normal": relief). Infinity: as loaded.
export function texCap(kind) {
  if (!PHONE && !lite) return Infinity;
  if (kind === "normal") return lite ? 0 : 512; // 0: no normal map
  return lite ? 512 : 1024;
}
export const pixelRatio = (dpr = globalThis.devicePixelRatio || 1) => Math.min(dpr, lite ? 1 : PHONE ? 1.5 : 2);
export const shadowSize = () => (lite ? 512 : PHONE ? 1024 : 2048);

// Leaving the page (not into the back-forward cache): stop drawing, close the decoded pictures the renderer's
// textures hold and drop the WebGL context, so the GPU's and the pictures' memory goes now, not whenever the
// old page is collected (in the shell the next page loads in the same process, while this one is still there).
export function freeOnLeave(renderer) {
  addEventListener("pagehide", (e) => {
    if (e.persisted) return;
    try {
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.forceContextLoss();
    } catch { /* gone already */ }
    for (const b of bitmaps) try { b.close(); } catch { /* closed */ }
  });
}
// ImageBitmaps made for textures (the kit's pictures, the GLTF loader's), closed on leaving.
const bitmaps = new Set();
export const keepBitmap = (b) => { if (b && typeof b.close === "function") bitmaps.add(b); return b; };
