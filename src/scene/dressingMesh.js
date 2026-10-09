import { environmentOf } from "../palette.js";
import { createBuilder } from "./meshBuilder.js";
import { createLandCover } from "./landCover.js";
import { createPathIndex } from "./pathIndex.js";
import { addCastle } from "./castleMesh.js";
import { addTrees } from "./treeMesh.js";
import { addSettlements } from "./settlementMesh.js";
import { makeRng } from "../rng.js";
import { terrainHeight } from "../course/terrainHeight.js";
import { lengthScale } from "../worldScale.js";

const m = (v) => v * lengthScale;

const ICOSAHEDRON = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((p) => p.map((x) => x / Math.hypot(1, t)));
  const f = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { v, f };
})();

const leftOf = (f) => {
  const l = Math.hypot(f[0], f[2]) || 1;
  return [-f[2] / l, 0, f[0] / l];
};
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

function rock(builder, center, size, yaw, random, color) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const squash = [1.25 + random() * 0.4, 0.55 + random() * 0.35, 1];
  const verts = ICOSAHEDRON.v.map((p) => {
    const k = size * (0.78 + random() * 0.4);
    const x = p[0] * k * squash[0],
      y = p[1] * k * squash[1],
      z = p[2] * k * squash[2];
    return [center[0] + x * c - z * s, center[1] + y, center[2] + x * s + z * c];
  });
  builder.lump(() => {
    for (const [a, b, d] of ICOSAHEDRON.f) builder.tri(verts[a], verts[b], verts[d], color, 0, 0.9 + random() * 0.16);
  });
}

function prism(builder, base, radii, levels, colorsFor, sides, random, phase) {
  const rings = levels.map((y, i) =>
    Array.from({ length: sides }, (_, k) => {
      const a = phase + (k / sides) * Math.PI * 2;
      const r = radii[i] * (0.86 + random() * 0.28);
      return [base[0] + Math.cos(a) * r, y, base[2] + Math.sin(a) * r];
    }),
  );
  for (let i = 0; i < rings.length - 1; i++)
    for (let k = 0; k < sides; k++) {
      const n = (k + 1) % sides;
      builder.quad(rings[i][k], rings[i][n], rings[i + 1][n], rings[i + 1][k], colorsFor(i));
    }
  const top = rings.at(-1),
    centre = [base[0], levels.at(-1) + radii.at(-1) * 0.2, base[2]];
  for (let k = 0; k < sides; k++) builder.tri(top[k], top[(k + 1) % sides], centre, colorsFor(rings.length - 1));
}

function spire(builder, spec, random, environment) {
  const { position, radius, height } = spec;
  const segments = 4 + Math.floor(random() * 3);
  const levels = [],
    radii = [];
  for (let i = 0; i <= segments; i++) {
    levels.push(position[1] + (height * 0.9 * i) / segments);
    radii.push(radius * (1 - 0.45 * (i / segments)) * (i % 2 ? 0.82 : 1));
  }
  const strata = environment.strata;
  const offset = Math.floor(random() * strata.length);
  prism(builder, position, radii, levels, (i) => strata[(i + offset) % strata.length], 7, random, random() * 6);
  const strataBefore = builder.strata;
  builder.strata = false;
  const capBase = levels.at(-1);
  const cap = radii.at(-1) * 1.55;
  prism(
    builder,
    position,
    [cap * 0.8, cap, cap * 0.7],
    [capBase, capBase + height * 0.05, capBase + height * 0.1],
    () => environment.capRock,
    6,
    random,
    random() * 6,
  );
  builder.strata = strataBefore;
}

function arch(builder, feature, random, environment) {
  const { position, forward, halfSpan, thickness, depth } = feature;
  const left = leftOf(forward);
  const along = [forward[0], 0, forward[2]].map((v, i, f) => v / (Math.hypot(f[0], f[2]) || 1));
  const rise = m(50),
    steps = 26,
    sides = 7;
  const rings = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    const lateral = -Math.cos(a) * halfSpan;
    const swell = 1 + 1.4 * Math.pow(Math.abs(Math.cos(a)), 3);
    const h = thickness * 1.5 * swell,
      w = depth * 1.2 * swell;
    const centreY = position[1] - rise * (1 - Math.sin(a)) + h / 2;
    const centre = add(position, left, lateral);
    rings.push(
      Array.from({ length: sides }, (_, k) => {
        const b = (k / sides) * Math.PI * 2;
        const jitter = 0.85 + random() * 0.3;
        const y = centreY + Math.sin(b) * (h / 2) * jitter;
        const bottom = Math.max(y, position[1] - rise * (1 - Math.sin(a)));
        return add([centre[0], bottom, centre[2]], along, Math.cos(b) * (w / 2) * jitter);
      }),
    );
  }
  for (let i = 0; i < steps; i++)
    for (let k = 0; k < sides; k++) {
      const n = (k + 1) % sides;
      builder.quad(rings[i][k], rings[i][n], rings[i + 1][n], rings[i + 1][k], environment.strata[0]);
    }
}

