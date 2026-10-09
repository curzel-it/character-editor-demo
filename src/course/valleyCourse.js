import { makeRng } from "../rng.js";
import { createWave, smoothstep } from "./noise.js";
import { tracePath } from "./tracePath.js";
import { placeGates } from "./placeGates.js";
import { startGrid } from "./startGrid.js";
import { surfaceAt } from "./surfaceAt.js";
import { carveValley } from "./valleyTerrain.js";
import { castleLayout, castleSolids } from "./castleLayout.js";
import { clearCorridor } from "./clearCorridor.js";
import { lengthScale, speedScale } from "../worldScale.js";

// Authored at the reference scale and emitted Froude-scaled, like the canyon. The castle, trees and
// houses are real-world objects, so the castle is laid out directly in world metres.
const STEP = 10;
const TERRAIN_CELL = 8;
const MARGIN = TERRAIN_CELL * 1.5;
const REACH = 760;
const SECTIONS = ["spurs", "gorge", "lake", "col", "castle"];
// Horizontal direction towards the scene's key light; slopes facing it host thermals.
const SUN = (() => {
  const d = [-0.52, 0.62],
    l = Math.hypot(...d);
  return d.map((v) => v / l);
})();
const m = (v) => v * lengthScale;
const mix = (a, b, t) => a + (b - a) * t;
const band = (s, s0, s1, blend) => smoothstep(s0 - blend, s0, s) * (1 - smoothstep(s1, s1 + blend, s));
const leftOf = (f) => {
  const l = Math.hypot(f[0], f[2]) || 1;
  return [-f[2] / l, 0, f[0] / l];
};
const round = (v) => Math.round(v * 1000) / 1000 + 0;
const roundVec = (v) => v.map(round);
const scaleVec = (v) => roundVec(v.map(m));
const shuffle = (list, random) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

function sectionOrder(random) {
  let order = shuffle([...SECTIONS], random);
  for (let tries = 0; tries < 12; tries++) {
    const gap = Math.abs(order.indexOf("lake") - order.indexOf("col"));
    if (gap > 1) break;
    order = shuffle(order, random);
  }
  return order;
}

/**
 * Seeded river-valley course with a castle, in world metres. The race follows a winding valley floor
 * through forested spurs, a gorge, meadows, a lake and over a col, and passes close beside a castle
 * whose volume the corridor excludes. Same output shape as the canyon course, plus `type`, and the
 * same `share` and `length` options.
 */
