import test from "node:test";
import assert from "node:assert/strict";
import { createCourse } from "../src/course/createCourse.js";
import { genes } from "../src/genome/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { simulateRace } from "../src/race/simulateRace.js";
import { raceGeometry } from "../src/race/raceGeometry.js";
import { sampleRace } from "../src/race/sampleRace.js";
import { deriveStats } from "../src/race/deriveStats.js";
import { windingCourse } from "../src/race/windingCourse.js";
import { scaleCourse } from "../src/race/scaleCourse.js";
import { flapRate } from "../src/race/flightModel.js";
import { lengthScale, speedScale } from "../src/worldScale.js";

const roster = (tag, count = 8) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${tag}-${i}`,
    name: `Racer ${i + 1}`,
    subject: "dragon",
    genome: makeGenome(genes, `${tag}:${i}`),
  }));

const cases = [
  ["generated course", createCourse("race-test")],
  ["winding climbing course", windingCourse("race-test")],
];
const races = cases.map(([name, course]) => [
  name,
  course,
  simulateRace({ seed: "race-test", course, roster: roster(name) }),
]);

test("same inputs give an identical recording", () => {
  const [, course] = races[0];
  const a = simulateRace({ seed: 7, course, roster: roster("det") });
  const b = simulateRace({ seed: 7, course, roster: roster("det") });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const c = simulateRace({ seed: 8, course, roster: roster("det") });
  assert.notEqual(JSON.stringify(a.results), JSON.stringify(c.results));
});

for (const [name, course, rec] of races) {
  test(`${name}: every racer finishes`, () => {
    assert.equal(rec.results.length, 8);
    assert.ok(rec.results.every((r) => r.time !== null), "a racer did not finish");
    for (const { id, time } of rec.results) {
      const dnf = rec.events.some((e) => e.type === "dnf" && e.racer === id);
      const finish = rec.events.find((e) => e.type === "finish" && e.racer === id);
      assert.ok(time !== null ? finish : dnf, `${id} has no outcome`);
    }
    assert.deepEqual(
      rec.results.map((r) => r.place),
      rec.results.map((_, i) => i + 1),
    );
    const times = rec.results.filter((r) => r.time !== null).map((r) => r.time);
    assert.deepEqual(times, [...times].sort((a, b) => a - b));
  });

  test(`${name}: gates are passed in order`, () => {
    const last = course.gates.length - 1;
    for (const { id } of rec.roster) {
      const gates = rec.events
        .filter((e) => (e.type === "gate" || e.type === "miss") && e.racer === id)
        .map((e) => e.gate);
      const finished = rec.results.find((r) => r.id === id).time !== null;
      assert.deepEqual(
        gates,
        Array.from({ length: finished ? last : gates.length }, (_, i) => i),
      );
      let previous = 0;
      for (const frame of rec.frames) {
        const racer = frame.racers.find((r) => r.id === id);
        assert.ok(racer.gate >= previous);
        previous = racer.gate;
      }
    }
  });

  test(`${name}: racers stay inside the corridor and above terrain`, () => {
    const { corridor } = raceGeometry(course);
    for (const frame of rec.frames)
      for (const racer of frame.racers) {
        if (racer.finished || racer.progress < corridor.start || racer.progress > corridor.end)
          continue;
        const f = corridor.at(racer.progress);
        const [x, y, z] = racer.position;
        const u = (x - f.position[0]) * f.left[0] + (z - f.position[2]) * f.left[2];
        assert.ok(Math.abs(u) <= f.halfWidth + 0.01, `lateral ${u} at ${racer.progress}`);
        assert.ok((racer.takeoff || y >= f.floor - 0.01) && y <= f.ceiling + 0.01, `altitude ${y}`);
        assert.ok(y >= corridor.terrainHeight(x, z) - 0.01, `below terrain at ${x},${z}`);
      }
  });

  test(`${name}: recording fields are complete and sane`, () => {
    assert.equal(rec.hz, 20);
    assert.ok(rec.roster.every((r) => Number.isFinite(r.stats.topSpeed) && ["perfect", "usual", "off"].includes(r.form)));
    for (const frame of rec.frames)
      for (const r of frame.racers) {
        assert.ok(Math.abs(Math.hypot(...r.forward) - 1) < 1e-3);
        assert.ok(r.flap >= 0 && r.flap < 1);
        assert.ok(r.effort >= 0 && r.effort <= 1);
        assert.ok(r.place >= 1 && r.place <= 8);
        assert.ok(Math.abs(r.bank) <= 1.1 + 1e-9);
      }
    const types = new Set(rec.events.map((e) => e.type));
    for (const type of ["overtake", "gate", "finish"]) assert.ok(types.has(type), type);
  });
}

test("sampleRace interpolates and wraps flap", () => {
  const [, , rec] = races[0];
  const mid = sampleRace(rec, 10.025);
  const a = rec.frames[200].racers[0],
    b = rec.frames[201].racers[0],
    s = mid.racers[0];
  assert.ok(Math.abs(s.progress - (a.progress + b.progress) / 2) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...s.forward) - 1) < 1e-9);
  assert.ok(s.flap >= 0 && s.flap < 1);
  assert.deepEqual(sampleRace(rec, -5).racers[0].position, rec.frames[0].racers[0].position);
  assert.deepEqual(sampleRace(rec, 1e6).racers[0].position, rec.frames.at(-1).racers[0].position);
});

test("stats ignore colour genes and head choices", () => {
  const genome = makeGenome(genes, "stats");
  const base = deriveStats("dragon", genome);
  for (const gene of genes.filter((g) => g.group === "color" || g.choices))
    assert.deepEqual(deriveStats("dragon", { ...genome, [gene.name]: gene.max }), base, gene.name);
  const wingspan = genes.find((g) => g.name === "wingspan");
  assert.notDeepEqual(deriveStats("dragon", { ...genome, wingspan: wingspan.max }), base);
});

test("stats are real units: a 3-star dragon averages about 180 km/h flat out", () => {
  const all = Array.from({ length: 400 }, (_, i) => deriveStats("dragon", makeGenome(genes, `units:${i}`), "adult", 3));
  const mean = (key) => all.reduce((sum, s) => sum + s[key], 0) / all.length;
  assert.ok(Math.abs(mean("topSpeed") * 3.6 - 180) < 8, `top speed ${mean("topSpeed") * 3.6} km/h`);
  assert.ok(mean("handling") > 5 && mean("handling") < 12, "handling is an acceleration and does not scale");
  assert.ok(mean("recharge") > 5 && mean("recharge") < 30, "breath recharges in seconds");
});

test("form rolls from the race's seed: perfect and off shape one race in ten each, a point of top speed either way", async () => {
  const { raceForm, applyForm } = await import("../src/race/racerTraits.js");
  const forms = Array.from({ length: 2000 }, (_, i) => raceForm(`seed-${i}`, "r"));
  const share = (id) => forms.filter((f) => f === id).length / forms.length;
  assert.ok(Math.abs(share("perfect") - 0.1) < 0.025 && Math.abs(share("off") - 0.1) < 0.025);
  assert.equal(raceForm("same", "r"), raceForm("same", "r"));
  const stats = { topSpeed: 50, acceleration: 2, handling: 8 };
  assert.ok(applyForm(stats, "perfect").topSpeed > 50 && applyForm(stats, "off").topSpeed < 50);
  assert.deepEqual(applyForm(stats, "usual"), stats);
});

test("longer wings beat slower, and harder effort beats faster", () => {
  assert.ok(flapRate(0.6, 18) < flapRate(0.6, 14));
  assert.ok(flapRate(1, 16) > flapRate(0.3, 16));
  assert.ok(flapRate(1, 16) < 3);
});

test("scaleCourse enlarges lengths and thermal lift like Froude scaling", () => {
  const course = createCourse("scale-test"),
    k = 2.25,
    big = scaleCourse(course, k);
  assert.ok(Math.abs(big.length - course.length * k) < 1e-6);
  assert.ok(Math.abs(big.path[3].s - course.path[3].s * k) < 1e-6);
  assert.deepEqual(big.path[3].forward, course.path[3].forward);
  assert.deepEqual(big.path[3].position, course.path[3].position.map((v) => v * k));
  assert.equal(big.gates[2].radius, course.gates[2].radius * k);
  assert.equal(big.gates[2].index, course.gates[2].index);
  assert.equal(big.terrain.cellSize, course.terrain.cellSize * k);
  assert.equal(big.terrain.columns, course.terrain.columns);
  assert.equal(big.terrain.heights[7], course.terrain.heights[7] * k);
  assert.equal(big.thermals[0].radius, course.thermals[0].radius * k);
  assert.ok(Math.abs(big.thermals[0].lift - course.thermals[0].lift * 1.5) < 1e-9);
  assert.equal(course.length, createCourse("scale-test").length, "input is not mutated");
});

test("synthetic course and race run at world scale", () => {
  const [, course, rec] = races[1];
  assert.ok(Math.abs(course.length - 2400 * lengthScale) < 1);
  assert.ok(Math.abs(course.gates[0].radius - 14 * lengthScale) < 1e-9);
  const winner = rec.results[0].time;
  const average = (course.gates.at(-1).s - course.path[0].s) / winner;
  assert.ok(average > 26 * speedScale && average < 36 * speedScale, `average ${average} m/s`);
});
