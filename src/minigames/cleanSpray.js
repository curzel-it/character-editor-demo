import { palette } from "../palette.js";

const HEX = 0,
  SHARD = 1,
  GLINT = 3,
  ORB = 4,
  BEAD = 5,
  JET = 6,
  GRAVITY = 2.6,
  BUBBLE_LIFE = 0.9,
  DROP_LIFE = 0.45,
  GLINT_LIFE = 0.6,
  STREAM = 22,
  LEAD = 0.45;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * The particles of the Clean minigame: lather bubbling off scrubbed mud, the hose's arcing stream
 * with its splash where it lands, and glints over rinsed skin.
 */
export function createCleanSpray() {
  const bubbles = [],
    drops = [],
    glints = [];
  let jet = null,
    seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const spread = (r) => [(random() - 0.5) * r, (random() - 0.5) * r, (random() - 0.5) * r];

  return {
    /** Bubbles welling up off a scrubbed spot at `at`, more for a bigger `amount` of wiggle. */
    lather(at, radius, time, amount) {
      for (let n = Math.min(4, Math.ceil(amount * 2)); n > 0; n--)
        bubbles.push({ born: time, at: at.map((v, k) => v + spread(1.2 * radius)[k]), rise: (0.4 + 0.6 * random()) * radius, size: (0.12 + 0.12 * random()) * radius });
    },
    /** A burst of glints over a spot rinsed clean. */
    sparkle(at, radius, time) {
      for (let n = 0; n < 5; n++) glints.push({ born: time + 0.06 * n, at: at.map((v, k) => v + spread(1.4 * radius)[k]), size: (0.35 + 0.2 * random()) * radius, spin: random() * Math.PI });
    },
    /** Moves the particles to `time`; `stream` ({ to, size }) is the water landing at `to`, or null. */
    update(view, time, stream) {
      jet = stream;
      if (stream)
        for (let n = 0; n < 3; n++) {
          const out = view.right.map((v, k) => v * (random() - 0.5) * 2 + view.up[k] * random() - view.ahead[k] * 0.6);
          drops.push({ born: time, at: stream.to, v: out.map((v) => v * stream.size * (2 + 2 * random())), size: (0.05 + 0.05 * random()) * stream.size, fall: GRAVITY * stream.size });
        }
      const keep = (list, life) => list.splice(0, list.length, ...list.filter((p) => time - p.born < life));
      keep(bubbles, BUBBLE_LIFE);
      keep(drops, DROP_LIFE);
      keep(glints, GLINT_LIFE + 0.4);
    },
    /** Draws them into billboards `out` at `time`, the stream leaving the nozzle at `tip` along `axis` while it runs. */
    draw(out, view, time, tip, axis) {
      const water = palette.careTools.clean.water,
        foam = palette.coat.foam;
      for (const b of bubbles) {
        const age = (time - b.born) / BUBBLE_LIFE;
        const at = [b.at[0], b.at[1] + b.rise * age, b.at[2]];
        const width = b.size * (0.5 + 0.5 * clamp01(age * 4));
        if (age < 0.85) {
          out.quad(at, at, width, [...foam, 0.55, 0.25], HEX, b.rise);
          out.quad(at, at, 0.4 * width, [...palette.sky, 1, 0.6], ORB, 0);
        } else out.quad(at, at, 1.6 * width, [...palette.sky, (1 - age) * 4, 0.5], SHARD, b.rise);
      }
      for (const d of drops) {
        const age = time - d.born;
        const at = (t) => d.at.map((v, k) => v + d.v[k] * t - (k === 1 ? 0.5 * d.fall * t * t : 0));
        out.quad(at(Math.max(0, age - 0.04)), at(age), d.size, [...water, clamp01((DROP_LIFE - age) * 5), 0.2], BEAD, 0);
      }
      for (const g of glints) {
        const age = (time - g.born) / GLINT_LIFE;
        if (age <= 0 || age >= 1) continue;
        out.quad(g.at, g.at, g.size * Math.sin(Math.PI * age), [...palette.sky.map((v, k) => (v + water[k]) / 2), 1, 0.8], GLINT, g.spin + 2 * age);
      }
      if (!tip || !jet) return;
      const length = Math.hypot(...jet.to.map((v, k) => v - tip[k]));
      const lead = tip.map((v, k) => v + (axis?.[k] ?? (jet.to[k] - v) / length) * LEAD * length);
      const along = (u) => tip.map((v, k) => (1 - u) * (1 - u) * v + 2 * u * (1 - u) * lead[k] + u * u * jet.to[k]);
      const us = Array.from({ length: STREAM + 1 }, (_, i) => i / STREAM);
      out.ribbon(us.map(along), us.map((u, i) => (0.014 + 0.01 * length * u) * (0.88 + 0.12 * Math.sin(40 * time - 9 * i))), [...water, 0.9, 0.2], JET);
      out.quad(jet.to, jet.to, 0.9 * jet.size, [...foam, 0.5, 0.3], HEX, 7 * time);
    },
  };
}
