import { creatureScale as C, speedScale as V } from "../worldScale.js";
import { racerFrame } from "./racerFrame.js";

const TOP = 35 * V;
const FLOATS = 5;
let scratch = new Float32Array(0);
const smoothstep = (a, b, x) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/**
 * Wingtip vortex ribbons from each racer's recent path (`racer.trail`, newest first), facing the
 * eye. Vertices are position then (across, alpha); vapour thickens as racers approach top speed.
 */
export function buildTrailRibbons(racers, eye, strength) {
  let segments = 0;
  for (const r of racers) segments += Math.max(0, (r.trail?.length ?? 0) - 1) * 2;
  if (scratch.length < segments * 6 * FLOATS) scratch = new Float32Array(segments * 6 * FLOATS);
  let n = 0;
  const put = (p, across, alpha) => {
    scratch[n++] = p[0];
    scratch[n++] = p[1];
    scratch[n++] = p[2];
    scratch[n++] = across;
    scratch[n++] = alpha;
  };
  for (const r of racers) {
    const trail = r.trail;
    if (!trail || trail.length < 2) continue;
    const intensity = strength * (0.25 + 0.75 * smoothstep(0.6 * TOP, 0.98 * TOP, r.speed ?? TOP));
    if (intensity < 0.02) continue;
    const span = (r.anatomy?.bounds?.radius ?? 8) * 0.86;
    for (const side of [1, -1]) {
      const tips = trail.map((s) => {
        const { forward, left } = racerFrame(s.forward, s.bank ?? 0);
        return s.position.map((v, i) => v + left[i] * side * span - forward[i] * 0.2 * span);
      });
      const last = tips.length - 1;
      const edge = tips.map((p, k) => {
        const q = tips[Math.min(last, k + 1)],
          o = tips[Math.max(0, k - 1)];
        const d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]],
          e = [eye[0] - p[0], eye[1] - p[1], eye[2] - p[2]];
        const x = [d[1] * e[2] - d[2] * e[1], d[2] * e[0] - d[0] * e[2], d[0] * e[1] - d[1] * e[0]];
        const l = Math.hypot(...x) || 1;
        const age = k / last;
        const w = (0.12 + 0.55 * age) * C;
        return x.map((v) => (v / l) * w);
      });
      const alpha = (k) => intensity * (1 - k / last) ** 1.4 * (k === 0 ? 0 : 0.6);
      for (let k = 0; k < last; k++) {
        const a = tips[k],
          b = tips[k + 1],
          ea = edge[k],
          eb = edge[k + 1];
        const a0 = a.map((v, i) => v - ea[i]),
          a1 = a.map((v, i) => v + ea[i]),
          b0 = b.map((v, i) => v - eb[i]),
          b1 = b.map((v, i) => v + eb[i]);
        const fa = alpha(k),
          fb = alpha(k + 1);
        put(a0, -1, fa);
        put(b0, -1, fb);
        put(b1, 1, fb);
        put(a0, -1, fa);
        put(b1, 1, fb);
        put(a1, 1, fa);
      }
    }
  }
  return { data: scratch.subarray(0, n), count: n / FLOATS };
}
