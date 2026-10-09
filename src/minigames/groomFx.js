import { palette } from "../palette.js";
import { groomHeartAnatomy } from "../scene/care/groomHeart.js";

const PUFF = 0,
  GLINT = 3,
  ORB = 4,
  MOTE_LIFE = 1.1,
  HEART_LIFE = 1.4,
  PUFF_LIFE = 0.9,
  GLINT_LIFE = 0.7;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * What the Groom minigame shows around the dragon: motes and small hearts rising off the hand while
 * it purrs, a burst of hearts and glints over a spot scratched to bliss and the puffs it snorts. Sizes
 * are in `size`, the dragon's head length.
 */
export function createGroomFx(size) {
  const motes = [],
    hearts = [],
    puffs = [],
    glints = [];
  let seed = 7,
    nextPurr = 0;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const jitter = (at, r) => at.map((v) => v + (random() - 0.5) * r);

  return {
    /** The dragon purring under the hand at `at`, warmer the higher `heat` (0..1). */
    purr(at, heat, time) {
      if (time < nextPurr) return;
      nextPurr = time + 0.5 - 0.3 * heat;
      motes.push({ born: time, at: jitter(at, 0.3 * size), rise: (0.3 + 0.3 * random()) * size, size: (0.04 + 0.03 * random()) * size, spin: random() * 6 });
      if (heat > 0.6 && random() < heat) hearts.push({ born: time, at: jitter(at, 0.2 * size), rise: 0.6 * size, scale: (0.1 + 0.04 * random()) * size, sway: random() * 6 });
    },
    /** Hearts and glints bursting off a spot at `at` scratched to bliss. */
    burst(at, time) {
      for (let n = 0; n < 5; n++) hearts.push({ born: time + 0.08 * n, at: jitter(at, 0.4 * size), rise: (0.9 + 0.4 * random()) * size, scale: (0.17 + 0.06 * random()) * size, sway: random() * 6 });
      for (let n = 0; n < 6; n++) glints.push({ born: time + 0.05 * n, at: jitter(at, 0.6 * size), size: (0.12 + 0.06 * random()) * size, spin: random() * Math.PI });
    },
    /** A snort from the nose at `at`, blowing along `ahead`. */
    snort(at, ahead, time) {
      for (let n = 0; n < 7; n++) puffs.push({ born: time + 0.03 * n, at: jitter(at, 0.1 * size), v: ahead.map((v, k) => (v * (0.8 + 0.6 * random()) + (random() - 0.5) * 0.5 - (k === 1 ? 0.2 : 0)) * size), size: (0.14 + 0.1 * random()) * size, spin: random() * 6 });
    },
    /** Draws the motes, glints and puffs into billboards `out` at `time`. */
    draw(out, time) {
      const keep = (list, life) => list.splice(0, list.length, ...list.filter((p) => time - p.born < life));
      keep(motes, MOTE_LIFE);
      keep(puffs, PUFF_LIFE);
      keep(glints, GLINT_LIFE + 0.4);
      const glow = palette.care.groom;
      for (const m of motes) {
        const u = (time - m.born) / MOTE_LIFE;
        const at = [m.at[0], m.at[1] + m.rise * u, m.at[2]];
        out.quad(at, at, m.size, [...glow, 0.8 * clamp01(u * 5) * clamp01((1 - u) * 2.5), 0.15], ORB, m.spin + time);
      }
      for (const g of glints) {
        const u = (time - g.born) / GLINT_LIFE;
        if (u <= 0 || u >= 1) continue;
        out.quad(g.at, g.at, g.size * Math.sin(Math.PI * u), [...glow, 1, 0.8], GLINT, g.spin + 2 * u);
      }
      for (const p of puffs) {
        const age = time - p.born;
        if (age <= 0) continue;
        const u = age / PUFF_LIFE,
          drift = 1 - Math.exp(-3 * age);
        const at = p.at.map((v, k) => v + (p.v[k] * drift) / 3);
        out.quad(at, at, p.size * (0.5 + u), [...palette.snort, 0.7 * (1 - u), 0.2], PUFF, p.spin + u);
      }
    },
    /** The hearts as props for the scene, facing `view`'s camera, at `time`. */
    hearts(view, time) {
      hearts.splice(0, hearts.length, ...hearts.filter((h) => time - h.born < HEART_LIFE));
      const facing = view.ahead.map((v) => -v);
      return hearts
        .filter((h) => time > h.born)
        .map((h) => {
          const u = (time - h.born) / HEART_LIFE;
          const grow = Math.min(1, u / 0.2) * (1 - clamp01((u - 0.75) / 0.25));
          const drift = 0.15 * size * Math.sin(2 * Math.PI * u + h.sway);
          const position = h.at.map((v, k) => v + view.right[k] * drift + (k === 1 ? h.rise * u : 0));
          const turn = 0.5 * Math.sin(Math.PI * u * 1.5 + h.sway);
          const forward = facing.map((v, k) => v * Math.cos(turn) + view.right[k] * Math.sin(turn));
          return { anatomy: groomHeartAnatomy(), pose: { bones: { prop: { scale: h.scale * grow } } }, position, forward, bank: 0.25 * Math.sin(2 * Math.PI * u + h.sway) };
        });
    },
  };
}
