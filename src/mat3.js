import { cross, dot, length, normalize, scale } from "./vec3.js";

/** 3x3 rotation, rows first, from a column-major 4x4 matrix. */
export const rotationOf = (m) => [0, 1, 2].map((r) => [0, 1, 2].map((c) => m[c * 4 + r]));
export const originOf = (m) => [m[12], m[13], m[14]];
export const apply = (R, v) => R.map((row) => dot(row, v));
export const transpose = (R) => [0, 1, 2].map((r) => [0, 1, 2].map((c) => R[c][r]));
export const times = (A, B) => A.map((row) => [0, 1, 2].map((c) => row[0] * B[0][c] + row[1] * B[1][c] + row[2] * B[2][c]));
export const columns = (a, b, c) => [0, 1, 2].map((r) => [a[r], b[r], c[r]]);
/** Euler [x, y, z] for `transform`, which composes Rz * Ry * Rx. */
export const euler = (R) => [Math.atan2(R[2][1], R[2][2]), Math.asin(Math.max(-1, Math.min(1, -R[2][0]))), Math.atan2(R[1][0], R[0][0])];
/** The rotation by `angle` radians about unit vector `axis`, by the right-hand rule. */
export const rotationAbout = ([x, y, z], angle) => {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    k = 1 - c;
  return [
    [c + k * x * x, k * x * y - s * z, k * x * z + s * y],
    [k * y * x + s * z, c + k * y * y, k * y * z - s * x],
    [k * z * x - s * y, k * z * y + s * x, c + k * z * z],
  ];
};
/** The smallest rotation taking unit vector `from` onto unit vector `to`. */
export const turning = (from, to) => {
  const n = cross(from, to),
    s = length(n);
  if (s < 1e-9) return columns([1, 0, 0], [0, 1, 0], [0, 0, 1]);
  return rotationAbout(scale(n, 1 / s), Math.atan2(s, dot(from, to)));
};
/** Orthonormal frame with x along `along` and y as close as possible to `toward`. */
export const frame = (along, toward) => {
  const x = normalize(along),
    z = normalize(cross(x, toward));
  return columns(x, cross(z, x), z);
};
