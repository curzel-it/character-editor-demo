import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { createExercise } from "../src/minigames/exercise.js";
import { minigameFor } from "../src/minigames/minigames.js";

const module = await loadSubject("dragon");

/** Plays a set on a dragon of `age`, tapping on the first `reps` beats, and returns what it saw. */
function play(age, reps) {
  const anatomy = module.createAnatomy(makeGenome(module.genes, 7), { age });
  const game = createExercise({ anatomy, seed: "test" });
  const racer = { anatomy, pose: module.pose(anatomy, 0, { stand: 1 }), position: [0, 0, 0], forward: [1, 0, 0] };
  const view = (time) => ({ time, dt: 1 / 60, width: 390, height: 844, dragon: racer, project: () => ({ x: 100, y: 200, front: true }) });
  const steps = [];
  let tapped = 0;
  for (let time = 0; time < 40 && !game.done; time += 1 / 60) {
    game.update(view(time));
    const beat = game.beat;
    if (beat && beat.count === 0 && tapped < reps && beat.until < 1 / 60) {
      game.pointer({ type: "down", x: 10, y: 10 });
      tapped++;
    }
    if (steps.at(-1) !== game.step) steps.push(game.step);
    for (const value of Object.values(game.motion())) assert.ok(Number.isFinite(value));
  }
  return { game, steps };
}

test("Exercise is the exercise action's minigame", () => {
  assert.equal(minigameFor("exercise").id, "exercise");
});

test("a set counts a rep for each tap on the beat, moves through the circuit and flops on a miss", () => {
  const { game, steps } = play("adult", 8);
  assert.equal(game.score, 8);
  assert.ok(game.done);
  assert.equal(steps[0], "ready");
  assert.deepEqual(steps.slice(-2), ["flop", "done"]);
  const drills = steps.filter((s) => !["ready", "flop", "done"].includes(s));
  assert.equal(drills.length, 2, "six reps of one drill, then the next");
  assert.ok(Math.abs(game.progress - 8 / 20) < 1e-9);
});

test("teens leave push-ups to adults and a set with no taps still ends", () => {
  const { game, steps } = play("teen", 30);
  assert.ok(!steps.includes("pushup"));
  assert.ok(game.score >= 18);
  const idle = play("teen", 0);
  assert.equal(idle.game.score, 0);
  assert.ok(idle.game.done);
});
