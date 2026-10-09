import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { tiltOf } from "../src/animate/dragonTilt.js";

const module = await loadSubject("dragon");
const standing = { effort: 0, glide: 1, stand: 1 };

test("An idle dragon tilts its head now and then, smoothly, kids further than adults", () => {
  const widest = {};
  for (const age of ["kid", "adult"])
    for (const seed of [3, 41.5, 77]) {
      const anatomy = { age };
      let tilted = 0,
        previous = 0;
      for (let i = 0; i < 120 * 60; i++) {
        const tilt = tiltOf(anatomy, { idle: 1, stand: 1 }, i / 60, seed),
          roll = tilt ? tilt.roll * tilt.full : 0;
        assert.ok(Math.abs(roll - previous) < 0.05, `${age} seed ${seed} at ${i / 60}`);
        assert.deepEqual(tiltOf(anatomy, { idle: 1, stand: 1 }, i / 60, seed), tilt);
        if (tilt) tilted++;
        widest[age] = Math.max(widest[age] ?? 0, Math.abs(roll));
        previous = roll;
      }
      assert.ok(tilted > 0.03 * 7200 && tilted < 0.5 * 7200, `${age} seed ${seed} tilted ${tilted}`);
    }
  assert.ok(widest.kid > widest.adult);
});

test("The head tilt only plays standing idle and awake, never in flight", () => {
  const anatomy = module.createAnatomy(makeGenome(module.genes, 2407), { age: "kid" });
  const times = Array.from({ length: 3000 }, (_, i) => i / 10);
  const head = (motion, t) => module.pose(anatomy, 0, { ...standing, time: t, ...motion }).bones.head.rotation;
  assert.ok(times.some((t) => head({ idle: 1 }, t)[0] !== head({}, t)[0]));
  for (const t of times) {
    assert.deepEqual(head({ idle: 1, sleep: 1 }, t), head({ sleep: 1 }, t));
    assert.deepEqual(module.pose(anatomy, t % 1, { time: t, idle: 1 }), module.pose(anatomy, t % 1, { time: t }));
  }
  assert.equal(tiltOf(anatomy, { idle: 1, stand: 1 }, null, 0), null);
});
