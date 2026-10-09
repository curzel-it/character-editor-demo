import { makeRng } from "../../rng.js";

const LENGTH = 1.8,
  GLINT = 3,
  ORB = 4,
  PIECES = 26;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const bump = (since, from, to) => (since > from && since < to ? Math.sin((Math.PI * (since - from)) / (to - from)) : 0);

const pieces = (() => {
  const random = makeRng("care:cheer");
  return Array.from({ length: PIECES }, (_, i) => ({
    angle: (i / PIECES) * Math.PI * 2 + random() * 0.6,
    reach: 0.35 + random() * 0.45,
    rise: 0.25 + random() * 0.55,
    delay: random() * 0.25,
    life: 0.9 + random() * 0.6,
    scale: 0.07 + random() * 0.06,
    spin: random() * Math.PI * 2,
    kind: i % 2 ? GLINT : ORB,
  }));
})();

/**
 * A dragon's delight, for reactions to build on: a quick crouch, a hop with the wings half open and
 * the mouth open, a smaller bounce, and a burst of glints and orbs in the action's colour rising off it.
 */
export const cheer = {
  length: LENGTH,
  /** Motion layered on the resting pose `since` seconds in, with `lift` the hop in body sizes. */
  motion(since) {
    const crouch = bump(since, 0, 0.32) + 0.6 * bump(since, 0.72, 0.92);
    const spread = bump(since, 0.18, 1.1);
    return {
      impact: crouch,
      stand: 1 - 0.45 * spread,
      roar: 0.7 * bump(since, 0.22, 0.95),
      lift: 0.16 * bump(since, 0.26, 0.76) + 0.05 * bump(since, 0.9, 1.15),
    };
  },
  /**
   * Draws the burst `since` seconds in into billboards `out`, around `centre` for
   * a dragon whose body measures about `size` metres, in `color`.
   */
  particles(out, since, { centre, size, color }) {
    for (const p of pieces) {
      const u = (since - 0.25 - p.delay) / p.life;
      if (u <= 0 || u >= 1) continue;
      const spread = 1 - (1 - u) ** 3;
      const at = [
        centre[0] + Math.cos(p.angle) * p.reach * size * spread,
        centre[1] + p.rise * size * (spread + 0.3 * u),
        centre[2] + Math.sin(p.angle) * p.reach * size * spread,
      ];
      const alpha = clamp01(u * 10) * clamp01((1 - u) * 3);
      const width = p.scale * size * (p.kind === GLINT ? 1 + 0.4 * Math.sin(since * 14 + p.spin) : 0.8);
      out.quad(at, at, width, [...color, alpha, p.kind === GLINT ? 0.6 : 0.2], p.kind, p.spin + since * 2);
    }
  },
};
