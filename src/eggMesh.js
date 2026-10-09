import { makeRng } from "./rng.js";
import { tint } from "./palette.js";

const segments = 10;
const rings = 8;
const height = 1.3;
const spotShare = 0.22;

/** The shell radius at polar angle `a` from the top: narrower above the middle, fuller below. */
const radius = (a) => Math.sin(a) * (1 - 0.14 * Math.cos(a));

/** The smooth shell the facets are cut from: the ring at polar angle `a` sits at `height * cos(a)` with `radius(a)`. */
export const eggProfile = { height, radius };

/**
 * A faceted egg as a one-bone anatomy the dragon renderer draws. `shell` and `spots` are RGB;
 * `seed` places the speckles and the slight shade differences between facets.
 * @param {{ shell: number[], spots: number[], seed: string }} look
 */
export function eggAnatomy({ shell, spots, seed }) {
  const rng = makeRng(`egg:${seed}`);
  const top = [0, height, 0],
    bottom = [0, -height, 0];
  const grid = [];
  for (let j = 1; j < rings; j++) {
    const a = (Math.PI * j) / rings;
    grid.push(
      Array.from({ length: segments }, (_, i) => {
        const b = (Math.PI * 2 * (i + (j % 2) * 0.5)) / segments;
        return [Math.cos(b) * radius(a), Math.cos(a) * height, Math.sin(b) * radius(a)];
      }),
    );
  }
  const triangles = [];
  for (let i = 0; i < segments; i++) {
    const n = (i + 1) % segments;
    triangles.push([top, grid[0][n], grid[0][i]]);
    triangles.push([bottom, grid[rings - 2][i], grid[rings - 2][n]]);
  }
  for (let j = 0; j < rings - 2; j++) {
    const upper = grid[j],
      lower = grid[j + 1];
    for (let i = 0; i < segments; i++) {
      const n = (i + 1) % segments;
      if (j % 2) {
        triangles.push([upper[i], upper[n], lower[i]]);
        triangles.push([lower[i], upper[n], lower[n]]);
      } else {
        triangles.push([upper[i], upper[n], lower[n]]);
        triangles.push([upper[i], lower[n], lower[i]]);
      }
    }
  }
  const vertices = [],
    colors = [];
  for (const triangle of triangles) {
    const color = tint(rng() < spotShare ? spots : shell, 0.96 + rng() * 0.08);
    for (const corner of triangle) {
      vertices.push(...corner);
      colors.push(...color);
    }
  }
  return {
    bones: [{ id: "egg", position: [0, 0, 0] }],
    parts: [{ bone: "egg", shape: "mesh", vertices, indices: Array.from({ length: vertices.length / 3 }, (_, i) => i), colors }],
    bounds: { center: [0, 0, 0], radius: height },
  };
}
