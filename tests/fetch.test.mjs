import test from "node:test";
import assert from "node:assert/strict";
import { aimOf, throwFlight } from "../src/minigames/fetchThrow.js";
import { fetchTrip } from "../src/minigames/fetchTrip.js";
import { findOf } from "../src/minigames/fetchFinds.js";

const H = 844;

test("a short or downward drag aims nothing, a longer one up the screen throws faster up to a cap", () => {
  assert.equal(aimOf({ x: 200, y: 600 }, { x: 204, y: 596 }, H), null);
  assert.equal(aimOf({ x: 280, y: 300 }, { x: 280, y: 600 }, H), null, "dragged down");
  assert.equal(aimOf({ x: 200, y: 600 }, { x: 500, y: 560 }, H), null, "dragged sideways");
  const gentle = aimOf({ x: 280, y: 660 }, { x: 280, y: 560 }, H);
  const hard = aimOf({ x: 280, y: 660 }, { x: 280, y: 300 }, H);
  assert.ok(gentle.speed < hard.speed);
  assert.equal(hard.speed, aimOf({ x: 280, y: 800 }, { x: 280, y: 0 }, H).speed);
  assert.ok(Math.abs(gentle.angle) < 1e-9);
  assert.ok(aimOf({ x: 200, y: 660 }, { x: 320, y: 360 }, H).angle > 0.2);
  assert.ok(aimOf({ x: 300, y: 660 }, { x: 180, y: 360 }, H).angle < -0.2);
});

test("a throw flies its arc from the hand down to the ground, further the faster", () => {
  const from = [0, 3, 0];
  const slow = throwFlight(from, [0, 0, -1], 8, 0.1);
  const fast = throwFlight(from, [0, 0, -1], 30, 0.1);
  assert.deepEqual(slow.at(0), from);
  assert.ok(Math.abs(fast.land[1] - 0.1) < 1e-9);
  assert.ok(-fast.land[2] > 2 * -slow.land[2], `${slow.land} ${fast.land}`);
  assert.ok(Math.abs(-throwFlight(from, [0, 0, -1], aimOf({ x: 0, y: 800 }, { x: 0, y: 0 }, H).speed, 0.1).land[2] - 100) < 10, "a full drag throws about 100 m");
  assert.ok(Math.abs(fast.land[0]) < 1e-9);
});

test("the dragon's run leaves its spot, goes the distance and comes home carrying its find", () => {
  const trip = fetchTrip({ from: [0, 0, 0], facing: [0.6, 0, 0.8], dir: [0, 0, -1], distance: 120, radius: 3.5 });
  const start = trip.at(0);
  assert.deepEqual([start.position[0], start.position[2]], [0, 0]);
  assert.equal(start.carrying, false);
  const away = trip.at(trip.landsAt);
  assert.ok(Math.abs(away.position[2] + 120) < 1, `at ${away.position}`);
  let carried = false,
    highest = 0;
  for (let t = 0; t < trip.length; t += 0.05) {
    const { position, carrying } = trip.at(t);
    carried ||= carrying;
    highest = Math.max(highest, position[1]);
    assert.ok(position.every(Number.isFinite));
  }
  assert.ok(carried);
  assert.ok(highest > 10, "it flies up after the stick");
  const end = trip.at(trip.length);
  assert.ok(Math.hypot(end.position[0], end.position[1], end.position[2]) < 1e-6);
  assert.ok(Math.hypot(end.forward[0] - 0.6, end.forward[2] - 0.8) < 1e-6, "it faces the keeper again");
  assert.equal(end.dropped, true);
  const late = fetchTrip({ from: [0, 0, 0], facing: [0.6, 0, 0.8], dir: [0, 0, -1], distance: 30, radius: 3.5, arrive: 4 });
  assert.equal(late.landsAt, 4, "it gets there as the stick comes down");
});

test("the first find is the stick and now and then it is something else, the same for the same seed", () => {
  assert.equal(findOf("s", 0), "stick");
  const finds = Array.from({ length: 200 }, (_, i) => findOf("s", i + 1));
  assert.ok(finds.filter((f) => f === "stick").length > 100);
  assert.ok(finds.includes("log") && finds.includes("bone"));
  assert.deepEqual(finds, Array.from({ length: 200 }, (_, i) => findOf("s", i + 1)));
});
