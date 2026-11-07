import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { ANIMAL_RIDERS, ANIMAL_ZH, ANIMAL_SIZE, animalOf, lookAnimal } from "../src/rider/animal-core.js";
import { cleanRider, cleanHi } from "../src/ride/together-core.js";

const root = new URL("..", import.meta.url).pathname;

test("every animal rider has a model, a picture, a name and a size", () => {
  assert.equal(ANIMAL_RIDERS.length, 9);
  for (const a of ANIMAL_RIDERS) {
    assert.ok(existsSync(`${root}assets/animals/3d/${a}.glb`), a);
    assert.ok(existsSync(`${root}assets/riders/thumbs/animal_${a}.png`), `thumb ${a}`);
    assert.ok(ANIMAL_ZH[a], a);
    assert.ok(ANIMAL_SIZE[a].len > 0.3 && ANIMAL_SIZE[a].len <= 1.5 && ANIMAL_SIZE[a].tall > 0.3, a);
  }
});

test("animalOf: only the known animals", () => {
  assert.equal(animalOf("fox"), "fox");
  for (const v of ["lynx", "Fox", "", "__proto__", "constructor", "toString", 3, null, undefined, ["fox"], { fox: 1 }]) assert.equal(animalOf(v), null, String(v));
});

test("lookAnimal: a look's animal, and older looks are people", () => {
  assert.equal(lookAnimal({ ch: { tpl: "F", parts: {}, colors: {}, animal: "moose" } }), "moose");
  assert.equal(lookAnimal({ ch: { tpl: "F", parts: {}, colors: {} } }), null, "saved before animals");
  assert.equal(lookAnimal({ preset: "A" }), null);
  assert.equal(lookAnimal({ ch: { tpl: "M", animal: "dragon" } }), null);
  assert.equal(lookAnimal(null), null);
});

test("cleanRider keeps a friend's animal only if it is one we know", () => {
  const ch = { tpl: "F", height: 168, parts: { hood: true }, colors: { MAT_jacket: "#112233" }, board: "C" };
  assert.equal(cleanRider({ ch: { ...ch, animal: "pika" } }).ch.animal, "pika");
  assert.equal(cleanRider({ ch: { ...ch, animal: "<img onerror=x>" } }).ch.animal, undefined);
  assert.equal(cleanRider({ ch: { ...ch, animal: "hasOwnProperty" } }).ch.animal, undefined);
  assert.equal(cleanRider({ ch }).ch.animal, undefined, "a person stays a person");
  assert.equal(cleanRider({ ch: { ...ch, animal: "fox" } }).ch.board, "C", "the board still comes along");
  assert.equal(cleanRider({ ch: { tpl: "X", animal: "fox" } }), null, "still needs a template to fall back on");
  assert.equal(cleanHi({ id: "mB12345678", rider: { ch: { ...ch, animal: "bear" } } }).rider.ch.animal, "bear");
});
