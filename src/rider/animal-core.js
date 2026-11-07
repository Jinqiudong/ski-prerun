// The resort animals as riders (a cute option on the rider page): which there are, their names, how big each
// stands on its board, and a look's animal checked. No DOM and no three.js (tested: tests/animal.test.mjs).
// The models are the start map's desk pets (assets/animals/3d/<name>.glb, tools/build_animals.py); animal.js
// puts one on a board.

// In the order the rider page shows them: the small ones first.
export const ANIMAL_RIDERS = ["pika", "hare", "marmot", "ptarmigan", "fox", "sheep", "bear", "elk", "moose"];
export const ANIMAL_ZH = { pika: "鼠兔", hare: "雪兔", marmot: "土拨鼠", ptarmigan: "雷鸟", fox: "狐狸", sheep: "大角羊", bear: "黑熊", elk: "马鹿", moose: "驼鹿" };
// Toy sizes on a 1.5 m board, in metres: nose to tail at most `len`, and no taller than `tall` (antlers included).
export const ANIMAL_SIZE = {
  pika: { len: 0.72, tall: 0.62 }, hare: { len: 0.8, tall: 0.95 }, marmot: { len: 0.82, tall: 0.62 }, ptarmigan: { len: 0.7, tall: 0.72 },
  fox: { len: 1.18, tall: 0.95 }, sheep: { len: 1.12, tall: 1.05 }, bear: { len: 1.2, tall: 1.05 }, elk: { len: 1.25, tall: 1.45 }, moose: { len: 1.3, tall: 1.5 },
};

// One of the animals, or null (a look comes from this phone's storage or over the wire).
export const animalOf = (v) => (typeof v === "string" && ANIMAL_RIDERS.includes(v) ? v : null);
// The animal a look's rider (core/look.js: { ch }, ...) rides as: ch.animal, or null for a person. The rest of
// ch (template, colours, board) stays as it was, so a person comes back in the same clothes.
export const lookAnimal = (rider) => animalOf(rider?.ch?.animal);
