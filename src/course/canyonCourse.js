import { makeRng } from "../rng.js";
import { createWave, smoothstep } from "./noise.js";
import { carveTerrain } from "./carveTerrain.js";
import { tracePath } from "./tracePath.js";
import { placeGates } from "./placeGates.js";
import { startGrid } from "./startGrid.js";
import { lengthScale, speedScale } from "../worldScale.js";

// Courses are authored at the reference scale and emitted Froude-scaled: lengths × lengthScale,
// thermal lift × speedScale. Generating at reference scale keeps every seed's layout identical.
const STEP = 10;
// The canyon grows by lengthScale while dragons only grow by creatureScale, so terrain is carved
// at half the reference cell to keep wall detail at least as fine relative to the racers.
const TERRAIN_CELL = STEP / 2;
const m = (v) => v * lengthScale;
const SIGNATURES = ["slot", "arch", "spires"];
const mix = (a, b, t) => a + (b - a) * t;
const band = (s, s0, s1, blend) =>
  smoothstep(s0 - blend, s0, s) * (1 - smoothstep(s1, s1 + blend, s));
const leftOf = (f) => {
  const l = Math.hypot(f[0], f[2]) || 1;
  return [-f[2] / l, 0, f[0] / l];
};
const round = (v) => Math.round(v * 1000) / 1000 + 0;
const roundVec = (v) => v.map(round);
const shuffle = (list, random) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

function scaleFeature(feature, m, scaleVec) {
  const out = { ...feature };
  for (const key of ["s", "s0", "s1", "halfSpan", "thickness", "depth"])
    if (key in out) out[key] = Math.round(m(out[key]) * 1000) / 1000;
  if (out.position) out.position = scaleVec(out.position);
  if (out.spires)
    out.spires = out.spires.map((spire) => ({
      position: scaleVec(spire.position),
      radius: Math.round(m(spire.radius) * 1000) / 1000,
      height: Math.round(m(spire.height) * 1000) / 1000,
    }));
  return out;
}

/**
 * Seeded canyon course, in world metres. The corridor at each path sample spans `halfWidth` metres either side
 * of `position` along the horizontal left vector, and `floor` to `ceiling` in absolute Y. `options.share`
 * shortens the seeded length to that share, with fewer gates at the same spacing; `options.length` sets it outright.
 */
