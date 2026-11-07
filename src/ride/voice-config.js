// Where voice chat finds its way between two phones (src/ride/voice.js): the ICE servers every peer
// connection uses. The one place to change them.
//
// STUN (free, public, Google's): tells each phone the address the internet sees it at, so two phones can
// reach each other straight. That works on most home and hotel Wi-Fi and on many phone networks. It does not
// work when both sides are behind a "symmetric" NAT or a firewall that drops UDP: many cellular carriers
// (carrier-grade NAT), some corporate and school Wi-Fi, some hotel and resort Wi-Fi with client isolation.
// Then the two phones never connect and voice shows "连不上". Positions and messages still work (they go
// through Supabase, not peer to peer).
//
// TURN relays the audio through a server when the straight way fails. The site is static and public, so a
// TURN username and password written here are readable by anyone who opens the page, and could be used to
// relay their own traffic on the owner's bill. If the owner sets one up, use a provider's short-lived or
// restricted credentials (or a free tier with a cap), and accept that the credential is public. Left empty
// on purpose until then.
//   { urls: ["turn:turn.example.com:3478?transport=udp", "turns:turn.example.com:443?transport=tcp"], username: "…", credential: "…" }
export const TURN = [];

export const ICE_SERVERS = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }, ...TURN];
