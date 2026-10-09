import test from "node:test";
import assert from "node:assert/strict";
import { createCourse } from "../src/course/createCourse.js";
import { terrainCeilingAt } from "../src/course/terrainHeight.js";
import { lengthScale, speedScale } from "../src/worldScale.js";

const m = (v) => v * lengthScale;
const step = m(10);

const seeds = ["2407", "canyon", "7", "alpha", "91"];
const canyon = (seed, options = {}) => createCourse(seed, { ...options, type: "canyon" });
const courses = new Map(seeds.map((seed) => [seed, canyon(seed)]));
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const leftOf = (f) => {
  const l = Math.hypot(f[0], f[2]);
  return [-f[2] / l, 0, f[0] / l];
};

test("canyon courses are deterministic, pure data and seed dependent", () => {
  const again = canyon("2407");
  assert.deepEqual(again, courses.get("2407"));
  assert.deepEqual(JSON.parse(JSON.stringify(again)), again);
  const layouts = new Set(seeds.map((s) => JSON.stringify(courses.get(s).path.at(-1).position)));
  assert.equal(layouts.size, seeds.length);
});

test("canyon course shape matches the racing contract", () => {
  for (const course of courses.values()) assert.equal(course.type, "canyon");
  for (const course of courses.values()) {
    assert.equal(typeof course.seed, "string");
    assert.ok(course.length >= m(2500) - step && course.length <= m(4000) + step, `length ${course.length}`);
    assert.equal(course.path[0].s, 0);
    assert.equal(course.path.at(-1).s, course.length);
    assert.deepEqual(course.path[0].position.filter((_, i) => i !== 1), [0, 0]);
    assert.ok(course.path[1].forward[0] > 0.95, "starts heading +X");
    course.path.forEach((p, i) => {
      assert.ok(Math.abs(p.s - i * step) < 1e-3, `s ${p.s}`);
      assert.ok(isVec(p.position) && isVec(p.forward));
      assert.ok(Math.abs(Math.hypot(...p.forward) - 1) < 1e-3);
      assert.ok(p.halfWidth > m(15) && p.ceiling - p.floor > m(40));
      assert.ok(p.position[1] > p.floor && p.position[1] < p.ceiling);
    });
    assert.ok(course.gates.length >= 12 && course.gates.length <= 20);
    assert.equal(course.start.grid.length, 12);
    for (const slot of course.start.grid) assert.ok(isVec(slot.position) && isVec(slot.forward));
    const { origin, cellSize, columns, rows, heights } = course.terrain;
    assert.ok(origin.length === 2 && cellSize > 0 && heights.length === columns * rows);
    assert.ok(heights.every(Number.isFinite));
    for (const t of course.thermals) {
      assert.ok(isVec(t.position) && t.radius >= m(16) - 1e-3 && t.radius <= m(28) + 1e-3);
      assert.ok(t.lift >= 3 * speedScale - 1e-3 && t.lift <= 8 * speedScale + 1e-3);
    }
    assert.ok(course.thermals.length >= 2, "thermals present");
  }
});

test("corridor is clear of terrain and walls rise above the ceiling", () => {
  for (const course of courses.values()) {
    let walled = 0;
    for (const p of course.path) {
      const left = leftOf(p.forward);
      for (let lateral = -p.halfWidth; lateral <= p.halfWidth; lateral += p.halfWidth / 8) {
        const x = p.position[0] + left[0] * lateral,
          z = p.position[2] + left[2] * lateral;
        const ground = terrainCeilingAt(course.terrain, x, z);
        assert.ok(ground < p.floor, `${course.seed} s=${p.s} lateral=${lateral.toFixed(1)}: ${ground} >= ${p.floor}`);
      }
      const high = [-1, 1].every((side) => {
        let peak = -Infinity;
        for (let reach = p.halfWidth + m(20); reach <= p.halfWidth + m(160); reach += step) {
          const x = p.position[0] + left[0] * reach * side,
            z = p.position[2] + left[2] * reach * side;
          peak = Math.max(peak, terrainCeilingAt(course.terrain, x, z));
        }
        return peak > p.ceiling + m(30);
      });
      if (high) walled++;
    }
    assert.ok(walled / course.path.length > 0.95, `${course.seed}: walls contain ${walled}/${course.path.length}`);
    for (const slot of course.start.grid) {
      assert.ok(terrainCeilingAt(course.terrain, slot.position[0], slot.position[2]) < slot.position[1] - m(20));
    }
  }
});

