import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { createStable } from "../src/stable/newStable.js";
import { createDragon } from "../src/stable/createDragon.js";
import { createEgg } from "../src/stable/egg.js";
import { performRitual, ritualOdds } from "../src/stable/soulAltar.js";
import { callHome, sendToWild } from "../src/stable/wild.js";
import { circleSize, joinState, maxParents, ritualVerdict, slumberLine } from "../src/ui/ritualReadiness.js";

const hour = 3_600_000;

function altarStable(ages) {
  const stable = createStable(genes, "ready", 0);
  stable.welcomed = true;
  ages.forEach((age, i) => stable.dragons.push(createDragon({ seed: `ready:${i}`, genome: makeGenome(genes, `ready:${i}`), age })));
  return stable;
}

test("The circle has a place per adult at home, from two up to where the odds top out", () => {
  assert.equal(maxParents, 6);
  assert.equal(ritualOdds(maxParents + 1), ritualOdds(maxParents));
  assert.ok(ritualOdds(maxParents - 1) < ritualOdds(maxParents));
  assert.equal(circleSize(altarStable(["kid"])), 2);
  assert.equal(circleSize(altarStable(["adult", "adult", "adult", "teen"])), 3);
  assert.equal(circleSize(altarStable(Array(8).fill("adult"))), 6);
});

test("Each dragon says why it cannot join, with the time left where waiting helps", () => {
  const stable = altarStable(["adult", "adult", "adult", "adult", "kid", "adult"]);
  const [ready, hurt, tired, sleepy, kid, wild] = stable.dragons;
  hurt.injury = { id: "wing", label: "Strained wing", until: 3 * hour };
  tired.fatigue = 0.9;
  sleepy.slumberUntil = 2 * hour;
  sendToWild(stable, wild.id, 0);
  assert.deepEqual(joinState(stable, ready, 0), { text: "Ready", tone: "happy", pickable: true, wait: 0 });
  assert.equal(joinState(stable, hurt, hour).text, "Strained wing · 2h 0m");
  assert.equal(joinState(stable, hurt, hour).tone, "sad");
  assert.match(joinState(stable, tired, 0).text, /^Tired · /);
  assert.deepEqual(joinState(stable, sleepy, hour), { text: "Slumbering · 1h 0m", tone: "warn", pickable: true, wait: hour });
  assert.deepEqual(joinState(stable, kid, 0), { text: "Kid, not an adult", tone: "", pickable: false, wait: null });
  assert.equal(joinState(stable, wild, 0).text, "In the wild");
  callHome(stable, wild.id, 0);
  assert.equal(joinState(stable, wild, hour).text, "On the way · 1h 0m");
  assert.equal(joinState(stable, wild, hour).pickable, false);
});

test("The verdict names who holds the circle back and for how long", () => {
  const stable = altarStable(["adult", "adult", "adult"]);
  const [a, b, c] = stable.dragons;
  assert.equal(ritualVerdict(stable, [a], 0).label, "Pick at least 2 adults");
  assert.equal(ritualVerdict(stable, [a, b], 0).tone, "happy");
  b.slumberUntil = 2 * hour;
  c.slumberUntil = 3 * hour;
  assert.deepEqual(ritualVerdict(stable, [a, b, c], 0), { id: "verdict", label: `${b.name} and ${c.name} are not ready`, value: "ready in 3h 0m", tone: "warn" });
  b.slumberUntil = c.slumberUntil = 0;
  while (stable.eggs.length + stable.dragons.length < 6) stable.eggs.push(createEgg(`full:${stable.eggs.length}`, 0));
  assert.equal(ritualVerdict(stable, [a, b], 0).label, "No slot for the egg");
});

test("After a ritual every parent slumbers, and the line says for how long", () => {
  const stable = altarStable(["adult", "adult"]);
  const parents = [...stable.dragons];
  const result = performRitual(stable, genes, parents.map((w) => w.id), 0);
  assert.ok(result);
  assert.equal(slumberLine(parents, 0), `${parents[0].name} and ${parents[1].name} slumber for ${result.success ? "3h 0m" : "1h 0m"}.`);
  assert.match(ritualVerdict(stable, parents, 0).label, /are not ready$/);
});
