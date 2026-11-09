// The shell's addresses (a classic script, no imports: it runs first, before anything else on a page).
//
// The app runs inside the shell, index.html: the shell holds the 对讲机 (src/core/voice.js) for the whole
// visit and loads the pages in an iframe under it, so changing pages never drops the voice. The shell's
// address is the page's after a "#": <site>/#look.html?resort=copper&lift=… is look.html?resort=… in the shell.
//   - Every page loads this script first, with data-page: opened on its own (a shared link, a bookmark, the
//     home-screen icon), it moves into the shell at once, at the same page. Not inside the shell, not in the
//     headless tests (navigator.webdriver; ?shell=force moves them too), not with ?shell=0.
//   - The shell (index.html) loads it to read its own address (appSrc) and to keep it on the page shown
//     (appHash), so a reload or a shared address opens the same page.
// Only the app's own pages load in the shell (PAGE): an address can't point the frame anywhere else.
(function (g) {
  var PAGE = /^(start\.html|look\.html|sound\.html|mountain\/(index\.html)?)([?#].*)?$/;
  // The page to load for the shell's address: its hash if that's one of ours, else the start page (with the
  // shell's own query, as index.html used to pass on: ?trip=… opens that trip).
  function appSrc(hash, search) {
    var h = String(hash || "").replace(/^#/, "");
    if (PAGE.test(h)) return h;
    return "start.html" + (/^\?[^#]*$/.test(search || "") ? search : "");
  }
  // The shell's hash for a page's address (root: the site's root, ending in "/"); null if it isn't ours.
  function appHash(href, root) {
    href = String(href || ""); root = String(root || "");
    if (!root || href.indexOf(root) !== 0) return null;
    var rel = href.slice(root.length);
    return PAGE.test(rel) ? "#" + rel : null;
  }
  // A page opened on its own: into the shell, at this page.
  function toShell(script) {
    try {
      if (g.top !== g) return false; // in the shell already (or someone's frame: leave it be)
      var q = g.location.search;
      if (/[?&]shell=0(&|$)/.test(q)) return false;
      if (g.navigator.webdriver && !/[?&]shell=force(&|$)/.test(q)) return false;
      var root = String(script && script.src || "").replace(/src\/core\/frame\.js(\?.*)?$/, "");
      var h = appHash(g.location.href, root);
      if (!h) return false;
      g.location.replace(root + h);
      return true;
    } catch (e) { return false; }
  }
  g.prerunShell = { PAGE: PAGE, appSrc: appSrc, appHash: appHash, toShell: toShell };
  var me = typeof document !== "undefined" ? document.currentScript : null;
  if (me && me.hasAttribute("data-page")) toShell(me);
})(globalThis);
