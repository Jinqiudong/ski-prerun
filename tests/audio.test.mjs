// node --test tests/audio.test.mjs — the sound's pure parts: the made-up sound material and how the
// board's physics map to the snow's layers. (The WebAudio graph itself is tried in a browser.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { snowTexture, sprayTexture, crunch, thump, clack, rng } from "../src/audio/buffers.js";
import { boardMix, SURFACES } from "../src/audio/snow.js";
import { STYLES } from "../src/audio/music.js";

const SR = 16000;
const peak = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

test("buffers are seeded, finite and at a sane level", () => {
  assert.deepEqual(snowTexture(SR, 1, 3).slice(0, 50), snowTexture(SR, 1, 3).slice(0, 50));
  for (const x of [crunch(SR, 2), thump(SR), clack(SR, 6, 0.1)]) { // one-shots: normalised below full scale
    assert.ok(x.every(Number.isFinite));
    assert.ok(peak(x) > 0.5 && peak(x) <= 1);
  }
  for (const x of [snowTexture(SR, 1), sprayTexture(SR, 1)]) { // loops: set by loudness
    const rms = Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
    assert.ok(x.every(Number.isFinite) && Math.abs(rms - 0.22) < 0.01 && peak(x) < 1.5);
  }
  const r = rng(5), v = Array.from({ length: 1000 }, r);
  assert.ok(v.every((x) => x >= 0 && x < 1));
});

test("the snow is smooth: no clicks or crackle (the owner heard 啪啪啪 in the first version)", () => {
  const rms = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
  for (const x of [snowTexture(48000, 1), sprayTexture(48000, 1), crunch(48000, 1)]) {
    let jump = 0, sq = 0;
    for (let i = 1; i < x.length; i++) { const d = x[i] - x[i - 1]; jump = Math.max(jump, Math.abs(d)); sq += d * d; }
    assert.ok(Math.sqrt(sq / x.length) < 0.25 * rms(x), "too much top end"); // little energy up high
    assert.ok(jump < 1.2 * rms(x), "a click"); // no single sample-to-sample snap
  }
});

test("a loop joins without a jump", () => {
  const x = snowTexture(SR, 1), jump = Math.abs(x[0] - x[x.length - 1]);
  assert.ok(jump < 0.5, `jump ${jump}`);
});

test("the snow follows the ride", () => {
  const still = boardMix({ speed: 0 });
  assert.equal(still.carve.g + still.glide.g + still.scrape.g + still.rumble.g, 0); // stopped: silent
  const c8 = boardMix({ speed: 8, lean: 0.6 }), c15 = boardMix({ speed: 15, lean: 0.6 });
  assert.ok(c15.carve.g > c8.carve.g && c15.carve.f > c8.carve.f); // faster: louder and brighter
  assert.ok(boardMix({ speed: 10, lean: 0.7 }).carve.g > boardMix({ speed: 10, lean: 0.1 }).carve.g); // more edge, more hiss
  const sk = boardMix({ speed: 10, skid: 1 });
  assert.ok(sk.scrape.g > 0.2 && sk.scrape.g > sk.carve.g); // a skid scrapes
  assert.equal(boardMix({ speed: 10, lean: 0.4 }).scrape.g, 0);
  const air = boardMix({ speed: 10, lean: 0.4, air: true });
  assert.equal(air.carve.g + air.glide.g + air.scrape.g, 0); // in the air: quiet
  const pw = boardMix({ speed: 12, lean: 0.5, surface: "powder" }), ice = boardMix({ speed: 12, lean: 0.5, surface: "ice" }), gr = boardMix({ speed: 12, lean: 0.5 });
  assert.ok(pw.carve.f < gr.carve.f && gr.carve.f < ice.carve.f); // powder soft, ice bright
  assert.deepEqual(Object.keys(SURFACES), ["groomed", "powder", "ice"]);
});

test("every track in the manifest is complete and free to use", () => {
  const { tracks } = JSON.parse(readFileSync(new URL("../assets/audio/music/manifest.json", import.meta.url)));
  assert.ok(tracks.length);
  const ids = new Set();
  for (const x of tracks) {
    for (const k of ["id", "title", "artist", "licence", "source", "mood"]) assert.ok(x[k], `${x.id}: ${k}`);
    assert.ok(!ids.has(x.id)); ids.add(x.id);
    assert.ok(["lift", "ski", "calm"].includes(x.mood));
    assert.ok(/^(CC0-1\.0|CC-BY-[34]\.0)$/.test(x.licence), `${x.id}: ${x.licence}`);
    assert.ok(x.gen || x.file);
    if (x.gen) assert.ok(STYLES[x.gen.style || x.mood]);
    if (x.file) assert.ok(readFileSync(new URL(`../assets/audio/music/${x.file}`, import.meta.url)).length > 1000);
  }
  for (const m of ["lift", "ski", "calm"]) assert.ok(tracks.some((x) => x.mood === m), m);
});