function ring(builder, gate, finish, environment) {
  const { position, forward, radius } = gate;
  const f = forward.map((v) => v / Math.hypot(...forward));
  const left = leftOf(f);
  const up = [
    left[1] * f[2] - left[2] * f[1],
    left[2] * f[0] - left[0] * f[2],
    left[0] * f[1] - left[1] * f[0],
  ];
  const segments = 36,
    sides = 6,
    tube = m(finish ? 1.9 : 1.25);
  const point = (i, k) => {
    const a = (i / segments) * Math.PI * 2,
      b = (k / sides) * Math.PI * 2;
    const radial = add(add([0, 0, 0], left, Math.cos(a)), up, Math.sin(a));
    const offset = add(add([0, 0, 0], radial, Math.cos(b) * tube), f, Math.sin(b) * tube);
    return add(add(position, radial, radius), offset);
  };
  for (let i = 0; i < segments; i++)
    for (let k = 0; k < sides; k++) {
      const color = finish
        ? (i + (k > 2 ? 1 : 0)) % 2
          ? environment.finishDark
          : environment.finishLight
        : environment.gate;
      builder.quad(point(i, k), point(i + 1, k), point(i + 1, k + 1), point(i, k + 1), color, finish ? 0.55 : 1);
    }
}

function post(builder, base, top, width, color, emissive = 0) {
  const corners = [
    [-1, -1], [1, -1], [1, 1], [-1, 1],
  ].map(([x, z]) => [x * width, z * width]);
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corners[k],
      [bx, bz] = corners[(k + 1) % 4];
    builder.quad(
      [base[0] + ax, base[1], base[2] + az],
      [base[0] + bx, base[1], base[2] + bz],
      [top[0] + bx, top[1], top[2] + bz],
      [top[0] + ax, top[1], top[2] + az],
      color,
      emissive,
    );
  }
}

/** Static course dressing as flat-coloured triangles: rocks, spires, arch, gates, start and finish. */
export function buildDressingMesh(course) {
  const environment = environmentOf(course);
  const valley = course.type === "valley";
  const builder = createBuilder();
  const random = makeRng(`dressing:${course.seed}`);
  const { terrain, path } = course;
  const spacing = path[1].s - path[0].s;
  const rocks = Math.round((valley ? 420 : 520) * lengthScale);
  for (let n = 0; n < rocks; n++) {
    const p = path[Math.floor(random() * path.length)];
    const left = leftOf(p.forward);
    const lateral = (random() * 2 - 1) * (p.halfWidth + m(90));
    const along = (random() - 0.5) * spacing;
    const x = p.position[0] + left[0] * lateral + p.forward[0] * along,
      z = p.position[2] + left[2] * lateral + p.forward[2] * along;
    const y = terrainHeight(terrain, x, z);
    const slope = Math.abs(terrainHeight(terrain, x + m(4), z) - terrainHeight(terrain, x - m(4), z)) / m(8);
    if (slope > 1.2) continue;
    const inCorridor = Math.abs(lateral) < p.halfWidth + m(8);
    const size = (inCorridor ? 1.2 + random() * 2.6 : 1.5 + random() * 5) * (valley ? 0.38 : lengthScale);
    const tone = random() < 0.5 ? environment.strata[Math.floor(random() * 6)] : environment.capRock;
    rock(builder, [x, y + size * 0.2, z], size, random() * 6, random, tone);
  }
  for (const feature of course.features || []) {
    builder.strata = true;
    if (feature.type === "spires") for (const spec of feature.spires) spire(builder, spec, random, environment);
    if (feature.type === "arch") arch(builder, feature, random, environment);
    builder.strata = false;
  }
  if (valley) {
    const cover = createLandCover(course, environment);
    const corridor = createPathIndex(course.path);
    const riverFeature = course.features.find((f) => f.type === "river");
    const river = riverFeature
      ? createPathIndex(riverFeature.points.map(([x, y, z, halfWidth]) => ({ position: [x, y, z], halfWidth })), 200)
      : null;
    for (const feature of course.features) if (feature.type === "castle") addCastle(builder, feature, terrain, environment);
    const taken = addSettlements(builder, course, environment, cover, corridor, river);
    addTrees(builder, course, environment, cover, corridor, river, taken);
  }
  course.gates.forEach((gate, i) => {
    const finish = i === course.gates.length - 1;
    ring(builder, gate, finish, environment);
    if (finish) {
      const left = leftOf(gate.forward);
      for (const side of [-1, 1]) {
        const top = add(gate.position, left, side * gate.radius);
        const ground = terrainHeight(terrain, top[0], top[2]);
        post(builder, [top[0], ground - m(2), top[2]], top, m(1.1), environment.finishLight, 0.4);
      }
    }
  });
  const start = path[0];
  const startLeft = leftOf(start.forward);
  for (const side of [-1, 1]) {
    const x = start.position[0] + startLeft[0] * side * (start.halfWidth - m(6)),
      z = start.position[2] + startLeft[2] * side * (start.halfWidth - m(6));
    const ground = terrainHeight(terrain, x, z);
    const [low, high] = [start.position[1] + m(16), start.position[1] + m(22)];
    post(builder, [x, ground - m(2), z], [x, low, z], m(1.3), environment.finishDark);
    post(builder, [x, low, z], [x, high, z], m(1.6), environment.start, 0.8);
  }
  return builder.result();
}
