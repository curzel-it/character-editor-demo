import test from "node:test";
import assert from "node:assert/strict";
import { catchOutcome, catchSkill } from "../src/minigames/feedCatch.js";
import { throwArc } from "../src/minigames/throwArc.js";
import { minigameFor, minigames } from "../src/minigames/minigames.js";

test("a throw dead on the mouth is caught when the roll comes under the dragon's skill", () => {
  assert.equal(catchOutcome({ lateral: 0, rise: 0, skill: 0.9, roll: 0.89, pick: 0 }), "catch");
  assert.notEqual(catchOutcome({ lateral: 0, rise: 0, skill: 0.9, roll: 0.91, pick: 0 }), "catch");
  assert.notEqual(catchOutcome({ lateral: 0.95, rise: 0, skill: 0.9, roll: 0.5, pick: 0 }), "catch", "the edge of its reach is hard to catch");
});

test("kids catch less than adults", () => {
  assert.ok(catchSkill.kid < catchSkill.teen && catchSkill.teen < catchSkill.adult);
  const caught = (skill) => Array.from({ length: 100 }, (_, i) => catchOutcome({ lateral: 0.3, rise: 0.2, skill, roll: i / 100, pick: 0.5 })).filter((k) => k === "catch").length;
  assert.ok(caught(catchSkill.kid) < caught(catchSkill.adult));
});

test("a fumble within reach is a bonk, a late chomp or meat on the head", () => {
  const fumble = (pick) => catchOutcome({ lateral: 0, rise: 0, skill: 0, roll: 0.5, pick });
  assert.equal(fumble(0.1), "bonk");
  assert.equal(fumble(0.6), "late");
  assert.equal(fumble(0.95), "head");
});

test("a throw out of reach lands on the head, falls short or flies wide", () => {
  const out = (lateral, rise) => catchOutcome({ lateral, rise, skill: 1, roll: 0, pick: 0 });
  assert.equal(out(0, 1.4), "head");
  assert.equal(out(0, -2), "short");
  assert.equal(out(2, 0), "spin");
  assert.equal(out(0, 3), "spin", "far over its head it whips round to watch it go");
});

test("a throw's arc passes its aim after its flight and comes down to the ground beyond it", () => {
  const arc = throwArc([0, 1, 0], [5, 2, 0], 1, 6, 0);
  assert.deepEqual(arc.at(0), [0, 1, 0]);
  assert.ok(Math.hypot(...arc.at(1).map((v, k) => v - [5, 2, 0][k])) < 1e-9);
  assert.ok(arc.landAt > 1 && Math.abs(arc.land[1]) < 1e-9 && arc.land[0] > 5);
});

test("Feed has a minigame with a finale inside its care reaction", () => {
  const def = minigameFor("feed", () => 0);
  assert.equal(def.id, "feed");
  assert.ok(def.finale > 0);
  assert.ok(minigames.feed.every((d) => d.icon && typeof d.create === "function"));
});
