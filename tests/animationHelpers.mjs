import { boneMatrices, multiply, point } from "../src/math3d.js";
import { makeSkinMesh } from "../src/skinMesh.js";

const stride = 12;

/** Rest mesh with per-corner joints, grouped by part so tests can inspect wings and hide. */
export function restMesh(anatomy) {
  const { vertices, inverseBind } = makeSkinMesh(anatomy);
  const partOf = [];
  let corner = 0;
  const count = vertices.length / stride;
  const perPart = new Map();
  const trial = { ...anatomy };
  for (const part of anatomy.parts) {
    trial.parts = [part];
    const n = makeSkinMesh(trial).vertices.length / stride;
    perPart.set(part.id, [corner, corner + n]);
    for (let i = 0; i < n; i++) partOf.push(part.id);
    corner += n;
  }
  if (corner !== count) throw new Error("Mesh partition mismatch");
  return { vertices, inverseBind, perPart, count };
}

/** Posed world positions of every triangle corner. */
export function deformMesh(anatomy, mesh, pose) {
  const matrices = boneMatrices(anatomy, pose).map((matrix, index) =>
    multiply(matrix, mesh.inverseBind[index]),
  );
  const out = new Float64Array(mesh.count * 3);
  for (let i = 0; i < mesh.count; i++) {
    const o = i * stride,
      p = [mesh.vertices[o], mesh.vertices[o + 1], mesh.vertices[o + 2]];
    const a = point(matrices[mesh.vertices[o + 9]], p),
      b = point(matrices[mesh.vertices[o + 10]], p),
      w = mesh.vertices[o + 11];
    for (let axis = 0; axis < 3; axis++)
      out[i * 3 + axis] = a[axis] * w + b[axis] * (1 - w);
  }
  return out;
}

export function restPositions(mesh) {
  const out = new Float64Array(mesh.count * 3);
  for (let i = 0; i < mesh.count; i++)
    for (let axis = 0; axis < 3; axis++)
      out[i * 3 + axis] = mesh.vertices[i * stride + axis];
  return out;
}

/** Edge-length ratios between a posed and rest mesh, for the corner range of one part. */
export function stretch(rest, posed, [start, end]) {
  let low = Infinity,
    high = 0;
  for (let t = start; t < end; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = t + k,
        b = t + ((k + 1) % 3);
      const length = (p) =>
        Math.hypot(
          p[a * 3] - p[b * 3],
          p[a * 3 + 1] - p[b * 3 + 1],
          p[a * 3 + 2] - p[b * 3 + 2],
        );
      const r = length(rest);
      if (r < 1e-4) continue;
      const ratio = length(posed) / r;
      low = Math.min(low, ratio);
      high = Math.max(high, ratio);
    }
  return { low, high };
}
