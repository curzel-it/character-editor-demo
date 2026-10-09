import test from "node:test";
import assert from "node:assert/strict";
import { createCourse } from "../src/course/createCourse.js";
import { castleSolids } from "../src/course/castleLayout.js";
import { terrainCeilingAt } from "../src/course/terrainHeight.js";
import { createCorridor } from "../src/race/corridor.js";
import { lengthScale, speedScale } from "../src/worldScale.js";

const m = (v) => v * lengthScale;
const step = m(10);
const seeds = ["2407", "valley", "7", "alpha", "91"];
const courses = new Map(seeds.map((seed) => [seed, createCourse(seed, { type: "valley" })]));
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const leftOf = (f) => {
  const l = Math.hypot(f[0], f[2]);
  return [-f[2] / l, 0, f[0] / l];
};
const castleOf = (course) => course.features.find((f) => f.type === "castle");
const capsuleDistance = (x, z, { a, b }) => {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
};

test("valley is the default course type and is deterministic pure data", () => {
  const again = createCourse("2407");
  assert.equal(again.type, "valley");
  assert.deepEqual(again, courses.get("2407"));
  assert.deepEqual(JSON.parse(JSON.stringify(again)), again);
  const layouts = new Set(seeds.map((s) => JSON.stringify(courses.get(s).path.at(-1).position)));
  assert.equal(layouts.size, seeds.length);
  const castles = new Set(seeds.map((s) => JSON.stringify(castleOf(courses.get(s)).towers.map((t) => t.top - t.position[1]))));
  assert.equal(castles.size, seeds.length, "castle layouts vary by seed");
});

test("valley course shape matches the racing contract", () => {
  for (const course of courses.values()) {
    assert.ok(course.length >= m(2900) - step && course.length <= m(3800) + step, `length ${course.length}`);
    assert.equal(course.path[0].s, 0);
    assert.equal(course.path.at(-1).s, course.length);
    assert.ok(course.path[1].forward[0] > 0.95, "starts heading +X");
    course.path.forEach((p, i) => {
      assert.ok(Math.abs(p.s - i * step) < 1e-3);
      assert.ok(isVec(p.position) && isVec(p.forward));
      assert.ok(p.halfWidth > m(15) && p.ceiling - p.floor > m(40));
      assert.ok(p.position[1] > p.floor && p.position[1] < p.ceiling);
    });
    assert.ok(course.gates.length >= 12 && course.gates.length <= 20);
    assert.equal(course.start.grid.length, 12);
    const { origin, cellSize, columns, rows, heights } = course.terrain;
    assert.ok(origin.length === 2 && cellSize > 0 && heights.length === columns * rows);
    assert.ok(heights.every(Number.isFinite));
    assert.ok(course.thermals.length >= 2);
    for (const t of course.thermals) {
      assert.ok(isVec(t.position) && t.radius >= m(16) - 1e-3 && t.radius <= m(28) + 1e-3);
      assert.ok(t.lift >= 3 * speedScale - 1e-3 && t.lift <= 8 * speedScale + 1e-3);
    }
    const types = course.features.map((f) => f.type);
    for (const type of ["castle", "spurs", "gorge", "lake", "col", "river"]) assert.ok(types.includes(type), `${course.seed}: ${type}`);
    assert.ok(course.signature.includes("castle"));
    for (const f of course.features) assert.ok(Number.isFinite(f.s ?? f.s0), `${f.type} has an arc position`);
  }
});

test("valley corridor is clear of terrain along the whole path", () => {
  for (const course of courses.values()) {
    for (const p of course.path) {
      const left = leftOf(p.forward);
      for (let lateral = -p.halfWidth; lateral <= p.halfWidth + 1e-6; lateral += p.halfWidth / 8) {
        const x = p.position[0] + left[0] * lateral,
          z = p.position[2] + left[2] * lateral;
        const ground = terrainCeilingAt(course.terrain, x, z);
        assert.ok(ground < p.floor, `${course.seed} s=${p.s} lateral=${lateral.toFixed(1)}: ${ground} >= ${p.floor}`);
      }
    }
    for (const slot of course.start.grid)
      assert.ok(terrainCeilingAt(course.terrain, slot.position[0], slot.position[2]) < slot.position[1] - m(20));
  }
});