test("gates are ordered, inside the corridor, and the last is the finish", () => {
  for (const course of courses.values()) {
    course.gates.forEach((gate, i) => {
      assert.equal(gate.index, i);
      if (i) assert.ok(gate.s > course.gates[i - 1].s);
      const p = course.path[Math.round(gate.s / step)];
      assert.equal(p.s, gate.s);
      const left = leftOf(p.forward);
      const lateral = (gate.position[0] - p.position[0]) * left[0] + (gate.position[2] - p.position[2]) * left[2];
      assert.ok(Math.abs(lateral) + gate.radius <= p.halfWidth + 1e-6, `gate ${i} lateral`);
      assert.ok(gate.position[1] - gate.radius >= p.floor && gate.position[1] + gate.radius <= p.ceiling, `gate ${i} vertical`);
      assert.ok(isVec(gate.forward) && gate.radius > m(5));
    });
    assert.equal(course.gates.at(-1).s, course.length);
  }
});

test("thermals sit inside open sections of the corridor", () => {
  for (const course of courses.values())
    for (const thermal of course.thermals) {
      const p = course.path.reduce((best, q) =>
        Math.hypot(q.position[0] - thermal.position[0], q.position[2] - thermal.position[2]) <
        Math.hypot(best.position[0] - thermal.position[0], best.position[2] - thermal.position[2])
          ? q
          : best,
      );
      assert.ok(p.halfWidth >= m(50), `thermal in open section (${p.halfWidth})`);
      assert.ok(thermal.position[1] > p.floor && thermal.position[1] < p.ceiling);
    }
});

// Timing depends on machine load; benchmarks are postponed and run with DRAGONZ_BENCH=1.
test("generation stays fast", { skip: !process.env.DRAGONZ_BENCH }, () => {
  const times = Array.from({ length: 5 }, (_, i) => {
    const start = performance.now();
    canyon(`speed-${i}`);
    return performance.now() - start;
  }).sort((a, b) => a - b);
  // The fastest run: a busy machine slows the median, a real regression slows them all.
  assert.ok(times[0] < 150, `fastest ${times[0].toFixed(0)} ms`);
});

test("courses are Froude-scaled from the reference layout", () => {
  for (const course of courses.values()) {
    const [a, b, , , e] = course.start.grid.map((slot) => slot.position);
    assert.ok(Math.abs(b[2] - a[2] - m(15)) < 1e-2, "lane spacing");
    assert.ok(Math.abs(a[0] - e[0] - m(16)) < 1e-2, "row spacing");
    assert.ok(Math.abs(course.terrain.cellSize - m(5)) < 1e-9, "terrain cell");
    for (const feature of course.features)
      if (feature.type === "arch") assert.ok(feature.thickness >= m(13) - 1e-3 && feature.thickness <= m(18) + 1e-3);
  }
});

test("a course share shortens the course with fewer gates at the same spacing, clear of the terrain", () => {
  for (const type of ["valley", "canyon"])
    for (const seed of seeds) {
      const full = createCourse(seed, { type }),
        short = createCourse(seed, { type, share: 0.5 });
      assert.ok(Math.abs(short.length / full.length - 0.5) < 0.01, `${type} ${seed}`);
      assert.ok(short.gates.length < full.gates.length && short.gates.length >= 6);
      const spacing = (c) => c.length / c.gates.length;
      assert.ok(Math.abs(spacing(short) / spacing(full) - 1) < 0.35, `${type} ${seed} gate spacing`);
      for (const p of short.path.filter((_, i) => i % 4 === 0))
        assert.ok(terrainCeilingAt(short.terrain, p.position[0], p.position[2]) < p.floor, `${type} ${seed} s=${p.s}`);
      assert.equal(short.gates.at(-1).s, short.length);
    }
});

test("a field races its league's course length; mixed ages and exhibitions race the full length", async () => {
  const { courseShare, fieldCourse } = await import("../src/fieldCourse.js");
  const { leagues } = await import("../src/stable/leagues.js");
  const of = (...ages) => ages.map((age) => ({ age }));
  assert.deepEqual(leagues.map((l) => courseShare(of(l.age, l.age))), [0.5, 0.72, 1]);
  assert.equal(courseShare(of(undefined, "adult")), 1);
  assert.equal(courseShare(of("kid", "teen")), 1);
  const field = (age) => ({ courseSeed: "7", courseType: "canyon", participants: of(age, age) });
  const [kid, teen, adult] = ["kid", "teen", "adult"].map((age) => fieldCourse(field(age)).length);
  assert.ok(kid < teen && teen < adult);
  assert.equal(adult, courses.get("7").length);
});
