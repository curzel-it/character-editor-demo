import { eggProfile } from "../eggMesh.js";
import { orientation, point } from "../math3d.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * The smooth shell of an egg standing in the yard as `anatomy` (`groundEgg`), in the egg's own frame:
 * x ahead, y up, z to its left, the origin at its centre. A shell point is named by its polar angle `a`
 * from the top and its azimuth `b`; `racer` is the egg as posed in the scene.
 */
export function eggShell(anatomy) {
  const scale = anatomy.bounds.radius / eggProfile.height;
  const height = eggProfile.height * scale;
  const frame = (racer) => orientation(racer.position, racer.forward, racer.bank ?? 0);
  const ringRadius = (y) => eggProfile.radius(Math.acos(clamp(y / height, -1, 1))) * scale;
  const inside = (p) => Math.abs(p[1]) <= height && Math.hypot(p[0], p[2]) <= ringRadius(p[1]);
  /** Direction `d` of the world carried into the egg's frame. */
  const turned = (m, d) => [0, 1, 2].map((c) => m[4 * c] * d[0] + m[4 * c + 1] * d[1] + m[4 * c + 2] * d[2]);

  /** The shell point at `a`, `b`, pushed out by `lift` of the egg's size. */
  const at = (a, b, lift = 0) => {
    const r = eggProfile.radius(a) * scale + lift * height;
    return [Math.cos(b) * r, Math.cos(a) * (height + lift * height), Math.sin(b) * r];
  };

  return {
    /** Half the egg's height, in metres. */
    size: height,
    at,
    /** The `[a, b]` of local point `p`. */
    angles: (p) => [Math.acos(clamp(p[1] / height, -1, 1)), Math.atan2(p[2], p[0])],
    /** Local point `p` of the egg in the world. */
    toWorld: (racer, p) => point(frame(racer), p),
    /** World point `w` in the egg's frame. */
    toLocal(racer, w) {
      const m = frame(racer);
      return turned(m, [0, 1, 2].map((k) => w[k] - m[12 + k]));
    },
    /** The `[a, b]` of the first shell point on the ray from world `origin` along `dir`, or null when it misses. */
    hit(racer, origin, dir) {
      const m = frame(racer);
      const o = turned(m, [0, 1, 2].map((k) => origin[k] - m[12 + k]));
      const n = Math.hypot(...dir) || 1;
      const d = turned(m, dir.map((v) => v / n));
      const along = (t) => o.map((v, k) => v + d[k] * t);
      const from = Math.max(0, Math.hypot(...o) - 2 * height),
        to = Math.hypot(...o) + 2 * height,
        step = height / 30;
      for (let t = from; t < to; t += step) {
        if (!inside(along(t))) continue;
        let lo = t - step,
          hi = t;
        for (let i = 0; i < 8; i++) {
          const mid = (lo + hi) / 2;
          if (inside(along(mid))) hi = mid;
          else lo = mid;
        }
        const p = along(hi);
        return [Math.acos(clamp(p[1] / height, -1, 1)), Math.atan2(p[2], p[0])];
      }
      return null;
    },
  };
}
