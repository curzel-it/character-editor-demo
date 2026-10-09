import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { yawnOf } from "../src/animate/dragonYawn.js";
import { individualSeed } from "../src/animate/flightNoise.js";

const module = await loadSubject("dragon");
const standing = { effort: 0, glide: 1, stand: 1 };
const step = 0.05;
const times = Array.from({ length: (1800 / step) | 0 }, (_, i) => i * step);

/** Every bout of yawns over `times` as `{ start, end, yawns }`. */
function bouts(anatomy, motion, seed) {
  const found = [];
  let bout = null;
  for (const t of times) {
    const yawn = yawnOf(anatomy, motion, t, seed);
    if (yawn && !bout) found.push((bout = { start: t, yawns: new Set() }));
    if (yawn) bout.yawns.add(yawn.id);
    if (!yawn && bout) [bout.end, bout] = [t, null];
  }
  return found.filter((b) => b.end !== undefined);
}

test("A bored dragon yawns in bouts of one or two, a good while apart, the same way every time", () => {
  for (const age of ["kid", "teen", "adult"])
    for (const seed of [3, 41.5, 77]) {
      const anatomy = { age },
        motion = { idle: 1, stand: 1, bored: 1 };
      const found = bouts(anatomy, motion, seed);
      assert.ok(found.length >= 25 && found.length <= 50, `${age} seed ${seed}: ${found.length} bouts in 30 minutes`);
      for (const [i, bout] of found.entries()) {
        assert.ok(bout.yawns.size === 1 || bout.yawns.size === 2);
        assert.ok(bout.end - bout.start <= 2 * 2.6 + 0.7 + step);
        if (i) assert.ok(bout.start - found[i - 1].end >= 20 - step, `${age} seed ${seed}: bouts ${bout.start - found[i - 1].end} s apart`);
      }
      assert.ok(found.some((bout) => bout.yawns.size === 2) && found.some((bout) => bout.yawns.size === 1));
      for (const t of times.slice(0, 2000)) assert.deepEqual(yawnOf(anatomy, motion, t, seed), yawnOf(anatomy, motion, t, seed));
    }
});

test("The more bored the dragon, the more often it yawns", () => {
  const count = (bored) => [3, 41.5, 77].reduce((sum, seed) => sum + bouts({ age: "kid" }, { idle: 1, stand: 1, bored }, seed).length, 0);
  assert.ok(count(0.3) < count(1));
});

test("A dragon that is not bored, asleep, busy or flying never yawns", () => {
  const anatomy = { age: "kid" };
  for (const motion of [{ idle: 1, stand: 1 }, { idle: 1, stand: 1, bored: 0 }, { idle: 1, stand: 1, bored: 1, sleep: 1 }, { idle: 0, stand: 1, bored: 1 }, { idle: 1, stand: 0, bored: 1 }, { idle: 1, stand: 1, bored: 1, wings: 1 }])
    for (const t of times) assert.equal(yawnOf(anatomy, motion, t, 7), null);
  assert.equal(yawnOf(anatomy, { idle: 1, stand: 1, bored: 1 }, null, 7), null);
});

test("A yawn opens the jaw wide and closes it again smoothly, only when bored", () => {
  const anatomy = module.createAnatomy(makeGenome(module.genes, 2408), { age: "adult" });
  const jaw = (motion, t) => module.pose(anatomy, t % 1, { ...standing, time: t, idle: 1, ...motion }).bones.jaw.rotation[2];
  const seed = individualSeed(anatomy.genome),
    first = Math.max(20, times.findIndex((t) => yawnOf(anatomy, { idle: 1, stand: 1, bored: 1 }, t, seed)));
  let widest = 0,
    previous = jaw({ bored: 1 }, times[first - 20]);
  for (const t of times.slice(first - 20, first + 140)) {
    const bored = jaw({ bored: 1 }, t);
    assert.ok(Math.abs(bored - previous) < 0.2, `the jaw jumped at ${t}`);
    widest = Math.max(widest, jaw({}, t) - bored);
    previous = bored;
  }
  assert.ok(widest > 0.3, `the jaw opened only ${widest}`);
  for (const t of times.slice(first - 20, first + 140)) assert.deepEqual(module.pose(anatomy, t % 1, { ...standing, time: t, idle: 1, bored: 1, sleep: 1 }), module.pose(anatomy, t % 1, { ...standing, time: t, idle: 1, sleep: 1 }));
});
