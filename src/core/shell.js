// The shell (index.html): it stays for the whole visit while the app's pages change in the frame under it,
// and holds what must not stop when they do: the 对讲机 (voice.js; the pages reach it with voiceHere()).
//   - The address follows the page in the frame (<site>/#<page>, src/core/frame.js), replaced, never pushed:
//     the frame's own history is the back button's, as it was before the shell.
//   - The tab's title follows the page's.
//   - A tap in the page counts for the shell's sound too (iOS starts sound only from a tap).
import { startVoice } from "./voice.js?v=16";

const S = globalThis.prerunShell, frame = document.getElementById("app");
const root = new URL("./", location.href).href;
const voice = startVoice({ root: "" });

let shown = "";
function follow() {
  let w; try { w = frame.contentWindow; } catch { return; }
  let href = ""; try { href = w.location.href; } catch { return; } // another origin: not ours to follow
  if (!href || href === "about:blank") return;
  if (href !== shown) {
    shown = href;
    const h = S.appHash(href, root);
    if (h && h !== location.hash) history.replaceState(history.state, "", location.pathname + h);
  }
  try { const tt = w.document.title; if (tt && tt !== document.title) document.title = tt; } catch { /* not loaded */ }
}
frame.addEventListener("load", () => { follow(); try { voice.unlockFrom(frame.contentWindow); } catch { /* another origin */ } });
setInterval(follow, 500); // history.replaceState inside a page changes its address without a load
// The address changed by hand (or a link to the shell with another page): show that page.
addEventListener("hashchange", () => {
  const src = S.appSrc(location.hash, "");
  if (new URL(src, root).href !== shown) { try { frame.contentWindow.location.replace(src); } catch { frame.src = src; } }
});
window.__shell = { frame, voice, follow }; // testing
