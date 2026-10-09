import { makeRng } from "../rng.js";
import { add, cross, normalize, scale } from "../vec3.js";
import { creatureScale as C, lengthScale as L, speedScale as V } from "../worldScale.js";
import { pathAt } from "./courseGeometry.js";

const NAMES = [
  "Ashwing",
  "Emberclaw",
  "Skyrend",
  "Duskfang",
  "Talonfall",
  "Stormveil",
  "Cinderjaw",
  "Frostquill",
];

/**
 * Winding, hilly canyon course for camera tests: the corridor bends in XZ and
 * rises and falls, and the heightfield has walls outside the corridor.
 * Course dimensions follow `lengthScale`; `length` and `halfWidth` options are in metres.
 */
export function createSyntheticCourse(seed = "fixture", options = {}) {
  const random = makeRng(`camera-course:${seed}`);
  const length = options.length ?? Math.round(240 * L) * 10,
    step = 10,
    halfWidth = options.halfWidth ?? 45 * L,
    bend = options.bend ?? 0.55,
    phase = random() * Math.PI * 2;
  const path = [];
  let x = 0,
    z = 0;
  for (let s = 0; s <= length; s += step) {
    const u = s / L;
    const heading = bend * Math.sin((u / 520) * Math.PI + phase) * Math.min(1, u / 200);
    const y = L * (70 + 18 * Math.sin(u / 310 + phase) + 8 * Math.sin(u / 97));
    const forward = normalize([
      Math.cos(heading),
      (18 / 310) * Math.cos(u / 310 + phase) + (8 / 97) * Math.cos(u / 97),
      Math.sin(heading),
    ]);
    path.push({ s, position: [x, y, z], forward, halfWidth, floor: y - 38 * L, ceiling: y + 55 * L });
    x += Math.cos(heading) * step;
    z += Math.sin(heading) * step;
  }
  const gates = [];
  const spacing = Math.round(20 * L) * 10;
  for (let i = 0, s = spacing; s <= length; s += spacing, i++) {
    const c = pathAt({ path }, s);
    gates.push({ index: i, s, position: c.position, forward: c.forward, radius: 16 * L });
  }
  if (gates.at(-1).s !== length) {
    const c = pathAt({ path }, length);
    gates.push({ index: gates.length, s: length, position: c.position, forward: c.forward, radius: 20 * L });
  }
  const start = path[0];
  const grid = Array.from({ length: 12 }, (_, i) => ({
    position: [
      C * (-(i % 2) * 10 - Math.floor(i / 4) * 8),
      start.position[1],
      C * ((i >> 1) % 6 - 2.5) * 12,
    ],
    forward: [1, 0, 0],
  }));
  const cellSize = 12 * L,
    pad = 150 * L,
    xs = path.map((p) => p.position[0]),
    zs = path.map((p) => p.position[2]);
  const origin = [Math.min(...xs) - pad, Math.min(...zs) - pad - halfWidth];
  const columns = Math.ceil((Math.max(...xs) - origin[0] + pad) / cellSize) + 1,
    rows = Math.ceil((Math.max(...zs) - origin[1] + pad + halfWidth) / cellSize) + 1;
  const search = Math.max(1, Math.round((20 * L) / step)),
    overhang = Math.ceil((30 * 10 * L) / step);
  const heights = new Array(columns * rows);
  const hilly = options.hilly ?? 1;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const wx = origin[0] + c * cellSize,
        wz = origin[1] + r * cellSize;
      let best = Infinity,
        near = path[0];
      for (let i = -overhang; i < path.length + overhang; i += search) {
        const at = pathAt({ path }, i * step);
        const p = at.position,
          d = (p[0] - wx) ** 2 + (p[2] - wz) ** 2;
        if (d < best) (best = d), (near = at);
      }
      const lateral = Math.sqrt(best);
      const hills =
        hilly *
        L *
        (9 * Math.sin(wx / (37 * L) + phase) * Math.cos(wz / (29 * L)) +
          5 * Math.sin((wx + wz) / (13 * L)));
      const wall = Math.max(0, lateral - halfWidth * 0.9);
      heights[r * columns + c] =
        near.floor - 12 * L + hills + Math.min(130 * L, (wall * wall * 0.08) / L);
    }
  const thermals = [0.3, 0.62].map((k) => {
    const c = pathAt({ path }, length * k);
    return { position: c.position, radius: 30 * L, lift: 4 * V };
  });
  return {
    seed: String(seed),
    length,
    path,
    gates,
    start: { grid },
    terrain: { origin, cellSize, columns, rows, heights },
    thermals,
  };
}

/**
 * Scripted race: a pack start, a comeback from the back, a super effective
 * hit on a front-runner, a missed gate, a thermal and a photo finish for the lead.
 * Froude-scaled like the live race: speeds by `speedScale`, script times by
 * `speedScale`, spacing between racers by `creatureScale`.
 */
