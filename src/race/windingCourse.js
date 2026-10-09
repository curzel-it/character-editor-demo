import { makeRng } from "../rng.js";
import { lengthScale } from "../worldScale.js";
import { scaleCourse } from "./scaleCourse.js";

/**
 * Synthetic winding, climbing course that follows the course contract, for headless checks. It is
 * laid out at the reference scale and enlarged by `lengthScale`; `length` is in real metres.
 */
export function windingCourse(seed, { length = 2400 * lengthScale, gateCount = 12 } = {}) {
  const reference = Math.round(length / lengthScale / 10) * 10;
  return scaleCourse(referenceCourse(seed, reference, gateCount), lengthScale);
}

function referenceCourse(seed, length, gateCount) {
  const random = makeRng(`winding:${seed}`);
  const bends = Array.from({ length: 5 }, () => ({
    at: random() * length,
    width: 120 + random() * 200,
    rate: (random() - 0.5) * 0.02,
  }));
  const path = [];
  let x = 0,
    z = 0,
    heading = 0;
  for (let s = 0; s <= length; s += 10) {
    const kappa = bends.reduce(
      (k, b) => k + b.rate * Math.exp(-(((s - b.at) / b.width) ** 2)),
      0,
    );
    const ground = 20 + 25 * Math.sin(s / 400) + s * 0.01;
    path.push({
      s,
      position: [x, ground + 45, z],
      forward: [Math.cos(heading), 0, Math.sin(heading)],
      halfWidth: 38 + 14 * Math.sin(s / 170),
      floor: ground + 8,
      ceiling: ground + 95,
    });
    heading += kappa * 10;
    x += Math.cos(heading) * 10;
    z += Math.sin(heading) * 10;
  }
  const gates = Array.from({ length: gateCount }, (_, i) => {
    const s = Math.round(((i + 1) * length) / gateCount / 10) * 10;
    const p = path[s / 10];
    const left = [-p.forward[2], 0, p.forward[0]];
    const u = (random() - 0.5) * p.halfWidth,
      y = p.floor + 20 + random() * 40;
    return {
      index: i,
      s,
      position: [p.position[0] + left[0] * u, y, p.position[2] + left[2] * u],
      forward: p.forward,
      radius: 14,
    };
  });
  const grid = Array.from({ length: 12 }, (_, i) => ({
    position: [-(i % 2) * 12, path[0].position[1], (Math.floor(i / 2) - 2.5) * 10],
    forward: [1, 0, 0],
  }));
  const xs = path.map((p) => p.position[0]),
    zs = path.map((p) => p.position[2]);
  const origin = [Math.min(...xs) - 200, Math.min(...zs) - 200],
    cellSize = 20;
  const columns = Math.ceil((Math.max(...xs) + 200 - origin[0]) / cellSize) + 1,
    rows = Math.ceil((Math.max(...zs) + 200 - origin[1]) / cellSize) + 1;
  const heights = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const px = origin[0] + c * cellSize,
        pz = origin[1] + r * cellSize;
      let best = path[0],
        bestD = Infinity;
      for (const p of path) {
        const d = (p.position[0] - px) ** 2 + (p.position[2] - pz) ** 2;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      heights.push(best.floor - 10 + Math.sqrt(bestD) * 0.6);
    }
  const thermals = Array.from({ length: 4 }, () => {
    const p = path[Math.floor((0.15 + random() * 0.7) * (path.length - 1))];
    const left = [-p.forward[2], 0, p.forward[0]];
    const u = (random() - 0.5) * p.halfWidth;
    return {
      position: [p.position[0] + left[0] * u, p.floor, p.position[2] + left[2] * u],
      radius: 18 + random() * 12,
      lift: 3 + random() * 3,
    };
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
