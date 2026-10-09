import { ceremonyPalette } from "../palette.js";
import { makeRng } from "../rng.js";
import { createBillboards } from "./billboards.js";

const SHARD = 1,
  GLINT = 3,
  FADE_IN = 0.6;

/**
 * Confetti falling over a box `{ centre, halfWidth, halfDepth, height }` from `start` seconds on,
 * as a pure function of time for the scene's `fireworks` slot: paper diamonds that flutter and
 * tumble down and loop, and a few glints around `sparkle` (the cup) when one is given.
 * `count` and `size` (metres) scale it with the dragons.
 */
export function createConfetti({ centre, halfWidth, halfDepth, height, size, count = 260, start = 0, seed = "confetti" }) {
  const random = makeRng(`${seed}:confetti`);
  const colors = ceremonyPalette.confetti;
  const pieces = Array.from({ length: count }, () => ({
    x: (random() * 2 - 1) * halfWidth,
    z: (random() * 2 - 1) * halfDepth,
    phase: random(),
    fall: 0.16 + random() * 0.1,
    sway: 0.4 + random() * 0.8,
    rate: 2 + random() * 4,
    spin: random() * Math.PI * 2,
    size: size * (0.7 + random() * 0.6),
    color: colors[Math.floor(random() * colors.length)],
  }));
  const glints = Array.from({ length: 6 }, () => ({ angle: random() * Math.PI * 2, rise: random(), rate: 0.7 + random() * 0.8 }));
  let sparkle = null;
  return {
    /** Where the cup is, `{ position, radius }`, for its glints; null hides them. */
    setSparkle(next) {
      sparkle = next;
    },
    build(time, eye) {
      const t = time - start;
      const out = createBillboards(eye);
      if (t <= 0) return out.result();
      const fade = Math.min(1, t / FADE_IN);
      for (const p of pieces) {
        const run = t * p.fall - p.phase * 0.6;
        if (run < 0) continue;
        const along = run % 1;
        const y = centre[1] + height * (1 - along);
        const sway = Math.sin(t * p.rate * 0.5 + p.spin) * p.sway * size * 2;
        const flutter = 0.35 + 0.65 * Math.abs(Math.cos(t * p.rate + p.spin));
        const at = [centre[0] + p.x + sway, y, centre[2] + p.z];
        const fadeOut = Math.min(1, (1 - along) * 8, along * 12);
        out.quad(at, at, p.size * flutter, [...p.color, fade * fadeOut, 0], SHARD, t * p.rate + p.spin);
      }
      if (sparkle)
        for (const g of glints) {
          const life = (t * g.rate + g.rise) % 1;
          const r = sparkle.radius * (0.6 + 0.5 * life);
          const at = [sparkle.position[0] + Math.cos(g.angle) * r, sparkle.position[1] + sparkle.radius * (life * 1.4 - 0.2), sparkle.position[2] + Math.sin(g.angle) * r];
          out.quad(at, at, sparkle.radius * 0.28 * Math.sin(life * Math.PI), [1, 0.95, 0.75, fade, 1], GLINT, g.angle);
        }
      return out.result();
    },
  };
}
