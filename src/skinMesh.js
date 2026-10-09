import { primitive } from "./geometry.js";
import { roundMesh, roundMeshAdaptive } from "./roundMesh.js";
import {
  transform,
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
    const m = part.skin
      ? transform()
      : multiply(
          bind[ids.get(part.bone)],
          transform(part.position, part.rotation, part.scale),
        );
    const source = geometry.vertices;
    const count = source.length / 3;
    const positions = new Array(count),
      colors = new Array(count),
      joints = new Array(count),
      weights = new Array(count);
    const own = [part.bone, part.bone];
    const marking = part.markings ?? 0;
    for (let index = 0; index < count; index++) {
      const x = source[index * 3],
        y = source[index * 3 + 1],
        z = source[index * 3 + 2];
      positions[index] = [
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
      ];
      const from = geometry.sources?.[index] ?? index;
      const mark = marking * (geometry.marks?.[index] ?? part.marks?.[from] ?? 1);
      const own3 = geometry.colors?.[index];
      colors[index] = own3
        ? [own3[0], own3[1], own3[2], mark]
        : part.colors
          ? [part.colors[from * 3], part.colors[from * 3 + 1], part.colors[from * 3 + 2], mark]
          : [part.color[0], part.color[1], part.color[2], mark];
      joints[index] = part.skin?.joints[from] || own;
      weights[index] = part.skin?.weights[from] ?? 1;
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
    const indices = geometry.indices;
    for (let triangle = 0; triangle < indices.length; triangle += 3) {
      const i0 = indices[triangle],
        i1 = indices[triangle + 1],
        i2 = indices[triangle + 2];
      const c0 = positions[i0],
        c1 = positions[i1],
        c2 = positions[i2];
      const a0 = c1[0] - c0[0],
        a1 = c1[1] - c0[1],
        a2 = c1[2] - c0[2];
      const b0 = c2[0] - c0[0],
        b1 = c2[1] - c0[1],
        b2 = c2[2] - c0[2];
      const n0 = a1 * b2 - a2 * b1,
        n1 = a2 * b0 - a0 * b2,
        n2 = a0 * b1 - a1 * b0;
      const length = Math.hypot(n0, n1, n2);
      if (length < 1e-9) continue;
      const nx = n0 / length,
        ny = n1 / length,
        nz = n2 / length;
      for (const index of [i0, i1, i2]) {
        const p = positions[index],
          c = colors[index],
          j = joints[index];
        data.push(p[0], p[1], p[2], nx, ny, nz, c[0], c[1], c[2], ids.get(j[0]), ids.get(j[1]), weights[index]);
        markings.push(c[3]);
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

/** The key a skin mesh built at `round` is filed under. */
export const roundKey = (round) => JSON.stringify(round ?? 0);

/**
 * A skin mesh built ahead of time (in a worker, say) and carried on the anatomy as `prebuilt: { key, data }`,
 * when it was built at `round`, or whatever it was built at when the anatomy has no parts to build another from.
 */
export function prebuiltSkin(anatomy, round) {
  if (!anatomy.prebuilt) return null;
  return anatomy.prebuilt.key === roundKey(round) || !anatomy.parts.length ? anatomy.prebuilt.data : null;
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
