import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { ANIMAL_RIDERS, ANIMAL_ZH, ANIMAL_SIZE, RIGGED, animalOf, riggedOf, deskPetOf, petColors, lookAnimal } from "../src/rider/animal-core.js";
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

test("the rigged animals (the capybara): a file, a picture, a name, defaults in animals.json", () => {
  const cfg = JSON.parse(readFileSync(`${root}assets/riders/animals/animals.json`, "utf8"));
  for (const a of RIGGED) {
    const e = cfg.animals.find((x) => x.id === a);
    assert.ok(e, a); assert.ok(existsSync(`${root}assets/riders/animals/${e.file}`), e.file);
    assert.ok(existsSync(`${root}assets/riders/thumbs/animal_${a}.png`), `thumb ${a}`);
    assert.ok(ANIMAL_ZH[a], a); assert.ok(e.height > 0.8 && e.height < 1.4, "its own height");
    assert.ok(!e.colors.MAT_mitten, "bare paws: no gloves colour");
    for (const [m, c] of Object.entries(e.colors)) assert.match(m + c, /^MAT_\w+#[0-9a-f]{6}$/i);
    assert.ok(!ANIMAL_RIDERS.includes(a), "not a resort animal (animal.js)");
  }
});

test("riggedOf / deskPetOf split the animals between character.js and animal.js", () => {
  assert.equal(animalOf("capybara"), "capybara");
  assert.equal(riggedOf("capybara"), "capybara"); assert.equal(deskPetOf("capybara"), null);
  assert.equal(riggedOf("fox"), null); assert.equal(deskPetOf("fox"), "fox");
  for (const v of ["Capybara", "", "__proto__", null, ["capybara"]]) { assert.equal(riggedOf(v), null); assert.equal(deskPetOf(v), null); }
});

test("a capybara look over the wire keeps its own colours and accessories, checked", () => {
  const ch = { tpl: "F", height: 168, parts: { hood: true, beanie: false, backpack: true }, colors: { MAT_jacket: "#112233" }, board: "C", animal: "capybara",
    pet: { colors: { MAT_fur: "#a8825e", MAT_jacket: "#2f3a4c", MAT_bad: "red", "<x>": "#000000" } } };
  const out = cleanRider(JSON.parse(JSON.stringify({ ch }))).ch;
  assert.equal(out.animal, "capybara");
  assert.deepEqual(out.pet, { colors: { MAT_fur: "#a8825e", MAT_jacket: "#2f3a4c" } });
  assert.equal(out.parts.beanie, false); assert.equal(out.parts.backpack, true);
  assert.equal(out.colors.MAT_jacket, "#112233", "the person's own clothes stay theirs");
  assert.equal(cleanRider({ ch: { ...ch, animal: "fox" } }).ch.pet, undefined, "only a rigged animal carries pet colours");
  assert.deepEqual(petColors({ MAT_eye: "#123456", MAT_x: 5 }), { MAT_eye: "#123456" });
  assert.deepEqual(petColors(null), {});
});
