// The public site, for links we share (no DOM; tested in tests/site.test.mjs). A link must open for a friend
// without the app, so inside the iOS app (its pages at capacitor://localhost/, docs/IOS_APP.md) links point at
// GitHub Pages; on the web they keep the page's own address, as before.
export const PUBLIC_SITE = "https://jinqiudong.github.io/ski-prerun/";
// The folder a shareable link starts from, ending in "/", for a page's location (on the web: the page's folder).
export const siteBase = (loc) => (/^https?:$/.test(loc.protocol) ? `${loc.origin}${loc.pathname.replace(/[^/]*$/, "")}` : PUBLIC_SITE);
