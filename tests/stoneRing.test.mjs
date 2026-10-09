import test from "node:test";
import assert from "node:assert/strict";
import { stoneRingLayout, altarFormation, RING_RADIUS, FORMATION_RADIUS, ENTRANCE_ANGLE } from "../src/scene/stoneRing.js";
import { addStoneRing } from "../src/scene/standingStones.js";
import { createBuilder } from "../src/scene/meshBuilder.js";

const SEEDS = ["soul-altar", "a", "b", "c", "d", "e", "f", "g", "h", "i", 7, 2407];
const PERSON = 0.9;
const ADULT_LENGTH = 11;

const angleGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

test("the ring is deterministic from its seed and varies between seeds", () => {
  assert.deepEqual(stoneRingLayout("x"), stoneRingLayout("x"));
  assert.notDeepEqual(stoneRingLayout("x").stones, stoneRingLayout("y").stones);
  const mesh = (seed) => {
    const builder = createBuilder();
    addStoneRing(builder, stoneRingLayout(seed));
    return builder.result();
  };
  assert.deepEqual(mesh("x"), mesh("x"));
});

test("the ring holds the requested trilithons, a whole entrance and a ruin like the real site", () => {
  for (const count of [3, 4, 5, 6]) {
    const ring = stoneRingLayout("count", { trilithons: count });
    const trilithons = ring.stones.filter((s) => s.kind === "trilithon");
    assert.equal(trilithons.length, count);
    assert.ok(trilithons[0].entrance && !trilithons[0].ruined && trilithons[0].lintel);
    assert.ok(Math.abs(trilithons[0].angle - ENTRANCE_ANGLE) < 1e-9);
    assert.equal(trilithons.filter((t) => t.ruined).length, count >= 4 ? 1 : 0);
    assert.ok(ring.stones.some((s) => s.kind === "fallen"));
    assert.ok(ring.stones.some((s) => s.kind === "standing" && s.heel));
  }
  assert.equal(stoneRingLayout("clamp", { trilithons: 1 }).stones.filter((s) => s.kind === "trilithon").length, 3);
  assert.equal(stoneRingLayout("clamp", { trilithons: 20 }).stones.filter((s) => s.kind === "trilithon").length, 6);
});

test("people pass between the stones and under the lintels, but an adult cannot stand inside", () => {
  for (const [seed, trilithons] of SEEDS.flatMap((seed) => [3, 4, 5, 6].map((n) => [seed, n]))) {
    const ring = stoneRingLayout(seed, { trilithons });
    assert.ok(ring.innerRadius * 2 < ADULT_LENGTH, "narrower than an adult dragon is long");
    const footprints = [];
    for (const stone of ring.stones) {
      if (stone.kind === "trilithon") {
        const [a, b] = stone.uprights;
        const opening = b.offset - a.offset - (a.width + b.width) / 2;
        assert.ok(opening > PERSON && opening < 2.5, `opening ${opening}`);
        if (stone.lintel) for (const u of stone.uprights) assert.ok(u.height > 4, "a person walks under the lintel with room to spare");
        for (const u of stone.uprights) footprints.push({ angle: stone.angle + u.offset / RING_RADIUS, half: u.width / 2 / RING_RADIUS });
      } else if (stone.kind === "standing" && !stone.heel) footprints.push({ angle: stone.angle, half: stone.width / 2 / RING_RADIUS });
    }
    footprints.sort((p, q) => p.angle - q.angle);
    footprints.forEach((p, i) => {
      const q = footprints[(i + 1) % footprints.length];
      const gap = (angleGap(q.angle, p.angle) - p.half - q.half) * RING_RADIUS;
      assert.ok(gap > PERSON, `${seed}: gap of ${gap.toFixed(2)} m between stones`);
    });
  }
});

test("the parents stand evenly outside the ring, facing its centre, clear of each other and the entrance", () => {
  for (const seed of SEEDS) {
    const ring = stoneRingLayout(seed, { centre: [100, 5, -40] });
    assert.ok(FORMATION_RADIUS > ring.outerRadius + 3, `${seed}: outer radius ${ring.outerRadius}`);
    for (let count = 2; count <= 6; count++) {
      const spots = altarFormation(count, ring);
      assert.equal(spots.length, count);
      for (const { position, forward, angle } of spots) {
        const dx = ring.centre[0] - position[0],
          dz = ring.centre[2] - position[2];
        assert.ok(Math.abs(Math.hypot(dx, dz) - FORMATION_RADIUS) < 1e-9);
        assert.equal(position[1], ring.centre[1]);
        assert.ok(Math.abs(Math.hypot(...forward) - 1) < 1e-9);
        assert.ok((forward[0] * dx + forward[2] * dz) / FORMATION_RADIUS > 0.999, "faces the centre");
        assert.ok(angleGap(angle, ring.entrance) >= Math.PI / count - 1e-9, "the entrance stays free");
      }
      for (let i = 0; i < count; i++)
        for (let j = i + 1; j < count; j++) {
          const d = Math.hypot(spots[i].position[0] - spots[j].position[0], spots[i].position[2] - spots[j].position[2]);
          assert.ok(d >= 13.9, `${count} parents stand ${d.toFixed(1)} m apart`);
        }
    }
  }
  assert.equal(altarFormation(1).length, 2);
  assert.equal(altarFormation(9).length, 6);
});

test("the stones mesh is finite, low-poly, grounded and lights its runes only when asked", () => {
  const ring = stoneRingLayout();
  const build = (runes) => {
    const builder = createBuilder();
    addStoneRing(builder, ring, { runes });
    return { mesh: builder.result(), triangles: builder.triangles };
  };
  const { mesh, triangles } = build(0);
  assert.ok(triangles > 500 && triangles < 5000, `${triangles} triangles`);
  assert.ok(mesh.positions.every(Number.isFinite));
  for (let i = 1; i < mesh.positions.length; i += 3) assert.ok(mesh.positions[i] > -0.6 && mesh.positions[i] < 8);
  for (let i = 0; i < mesh.colors.length; i += 4) {
    for (let k = 0; k < 3; k++) assert.ok(mesh.colors[i + k] >= 0 && mesh.colors[i + k] <= 1);
    assert.equal(mesh.colors[i + 3], 0);
  }
  const lit = build(0.6).mesh;
  assert.ok(lit.colors.some((v, i) => i % 4 === 3 && v === Math.fround(0.6)));
});
