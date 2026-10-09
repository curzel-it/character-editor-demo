import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { stockedStable } from "./stableHelpers.mjs";
import { fieldCourse } from "../src/fieldCourse.js";
import { raceRoster } from "../src/raceField.js";
import { simulateRace } from "../src/race/simulateRace.js";
import { createLiveRace } from "../src/race/liveRace.js";
import { createOwnerPilot, inputCommand } from "../src/race/ownerPilot.js";
import { simulationHz } from "../src/race/raceSim.js";
import { finishLeagueRace, liveRaceOf, runLeagueRace, startLeagueRace } from "../src/stable/leagueRace.js";

const hour = 3_600_000;
const frame = 1 / 30;

/** A teen league race on air, so breath is in play. */
function onAir(seed = "live") {
  const stable = stockedStable(genes, seed, 0);
  const teen = stable.dragons.find((w) => w.age === "teen");
  const live = startLeagueRace(stable, "teens", teen.id, hour);
  const { field } = live;
  return { stable, teen, live, race: { seed: field.raceSeed, course: fieldCourse(field), roster: raceRoster(field) } };
}
const shared = onAir();

/** Flies `live` from the start like the screen does, a frame at a time, calling `act(t)` before each frame; stops at `until` or the end. */
function fly(live, { from = 0, until = Infinity, act = () => {}, budget = Infinity } = {}) {
  let t = from;
  for (; t <= until && !(live.done && t >= live.recording.duration); t += frame) {
    act(t);
    live.advance(t, budget);
  }
  return t;
}

const summary = (recording) => ({ results: recording.results, events: recording.events });

test("a live race left on Autopilot is the race simulateRace runs", () => {
  const { race, live } = shared;
  const ride = structuredClone(live.ride);
  const flown = createLiveRace({ ...race, ride });
  fly(flown);
  assert.equal(ride.log.length, 0);
  assert.ok(flown.recording.events.some((e) => e.type === "breath" && e.racer === ride.racer), "the owner's dragon breathes on Autopilot like the racer AI");
  assert.deepEqual(summary(flown.recording), summary(simulateRace(race)));
  assert.deepEqual(flown.recording.frames, simulateRace(race).frames);
});

/** Takes the reins at 10 s, steers, breathes, and hands back at 30 s. */
const script = (live) => (t) => {
  if (t >= 10 && t < 10 + frame) live.reins(true);
  if (t >= 12 && t < 12 + frame) live.give({ type: "stick", x: 0.62, y: -0.3 });
  if (t >= 18 && t < 18 + frame) live.give({ type: "breath" });
  if (t >= 20 && t < 20 + frame) live.give({ type: "stick", x: 0, y: 0 });
  if (t >= 30 && t < 30 + frame) live.reins(false);
};

test("the same seed and input log give the same race, and riding changes it", () => {
  const { race, live } = shared;
  const ride = structuredClone(live.ride);
  const flown = createLiveRace({ ...race, ride });
  fly(flown, { act: script(flown) });
  assert.deepEqual(ride.log.map(([, code]) => code), ["r", "s", "f", "s", "r"]);
  assert.deepEqual(ride.log[1].slice(2), [0.6, -0.3], "the stick moves in steps of 0.05");
  const replay = simulateRace({ ...race, ride });
  assert.deepEqual(summary(flown.recording), summary(replay));
  assert.deepEqual(summary(simulateRace({ ...race, ride: structuredClone(ride) })), summary(replay));
  assert.notDeepEqual(replay.frames, simulateRace(race).frames, "the owner's inputs fly a different race");
});

test("a race closed mid-way resumes from the seed and the log where it stopped, on Autopilot", () => {
  const { race, live } = shared;
  const ride = structuredClone(live.ride);
  const first = createLiveRace({ ...race, ride });
  fly(first, { until: 20, act: script(first) });
  assert.equal(first.riding, true);
  const saved = JSON.parse(JSON.stringify({ ride, step: first.step }));
  const resumed = createLiveRace({ ...race, ...saved });
  assert.equal(resumed.riding, false, "a resumed race opens on Autopilot");
  assert.equal(resumed.step, saved.step);
  assert.deepEqual(saved.ride.log.at(-1), [saved.step + 1, "r", 0]);
  fly(resumed, { from: saved.step / simulationHz });
  assert.deepEqual(summary(resumed.recording), summary(simulateRace({ ...race, ride: saved.ride })));
});

test("skipping hands back and flies the rest on Autopilot", () => {
  const { race, live } = shared;
  const ride = structuredClone(live.ride);
  const flown = createLiveRace({ ...race, ride });
  fly(flown, { until: 14, act: script(flown) });
  const recording = flown.complete();
  assert.equal(flown.riding, false);
  assert.ok(recording.results.length && recording.results.every((r) => r.place > 0));
  assert.deepEqual(summary(recording), summary(simulateRace({ ...race, ride })));
});

