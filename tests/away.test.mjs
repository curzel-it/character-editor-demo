import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { stockedStable } from "./stableHelpers.mjs";
import { advanceStable } from "../src/stable/advanceStable.js";
import { evolve, stageDurations } from "../src/stable/lifeStages.js";
import { fatigueLimit } from "../src/stable/condition.js";
import { freshCare } from "../src/stable/care.js";
import { hatchEgg } from "../src/stable/hatch.js";
import { summariseAway } from "../src/stable/awaySummary.js";
import { createAwayLog, minAway } from "../src/ui/awayLog.js";
import { callHome, flightHome, sendToWild } from "../src/stable/wild.js";

const hour = 3_600_000;
const stable = () => stockedStable(genes, "away", 0);
const types = (entries) => entries.map((e) => e.type);

test("a tired dragon becomes rested once its fatigue drops to the limit", () => {
  const s = stable();
  const adult = s.dragons.find((w) => w.age === "adult");
  adult.fatigue = fatigueLimit + 0.1;
  const events = advanceStable(s, hour, hour);
  assert.ok(events.some((e) => e.type === "rested" && e.id === adult.id));
  assert.ok(!advanceStable(s, hour, 2 * hour).some((e) => e.type === "rested"), "rested is reported once");
});

test("the away summary lists ready eggs, needy dragons, growth and recovery, most urgent first", () => {
  const s = stable();
  const [needy, kid, teen] = s.dragons;
  needy.care = { ...freshCare(), fullness: 33, happiness: 60, cleanliness: 50 };
  teen.injury = { id: "leg", label: "Sore leg", until: hour / 4 };
  const adult = s.dragons.find((w) => w.age === "adult");
  adult.fatigue = fatigueLimit + 0.05;
  kid.growth = stageDurations.kid - hour / 4;
  s.eggs[0].incubation = stageDurations.egg - hour / 4;
  const events = advanceStable(s, hour / 2, hour / 2);
  const entries = summariseAway(s, events);
  assert.deepEqual(types(entries).slice(0, 2), ["ready", "care"], "an egg and a neglected kid lead");
  assert.equal(entries[1].id, needy.id);
  assert.ok(entries.some((e) => e.type === "evolve" && e.id === kid.id && e.age === "teen"));
  assert.ok(entries.some((e) => e.type === "healed" && e.id === teen.id));
  assert.ok(entries.some((e) => e.type === "rested" && e.id === adult.id));
  const order = ["ready", "care", "evolve", "healed", "rested"];
  assert.deepEqual(types(entries), [...types(entries)].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
});

test("the away summary keeps one entry per dragon stage and drops what no longer holds", () => {
  const s = stable();
  const kid = s.dragons.find((w) => w.age === "kid");
  const events = [];
  for (let t = 0; t < 2 * stageDurations.kid; t += 10 * 60_000) {
    events.push(...advanceStable(s, 10 * 60_000, 0));
    kid.care = freshCare();
  }
  assert.deepEqual(summariseAway(s, events).filter((e) => e.id === kid.id), [{ type: "evolve", id: kid.id, age: "teen" }]);
  evolve(s, kid);
  assert.ok(!summariseAway(s, events).some((e) => e.id === kid.id), "an evolved dragon drops out");
  hatchEgg(s, genes, s.eggs[0].id, 0);
  for (const w of s.dragons) Object.assign(w, { care: freshCare(), bond: 1 });
  assert.ok(!summariseAway(s, events).some((e) => e.type === "ready" || e.type === "care"), "hatched eggs and cared dragons drop out");
  const hurt = s.dragons.find((w) => w.age === "adult");
  assert.ok(!summariseAway(s, [{ type: "healed", id: hurt.id }, { type: "rested", id: hurt.id }]).some((e) => e.type === "rested"), "healed and rested read as one");
  hurt.injury = { id: "wing", label: "Strained wing", until: Infinity };
  assert.deepEqual(summariseAway(s, [{ type: "healed", id: hurt.id }]), [], "a dragon hurt again is not reported as healed");
  assert.deepEqual(summariseAway(s, [{ type: "evolve", id: "gone", age: "kid" }]), []);
});

test("a wild dragon called home lands in the stable as the step reaches it", () => {
  const s = stable();
  const adult = s.dragons.find((w) => w.age === "adult");
  sendToWild(s, adult.id, 0);
  callHome(s, adult.id, 0);
  assert.ok(!advanceStable(s, flightHome / 2, flightHome / 2).some((e) => e.type === "arrived"));
  const events = advanceStable(s, flightHome / 2, flightHome);
  assert.deepEqual(events[0], { type: "arrived", id: adult.id }, "arrivals come first");
  assert.ok(s.dragons.includes(adult) && !s.wild.includes(adult));
  assert.equal(adult.wild, undefined);
  assert.ok(!advanceStable(s, hour, flightHome + hour).some((e) => e.type === "arrived"), "arrived is reported once");
  assert.deepEqual(advanceStable(s, 0, flightHome + hour), [], "an empty step moves nothing");
});

test("a slumbering dragon wakes once, in the step its slumber ends", () => {
  const s = stable();
  const adult = s.dragons.find((w) => w.age === "adult");
  adult.slumberUntil = hour + 1;
  assert.ok(!advanceStable(s, hour, hour).some((e) => e.type === "woke"));
  assert.ok(advanceStable(s, hour, 2 * hour).some((e) => e.type === "woke" && e.id === adult.id));
  assert.ok(!advanceStable(s, hour, 3 * hour).some((e) => e.type === "woke"), "woke is reported once");
});

test("the away summary reports arrivals and wakings while they still hold", () => {
  const s = stable();
  const [home, sleeper] = s.dragons.filter((w) => w.age === "adult");
  sendToWild(s, home.id, 0);
  callHome(s, home.id, 0);
  sleeper.slumberUntil = hour;
  const events = advanceStable(s, flightHome, flightHome);
  const entries = summariseAway(s, events, flightHome);
  assert.ok(entries.some((e) => e.type === "arrived" && e.id === home.id));
  assert.ok(entries.some((e) => e.type === "woke" && e.id === sleeper.id));
  const order = ["ready", "care", "evolve", "arrived", "woke", "healed", "rested"];
  assert.deepEqual(types(entries), [...types(entries)].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  s.clock.game = flightHome;
  assert.deepEqual(summariseAway(s, events).filter((e) => e.type === "arrived" || e.type === "woke").length, 2, "now defaults to the stable's clock");
  sleeper.slumberUntil = 10 * hour;
  sendToWild(s, home.id, flightHome);
  assert.ok(!summariseAway(s, events, flightHome).some((e) => e.type === "arrived" || e.type === "woke"), "one back in the wild or asleep again drops out");
});

test("the away log collects events during an absence and only long ones earn the sheet", () => {
  const log = createAwayLog();
  assert.equal(log.back(0, 0), null, "no absence, no visit");
  log.leave(1000, 50);
  log.add([{ type: "ready", id: "egg" }]);
  log.leave(5000, 60);
  log.add([{ type: "healed", id: "w" }]);
  const visit = log.back(1000 + minAway, 50 + 10 * minAway);
  assert.deepEqual(visit, { events: [{ type: "ready", id: "egg" }, { type: "healed", id: "w" }], realAway: minAway, gameAway: 10 * minAway, sheet: true });
  assert.equal(log.away, false);
  log.leave(0, 0);
  assert.equal(log.back(minAway - 1, 0).sheet, false, "a short gap is only a glance");
});