export function createSyntheticRecording(course, options = {}) {
  const seed = options.seed ?? "fixture",
    count = options.count ?? 8,
    hz = options.hz ?? 20;
  const random = makeRng(`camera-race:${seed}`);
  const length = course.length;
  const roster = Array.from({ length: count }, (_, i) => ({
    id: `w${i}`,
    name: NAMES[i % NAMES.length],
    subject: "dragon",
    genome: {},
    stats: {},
  }));
  const base = roster.map(() => V * (31 + random() * 1.2));
  const lanes = roster.map((_, i) => (i - (count - 1) / 2) * 5 * C);
  const script = (i, t, progress) => {
    const u = t / V;
    let v = base[i];
    if (i === 0) v += 1.2 * V;
    if (i === 1 && progress > length * 0.7) v += 2.6 * V;
    if (i === 2) v += V * (u < 25 ? 2 : u < 38 ? -7 : 0);
    if (i === count - 1) v += V * (u > 12 ? 1.9 : -2);
    if (i === 4 && u > 44 && u < 46) v *= 0.4;
    if (i === 5 && u > 55 && u < 58) v += 4 * V;
    return v;
  };
  const events = [];
  const hitAt = 25 * V,
    missAt = 44 * V,
    thermalAt = 55 * V;
  const dt = 1 / hz;
  const progress = roster.map((_, i) => -C * ((i % 2) * 6 + (i >> 1) * 3));
  const speeds = roster.map(() => 0);
  const done = roster.map(() => null);
  const history = roster.map(() => []);
  const maxT = options.maxT ?? 200 * V;
  for (let f = 0; f * dt <= maxT; f++) {
    const t = f * dt;
    roster.forEach((_, i) => {
      if (f > 0) {
        speeds[i] = Math.min(speeds[i] + 12 * dt, script(i, t, progress[i]));
        progress[i] += speeds[i] * dt;
      }
      history[i].push(progress[i]);
      if (done[i] === null && progress[i] >= length) done[i] = t;
    });
    if (done.every((d) => d !== null) && t > Math.max(...done) + 3) break;
  }
  const photo = Math.min(...done.filter((_, i) => i !== 1)) - 0.04;
  const warp = (i, t) => (i === 1 ? (t * done[1]) / photo : t);
  const frameCount = history[0].length;
  const at = (i, t) => {
    const x = Math.min(frameCount - 1, warp(i, t) * hz),
      k = Math.floor(x),
      u = x - k;
    const a = history[i][k],
      b = history[i][Math.min(frameCount - 1, k + 1)];
    return a + (b - a) * u;
  };
  const finishTime = (i) => (i === 1 ? photo : done[i]);
  const frames = [];
  let order = null;
  for (let f = 0; f < frameCount; f++) {
    const t = f / hz;
    const racers = roster.map(({ id }, i) => {
      const raw = at(i, t),
        progress = Math.min(length, raw),
        u = t / V;
      const c = pathAt(course, raw);
      const left = normalize(cross([c.forward[0], 0, c.forward[2]], [0, 1, 0]));
      const sway = lanes[i] + 3 * C * Math.sin(u * 0.4 + i * 1.7);
      const climb = i === 5 && t > thermalAt ? Math.min(12 * L, (t - thermalAt) * 4 * V) : 0;
      const lift = 4 * C * Math.sin(u * 0.25 + i) + climb;
      const speed = (at(i, t + dt) - raw) * hz;
      return {
        id,
        position: add(add(c.position, scale(left, sway)), [0, lift, 0]),
        forward: c.forward,
        bank: 0.2 * Math.cos(u * 0.4 + i * 1.7),
        flap: (t * 2.3 + i * 0.13) % 1,
        speed: raw >= length ? speed : Math.max(0, speed),
        progress,
        gate: course.gates.filter((g) => g.s <= progress).length,
        place: 0,
        finished: raw >= length,
      };
    });
    const ranked = [...racers].sort((a, b) => {
      const ia = roster.findIndex((r) => r.id === a.id),
        ib = roster.findIndex((r) => r.id === b.id);
      if (a.finished && b.finished) return finishTime(ia) - finishTime(ib);
      return b.progress - a.progress;
    });
    ranked.forEach((r, k) => (r.place = k + 1));
    if (order)
      for (const r of ranked) {
        const before = order.indexOf(r.id) + 1;
        if (r.place < before)
          events.push({ t, type: "overtake", racer: r.id, other: order[r.place - 1], place: r.place });
      }
    order = ranked.map((r) => r.id);
    frames.push({ t, racers });
  }
  events.push({ t: hitAt, type: "hit", racer: "w2", other: "w1", element: "fire", matchup: 2, amount: 0.5, until: hitAt + 1.8 });
  events.push({ t: missAt, type: "miss", racer: "w4", detail: { gate: course.gates.findIndex((g) => g.s > at(4, missAt)) } });
  events.push({ t: thermalAt, type: "thermal", racer: "w5" });
  const results = roster
    .map(({ id }, i) => ({ id, time: finishTime(i) }))
    .sort((a, b) => a.time - b.time)
    .map((r, k) => ({ ...r, place: k + 1 }));
  for (const r of results) events.push({ t: r.time, type: "finish", racer: r.id, place: r.place });
  events.sort((a, b) => a.t - b.t);
  return {
    seed: String(seed),
    hz,
    duration: (frameCount - 1) / hz,
    roster,
    frames,
    events,
    results,
  };
}

/** Cuts a recording at time t, as a director would see it live at t - 3. */
export function truncateRecording(recording, t) {
  const frames = recording.frames.filter((_, f) => f / recording.hz <= t + 1e-9);
  return {
    ...recording,
    duration: (frames.length - 1) / recording.hz,
    frames,
    events: recording.events.filter((e) => e.t <= t),
    results: [],
  };
}
