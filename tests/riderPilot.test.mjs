import test from "node:test";
import assert from "node:assert/strict";
import { createCourse } from "../src/course/createCourse.js";
import { genes } from "../src/genome/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { createRaceSim, simulationHz } from "../src/race/raceSim.js";
import { raceGeometry } from "../src/race/raceGeometry.js";
import { createRiderPilot } from "../src/race/riderPilot.js";
import { decide } from "../src/race/pilot.js";
import { createChaseCam } from "../src/camera/chaseCam.js";
import { breathLength } from "../src/breath/breathCue.js";
import { breathElements } from "../src/breath/breathElements.js";

const roster = (count) =>
  Array.from({ length: count }, (_, i) => ({ id: `t-${i}`, name: `T${i}`, subject: "dragon", genome: makeGenome(genes, `train:${i}`) }));
const canyon = createCourse("training-canyon", { type: "canyon" });

test("a live recording keeps a frame per step", () => {
  const sim = createRaceSim({ seed: 3, course: canyon, roster: roster(1), hz: simulationHz });
  for (let i = 0; i < 30; i++) sim.step();
  assert.equal(sim.recording.frames.length, 31);
  assert.equal(sim.recording.hz, simulationHz);
  assert.equal(sim.done, false);
});

const ride = ({ at = {}, script = null, until = Infinity, driver = null, age } = {}) => {
  const rider = createRiderPilot({ script });
  const pilot = driver ? (racer, ctx) => (rider.give(driver(racer, ctx)), rider.pilot(racer, ctx)) : rider.pilot;
  const racers = roster(1).map((entry) => ({ ...entry, age }));
  const sim = createRaceSim({ seed: "training", course: canyon, roster: racers, hz: simulationHz, pilots: { "t-0": pilot } });
  for (let step = 0; !sim.done && step < until; step++) {
    for (const command of at[step] ?? []) rider.give(command);
    sim.step();
  }
  return { sim, rider, last: sim.recording.frames.at(-1).racers[0] };
};
const lateral = (position) => raceGeometry(canyon).corridor.project(position).u;
const airborne = ride().sim.recording.frames.findIndex((f) => !f.racers[0].takeoff);
const clamp = (v) => Math.max(-1, Math.min(1, v));

test("the stick steers the dragon across the course", () => {
  const steps = airborne + 2 * simulationHz;
  const base = lateral(ride({ until: steps }).last.position);
  const left = lateral(ride({ until: steps, at: { [airborne]: [{ type: "stick", x: 1, y: 0 }] } }).last.position);
  const right = lateral(ride({ until: steps, at: { [airborne]: [{ type: "stick", x: -1, y: 0 }] } }).last.position);
  assert.ok(left > base + 3, `${left} vs ${base}`);
  assert.ok(right < base - 3, `${right} vs ${base}`);
});

test("left alone, a ridden dragon flies Autopilot's line at Autopilot's pace", () => {
  const ridden = ride().sim.recording;
  const auto = createRaceSim({ seed: "training", course: canyon, roster: roster(1), hz: simulationHz });
  while (!auto.done) auto.step();
  assert.ok(Math.abs(ridden.results[0].time - auto.recording.results[0].time) < 0.05, `${ridden.results[0].time} vs ${auto.recording.results[0].time}`);
});

test("letting go of the stick puts the dragon back on the racing line", () => {
  const rider = createRiderPilot();
  const gaps = [];
  const pilot = (racer, ctx) => {
    const step = Math.round(ctx.t * simulationHz);
    if (step === airborne) rider.give({ type: "stick", x: 1, y: 0.5 });
    if (step === airborne + simulationHz) rider.give({ type: "stick", x: 0, y: 0 });
    const flown = rider.pilot(racer, ctx),
      line = decide(racer, ctx);
    gaps[step] = Math.abs(flown.uWish - line.uWish) + Math.abs(flown.yWish - line.yWish);
    return flown;
  };
  const sim = createRaceSim({ seed: "training", course: canyon, roster: roster(1), hz: simulationHz, pilots: { "t-0": pilot } });
  for (let step = 0; step < airborne + 4 * simulationHz; step++) sim.step();
  assert.ok(gaps[airborne + simulationHz - 1] > 3, `${gaps[airborne + simulationHz - 1]}`);
  assert.ok(gaps[airborne + 4 * simulationHz - 1] < 0.01, `${gaps[airborne + 4 * simulationHz - 1]}`);
});

