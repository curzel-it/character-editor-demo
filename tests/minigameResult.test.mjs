import test from "node:test";
import assert from "node:assert/strict";
import { applyCare, freshCare } from "../src/stable/care.js";
import { bestScore, minigameAmount, minigameFloor, settleMinigame } from "../src/stable/minigameResult.js";

const kid = (care = {}) => ({ age: "kid", care: { ...freshCare(), ...care }, bond: 0.5 });

test("a minigame's amount refills its share of the need and scales the side effects", () => {
  const dragon = kid({ happiness: 0, fullness: 50, cleanliness: 50 });
  applyCare(dragon, "play", 0.7);
  assert.equal(Math.round(dragon.care.happiness), 70);
  assert.equal(Math.round(dragon.care.fullness), 40, "play's hunger grows with the amount");
  const tapped = kid({ cleanliness: 0 });
  applyCare(tapped, "clean");
  assert.equal(tapped.care.cleanliness, 60, "without an amount the tap's effect holds");
});

test("the least play refills the floor, full progress the whole need", () => {
  assert.equal(minigameAmount(0), minigameFloor);
  assert.equal(minigameAmount(1), 1);
  assert.equal(minigameAmount(2), 1);
});

test("a new best score is kept per minigame and refills the need in full", () => {
  const stable = { highscores: {} };
  const first = kid({ cleanliness: 0 });
  assert.deepEqual(settleMinigame(stable, first, { action: "clean", id: "clean", progress: 0, score: 40 }), { amount: 1, record: true });
  assert.equal(first.care.cleanliness, 100);
  assert.equal(bestScore(stable, "clean"), 40);
  const second = kid({ cleanliness: 0 });
  assert.equal(settleMinigame(stable, second, { action: "clean", id: "clean", progress: 0.5, score: 40 }).record, false, "matching the best is no record");
  assert.equal(Math.round(second.care.cleanliness), 65);
  assert.equal(bestScore(stable, "fetch"), 0);
  assert.equal(settleMinigame(stable, kid(), { action: "clean", id: "clean", progress: 0, score: 0 }).record, false);
});