test("the castle is real-world sized, finite and excluded from the corridor", () => {
  for (const course of courses.values()) {
    const castle = castleOf(course);
    const base = castle.position[1];
    const finite = (value) =>
      Array.isArray(value) ? value.every(finite) : value && typeof value === "object" ? Object.values(value).every(finite) : typeof value !== "number" || Number.isFinite(value);
    assert.ok(finite(castle), "castle geometry is finite");
    assert.ok(castle.width >= 110 && castle.width <= 190 && castle.depth >= 60 && castle.depth <= 120, `footprint ${castle.width}×${castle.depth}`);
    assert.ok(castle.wallHeight >= 10 && castle.wallHeight <= 12);
    assert.ok(castle.towers.length >= 5 && castle.towers.length <= 7);
    for (const t of castle.towers) assert.ok(t.top - base >= 20 && t.top - base <= 30 && t.roofTop > t.top);
    assert.ok(castle.keep.top - base >= 35 && castle.keep.top - base <= 40);
    assert.ok(castle.gatehouse && castle.banners.length >= 1 && castle.outworks.length === 1);

    const solids = castleSolids(castle);
    const corridor = createCorridor(course);
    let closest = Infinity;
    for (let s = Math.max(0, castle.s - 500); s <= Math.min(course.length, castle.s + 500); s += 2) {
      const f = corridor.at(s);
      for (let u = -f.halfWidth; u <= f.halfWidth + 1e-6; u += f.halfWidth / 10) {
        const x = f.position[0] + f.left[0] * u,
          z = f.position[2] + f.left[2] * u;
        for (const solid of solids) {
          const d = capsuleDistance(x, z, solid) - solid.radius;
          if (solid.top > f.floor) {
            assert.ok(d > 0, `${course.seed} s=${s.toFixed(0)} u=${u.toFixed(0)} inside castle (top ${solid.top} > floor ${f.floor})`);
            closest = Math.min(closest, d);
          }
        }
      }
    }
    assert.ok(closest < 25, `${course.seed}: the line passes within ${closest.toFixed(1)} m of the castle`);
  }
});

test("valley gates are ordered, inside the corridor, and one forces the castle line", () => {
  for (const course of courses.values()) {
    course.gates.forEach((gate, i) => {
      assert.equal(gate.index, i);
      if (i) assert.ok(gate.s > course.gates[i - 1].s);
      const p = course.path[Math.round(gate.s / step)];
      assert.ok(Math.abs(p.s - gate.s) < 1e-3);
      const left = leftOf(p.forward);
      const lateral = (gate.position[0] - p.position[0]) * left[0] + (gate.position[2] - p.position[2]) * left[2];
      assert.ok(Math.abs(lateral) + gate.radius <= p.halfWidth + 1e-6, `gate ${i} lateral`);
      assert.ok(gate.position[1] - gate.radius >= p.floor && gate.position[1] + gate.radius <= p.ceiling, `gate ${i} vertical`);
    });
    assert.equal(course.gates.at(-1).s, course.length);
    const castle = castleOf(course);
    const keep = castle.keep.position;
    const nearest = Math.min(...course.gates.map((g) => Math.hypot(g.position[0] - keep[0], g.position[2] - keep[2])));
    assert.ok(nearest < 110, `${course.seed}: castle gate ${nearest.toFixed(0)} m from the keep`);
  }
});

test("valley thermals sit inside open sections of the corridor", () => {
  for (const course of courses.values())
    for (const thermal of course.thermals) {
      const p = course.path.reduce((best, q) =>
        Math.hypot(q.position[0] - thermal.position[0], q.position[2] - thermal.position[2]) <
        Math.hypot(best.position[0] - thermal.position[0], best.position[2] - thermal.position[2])
          ? q
          : best,
      );
      assert.ok(p.halfWidth >= m(40), `thermal in open section (${p.halfWidth})`);
      assert.ok(thermal.position[1] > p.floor && thermal.position[1] < p.ceiling);
    }
});

// Timing depends on machine load; benchmarks are postponed and run with DRAGONZ_BENCH=1.
test("valley generation stays reasonable", { skip: !process.env.DRAGONZ_BENCH }, () => {
  const times = Array.from({ length: 5 }, (_, i) => {
    const start = performance.now();
    createCourse(`valley-speed-${i}`, { type: "valley" });
    return performance.now() - start;
  }).sort((a, b) => a - b);
  // The fastest run: a busy machine slows the median, a real regression slows them all.
  assert.ok(times[0] < 600, `fastest ${times[0].toFixed(0)} ms`);
});
