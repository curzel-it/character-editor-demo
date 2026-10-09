import { makeRng } from "../rng.js";
import { createBillboards } from "./billboards.js";

const COUNT = 70,
  PUFF = 0,
  GREY = [0.64, 0.62, 0.74];

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The mist that rises off an empty altar when a ritual fails: soft grey puffs, tinted by `hue`,
 * welling up from `altar` (its top) from `from` seconds and spreading, sinking and thinning away.
 * `build(t, eye)` returns breath-shader quads, a pure function of `seed` and `t`.
 */
export function createAltarMist({ altar, from, seed, hue = GREY }) {
  const random = makeRng(`${seed}:mist`);
  const tint = GREY.map((v, k) => v * 0.8 + hue[k] * 0.2);
  const puffs = Array.from({ length: COUNT }, () => {
    const a = random() * Math.PI * 2,
      r = 0.2 + random() * 0.9;
    return {
      born: from - 0.2 + random() * 2.2,
      life: 3.2 + random() * 2.4,
      at: [altar[0] + Math.cos(a) * r, altar[1] + 0.1 + random() * 0.5, altar[2] + Math.sin(a) * r],
      drift: [Math.cos(a) * (0.25 + random() * 0.45), 0.35 + random() * 0.3, Math.sin(a) * (0.25 + random() * 0.45)],
      size: 0.5 + random() * 0.5,
      spin: random() * 6.28,
      shade: 0.85 + random() * 0.25,
    };
  });

  function build(t, eye) {
    const q = createBillboards(eye);
    for (const p of puffs) {
      const age = t - p.born;
      if (age < 0 || age > p.life) continue;
      const k = age / p.life;
      const rise = (p.drift[1] * (1 - Math.exp(-age * 1.2))) / 1.2 - 0.04 * age * age;
      const at = [p.at[0] + p.drift[0] * age, p.at[1] + rise, p.at[2] + p.drift[2] * age];
      const alpha = 0.24 * smooth(0, 0.18, k) * (1 - smooth(0.45, 1, k));
      q.quad(at, at, p.size * (1 + 1.6 * k), [...tint.map((v) => v * p.shade), alpha, 0], PUFF, p.spin + age * 0.2);
    }
    return q.result();
  }

  return { build };
}
