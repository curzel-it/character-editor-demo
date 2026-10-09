const CREASE = -0.25;

/**
 * Rounds a faceted part without touching its rig: corners that share a position share an averaged
 * normal, and every triangle is split `level`×`level` over the curved patch those normals describe
 * (PN triangles), so silhouettes bulge out of the facets. Skin weights blend across each patch.
 * Calls `emit(position, normal, color, joints, weight)` once per corner of every new triangle.
 * Faces turned further apart than `crease` (the cosine between them) keep the edge between them sharp.
 * @param {{ positions: number[][], colors: number[][], joints: string[][], weights: number[], indices: number[] }} mesh
 * @param {number} level
 * @param {(p: number[], n: number[], c: number[], joints: string[], weight: number) => void} emit
 * @param {number} [crease]
 */
export function roundMesh({ positions, colors, joints, weights, indices }, level, emit, crease = CREASE) {
  const normals = smoothNormals(positions, indices, crease);
  const grid = [];
  for (let j = 0; j <= level; j++) for (let i = 0; i <= level - j; i++) grid.push([(level - i - j) / level, i / level, j / level]);
  const order = [];
  const at = (i, j) => j * (level + 1) - (j * (j - 1)) / 2 + i;
  for (let j = 0; j < level; j++)
    for (let i = 0; i < level - j; i++) {
      order.push(at(i, j), at(i + 1, j), at(i, j + 1));
      if (i + j < level - 1) order.push(at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
    }
  const b = new Float64Array(30);
  const samples = grid.map(() => ({ p: [0, 0, 0], n: [0, 0, 0], c: colors[0].map(() => 0), joints: ["", ""], weight: 1 }));
  const bones = [],
    amounts = [],
    k = new Float64Array(10);
  for (let t = 0; t < indices.length; t += 3) {
    const c0 = indices[t],
      c1 = indices[t + 1],
      c2 = indices[t + 2];
    const n0 = normals[t],
      n1 = normals[t + 1],
      n2 = normals[t + 2];
    controlPoints(positions[c0], positions[c1], positions[c2], n0, n1, n2, b);
    const corners = [c0, c1, c2];
    for (let s = 0; s < grid.length; s++) {
      const uvw = grid[s],
        [w, u, v] = uvw,
        sample = samples[s];
      k[0] = w * w * w;
      k[1] = u * u * u;
      k[2] = v * v * v;
      k[3] = 3 * w * w * u;
      k[4] = 3 * w * u * u;
      k[5] = 3 * w * w * v;
      k[6] = 3 * u * u * v;
      k[7] = 3 * w * v * v;
      k[8] = 3 * u * v * v;
      k[9] = 6 * w * u * v;
      for (let a = 0; a < 3; a++) {
        let sum = 0;
        for (let q = 0; q < 10; q++) sum += b[q * 3 + a] * k[q];
        sample.p[a] = sum;
        sample.n[a] = n0[a] * w + n1[a] * u + n2[a] * v;
      }
      for (let a = 0; a < sample.c.length; a++) sample.c[a] = colors[c0][a] * w + colors[c1][a] * u + colors[c2][a] * v;
      const length = Math.hypot(sample.n[0], sample.n[1], sample.n[2]) || 1;
      for (let a = 0; a < 3; a++) sample.n[a] /= length;
      bones.length = amounts.length = 0;
      for (let q = 0; q < 3; q++) {
        const corner = corners[q],
          [j0, j1] = joints[corner],
          weight = weights[corner],
          share = uvw[q];
        if (j0 === j1) add(bones, amounts, j0, share);
        else add(bones, amounts, j0, share * weight), add(bones, amounts, j1, share * (1 - weight));
      }
      let first = 0,
        second = -1;
      for (let q = 1; q < bones.length; q++)
        if (amounts[q] > amounts[first]) (second = first), (first = q);
        else if (second < 0 || amounts[q] > amounts[second]) second = q;
      sample.joints = second < 0 ? [bones[first], bones[first]] : [bones[first], bones[second]];
      sample.weight = second < 0 ? 1 : amounts[first] / (amounts[first] + amounts[second]);
    }
    for (const s of order) {
      const sample = samples[s];
      emit(sample.p, sample.n, sample.c, sample.joints, sample.weight);
    }
  }
}

function add(bones, amounts, bone, amount) {
  const i = bones.indexOf(bone);
  if (i < 0) bones.push(bone), amounts.push(amount);
  else amounts[i] += amount;
}

/** One normal per triangle corner: the faces meeting there averaged, leaving out those turned away past `crease`, such as the far side of a membrane. */
function smoothNormals(positions, indices, crease) {
  const key = (p) => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(p[2] * 1e4)}`;
  const keys = positions.map(key);
  const faces = [],
    around = new Map();
  for (let t = 0; t < indices.length; t += 3) {
    const p = positions[indices[t]],
      q = positions[indices[t + 1]],
      r = positions[indices[t + 2]];
    const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]],
      v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...n) || 1;
    faces.push([n, [n[0] / length, n[1] / length, n[2] / length]]);
    for (let c = 0; c < 3; c++) {
      const k = keys[indices[t + c]];
      if (around.has(k)) around.get(k).push(t / 3);
      else around.set(k, [t / 3]);
    }
  }
  const normals = [];
  for (let t = 0; t < indices.length; t += 3) {
    const own = faces[t / 3][1];
    for (let c = 0; c < 3; c++) {
      const sum = [0, 0, 0];
      for (const f of around.get(keys[indices[t + c]])) {
        const [n, unit] = faces[f];
        if (unit[0] * own[0] + unit[1] * own[1] + unit[2] * own[2] < crease) continue;
        sum[0] += n[0];
        sum[1] += n[1];
        sum[2] += n[2];
      }
      const length = Math.hypot(...sum);
      normals.push(length > 1e-12 ? [sum[0] / length, sum[1] / length, sum[2] / length] : own);
    }
  }
  return normals;
}

/** Cubic Bézier triangle control points in `out`: p1, p2, p3, b210, b120, b201, b021, b102, b012, b111. */
function controlPoints(p1, p2, p3, n1, n2, n3, out) {
  const edge = (pi, pj, ni, slot) => {
    const d = (pj[0] - pi[0]) * ni[0] + (pj[1] - pi[1]) * ni[1] + (pj[2] - pi[2]) * ni[2];
    for (let a = 0; a < 3; a++) out[slot * 3 + a] = (2 * pi[a] + pj[a] - d * ni[a]) / 3;
  };
  for (let a = 0; a < 3; a++) (out[a] = p1[a]), (out[3 + a] = p2[a]), (out[6 + a] = p3[a]);
  edge(p1, p2, n1, 3);
  edge(p2, p1, n2, 4);
  edge(p1, p3, n1, 5);
  edge(p2, p3, n2, 6);
  edge(p3, p1, n3, 7);
  edge(p3, p2, n3, 8);
  for (let a = 0; a < 3; a++) {
    let e = 0;
    for (let q = 3; q < 9; q++) e += out[q * 3 + a];
    e /= 6;
    const v = (p1[a] + p2[a] + p3[a]) / 3;
    out[27 + a] = e + (e - v) / 2;
  }
}

/**
 * Like `roundMesh`, but splits only the edges that bulge more than `tolerance` off their chord:
 * each triangle becomes one to four, and both sides of an edge agree on it, so nothing cracks.
 * @param {{ positions: number[][], colors: number[][], joints: string[][], weights: number[], indices: number[] }} mesh
 * @param {number} tolerance
 * @param {(p: number[], n: number[], c: number[], joints: string[], weight: number) => void} emit
 * @param {number} [crease]
 */
export function roundMeshAdaptive({ positions, colors, joints, weights, indices }, tolerance, emit, crease = CREASE) {
  const normals = smoothNormals(positions, indices, crease);
  const bones = [],
    amounts = [];
  const vertex = (q, k, t) => ({ p: positions[q], n: normals[t + k], c: colors[q], joints: joints[q], weight: weights[q] });
  const middle = (a, b) => {
    const p = [0, 0, 0],
      n = [0, 0, 0],
      c = a.c.map((v, i) => (v + b.c[i]) / 2);
    for (let i = 0; i < 3; i++) {
      const ea = (2 * a.p[i] + b.p[i] - dotTo(b.p, a.p, a.n) * a.n[i]) / 3;
      const eb = (2 * b.p[i] + a.p[i] - dotTo(a.p, b.p, b.n) * b.n[i]) / 3;
      p[i] = (a.p[i] + 3 * ea + 3 * eb + b.p[i]) / 8;
      n[i] = a.n[i] + b.n[i];
    }
    const length = Math.hypot(...n) || 1;
    bones.length = amounts.length = 0;
    for (const v of [a, b]) {
      const [j0, j1] = v.joints;
      if (j0 === j1) add(bones, amounts, j0, 0.5);
      else add(bones, amounts, j0, 0.5 * v.weight), add(bones, amounts, j1, 0.5 * (1 - v.weight));
    }
    let first = 0,
      second = -1;
    for (let q = 1; q < bones.length; q++)
      if (amounts[q] > amounts[first]) (second = first), (first = q);
      else if (second < 0 || amounts[q] > amounts[second]) second = q;
    const bulge = Math.hypot(p[0] - (a.p[0] + b.p[0]) / 2, p[1] - (a.p[1] + b.p[1]) / 2, p[2] - (a.p[2] + b.p[2]) / 2);
    return {
      p,
      n: [n[0] / length, n[1] / length, n[2] / length],
      c,
      joints: second < 0 ? [bones[first], bones[first]] : [bones[first], bones[second]],
      weight: second < 0 ? 1 : amounts[first] / (amounts[first] + amounts[second]),
      bulge,
    };
  };
  const out = (...vs) => {
    for (const v of vs) emit(v.p, v.n, v.c, v.joints, v.weight);
  };
  for (let t = 0; t < indices.length; t += 3) {
    const v = [0, 1, 2].map((k) => vertex(indices[t + k], k, t));
    const m = [0, 1, 2].map((k) => {
      const mid = middle(v[k], v[(k + 1) % 3]);
      return mid.bulge > tolerance ? mid : null;
    });
    const split = m.filter(Boolean).length;
    if (split === 0) out(v[0], v[1], v[2]);
    else if (split === 3) out(v[0], m[0], m[2], m[0], v[1], m[1], m[2], m[1], v[2], m[0], m[1], m[2]);
    else {
      const r = split === 1 ? m.findIndex(Boolean) : m.findIndex((x) => !x);
      const [a, b, c] = [v[r], v[(r + 1) % 3], v[(r + 2) % 3]];
      const [mab, mbc] = [m[r], m[(r + 1) % 3]];
      if (split === 1) out(a, mab, c, mab, b, c);
      else {
        const [b2, c2, a2] = [b, c, a];
        const [mbc2, mca2] = [mbc, m[(r + 2) % 3]];
        out(b2, mbc2, mca2, mbc2, c2, mca2, b2, mca2, a2);
      }
    }
  }
}

const dotTo = (to, from, n) => (to[0] - from[0]) * n[0] + (to[1] - from[1]) * n[1] + (to[2] - from[2]) * n[2];
