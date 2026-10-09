import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { stockedStable } from "./stableHelpers.mjs";
import { advanceStable } from "../src/stable/advanceStable.js";
import { freshCare } from "../src/stable/care.js";
import { stageDurations, evolve } from "../src/stable/lifeStages.js";
import { createDragon } from "../src/stable/createDragon.js";
import { runLeagueRace } from "../src/stable/leagueRace.js";
import { deriveStats } from "../src/race/deriveStats.js";
import { buildOf, statKeys, statLevels } from "../src/dragonBuild.js";
import { markStarsCelebrated, starToCelebrate, starsOf, strengthen, strengthOf, strengthPace } from "../src/stable/strength.js";

const hour = 3_600_000,
  day = 24 * hour;
const neglect = { fullness: 0, happiness: 0, cleanliness: 0, exercise: 0 };
const kidOf = (stable) => stable.dragons.find((w) => w.age === "kid");

test("a dragon starts at 1 star and good care grows it to 5 in about three days", () => {
  const w = createDragon({ seed: "care", genome: makeGenome(genes, "care") });
  assert.equal(strengthOf(w), 1);
  strengthen(w, hour);
  assert.ok(Math.abs(w.strength - 1 - strengthPace.perHour) < 1e-12, "full care earns the full hourly pace");
  strengthen(w, 3 * day);
  assert.equal(w.strength, 5, "and stops at five");
  const stable = stockedStable(genes, "strengthen", 0);
  advanceStable(stable, hour, hour);
  assert.ok(kidOf(stable).strength > 1, "the game clock grows it too");
});

test("neglect only stops strength, never takes it away, and races add none", () => {
  const w = createDragon({ seed: "neglected", genome: makeGenome(genes, "neglected"), strength: 2.5 });
  Object.assign(w.care, neglect);
  strengthen(w, 10 * hour);
  assert.equal(w.strength, 2.5);
  const stable = stockedStable(genes, "raced", 0);
  const kid = kidOf(stable);
  runLeagueRace(stable, "kids", kid.id, 0);
  assert.equal(kid.strength, 1, "a race leaves strength alone");
});

test("evolving keeps strength, and growing up takes time only", () => {
  const stable = stockedStable(genes, "evolve", 0);
  const kid = kidOf(stable);
  Object.assign(kid, { strength: 2.4, care: { ...freshCare(), ...neglect } });
  advanceStable(stable, stageDurations.kid, stageDurations.kid);
  assert.equal(kid.growth, stageDurations.kid, "a neglected kid grows up on time");
  assert.equal(evolve(stable, kid), "teen");
  assert.equal(kid.strength, 2.4);
});

test("stats are the build's share times strength: same total for the same stars, more for more stars", () => {
  for (let i = 0; i < 100; i++) {
    const genome = makeGenome(genes, `build:${i}`);
    const build = buildOf(genes, genome);
    assert.ok(Math.abs(statKeys.reduce((sum, key) => sum + build[key], 0) - statKeys.length) < 0.2, `seed ${i}`);
    const [low, high] = [1, 4].map((stars) => statLevels(genes, genome, stars));
    for (const key of statKeys) assert.ok(Math.abs(high[key] - 4 * low[key]) < 1e-9);
    const [weak, strong] = [1, 5].map((stars) => deriveStats({ genes }, genome, "adult", stars));
    for (const key of ["topSpeed", "acceleration", "handling", "breath"]) assert.ok(strong[key] > weak[key], `${key} grows with stars`);
  }
});

test("each body part drives its stat", () => {
  const genome = makeGenome(genes, "parts");
  const at = (name, end) => {
    const gene = genes.find((g) => g.name === name);
    return buildOf(genes, { ...genome, [name]: end ? gene.max : gene.min });
  };
  for (const [name, key] of [["body", "topSpeed"], ["wingspan", "acceleration"], ["tail", "handling"], ["horns", "breath"], ["thighs", "weight"]])
    assert.ok(at(name, true)[key] > at(name, false)[key], `${name} raises ${key}`);
});

test("each whole star is celebrated once", () => {
  const w = createDragon({ seed: "celebrate", genome: makeGenome(genes, "celebrate"), strength: 1.9 });
  assert.equal(starToCelebrate(w), null);
  w.strength = 2.05;
  assert.equal(starToCelebrate(w), 2);
  markStarsCelebrated(w, 2);
  assert.equal(starToCelebrate(w), null);
  assert.deepEqual(starsOf({ strength: 2.25 }), { stars: 2, progress: 0.25 });
  assert.deepEqual(starsOf({ strength: 5 }), { stars: 5, progress: 1 });
});
