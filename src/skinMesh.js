import { primitive } from "./geometry.js";
import { roundMesh, roundMeshAdaptive } from "./roundMesh.js";
import {
  transform,
  point,
  multiply,
  boneMatrices,
  inverseRigid,
} from "./math3d.js";
import { metalToneOf } from "./anatomy/metalTone.js";

/**
 * Flat-shaded triangles in the bind pose; with `round`, each part is smoothed and split `round`×`round`,
 * or with `round: { bulge }` only where an edge bulges more than `bulge` × the anatomy's radius.
 * `metals` holds each vertex's metal for a metallic coat (`metalIds`), 0 elsewhere.
 * `markings` holds one float per vertex: how much the coat's markings show there, negative on the legs.
 * @param {object} anatomy
 * @param {{ round?: number | { bulge: number } }} [options]
 */
export function makeSkinMesh(anatomy, { round = 0 } = {}) {
  const data = [],
    markings = [];
  const ids = new Map(anatomy.bones.map((bone, index) => [bone.id, index]));
  const bind = boneMatrices(anatomy);
  for (const part of anatomy.parts) {
    const geometry = part.cornerColors ? unweld(part) : primitive(part);
    const matrix = part.skin
      ? transform()
      : multiply(
          bind[ids.get(part.bone)],
          transform(part.position, part.rotation, part.scale),
        );
    const count = geometry.vertices.length / 3;
    const positions = [],
      colors = [],
      joints = [],
      weights = [];
    for (let index = 0; index < count; index++) {
      positions.push(point(matrix, geometry.vertices.slice(index * 3, index * 3 + 3)));
      const source = geometry.sources?.[index] ?? index;
      const color = geometry.colors?.[index] ?? (part.colors ? part.colors.slice(source * 3, source * 3 + 3) : part.color);
      colors.push([...color, (part.markings ?? 0) * (geometry.marks?.[index] ?? part.marks?.[source] ?? 1)]);
      joints.push(part.skin?.joints[source] || [part.bone, part.bone]);
      weights.push(part.skin?.weights[source] ?? 1);
    }
    if (round) {
      const mesh = { positions, colors, joints, weights, indices: geometry.indices };
      const emit = (p, n, c, [j0, j1], w) => {
        data.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], ids.get(j0), ids.get(j1), w);
        markings.push(c[3]);
      };
      if (typeof round === "object") roundMeshAdaptive(mesh, round.bulge * anatomy.bounds.radius, emit);
      else roundMesh(mesh, round, emit);
      continue;
    }
    for (let triangle = 0; triangle < geometry.indices.length; triangle += 3) {
      const indices = geometry.indices.slice(triangle, triangle + 3);
      const corners = indices.map((index) => positions[index]);
      const a = corners[1].map((v, i) => v - corners[0][i]);
      const b = corners[2].map((v, i) => v - corners[0][i]);
      const n = [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      const length = Math.hypot(...n);
      if (length < 1e-9) continue;
      const normal = n.map((v) => v / length);
      for (let corner = 0; corner < 3; corner++) {
        const index = indices[corner];
        data.push(
          ...corners[corner],
          ...normal,
          ...colors[index].slice(0, 3),
          ids.get(joints[index][0]),
          ids.get(joints[index][1]),
          weights[index],
        );
        markings.push(colors[index][3]);
      }
    }
  }
  return {
    vertices: new Float32Array(data),
    metals: metalsOf(anatomy, data),
    markings: new Float32Array(markings),
    inverseBind: bind.map(inverseRigid),
  };
}

/** The metal of every vertex in `data`, judged by its colour, one judgement per distinct colour. */
function metalsOf(anatomy, data) {
  const metals = new Float32Array(data.length / 12);
  const tone = metalToneOf(anatomy.genome);
  if (!tone) return metals;
  const known = new Map();
  for (let i = 0; i < metals.length; i++) {
    const color = data.slice(i * 12 + 6, i * 12 + 9);
    const key = color.join();
    if (!known.has(key)) known.set(key, tone(color));
    metals[i] = known.get(key);
  }
  return metals;
}

/** A mesh part with `cornerColors` split so every triangle corner is its own vertex; rounding still welds normals by position. */
function unweld(part) {
  const vertices = [],
    colors = [];
  part.indices.forEach((index, corner) => {
    vertices.push(...part.vertices.slice(index * 3, index * 3 + 3));
    colors.push(part.cornerColors.slice(corner * 3, corner * 3 + 3));
  });
  return { vertices, indices: part.indices.map((_, corner) => corner), sources: part.indices, colors, marks: part.cornerMarks };
}
