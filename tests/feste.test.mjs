import test from "node:test";
import assert from "node:assert/strict";
import { festeAway, festeDue, festeRest, markFeste, markSeen } from "../src/stable/feste.js";

const MINUTE = 60 * 1000,
  HOUR = 60 * MINUTE,
  DAY = 24 * HOUR;

/** What the stable does as `dragon` comes on screen at `now`: greets when due, then notes it seen. */
function show(stable, dragon, now, state) {
  const greets = festeDue(stable, dragon, now, state);
  if (greets) markFeste(stable, now);
  markSeen(dragon, now);
  return greets;
}

test("the gaps are eight hours away and five minutes between greetings", () => {
  assert.equal(festeAway, 8 * HOUR);
  assert.equal(festeRest, 5 * MINUTE);
});

test("a dragon greets the owner opening the app after two days, and not again on the next opening", () => {
  const stable = {},
    a = { seenAt: 0 };
  assert.equal(show(stable, a, 2 * DAY), true);
  assert.equal(show(stable, a, 2 * DAY + 10 * MINUTE), false);
});

test("a dragon not selected for days greets when selected, though the app was in use every few minutes", () => {
  const stable = {},
    a = { seenAt: 0 },
    x = { seenAt: 0 };
  for (let now = 0; now < 2 * DAY; now += 5 * MINUTE) show(stable, a, now);
  assert.equal(show(stable, x, 2 * DAY), true);
});

test("a second dragon coming on screen right after a greeting holds back, and counts as seen", () => {
  const stable = {},
    a = { seenAt: 0 },
    b = { seenAt: 0 };
  assert.equal(show(stable, a, DAY), true);
  assert.equal(show(stable, b, DAY + 30 * 1000), false);
  assert.equal(b.seenAt, DAY + 30 * 1000);
  assert.equal(show(stable, b, DAY + 10 * MINUTE), false, "it has been seen since");
});

test("a second dragon greets once five minutes have passed since the last greeting", () => {
  const stable = {},
    a = { seenAt: 0 },
    b = { seenAt: 0 };
  assert.equal(show(stable, a, DAY), true);
  assert.equal(show(stable, b, DAY + 6 * MINUTE), true);
});

test("an asleep dragon does not greet, but is seen", () => {
  const stable = {},
    a = { seenAt: 0 };
  assert.equal(show(stable, a, DAY, { asleep: true }), false);
  assert.equal(a.seenAt, DAY);
  assert.equal(stable.festeAt, undefined, "the rest is not taken");
});

test("a dragon on screen for the first time does not greet, but is seen from then on", () => {
  const stable = {},
    kid = {};
  assert.equal(show(stable, kid, DAY), false);
  assert.equal(kid.seenAt, DAY);
  assert.equal(show(stable, kid, 2 * DAY), true);
});

test("a dragon seen within eight hours does not greet", () => {
  assert.equal(festeDue({}, { seenAt: 0 }, festeAway), false);
  assert.equal(festeDue({}, { seenAt: 0 }, festeAway + 1), true);
});
