import test from "node:test";
import assert from "node:assert/strict";
import { createBeat } from "../src/minigames/exerciseBeat.js";

const beat = () => createBeat({ start: 10, period: 1, count: 3, quicken: 0.9, fastest: 0.5 });

test("the count-in leads to the first beat and taps during it are let go", () => {
  const set = beat();
  assert.equal(set.due, 13);
  assert.equal(set.countIn(10.1), 2);
  assert.equal(set.countIn(12.1), 0);
  assert.equal(set.tap(11), null);
  assert.equal(set.update(12), null);
  assert.equal(set.reps, 0);
  assert.equal(set.missAt, null);
});

test("taps on the beat count reps and the beat quickens down to the fastest", () => {
  const set = beat();
  assert.equal(set.tap(13.02), "good");
  assert.equal(set.reps, 1);
  assert.ok(Math.abs(set.period - 0.9) < 1e-9);
  assert.ok(Math.abs(set.due - 13.9) < 1e-9, "the next beat keeps to the grid, not to the tap");
  for (let i = 0; i < 20; i++) assert.equal(set.tap(set.due), "good");
  assert.equal(set.period, 0.5);
});

test("a tap a little off the beat still counts, as late or early", () => {
  const set = beat();
  assert.equal(set.tap(13.2), "late");
  assert.equal(set.tap(set.due - 0.2), "early");
  assert.equal(set.reps, 2);
});

test("a tap way off the beat or a beat let pass ends the set", () => {
  const off = beat();
  off.tap(13);
  assert.equal(off.tap(13.4), "miss");
  assert.equal(off.missAt, 13.4);
  assert.equal(off.tap(off.due), null, "nothing counts once it is over");
  assert.equal(off.reps, 1);
  const idle = beat();
  idle.tap(13);
  assert.equal(idle.update(14), null);
  assert.equal(idle.update(14.3), "miss");
  assert.equal(idle.update(15), null);
});

test("a second tap just after a counted one is let go", () => {
  const set = beat();
  set.tap(13);
  assert.equal(set.tap(13.08), null);
  assert.equal(set.reps, 1);
  assert.equal(set.missAt, null);
});
