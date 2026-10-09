import { roundMesh, roundMeshAdaptive } from "../roundMesh.js";

const NO_BONES = ["", ""],
  CREASE = -0.9,
  LARGE = 0.04;

/**
 * A scenery mesh (the `createBuilder` layout) for a soft style: the colours of its `blends` averaged
 * where their triangles share a corner, and each of its `lumps` given shared normals by `roundMesh`.
 * Lumps within `near` (`{ centre: [x, z], radius }`, where the camera stays), or large for their distance
 * from it (clouds), are split as well: `round`
 * splits every triangle `round`×`round`, `{ bulge }` only the edges bulging more than `bulge` × the
 * lump's radius. Everything else stays as it is.
 * @param {{ positions: Float32Array, colors: Float32Array, surface: Float32Array, normals: Float32Array, lumps?: Uint32Array, blends?: Uint32Array }} flat
 * @param {number | { bulge: number }} round
 * @param {{ centre: number[], radius: number }} [near]
 */
export function softenDressing(flat, round, near) {
  if (!round) return flat;
  const mesh = { ...flat, colors: blendColors(flat) };
  const lumps = mesh.lumps ?? [];
  if (!lumps.length) return mesh;
  const positions = [],
    colors = [],
    surface = [],
    normals = [];
  const copy = (first, end) => {
    for (let v = first * 3; v < end * 3; v++) {
      positions.push(mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]);
      colors.push(mesh.colors[v * 4], mesh.colors[v * 4 + 1], mesh.colors[v * 4 + 2], mesh.colors[v * 4 + 3]);
      surface.push(mesh.surface[v * 2], mesh.surface[v * 2 + 1]);
      normals.push(mesh.normals[v * 3], mesh.normals[v * 3 + 1], mesh.normals[v * 3 + 2]);
    }
  };
  const emit = (p, n, c) => {
    positions.push(p[0], p[1], p[2]);
    colors.push(c[0], c[1], c[2], c[3]);
    surface.push(c[4], c[5]);
    normals.push(n[0], n[1], n[2]);
  };
  let done = 0;
  for (let k = 0; k < lumps.length; k += 2) {
    const [first, end] = [lumps[k], lumps[k + 1]];
    copy(done, first);
    const lump = { positions: [], colors: [], joints: [], weights: [], indices: [] };
    for (let v = first * 3; v < end * 3; v++) {
      lump.positions.push([mesh.positions[v * 3], mesh.positions[v * 3 + 1], mesh.positions[v * 3 + 2]]);
      lump.colors.push([...mesh.colors.subarray(v * 4, v * 4 + 4), mesh.surface[v * 2], mesh.surface[v * 2 + 1]]);
      lump.joints.push(NO_BONES);
      lump.weights.push(1);
      lump.indices.push(lump.indices.length);
    }
    const { centre, radius } = boundsOf(lump.positions);
    const away = near ? Math.hypot(centre[0] - near.centre[0], centre[2] - near.centre[1]) : Infinity;
    const close = away < near?.radius || radius / away > LARGE;
    if (!close) roundMesh(lump, 1, emit, CREASE);
    else if (typeof round === "object") roundMeshAdaptive(lump, round.bulge * radius, emit, CREASE);
    else roundMesh(lump, round, emit, CREASE);
    done = end;
  }
  copy(done, mesh.positions.length / 9);
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    surface: new Float32Array(surface),
    normals: new Float32Array(normals),
  };
}

const cornerKey = (p, v) => `${Math.round(p[v * 3] * 1e3)},${Math.round(p[v * 3 + 1] * 1e3)},${Math.round(p[v * 3 + 2] * 1e3)}`;

function blendColors({ positions, colors, blends = [] }) {
  const out = colors.slice();
  for (let k = 0; k < blends.length; k += 2) {
    const sums = new Map();
    for (let v = blends[k] * 3; v < blends[k + 1] * 3; v++) {
      const key = cornerKey(positions, v),
        sum = sums.get(key) ?? [0, 0, 0, 0];
      for (let a = 0; a < 3; a++) sum[a] += colors[v * 4 + a];
      sum[3]++;
      sums.set(key, sum);
    }
    for (let v = blends[k] * 3; v < blends[k + 1] * 3; v++) {
      const sum = sums.get(cornerKey(positions, v));
      for (let a = 0; a < 3; a++) out[v * 4 + a] = sum[a] / sum[3];
    }
  }
  return out;
}

function boundsOf(points) {
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], p[a]);
      hi[a] = Math.max(hi[a], p[a]);
    }
  return { centre: lo.map((v, a) => (v + hi[a]) / 2), radius: Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2 };
}