export function createCanyonCourse(seed, options = {}) {
  const random = makeRng(`course:${seed}`);
  const share = options.length === undefined ? (options.share ?? 1) : 1;
  const length =
    options.length !== undefined
      ? STEP * Math.round(options.length / lengthScale / STEP)
      : STEP * Math.round((share * (2500 + random() * 1500)) / STEP);
  const count = Math.round(length / STEP) + 1;
  const tightness = 0.8 + random() * 0.42;

  const order = shuffle([...SIGNATURES], random);
  const signature = order.slice(0, random() < 0.55 ? 2 : 1);
  const centres = shuffle([0.3, 0.52, 0.74], random).map((f) => (f + (random() - 0.5) * 0.08) * length);
  const place = Object.fromEntries(signature.map((id, i) => [id, centres[i]]));
  const slot = place.slot && {
    s0: place.slot - 140 - random() * 60,
    s1: place.slot + 140 + random() * 60,
    width: 18 + random() * 4,
  };
  const spires = place.spires && {
    s0: place.spires - 230,
    s1: place.spires + 230,
  };
  const arch = place.arch && { s: STEP * Math.round(place.arch / STEP) };

  const widthWave = createWave(random, 380, 950),
    spanWave = createWave(random, 500, 1100),
    floorWave = createWave(random, 900, 1600, 2),
    floorDetail = createWave(random, 380, 650, 2);
  const turns = Array.from({ length: 3 }, (_, i) => ({
    amplitude: (0.9 / (i + 1)) * (0.6 + random() * 0.7),
    k: (Math.PI * 2) / ([1300, 650, 360][i] * (0.8 + random() * 0.4)),
    phase: random() * Math.PI * 2,
  }));
  const slotTwist = { k: (Math.PI * 2) / (170 + random() * 50), phase: random() * 6 };
  const floorBase = 25 + random() * 30;

  const profile = (s, turnScale = 1) => {
    const open = Math.pow(widthWave(s), 1.35);
    let halfWidth = (27 + 86 * open) * tightness;
    halfWidth = mix(halfWidth, Math.max(halfWidth, 64), 1 - smoothstep(180, 340, s));
    halfWidth = mix(halfWidth, Math.max(halfWidth, 58), smoothstep(length - 260, length - 120, s));
    let floor = floorBase + (floorWave(s) - 0.5) * 60 + (floorDetail(s) - 0.5) * 22;
    let span = 72 + spanWave(s) * 38;
    let clearance = 10,
      steep = 0;
    let heading = turns.reduce((h, w) => h + w.amplitude * Math.sin(s * w.k + w.phase), 0);
    if (slot) {
      const w = band(s, slot.s0, slot.s1, 90);
      halfWidth = mix(halfWidth, slot.width, w);
      span = mix(span, 96, w);
      heading += w * 0.24 * Math.sin(s * slotTwist.k + slotTwist.phase);
    }
    if (spires) {
      const w = band(s, spires.s0, spires.s1, 140);
      halfWidth = mix(halfWidth, Math.max(halfWidth, 108), w);
      floor += 28 * w;
      clearance = mix(10, 62, w);
      steep = 1.6 * w;
    }
    if (arch) {
      const w = band(s, arch.s - 120, arch.s + 120, 110);
      halfWidth = mix(halfWidth, 44, w);
      span = mix(span, 54, band(s, arch.s - 30, arch.s + 30, 70));
    }
    heading = 0.95 * Math.tanh((heading * turnScale) / 0.95) * smoothstep(0, 380, s);
    const open2 = smoothstep(24, 104, halfWidth);
    return {
      halfWidth: Math.max(17, halfWidth),
      floor,
      ceiling: floor + span,
      bed: floor - clearance,
      slope: mix(4.6, 1.9, open2) + steep,
      heading,
    };
  };

  const path = tracePath(profile, { count, step: STEP });
  const gates = placeGates(path, random, { length, step: STEP, share });
  const grid = startGrid(path[0]);

  const thermals = [];
  const candidates = shuffle(
    path.filter((p) => p.halfWidth >= 60 && p.s > 320 && p.s < length - 260),
    random,
  );
  const wanted = 3 + Math.floor(random() * 4);
  for (const p of candidates) {
    if (thermals.length >= wanted) break;
    if (thermals.some((t) => Math.abs(t.s - p.s) < 260)) continue;
    const radius = 16 + random() * 12;
    const side = random() < 0.5 ? -1 : 1;
    const lateral = side * Math.min((0.35 + random() * 0.3) * p.halfWidth, p.halfWidth - radius - 4);
    const left = leftOf(p.forward);
    thermals.push({
      s: p.s,
      position: roundVec([
        p.position[0] + left[0] * lateral,
        p.position[1],
        p.position[2] + left[2] * lateral,
      ]),
      radius: round(radius),
      lift: round(3 + random() * 5),
    });
  }
  thermals.sort((a, b) => a.s - b.s);

  const features = [];
  if (slot) features.push({ type: "slot", s0: Math.round(slot.s0), s1: Math.round(slot.s1) });
  if (arch) {
    const p = path[arch.s / STEP];
    features.push({
      type: "arch",
      s: arch.s,
      position: roundVec([p.position[0], p.ceiling + 12, p.position[2]]),
      forward: roundVec(p.forward),
      halfSpan: round(p.halfWidth + 50),
      thickness: 13 + Math.round(random() * 5),
      depth: 16 + Math.round(random() * 6),
    });
  }
  if (spires) {
    const list = [];
    for (let n = 0; n < 34; n++) {
      const p = path[Math.round((spires.s0 + random() * (spires.s1 - spires.s0)) / STEP)];
      const radius = 4 + random() * 7;
      const inside = random() < 0.55;
      const lateral = inside
        ? (random() * 2 - 1) * (p.halfWidth - 6)
        : (random() < 0.5 ? -1 : 1) * (p.halfWidth + radius + 4 + random() * 30);
      const base = p.bed - 6;
      const top = inside
        ? p.floor - 4 - random() * 18
        : p.floor + random() * (p.ceiling - p.floor + 30);
      const left = leftOf(p.forward);
      list.push({
        position: roundVec([p.position[0] + left[0] * lateral, base, p.position[2] + left[2] * lateral]),
        radius: round(radius),
        height: round(top - base),
      });
    }
    features.push({ type: "spires", s0: Math.round(spires.s0), s1: Math.round(spires.s1), spires: list });
  }

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
  const carve = [
    ...extension(path[0], [-1, 0, 0], 22).reverse(),
    ...path,
    ...extension(last, last.forward, 22),
  ];
  const carved = carveTerrain(carve, makeRng(`terrain:${seed}`), {
    cellSize: options.cellSize === undefined ? TERRAIN_CELL : options.cellSize / lengthScale,
    margin: STEP * 1.5,
    plateau: options.plateau === undefined ? undefined : options.plateau / lengthScale,
  });
  const terrain = {
    origin: carved.origin.map(m),
    cellSize: m(carved.cellSize),
    columns: carved.columns,
    rows: carved.rows,
    heights: carved.heights.map((h) => Math.round(m(h) * 100) / 100 + 0),
  };
  const scaleVec = (v) => roundVec(v.map(m));

  return {
    seed: String(seed),
    type: "canyon",
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
    start: { grid: grid.map((g) => ({ ...g, position: scaleVec(g.position) })) },
    terrain,
    thermals: thermals.map(({ position, radius, lift }) => ({
      position: scaleVec(position),
      radius: round(m(radius)),
      lift: round(lift * speedScale),
    })),
    features: features.map((f) => scaleFeature(f, m, scaleVec)),
  };
}
