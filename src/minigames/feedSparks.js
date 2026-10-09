import { makeRng } from "../rng.js";
import { palette } from "../palette.js";
import { crumbAnatomies } from "../scene/care/feedMeat.js";

const GLINT = 3,
  ORB = 4,
  CRUMB_LIFE = 0.55,
  GLINT_LIFE = 0.9,
  STARS = 5,
  STAR_LIFE = 1.3;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

const crumbs = (() => {
  const random = makeRng("minigame:feed:crumbs");
  return Array.from({ length: 6 }, (_, i) => ({
    anatomy: crumbAnatomies[i % 2],
    out: [random() - 0.5, 0.4 + random() * 0.6, random() - 0.5],
    speed: 0.4 + random() * 0.5,
    scale: 0.05 + random() * 0.04,
    spin: [random() * 6, random() * 6, random() * 6],
    delay: random() * 0.1,
  }));
})();

const glints = (() => {
  const random = makeRng("minigame:feed:glints");
  return Array.from({ length: 8 }, (_, i) => ({
    angle: (i / 8) * Math.PI * 2 + random() * 0.5,
    reach: 0.15 + random() * 0.2,
    rise: 0.2 + random() * 0.35,
    delay: random() * 0.15,
    scale: 0.05 + random() * 0.04,
    spin: random() * Math.PI * 2,
    kind: i % 3 ? GLINT : ORB,
  }));
})();

/**
 * What the Feed minigame scatters: crumbs knocked off a bite, warm glints over a catch and stars
 * circling a bonked head. Each burst is `{ kind, at, size }` started at `time`, `at` its world point
 * (a function of the time for stars, which follow the head), `size` the dragon's.
 */
export function createFeedSparks() {
  /** @type {{ kind: "crumbs" | "glints" | "stars", time: number, at: any, size: number }[]} */
  const bursts = [];

  return {
    /** Starts a burst of `kind` at `at` (stars take a function of the time) for a dragon of `size`. */
    burst(kind, time, at, size) {
      bursts.push({ kind, time, at, size });
    },
    /** Drops the bursts that are over by `time`. */
    update(time) {
      bursts.splice(0, bursts.length, ...bursts.filter((b) => time - b.time < STAR_LIFE + 0.2));
    },
    /** The crumbs in flight at `time`, as scene objects. */
    objects(time, forward) {
      return bursts
        .filter((b) => b.kind === "crumbs")
        .flatMap((b) =>
          crumbs.flatMap((c) => {
            const t = time - b.time - c.delay;
            if (t <= 0 || t >= CRUMB_LIFE) return [];
            const position = b.at.map((v, k) => v + c.out[k] * c.speed * b.size * t - (k === 1 ? 2.4 * b.size * t * t : 0));
            return [{ anatomy: c.anatomy, pose: { bones: { hand: { rotation: c.spin.map((s) => s * t), scale: c.scale * b.size * (1 - (t / CRUMB_LIFE) ** 2) } } }, position, forward, bank: 0 }];
          }),
        );
    },
    /** Draws the glints and stars into billboards `out` at `time`. */
    draw(out, time) {
      const warm = palette.care.feed;
      for (const b of bursts) {
        const since = time - b.time;
        if (b.kind === "glints")
          for (const g of glints) {
            const u = (since - g.delay) / GLINT_LIFE;
            if (u <= 0 || u >= 1) continue;
            const at = [b.at[0] + Math.cos(g.angle) * g.reach * b.size, b.at[1] + b.size * g.rise * u, b.at[2] + Math.sin(g.angle) * g.reach * b.size];
            out.quad(at, at, g.scale * b.size * (g.kind === GLINT ? 1 + 0.4 * Math.sin(time * 12 + g.spin) : 0.7), [...warm, clamp01(u * 8) * clamp01((1 - u) * 3), g.kind === GLINT ? 0.7 : 0.25], g.kind, g.spin + time * 1.5);
          }
        if (b.kind === "stars") {
          const u = since / STAR_LIFE;
          if (u <= 0 || u >= 1) continue;
          const centre = b.at(time);
          for (let i = 0; i < STARS; i++) {
            const angle = (i / STARS) * Math.PI * 2 + 5 * since;
            const at = [centre[0] + Math.cos(angle) * 0.18 * b.size, centre[1] + 0.03 * b.size * Math.sin(3 * angle), centre[2] + Math.sin(angle) * 0.18 * b.size];
            out.quad(at, at, 0.06 * b.size, [...palette.hatchGlow, clamp01(u * 10) * clamp01((1 - u) * 4), 0.8], GLINT, angle);
          }
        }
      }
    },
  };
}