test("the director plans the live race on the fork and steps aside while riding", () => {
  const { race, live } = shared;
  const flown = createLiveRace({ ...race, ride: structuredClone(live.ride) });
  fly(flown, { until: 8 });
  assert.ok(flown.director);
  assert.ok(flown.recording.duration >= 8 + 3, "the fork runs ahead of the race on screen");
  flown.reins(true);
  flown.advance(8 + frame);
  assert.equal(flown.director, null);
  assert.ok(flown.recording.duration < 8.2, "riding shows the live sim");
  flown.reins(false);
  fly(flown, { from: 8 + 2 * frame, until: 9 });
  assert.ok(flown.director, "the director is back once the fork caught up");
});

test("the fork keeps up with the live sim while riding, so the broadcast is back at the hand-back", () => {
  const { race, live } = shared;
  const flown = createLiveRace({ ...race, ride: structuredClone(live.ride) });
  fly(flown, { until: 40 });
  flown.reins(true);
  fly(flown, { from: 40 + frame, until: 60 });
  assert.equal(flown.catchingUp, null, "nothing to catch up while riding");
  flown.reins(false);
  assert.ok(flown.catchingUp > 0.9, "the fork has replayed the ride already");
  for (let n = 1; n <= 3; n++) flown.advance(60 + n * frame, 0);
  assert.ok(flown.director, "the director is back within three frames of the least budget, not a replay from the seed");
  assert.equal(flown.catchingUp, null);
});

test("a hand-back before the fork caught up shows how far it is, and races on the same", () => {
  const { race, live } = shared;
  const ride = structuredClone(live.ride);
  const flown = createLiveRace({ ...race, ride });
  const progress = [];
  fly(flown, {
    budget: 0,
    act: (t) => {
      if (t >= 30 && t < 30 + frame) flown.reins(true);
      if (t >= 30.1 && t < 30.1 + frame) flown.give({ type: "stick", x: 0.4, y: 0.2 });
      if (t >= 30.2 && t < 30.2 + frame) flown.reins(false);
      if (t > 30.2 && flown.catchingUp !== null) progress.push(flown.catchingUp);
    },
  });
  assert.ok(progress.length > 1 && progress[0] < 0.5, "the fork replays from the seed a little a frame");
  assert.ok(progress.every((p, i) => p >= 0 && p <= 1 && (i === 0 || p >= progress[i - 1] - 0.01)));
  assert.ok(flown.director);
  const replay = simulateRace({ ...race, ride });
  assert.deepEqual(summary(flown.recording), summary(replay));
  assert.deepEqual(flown.recording.frames, replay.frames);
});

test("the owner's pilot replays a log of commands step for step", () => {
  const owner = createOwnerPilot({ log: [] });
  assert.equal(owner.riding, false);
  owner.give({ type: "breath" });
  assert.equal(owner.log.length, 0, "nothing is logged on Autopilot");
  owner.reins(true);
  owner.give({ type: "stick", x: 0.33, y: 1.4 });
  owner.give({ type: "stick", x: 0.34, y: 1 });
  assert.deepEqual(owner.log, [[1, "r", 1], [4, "s", 0.35, 1]], "one stick every four steps, rounded and clamped");
  owner.give({ type: "breath" });
  assert.deepEqual(owner.log.at(-1), [4, "f"], "never logged before the stick");
  assert.deepEqual(inputCommand([4, "f"]), { type: "breath" });
  owner.give({ type: "push", on: true });
  assert.equal(owner.log.length, 3, "Go and Brake are gone");
  assert.equal(owner.riding, true);
});

test("a league race on air is recorded when it finishes, with the ride that flew it", () => {
  const { stable, teen, live, race } = onAir("record");
  assert.equal(liveRaceOf(stable, "teens"), live);
  assert.equal(startLeagueRace(stable, "teens", teen.id, hour), null, "a race on air cannot be started again");
  assert.equal(runLeagueRace(stable, "teens", teen.id, hour), null);
  assert.equal(stable.leagues.teens.races.length, 0, "nothing is recorded before the finish");
  const flown = createLiveRace({ ...race, ride: live.ride });
  fly(flown, { act: script(flown) });
  const run = finishLeagueRace(stable, "teens", flown.recording.results, 2 * hour);
  assert.equal(liveRaceOf(stable, "teens"), null);
  assert.equal(run.race.ride, live.ride);
  assert.equal(teen.record.starts, 1);
  assert.equal(teen.history[0].place, run.race.results.find((r) => r.id === teen.id).place);
  assert.deepEqual(simulateRace({ ...race, ride: run.race.ride }).results, flown.recording.results);
  assert.equal(finishLeagueRace(stable, "teens", [], 2 * hour), null);

  const quiet = stockedStable(genes, "record", 0);
  const auto = runLeagueRace(quiet, "teens", quiet.dragons.find((w) => w.age === "teen").id, hour);
  assert.equal(auto.race.ride, undefined, "a race left on Autopilot keeps no ride");
  assert.deepEqual(auto.race.results.map((r) => r.id), simulateRace(race).results.map((r) => r.id));
});
