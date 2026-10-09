import test from "node:test";
import assert from "node:assert/strict";
import { createCourse } from "../src/course/createCourse.js";
import { genes } from "../src/genome/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { simulateRace } from "../src/race/simulateRace.js";
import { deriveStats } from "../src/race/deriveStats.js";
import { launchPush } from "../src/race/takeoff.js";
import { surfaceAt } from "../src/course/surfaceAt.js";
import { launchFromEvents } from "../src/animate/launchEvents.js";
import { dragonLegShapes } from "../src/anatomy/dragonLegVariants.js";
import { creatureScale } from "../src/worldScale.js";
import { raceGeometry } from "../src/race/raceGeometry.js";
import { footing, ground, standHeight } from "../src/race/landing.js";
import { leagues } from "../src/stable/leagues.js";

const roster = (tag, count = 8) =>
  Array.from({ length: count }, (_, i) => ({ id: `${tag}-${i}`, name: `Racer ${i + 1}`, subject: "dragon", genome: makeGenome(genes, `${tag}:${i}`) }));

const races = [
  ["valley", createCourse("takeoff-test")],
  ["canyon", createCourse("takeoff-test", { type: "canyon" })],
].map(([name, course]) => ({ name, course, recording: simulateRace({ seed: "takeoff", course, roster: roster(name) }) }));

test("the field stands on the ground at the start, jumps off after Go and is airborne within seconds", () => {
  for (const { name, course, recording } of races) {
    for (const [index, racer] of recording.frames[0].racers.entries()) {
      assert.ok(racer.grounded && racer.takeoff && racer.speed === 0, `${name} ${racer.id} waits on the ground`);
      const spot = surfaceAt(course, racer.position[0], racer.position[2]);
      const above = racer.position[1] - Math.max(spot.ground, spot.level);
      assert.ok(above > 0 && above < 5 * creatureScale, `${name} ${racer.id} stands ${above} m up`);
      const launch = recording.events.filter((e) => e.type === "launch" && e.racer === racer.id);
      const airborne = recording.events.filter((e) => e.type === "airborne" && e.racer === racer.id);
      assert.equal(launch.length, 1);
      assert.equal(airborne.length, 1);
      assert.ok(launch[0].t > 0 && launch[0].t < 1, `${name}: reacts to Go`);
      assert.ok(airborne[0].t > launch[0].t && airborne[0].t < 10, `${name}: airborne at ${airborne[0].t}`);
      const after = recording.frames.find((f) => f.t >= airborne[0].t).racers[index];
      assert.ok(!after.takeoff && !after.grounded && after.position[1] > racer.position[1]);
    }
    assert.equal(recording.events.filter((e) => e.type === "airborne" && e.first).length, 1);
  }
});

test("leg shape, leg length and weight set the jump off the ground", () => {
  const stats = { weight: 1 };
  const shape = (id) => dragonLegShapes.findIndex((s) => s.id === id);
  const push = (genome, s = stats) => {
    const p = launchPush(genome, s);
    return Math.hypot(p.forward, p.up);
  };
  assert.ok(push({ legShape: shape("spurred") }) > push({ legShape: shape("raptor") }));
  assert.ok(push({ legShape: shape("raptor") }) > push({ legShape: shape("armoured") }));
  const feathered = launchPush({ legShape: shape("feathered") }, stats),
    armoured = launchPush({ legShape: shape("armoured") }, stats);
  assert.ok(feathered.up / feathered.forward > armoured.up / armoured.forward, "feathered legs hop higher");
  const legs = genes.find((g) => g.name === "legs");
  assert.ok(push({ legs: legs.max }) > push({ legs: legs.min }));
  assert.ok(push({}, { weight: 1.2 }) < push({}, { weight: 0.9 }));
  const genome = makeGenome(genes, "push");
  assert.ok(push(genome, deriveStats("dragon", genome)) > 0);
});

test("the grid pose stands, crouches just before the jump and lets go after it", () => {
  const { recording } = races[0];
  const launch = recording.events.find((e) => e.type === "launch");
  const racer = { id: launch.racer, grounded: true };
  assert.deepEqual(launchFromEvents(recording, racer, -2), { stand: 1, impact: 0 });
  const crouch = launchFromEvents(recording, racer, launch.t - 0.1);
  assert.ok(crouch.stand === 1 && crouch.impact > 0.5);
  assert.deepEqual(launchFromEvents(recording, racer, launch.t + 1), { stand: 0, impact: 0 });
  assert.equal(launchFromEvents({ events: [] }, racer, 0).stand, 1, "a live flight stands until it launches");
});

test("every grid slot gives every age footing, so no kid or teen starts in water", () => {
  const short = { legs: genes.find((g) => g.name === "legs").min };
  for (const type of ["valley", "canyon"])
    for (const league of leagues)
      for (let i = 0; i < (type === "valley" ? 6 : 2); i++) {
        const course = createCourse(`grid-water-${i}`, { type, share: league.courseShare });
        const { corridor } = raceGeometry(course);
        for (const [index, slot] of course.start.grid.entries()) {
          const p = corridor.project(slot.position);
          const spot = ground(corridor, course, p.s, p.u);
          for (const age of ["kid", "teen", "adult"])
            assert.ok(footing(spot, standHeight(short, age), age), `${type} ${course.seed} ${league.id} slot ${index}: ${age} in ${spot.surface}`);
        }
      }
});
