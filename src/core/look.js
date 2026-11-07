// How I look to friends on a shared trip (a member's "look"): my avatar, and my rider as the rider page has
// it chosen (one of the four outfits, or one of mine). Friends' memory photos dress me from it.
import { myAvatar } from "./i18n.js?v=43";
import { canon } from "../start/season.js?v=13";

// The four outfits and the character preset each is (boarder.js OUTFITS[k].ch).
const OUTFIT_TPL = { o_pine: "A", o_night: "B", o_wine: "C", o_glacier: "D" };

// My rider: { ch } (what I'm wearing, or one I made), { preset, colors } (one saved before characters, on A), or
// { preset }. The rider page keeps what I'm wearing in st.wear ({ ch, name, from, stance }); before it did, the
// chosen outfit (st.rider: one of the four, or one of mine in st.riders) was it.
export function myRiderLook() {
  let st = {}; try { st = JSON.parse(localStorage.getItem("prerun") || "{}"); } catch { /* fresh */ }
  if (st.wear?.ch?.tpl) return { ch: st.wear.ch };
  const mine = (st.riders || []).find((r) => r.id === st.rider);
  if (mine?.ch?.tpl) return { ch: mine.ch };
  if (mine) return { preset: "A", colors: mine.colors || {} };
  return { preset: OUTFIT_TPL[st.rider] || "A" };
}
export const myLook = () => ({ avatar: myAvatar(), rider: myRiderLook() });
// Whether a member's look on the server is already mine (the server may reorder the keys).
export const sameLook = (a, b) => canon(a?.avatar) === canon(b?.avatar) && canon(a?.rider) === canon(b?.rider);