test("the stick climbs the dragon above the racing line", () => {
  const start = airborne + 20 * simulationHz;
  const at = { [start]: [{ type: "stick", x: 0, y: 1 }], [start + simulationHz]: [{ type: "stick", x: 0, y: 0 }] };
  const gain = (seconds) => ride({ at, until: start + seconds * simulationHz }).last.position[1] - ride({ until: start + seconds * simulationHz }).last.position[1];
  assert.ok(gain(1.5) > 5, `${gain(1.5)}`);
});

test("a rider steering at each gate flies the course clean", () => {
  const driver = (racer, ctx) => {
    const gate = ctx.gates[racer.gate];
    return gate ? { type: "stick", x: clamp((gate.u - racer.u) / gate.radius), y: clamp((gate.y - racer.y) / gate.radius) } : { type: "stick", x: 0, y: 0 };
  };
  const { sim } = ride({ driver });
  assert.equal(sim.recording.events.filter((e) => e.type === "miss").length, 0);
  assert.notEqual(sim.recording.results[0].time, null);
});

test("the dragon follows the stick at once", () => {
  const rider = createRiderPilot();
  rider.give({ type: "stick", x: 0.6, y: -0.2 });
  const sim = createRaceSim({ seed: "training", course: canyon, roster: roster(1), hz: simulationHz, pilots: { "t-0": rider.pilot } });
  sim.step();
  assert.deepEqual([rider.state.x, rider.state.y], [0.6, -0.2]);
});

test("a flight replays exactly from its command log", () => {
  const at = { 30: [{ type: "stick", x: 0.5, y: 0 }, { type: "stick", x: 0.8, y: -0.2 }], 400: [{ type: "stick", x: 0, y: 0 }], 900: [{ type: "breath" }] };
  const live = ride({ at, until: 20 * simulationHz });
  const replay = ride({ script: live.rider.log, until: 20 * simulationHz });
  assert.equal(live.rider.log.length, 3);
  assert.deepEqual(replay.sim.recording.frames, live.sim.recording.frames);
  assert.deepEqual(replay.sim.recording.events, live.sim.recording.events);
});

test("the chase camera sits behind and above, and trails a sideways move", () => {
  const cam = createChaseCam({ span: 16 });
  const at = (x, z) => ({ id: "t", position: [x, 100, z], forward: [1, 0, 0], bank: 0, speed: 40, effort: 0.6 });
  const first = cam.shot(at(0, 0), 0, 1 / 60, { motion: 0 }).shot;
  assert.ok(first.eye[0] < -10 && first.eye[1] > 102);
  const moved = cam.shot(at(1, 10), 1 / 60, 1 / 60, { motion: 0 }).shot;
  assert.ok(moved.eye[2] > 0 && moved.eye[2] < 2, `${moved.eye[2]}`);
  assert.ok(Math.abs(moved.eye[0] - first.eye[0] - 1) < 0.1);
});

/** Breathes at every step the breath is ready, `times` times, from `after` seconds on; returns the ride's breath events. */
const breathing = ({ times = 1, after = 0, age, until = airborne + 80 * simulationHz } = {}) => {
  let left = times;
  const driver = (racer, ctx) => (left > 0 && ctx.t >= after && ctx.t >= racer.breathReady ? (left--, { type: "breath" }) : { type: "stick", x: 0, y: 0 });
  return ride({ driver, age, until }).sim.recording.events.filter((e) => e.type === "breath");
};

test("the rider's breath goes out with the dragon's element, then recharges at its Breath stat", () => {
  const [first, second] = breathing({ times: 2 });
  assert.ok(breathElements.some((e) => e.id === first.element));
  const { stats } = createRaceSim({ seed: "training", course: canyon, roster: roster(1) }).recording.roster[0];
  assert.ok(Math.abs(second.t - first.t - (breathLength + stats.recharge)) < 0.05, `${second.t - first.t}`);
});

test("a ridden kid cannot breathe; a teen can", () => {
  assert.equal(breathing({ age: "kid" }).length, 0);
  assert.equal(breathing({ age: "teen" }).length, 1);
});
