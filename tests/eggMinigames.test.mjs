import test from "node:test";
import assert from "node:assert/strict";
import { createEgg, warmLimit } from "../src/stable/egg.js";
import { settleWarm } from "../src/stable/eggMinigameResult.js";
import { bestScore } from "../src/stable/minigameResult.js";
import { warmBand, warmStep } from "../src/minigames/warm.js";
import { eggShell } from "../src/minigames/eggShell.js";

const hour = 3_600_000;

test("warming warms the egg however little was played, once an hour, and keeps a new best", () => {
  const stable = { highscores: {}, eggs: [], dragons: [] };
  const egg = createEgg("warm-1", 0);
  assert.deepEqual(settleWarm(stable, egg, { id: "warm", score: 0 }, 0), { warmed: true, record: false });
  assert.equal(egg.warms, 1);
  assert.deepEqual(settleWarm(stable, egg, { id: "warm", score: 50 }, hour - 1), { warmed: false, record: false }, "once an hour, even for a record");
  assert.deepEqual(settleWarm(stable, egg, { id: "warm", score: 40 }, hour), { warmed: true, record: true }, "an hour later it can be warmed again");
  assert.equal(bestScore(stable, "warm"), 40);
  egg.warms = warmLimit;
  assert.deepEqual(settleWarm(stable, egg, { id: "warm", score: 99 }, 9 * hour), { warmed: false, record: false }, "no record without a warm");
});

test("an egg rubbed steadily settles in the warm band, rubbed frantically it overheats, left alone it cools", () => {
  const settle = (radiansPerSecond) => {
    let w = 0;
    for (let i = 0; i < 600; i++) w = warmStep(w, radiansPerSecond / 60, 1 / 60);
    return w;
  };
  const steady = settle(8);
  assert.ok(steady >= warmBand[0] && steady <= warmBand[1], `steady circles hold ${steady}`);
  assert.ok(settle(20) >= 1, "frantic rubbing overheats");
  assert.ok(settle(2) < warmBand[0], "lazy rubbing stays cool");
  assert.ok(warmStep(0.7, 0, 1) < 0.7);
});

test("a ray at the egg's middle hits its shell facing the eye", () => {
  const anatomy = { bounds: { radius: 0.65 }, parts: [] };
  const shell = eggShell(anatomy);
  const racer = { position: [0, 0.65, 0], forward: [1, 0, 0], bank: 0 };
  const hit = shell.hit(racer, [0, 0.65, 5], [0, 0, -1]);
  assert.ok(hit);
  assert.ok(Math.abs(hit[0] - Math.PI / 2) < 0.05);
  const point = shell.toWorld(racer, shell.at(...hit));
  assert.ok(point[2] > 0.4 && point[2] < 0.6, `the shell's near side, ${point[2]}`);
  assert.equal(shell.hit(racer, [3, 0.65, 5], [0, 0, -1]), null);
  assert.deepEqual(shell.toLocal(racer, point).map((v) => Math.round(v * 1000)), shell.at(...hit).map((v) => Math.round(v * 1000)));
});
