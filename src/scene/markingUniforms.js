const NONE = [0, 0, 0, 0];

/**
 * Sets the racer shader's `markings` (kind, rest-pose units per reference unit, seed) and `markingColor` from an
 * anatomy's `markings`; anatomies without them go plain.
 * @param {WebGL2RenderingContext} gl
 * @param {Record<string, WebGLUniformLocation>} u
 * @param {{ markings?: { kind: number, color: number[], seed: number[] } | null, scale?: number }} anatomy
 */
export function setMarkings(gl, u, anatomy) {
  const markings = anatomy.markings;
  gl.uniform4fv(u.markings, markings ? [markings.kind, 1 / (anatomy.scale ?? 1), ...markings.seed] : NONE);
  if (markings) gl.uniform3fv(u.markingColor, markings.color);
}
