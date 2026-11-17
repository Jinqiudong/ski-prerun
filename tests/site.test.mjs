// node --test tests/site.test.mjs — where a shared link points, on the web and in the iOS app.
import { test } from "node:test";
import assert from "node:assert/strict";
import { siteBase, PUBLIC_SITE } from "../src/core/site.js";

test("a shared link keeps the page's own folder on the web", () => {
  assert.equal(siteBase({ protocol: "https:", origin: "https://jinqiudong.github.io", pathname: "/ski-prerun/start.html" }), "https://jinqiudong.github.io/ski-prerun/");
  assert.equal(siteBase({ protocol: "http:", origin: "http://localhost:8766", pathname: "/start.html" }), "http://localhost:8766/");
});

test("from the iOS app a shared link points at the public site", () => {
  assert.equal(siteBase({ protocol: "capacitor:", origin: "capacitor://localhost", pathname: "/start.html" }), PUBLIC_SITE);
  assert.equal(PUBLIC_SITE, "https://jinqiudong.github.io/ski-prerun/");
});