export function createValleyCourse(seed, options = {}) {
  const random = makeRng(`valley:${seed}`);
  const share = options.length === undefined ? (options.share ?? 1) : 1;
  const length =
    options.length !== undefined
      ? STEP * Math.round(options.length / lengthScale / STEP)
      : STEP * Math.round((share * (2900 + random() * 900)) / STEP);
  const count = Math.round(length / STEP) + 1;

  const order = sectionOrder(random);
  const slots = [0.2, 0.36, 0.52, 0.68, 0.84].map((f) => (f + (random() - 0.5) * 0.03) * length);
  const at = Object.fromEntries(order.map((id, i) => [id, slots[i]]));
  const spurs = { s0: at.spurs - 230, s1: at.spurs + 230, count: 2 + Math.floor(random() * 2), first: random() < 0.5 ? 1 : -1 };
  const gorge = { s0: at.gorge - 160 - random() * 40, s1: at.gorge + 160 + random() * 40 };
  const lake = { s: STEP * Math.round(at.lake / STEP), half: 170 + random() * 50, offset: (random() - 0.5) * 50 };
  const col = { s: STEP * Math.round(at.col / STEP), half: 440 + random() * 80, height: 42 + random() * 16 };
  const castle = { s: at.castle, side: random() < 0.5 ? 1 : -1, hill: 6 + random() * 2 };

  const widthWave = createWave(random, 420, 1000),
    extraWaves = [createWave(random, 500, 1200), createWave(random, 500, 1200)],
    spanWave = createWave(random, 500, 1100),
    groundWave = createWave(random, 900, 1700, 2),
    riverWave = createWave(random, 280, 560, 2),
    runWave = createWave(random, 400, 900, 2);
  const turns = Array.from({ length: 3 }, (_, i) => ({
    amplitude: (0.85 / (i + 1)) * (0.6 + random() * 0.7),
    k: (Math.PI * 2) / ([1500, 780, 420][i] * (0.8 + random() * 0.4)),
    phase: random() * Math.PI * 2,
  }));
  const snake = { k: (Math.PI * 2) / (spurs.s1 - spurs.s0) * spurs.count * 0.5, phase: random() * 6 };
  const descent = 0.008 + random() * 0.008;
  const baseGround = (s) => 40 + (groundWave(s) - 0.5) * 24 - s * descent;
  const colBump = (s) => {
    const d = Math.abs(s - col.s);
    return d < col.half ? col.height * (0.5 + 0.5 * Math.cos((Math.PI * d) / col.half)) : 0;
  };
  const lakeGround = baseGround(lake.s) + colBump(lake.s);

  const profile = (s, turnScale = 1) => {
    let halfWidth = 40 + 56 * Math.pow(widthWave(s), 1.35);
    halfWidth = mix(halfWidth, Math.max(halfWidth, 64), 1 - smoothstep(180, 340, s));
    halfWidth = mix(halfWidth, Math.max(halfWidth, 58), smoothstep(length - 260, length - 120, s));
    const extra = extraWaves.map((wave) => 40 + 150 * wave(s));
    const foot = [0.26, 0.26];
    let run = 80 + 120 * runWave(s),
      mountain = 0.62,
      ground = baseGround(s) + colBump(s),
      clearance = 9,
      span = 92 + 28 * spanWave(s);
    let heading = turns.reduce((h, w) => h + w.amplitude * Math.sin(s * w.k + w.phase), 0);

    const wSpurs = band(s, spurs.s0, spurs.s1, 100);
    if (wSpurs > 0) {
      for (let k = 0; k < spurs.count; k++) {
        const centre = spurs.s0 + ((k + 0.5) * (spurs.s1 - spurs.s0)) / spurs.count;
        const i = (k % 2 ? -spurs.first : spurs.first) > 0 ? 0 : 1;
        const w = band(s, centre - 40, centre + 40, 70) * wSpurs;
        extra[i] = mix(extra[i], 2, w);
        foot[i] = mix(foot[i], 1.1, w);
      }
      halfWidth = mix(halfWidth, 34, wSpurs);
      run = mix(run, 40, wSpurs);
      heading += wSpurs * 0.2 * Math.sin(s * snake.k + snake.phase);
    }
    const wGorge = band(s, gorge.s0, gorge.s1, 110);
    if (wGorge > 0) {
      halfWidth = mix(halfWidth, 24, wGorge);
      for (let i = 0; i < 2; i++) {
        extra[i] = mix(extra[i], 1, wGorge);
        foot[i] = mix(foot[i], 2.2, wGorge);
      }
      run = mix(run, 30, wGorge);
      mountain = mix(mountain, 1.3, wGorge);
      span = mix(span, 84, wGorge);
    }
    const wLake = band(s, lake.s - lake.half, lake.s + lake.half, 120);
    if (wLake > 0) {
      halfWidth = mix(halfWidth, Math.max(halfWidth, 100), wLake);
      for (let i = 0; i < 2; i++) extra[i] = mix(extra[i], 170, wLake);
      ground = mix(ground, lakeGround, wLake);
      clearance = mix(clearance, 12, wLake);
    }
    const wCol = band(s, col.s - col.half * 0.6, col.s + col.half * 0.6, 150);
    if (wCol > 0) {
      halfWidth = mix(halfWidth, 46, wCol);
      for (let i = 0; i < 2; i++) extra[i] = mix(extra[i], 18, wCol);
    }
    const wCastle = band(s, castle.s - 160, castle.s + 160, 110);
    if (wCastle > 0) {
      const near = castle.side > 0 ? 0 : 1;
      halfWidth = mix(halfWidth, 27, wCastle);
      clearance = mix(clearance, 6, wCastle);
      extra[near] = mix(extra[near], 26, wCastle);
      extra[1 - near] = mix(extra[1 - near], 12, wCastle);
    }
    heading = 0.95 * Math.tanh((heading * turnScale) / 0.95) * smoothstep(0, 380, s);
    halfWidth = Math.max(18, halfWidth);
    const room = halfWidth + MARGIN + Math.min(...extra) - 8;
    const colFade = 1 - smoothstep(0.2, 0.55, colBump(s) / col.height);
    const riverU = mix((riverWave(s) * 2 - 1) * Math.max(0, room) * 0.7, lake.offset, wLake);
    return {
      halfWidth,
      floor: ground + clearance,
      ceiling: ground + clearance + span,
      ground,
      extra,
      foot,
      hillRun: run,
      mountain,
      riverU,
      riverHalf: (5 + 2 * riverWave(s + 170)) * colFade,
      water: ground - 0.5,
      heading,
    };
  };

  const path = tracePath(profile, { count, step: STEP, wall: 520, turnRadius: 110 });

  // The castle stands on a crag beside the castle stretch, with a detached tower across the line.
  const ci = Math.round(castle.s / STEP);
  const site = path[ci];
  const siteLeft = leftOf(site.forward);
  const near = [-siteLeft[0] * castle.side, 0, -siteLeft[2] * castle.side];
  const along = castle.side > 0 ? [-site.forward[0], 0, -site.forward[2]] : [site.forward[0], 0, site.forward[2]];
  const flatLength = Math.hypot(along[0], along[2]);
  along[0] /= flatLength;
  along[2] /= flatLength;
  const hillTop = site.ground + castle.hill;
  const draft = castleLayout(makeRng(`castle:${seed}`), { position: [0, m(hillTop), 0], along, near });
  const reachNear = Math.max(
    ...castleSolids(draft).flatMap((solid) => [solid.a, solid.b].map((p) => p[0] * near[0] + p[1] * near[2] + solid.radius)),
  );
  const offset = m(site.halfWidth + 3.5) + reachNear;
  const layout = castleLayout(makeRng(`castle:${seed}`), {
    position: [m(site.position[0]) - near[0] * offset, m(hillTop), m(site.position[2]) - near[2] * offset],
    along,
    near,
  });
  const keepAt = [layout.keep.position[0] / lengthScale, layout.keep.position[2] / lengthScale];
  const keepSample = path.reduce((best, p) =>
    Math.hypot(p.position[0] - keepAt[0], p.position[2] - keepAt[1]) <
    Math.hypot(best.position[0] - keepAt[0], best.position[2] - keepAt[1])
      ? p
      : best,
  );
  const outRandom = makeRng(`outwork:${seed}`);
  const outRadius = 5.5 + outRandom() * 1.5,
    outHeight = 24 + outRandom() * 6;
  const outLeft = leftOf(keepSample.forward);
  const outLateral = -castle.side * (keepSample.halfWidth + 3.5 + (outRadius + 2) / lengthScale);
  const outBase = m(keepSample.ground);
  layout.outworks = [
    {
      shape: "round",
      position: scaleVec([
        keepSample.position[0] + outLeft[0] * outLateral,
        keepSample.ground,
        keepSample.position[2] + outLeft[2] * outLateral,
      ]),
      radius: round(outRadius),
      top: round(outBase + outHeight),
      roofTop: round(outBase + outHeight + outRadius * 2.2),
      yaw: layout.keep.yaw,
      detached: true,
    },
  ];
  const solids = castleSolids(layout).map((solid) => ({
    a: solid.a.map((v) => v / lengthScale),
    b: solid.b.map((v) => v / lengthScale),
    radius: solid.radius / lengthScale,
    top: solid.top / lengthScale,
  }));
  clearCorridor(path, solids, { margin: 2.5, clearance: 4, minHalfWidth: 16, minSpan: 60, reach: STEP * 0.75 });
  for (const p of path)
    if (p.position[1] <= p.floor || p.position[1] >= p.ceiling) p.position[1] = p.floor + (p.ceiling - p.floor) * 0.42;

  const gateRadius = 9.5;
  const gates = placeGates(path, random, {
    length,
    step: STEP,
    share,
    maxLateral: 70,
    fixed: [
      {
        s: keepSample.s,
        lateral: castle.side * Math.max(0, keepSample.halfWidth - gateRadius - 1),
        y: keepSample.floor + gateRadius + 2,
        radius: Math.min(gateRadius, keepSample.halfWidth - 4),
      },
    ],
  });
  const thermals = [];
  const candidates = shuffle(
    path.filter((p) => p.halfWidth >= 46 && p.s > 320 && p.s < length - 260 && Math.abs(p.s - castle.s) > 300),
    random,
  );
  const wanted = 3 + Math.floor(random() * 4);
  for (const p of candidates) {
    if (thermals.length >= wanted) break;
    if (thermals.some((t) => Math.abs(t.s - p.s) < 260)) continue;
    const left = leftOf(p.forward);
    const sunny = -(left[0] * SUN[0] + left[2] * SUN[1]);
    const side = sunny >= 0 ? 1 : -1;
    const radius = 16 + random() * 12;
    const lateral = side * Math.min((0.35 + random() * 0.3) * p.halfWidth, p.halfWidth - radius - 4);
    thermals.push({
      s: p.s,
      position: roundVec([p.position[0] + left[0] * lateral, p.position[1], p.position[2] + left[2] * lateral]),
      radius: round(radius),
      lift: round(3 + random() * 5),
    });
  }
  thermals.sort((a, b) => a.s - b.s);

  const lakeSample = path[lake.s / STEP];
  const lakeLeft = leftOf(lakeSample.forward);
  const lakeFeature = {
    position: [
      lakeSample.position[0] + lakeLeft[0] * lake.offset,
      lakeGround - 0.4,
      lakeSample.position[2] + lakeLeft[2] * lake.offset,
    ],
    forward: [lakeLeft[2], 0, -lakeLeft[0]],
    halfLength: lake.half + 40,
    halfWidth: lakeSample.halfWidth + MARGIN + 120,
    level: lakeGround - 0.4,
  };

  const extension = (from, direction, n) =>
    Array.from({ length: n }, (_, i) => ({
      ...from,
      position: [
        from.position[0] + direction[0] * STEP * (i + 1),
        from.position[1],
        from.position[2] + direction[2] * STEP * (i + 1),
      ],
    }));
  const last = path[count - 1];
  const carve = [...extension(path[0], [-1, 0, 0], 30).reverse(), ...path, ...extension(last, last.forward, 30)];
  const carved = carveValley(carve, makeRng(`terrain:${seed}`), {
    cellSize: options.cellSize === undefined ? TERRAIN_CELL : options.cellSize / lengthScale,
    margin: MARGIN,
    reach: REACH,
    lakes: [lakeFeature],
    hills: [
      {
        position: [layout.position[0] / lengthScale, 0, layout.position[2] / lengthScale],
        radius: layout.radius / lengthScale + 1,
        top: hillTop,
        slope: 0.8,
      },
    ],
  });
  const terrain = {
    origin: carved.origin.map(m),
    cellSize: m(carved.cellSize),
    columns: carved.columns,
    rows: carved.rows,
    heights: carved.heights.map((h) => Math.round(m(h) * 100) / 100 + 0),
  };

  const sections = {
    castle: {
      type: "castle",
      s: round(m(keepSample.s)),
      ...layout,
    },
    spurs: { type: "spurs", s0: round(m(spurs.s0)), s1: round(m(spurs.s1)) },
    gorge: { type: "gorge", s0: round(m(gorge.s0)), s1: round(m(gorge.s1)) },
    lake: {
      type: "lake",
      s: round(m(lake.s)),
      s0: round(m(lake.s - lake.half)),
      s1: round(m(lake.s + lake.half)),
      position: scaleVec(lakeFeature.position),
      forward: roundVec(lakeFeature.forward),
      halfLength: round(m(lakeFeature.halfLength)),
      halfWidth: round(m(lakeFeature.halfWidth)),
      level: round(m(lakeFeature.level)),
    },
    col: { type: "col", s: round(m(col.s)), position: scaleVec(path[col.s / STEP].position), height: round(m(col.height)) },
  };
  const signature = [...SECTIONS].sort((a, b) => at[a] - at[b]);
  const river = {
    type: "river",
    s0: 0,
    s1: round(m(length)),
    points: carve.map((p) => {
      const left = leftOf(p.forward);
      return [
        ...scaleVec([p.position[0] + left[0] * p.riverU, p.water, p.position[2] + left[2] * p.riverU]),
        round(m(p.riverHalf)),
      ];
    }),
  };

  const course = {
    seed: String(seed),
    type: "valley",
    length: round(m(length)),
    signature,
    path: path.map((p) => ({
      s: round(m(p.s)),
      position: scaleVec(p.position),
      forward: roundVec(p.forward),
      halfWidth: round(m(p.halfWidth)),
      floor: round(m(p.floor)),
      ceiling: round(m(p.ceiling)),
    })),
    gates: gates.map((g) => ({ ...g, s: round(m(g.s)), position: scaleVec(g.position), radius: round(m(g.radius)) })),
    terrain,
    thermals: thermals.map(({ position, radius, lift }) => ({
      position: scaleVec(position),
      radius: round(m(radius)),
      lift: round(lift * speedScale),
    })),
    features: [...signature.map((id) => sections[id]), river],
  };
  const dry = (position) => surfaceAt(course, m(position[0]), m(position[2])).surface !== "water";
  const grid = startGrid(path[0], dry);
  return { ...course, start: { grid: grid.map((g) => ({ ...g, position: scaleVec(g.position) })) } };
}
