import test from "node:test";
import assert from "node:assert/strict";
import { createCourse } from "../src/course/createCourse.js";
import { genes } from "../src/genome/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { simulateRace } from "../src/race/simulateRace.js";
import { footing, landingSettle, standHeight } from "../src/race/landing.js";
import { windingCourse } from "../src/race/windingCourse.js";
import { surfaceAt } from "../src/course/surfaceAt.js";
import { createDirector } from "../src/camera/createDirector.js";
import { buildSplash, splashLife } from "../src/scene/splash.js";
import { environmentOf } from "../src/palette.js";

const roster = (tag, count = 8) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${tag}-${i}`,
    name: `Racer ${i + 1}`,
    subject: "dragon",
    genome: makeGenome(genes, `${tag}:${i}`),
  }));

const races = [
  ["valley", createCourse("landing-test")],
  ["canyon", createCourse("landing-test", { type: "canyon" })],
  ["winding", windingCourse("landing-test")],
].map(([name, course]) => ({ name, course, recording: simulateRace({ seed: "landing", course, roster: roster(name) }) }));

test("every finisher lands once, after finishing, on the ground beyond the line", () => {
  for (const { name, course, recording } of races) {
    const finishS = course.gates.at(-1).s;
    for (const result of recording.results.filter((r) => r.time !== null)) {
      const lands = recording.events.filter((e) => e.type === "land" && e.racer === result.id);
      assert.equal(lands.length, 1, `${name} ${result.id} lands once`);
      const [land] = lands;
      assert.ok(land.t > result.time + 3, `${name}: glides in before touching down`);
      assert.ok(["water", "mud", "sand", "dirt"].includes(land.surface));
      assert.ok(land.position.every(Number.isFinite) && land.speed > 0);
      const index = recording.roster.findIndex((r) => r.id === result.id);
      const frame = recording.frames.find((f) => f.t >= land.t + 0.1);
      const racer = frame.racers[index];
      assert.ok(racer.grounded && racer.landing === 1, `${name}: grounded after touchdown`);
      assert.ok(racer.progress > finishS, `${name}: lands beyond the finish`);
      if (course.terrain) {
        const spot = surfaceAt(course, land.position[0], land.position[2]);
        assert.ok(Math.abs(land.position[1] - (land.surface === "water" ? spot.level : spot.ground)) < 0.5);
      }
    }
  }
});

test("landing racers stay above the ground and come to rest before the recording ends", () => {
  for (const { name, course, recording } of races) {
    const lands = recording.events.filter((e) => e.type === "land");
    assert.ok(recording.duration >= Math.max(...lands.map((e) => e.t)) + landingSettle - 0.1, `${name}: settles on camera`);
    const last = recording.frames.at(-1),
      before = recording.frames.at(-recording.hz);
    last.racers.forEach((racer, i) => {
      if (!racer.finished) return;
      assert.ok(racer.grounded && racer.speed < 1e-6, `${name}: at rest`);
      assert.deepEqual(racer.position, before.racers[i].position, `${name}: stands still`);
    });
    if (!course.terrain) continue;
    for (const frame of recording.frames)
      for (const racer of frame.racers)
        if (racer.landing > 0) {
          const spot = surfaceAt(course, racer.position[0], racer.position[2]);
          assert.ok(racer.position[1] > spot.ground + 1, `${name}: clear of the ground at ${frame.t}`);
        }
  }
});

test("only adults set down in water, and only where it is very shallow", () => {
  const water = (depth) => ({ surface: "water", ground: 0, level: depth });
  assert.ok(footing({ surface: "dirt", ground: 0, level: 0 }, 3, "kid"));
  assert.ok(footing(water(0.5), 3, "adult"), "an adult wades in shallow water");
  assert.ok(!footing(water(2), 3, "adult"), "never where it would swim");
  assert.ok(!footing(water(0.5), 3, "teen") && !footing(water(0.5), 3, "kid"), "kids and teens keep out of water");
  const course = createCourse("wet-35", { share: 0.5 });
  for (const age of ["kid", "teen", "adult"]) {
    const entries = roster(`wet-${age}`, 12).map((entry) => (age === "adult" ? entry : { ...entry, age }));
    const recording = simulateRace({ seed: "wet", course, roster: entries });
    for (const land of recording.events.filter((e) => e.type === "land")) {
      const index = recording.roster.findIndex((r) => r.id === land.racer);
      const stand = standHeight(entries[index].genome, entries[index].age);
      for (const frame of recording.frames.filter((f) => f.t >= land.t)) {
        const [x, , z] = frame.racers[index].position;
        assert.ok(footing(surfaceAt(course, x, z), stand, age), `${age} ${land.racer} stays out of deep water at ${frame.t}`);
      }
    }
  }
});

test("the winner's touchdown gets a slow-motion ground shot that shakes on impact", () => {
  for (const { name, course, recording } of races.slice(0, 2)) {
    const director = createDirector(recording, course);
    const winner = recording.results[0].id;
    const land = recording.events.find((e) => e.type === "land" && e.racer === winner);
    const shot = director.timeline.find((s) => s.shot === "landing" && s.subject === winner);
    assert.ok(shot && shot.start < land.t - 0.5 && shot.end > land.t + 1, `${name}: touchdown is on air`);
    assert.ok(director.pace(land.t) < 0.5 && director.pace(shot.start) === 1, `${name}: ${director.pace(land.t)} ${director.pace(shot.start)} ${shot.start} ${land.t}`);
    const before = director.shotAt(land.t - 0.05),
      after = director.shotAt(land.t + 0.1);
    assert.ok(after.thud > 0.2 && after.thud > before.thud, `${name}: ground camera shakes (${before.thud} → ${after.thud})`);
    const next = recording.events.find((e) => e.type === "land" && e.t > land.t);
    const settled = Math.min(land.t + 1.9, (next?.t ?? Infinity) - 0.01);
    if (settled - land.t > 1.2) assert.ok(director.shotAt(settled).thud < after.thud * 0.05, `${name}: the winner's shake dies out`);
  }
});

test("splash debris is deterministic and limited to its lifetime", () => {
  for (const { course, recording } of races.slice(0, 2)) {
    const env = environmentOf(course);
    const lands = recording.events.filter((e) => e.type === "land");
    const t = lands[0].t + 0.4;
    const a = buildSplash(lands, t, env),
      b = buildSplash(lands, t, env);
    assert.ok(a && a.positions.length > 0 && a.positions.every(Number.isFinite));
    assert.deepEqual(a.positions, b.positions);
    assert.equal(buildSplash(lands.slice(0, 1), lands[0].t - 5, env), null);
    assert.equal(buildSplash(lands.slice(0, 1), lands[0].t + splashLife + 0.1, env), null);
  }
  for (const surface of ["water", "mud", "sand", "dirt"]) {
    const splash = buildSplash([{ t: 0, racer: "x", surface, position: [0, 0, 0], forward: [1, 0, 0], speed: 8 }], 0.5, environmentOf({ type: "valley" }));
    assert.ok(splash.positions.length > 0, surface);
  }
});
