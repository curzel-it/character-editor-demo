import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { applyCare, freshCare } from "../src/stable/care.js";
import { minigameNeed } from "../src/stable/minigameResult.js";
import { scratchSpots } from "../src/minigames/scratchSpots.js";
import { spotPoints } from "../src/minigames/coatSpots.js";
import { createGroom } from "../src/minigames/groom.js";

const dragon = await loadSubject("dragon");
const adult = dragon.createAnatomy(makeGenome(dragon.genes, "groom-1"), { age: "adult" });
const grown = (affection) => ({ age: "adult", care: { ...freshCare(), affection }, bond: 0.2 });

test("a groom minigame fills affection by its share of the scale, like every other need", () => {
  const tapped = grown(20);
  applyCare(tapped, "groom");
  assert.equal(tapped.care.affection, 80, "the tap's sixty points hold");
  const least = grown(20);
  applyCare(least, "groom", 0.3);
  assert.equal(Math.round(least.care.affection), 50, "the floor gives thirty points");
  const best = grown(20);
  applyCare(best, "groom", 1);
  assert.equal(best.care.affection, 100, "a full game fills it");
  assert.ok(best.bond > least.bond, "a better game bonds more");
  assert.equal(minigameNeed(grown(20), "groom", 1, "affection"), best.care.affection, "the meter previews what settling gives");
  const dirty = { age: "kid", care: { ...freshCare(), cleanliness: 10 }, bond: 0 };
  assert.equal(Math.round(minigameNeed(dirty, "clean", 0.5, "cleanliness")), 60, "other needs still refill their share of the scale");
  assert.equal(dirty.care.cleanliness, 10, "previewing leaves the dragon alone");
});

test("every age has itchy spots on its head and neck, and a nose apart from them", () => {
  for (const age of ["kid", "teen", "adult"]) {
    const anatomy = dragon.createAnatomy(makeGenome(dragon.genes, `groom-${age}`), { age });
    const { spots, nose, skin, size } = scratchSpots(anatomy, { side: 1, seed: age });
    assert.ok(spots.length >= 4, `${age} has ${spots.length} spots`);
    assert.equal(new Set(spots.map((s) => s.region)).size, spots.length, "one spot per region");
    assert.ok(skin.length > 100 && size > 0);
    for (const s of spots) assert.ok(Math.hypot(...s.at.map((v, k) => v - nose.at[k])) > 0.2 * size, `${age} ${s.region} clear of the nose`);
  }
});

test("an adult's itch moves well away each time and reaches down the neck", () => {
  for (const seed of ["a", "b", "c", "d", "e"]) {
    const { spots, size } = scratchSpots(adult, { side: 1, seed });
    const gap = (a, b) => Math.hypot(...a.at.map((v, k) => v - b.at[k])) / size;
    for (let n = 1; n < 4; n++) assert.ok(gap(spots[n], spots[n - 1]) > 0.7, `${seed}: spot ${n} is ${gap(spots[n], spots[n - 1]).toFixed(2)} heads from the last`);
    assert.ok(spots.some((s) => s.region === "throat"), "one itches low on the neck");
  }
});

/** A side view from the dragon's left, 200 pixels a metre. */
function sideView(time) {
  const racer = { anatomy: adult, pose: { bones: {} }, position: [0, 0, 0], forward: [1, 0, 0] };
  return {
    time,
    dt: 1 / 60,
    dragon: racer,
    eye: [0, 5, 100],
    ahead: [0, 0, -1],
    right: [1, 0, 0],
    up: [0, 1, 0],
    width: 390,
    height: 844,
    project: (p) => ({ x: 200 + 200 * (p[0] - 4), y: 400 - 200 * (p[1] - 5), front: true }),
  };
}

const play = (game, from, seconds) => {
  for (let t = from; t < from + seconds; t += 1 / 60) game.update(sideView(t));
  return from + seconds;
};

test("holding the itchy spot fills the bliss, scores it and moves the itch", () => {
  const game = createGroom({ anatomy: adult, seed: "s" });
  const racer = sideView(0).dragon;
  const [first] = scratchSpots(adult, { side: 1, seed: "s" }).spots;
  const at = sideView(0).project(spotPoints([first], racer)[0]);
  let t = play(game, 0, 1.2);
  assert.equal(game.step, "search");
  game.pointer({ type: "down", x: at.x, y: at.y });
  for (let n = 0; n < 200 && game.score === 0; n++) {
    game.pointer({ type: "move", x: at.x + (n % 2 ? 2 : -2), y: at.y });
    t = play(game, t, 1 / 60);
  }
  assert.equal(game.score, 1);
  assert.equal(game.step, "found");
  assert.equal(game.progress, 0.25);
  assert.equal(game.takeEvents().length, 1);
  assert.ok(game.motion().thump > 0, "a hind foot thumps for joy");
  play(game, t, 2);
  assert.notEqual(game.step, "found", "the itch has moved on");
});

test("stroking off the spot scores nothing and three snorts at the nose end it", () => {
  const game = createGroom({ anatomy: adult, seed: "s" });
  const view = sideView(0);
  const nose = view.project(spotPoints([scratchSpots(adult, { side: 1, seed: "s" }).nose], view.dragon)[0]);
  let t = play(game, 0, 1.2);
  for (let n = 0; n < 3; n++) {
    game.pointer({ type: "down", x: nose.x, y: nose.y });
    t = play(game, t, 0.1);
    assert.equal(game.step, "snort");
    game.pointer({ type: "up", x: nose.x, y: nose.y });
    t = play(game, t, 1.5);
  }
  assert.equal(game.done, true);
  assert.equal(game.score, 0);
  assert.equal(game.progress, 0);
});

test("the camera keeps every region that may itch, and the nose, in view as the dragon stood when the game began", () => {
  const game = createGroom({ anatomy: adult, seed: "s" });
  assert.equal(game.camera().keep, null, "nothing to keep before the dragon is seen");
  const view = sideView(0);
  play(game, 0, 1 / 60);
  const { keep } = game.camera();
  const { spots, nose } = scratchSpots(adult, { side: 1, seed: "s" });
  const posed = spotPoints([...spots, nose], view.dragon);
  const box = [0, 1, 2].map((k) => [Math.min(...keep.map((p) => p[k])), Math.max(...keep.map((p) => p[k]))]);
  for (const p of posed) assert.ok(p.every((v, k) => v >= box[k][0] - 1e-9 && v <= box[k][1] + 1e-9), "every spot and the nose fall within what is kept");
  play(game, 1 / 60, 2);
  assert.equal(game.camera().keep, keep, "held still while the dragon leans into the hand");
});
