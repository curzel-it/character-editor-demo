import test from "node:test";
import assert from "node:assert/strict";
import { dragonReturns, flickOf, throwAim, throwMiss, volleyReach } from "../src/minigames/volleyballThrow.js";

test("a flick is measured over the finger's last tenth of a second", () => {
  const samples = [
    { x: 0, y: 900, time: 0 },
    { x: 100, y: 500, time: 0.95 },
    { x: 110, y: 400, time: 1 },
  ];
  const { vx, vy } = flickOf(samples, 1);
  assert.ok(Math.abs(vx - 200) < 1e-6 && Math.abs(vy + 2000) < 1e-6);
  assert.deepEqual(flickOf(samples.slice(0, 1), 1), { vx: 0, vy: 0 }, "a tap is no flick");
});

test("a straight flick of the ideal speed reaches the head, softer falls short, harder sails over", () => {
  const height = 800;
  assert.equal(throwAim({ vx: 0, vy: -100 }, height), null, "a release that barely rises keeps the ball");
  assert.equal(throwAim({ vx: 0, vy: 400 }, height), null, "a downward flick keeps the ball");
  const ideal = throwAim({ vx: 0, vy: -1.7 * height }, height);
  assert.ok(Math.abs(ideal.power - 1) < 1e-9);
  assert.equal(throwMiss(ideal).up, 0);
  assert.equal(throwMiss(ideal).across, 0);
  assert.ok(throwMiss(throwAim({ vx: 0, vy: -0.8 * height }, height)).up < 0);
  assert.ok(throwMiss(throwAim({ vx: 0, vy: -3 * height }, height)).up > 0);
  assert.ok(throwMiss(throwAim({ vx: 900, vy: -1.7 * height }, height)).across > 0, "a flick to the right veers right");
});

test("out of reach the dragon always misses, a clean throw it nearly always returns", () => {
  const reach = volleyReach.kid;
  assert.equal(dragonReturns({ wild: reach + 0.01, reach, rally: 0, roll: 0.999 }), false);
  assert.equal(dragonReturns({ wild: 0, reach, rally: 0, roll: 0.1 }), true);
  assert.equal(dragonReturns({ wild: 0, reach, rally: 0, roll: 0.01 }), false, "now and then it fumbles");
  assert.equal(dragonReturns({ wild: 0.9 * reach, reach, rally: 0, roll: 0.5 }), false, "a throw at the edge of its reach is mostly missed");
  assert.equal(dragonReturns({ wild: 0, reach, rally: 30, roll: 0.3 }), false, "it tires as the rally runs long");
  assert.ok(volleyReach.kid < volleyReach.teen && volleyReach.teen < volleyReach.adult);
});
