import { makeRng } from "../../rng.js";
import { add, scale } from "../../vec3.js";
import { cheer } from "./cheer.js";
import { crumbAnatomies, meatAnatomy } from "./feedMeat.js";
import { arc, heldMeat, mouthOf } from "./feedToss.js";

const RELEASE = 0.95,
  CATCH = 1.45,
  CHEW = 1.58,
  GULP = 2.3,
  DELIGHT = 2.6,
  SWALLOW = 0.22,
  CRUMB_LIFE = 0.55,
  GLINT = 3,
  ORB = 4;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const rise = (since, from, to) => {
  const t = clamp01((since - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const bump = (since, from, to) => (since > from && since < to ? Math.sin((Math.PI * (since - from)) / (to - from)) : 0);

const crumbs = (() => {
  const random = makeRng("care:feed:crumbs");
  return Array.from({ length: 7 }, (_, i) => ({
    anatomy: crumbAnatomies[i % 2],
    out: [random() - 0.5, 0.4 + random() * 0.6, random() - 0.5],
    speed: 0.5 + random() * 0.6,
    scale: 0.06 + random() * 0.04,
    spin: [random() * 6, random() * 6, random() * 6],
    delay: random() * 0.12,
  }));
})();

const glints = (() => {
  const random = makeRng("care:feed:glints");
  return Array.from({ length: 10 }, (_, i) => ({
    angle: (i / 10) * Math.PI * 2 + random() * 0.5,
    reach: 0.25 + random() * 0.3,
    rise: 0.45 + random() * 0.45,
    delay: random() * 0.5,
    life: 0.9 + random() * 0.5,
    scale: 0.07 + random() * 0.05,
    spin: random() * Math.PI * 2,
    kind: i % 3 ? GLINT : ORB,
  }));
})();

/** The keeper's fist holding the drumstick up: it bobs it to tease, cocks back and flicks it up towards the dragon. */
function holding(since) {
  const tease = bump(since, 0.4, 0.75);
  const cock = rise(since, 0.62, 0.85) * (1 - rise(since, 0.85, RELEASE));
  const flick = rise(since, 0.85, RELEASE + 0.08);
  const at = [0.35 + 0.12 * flick - 0.04 * cock, -0.7 - 0.06 * tease - 0.12 * cock + 0.2 * flick];
  return { at, wrist: 0.15 + 0.12 * tease - 0.55 * cock + 0.5 * flick, twist: -1, curl: 0.78, thumb: 0.75, roll: -0.25 };
}

/** The keeper's hand: it rises with a drumstick, throws it and drops away open. */
function hand(since) {
  const reach = rise(since, 0, 0.45) * (1 - rise(since, 1.02, 1.45));
  if (reach <= 0) return null;
  const pose = { ...holding(since), reach };
  if (since < RELEASE) return { ...pose, item: "drumstick" };
  const open = rise(since, RELEASE, RELEASE + 0.12);
  return { ...pose, wrist: pose.wrist - 0.2 * open, twist: -1 + 0.6 * open, curl: 0.78 - 0.68 * open, thumb: 0.75 - 0.6 * open, spread: 0.3 * open };
}

/** The drumstick in flight from the hand to the dragon's mouth, tumbling and growing a little so it reads at any age, then gone down in the jaws. */
function meat(since, view) {
  if (since < RELEASE || since >= CATCH + SWALLOW) return null;
  const release = holding(RELEASE);
  const from = heldMeat(view, release);
  const u = Math.min(1, (since - RELEASE) / (CATCH - RELEASE));
  const down = clamp01((since - CATCH) / SWALLOW);
  const to = add(mouthOf(view), scale(view.dragon.forward, -0.12 * down * view.dragon.size));
  const { position, t } = arc(from.centre, to, u, 0.07, view);
  const grow = 1 + Math.max(0, (0.22 * view.dragon.size) / 0.14 - 1) * t;
  const turn = 9 * (Math.min(since, CATCH) - RELEASE);
  return {
    anatomy: meatAnatomy,
    pose: { bones: { hand: { rotation: [release.twist + 0.4 * turn, 0, release.wrist + turn], scale: grow * (1 - down * down) } } },
    position,
    forward: from.forward,
    bank: from.bank,
  };
}

/** Crumbs knocked off as the jaws close, falling away from the mouth. */
function crumbsAt(since, view) {
  const mouth = mouthOf(view);
  const { size } = view.dragon;
  return crumbs.flatMap((c) => {
    const t = since - CATCH - c.delay;
    if (t <= 0 || t >= CRUMB_LIFE) return [];
    const drift = add(scale(c.out, c.speed * size * t), [0, -2.4 * size * t * t, 0]);
    return [{
      anatomy: c.anatomy,
      pose: { bones: { hand: { rotation: c.spin.map((s) => s * t), scale: c.scale * size * (1 - (t / CRUMB_LIFE) ** 2) } } },
      position: add(mouth, drift),
      forward: view.dragon.forward,
      bank: 0,
    }];
  });
}

/**
 * How a dragon reacts to Feed: the keeper teases it with a drumstick and tosses it up in an arc; the
 * dragon gapes, snaps it out of the air in a spray of crumbs, chews, gulps it down and hops for joy
 * in a few warm glints.
 */
export const feed = {
  length: DELIGHT + cheer.length,
  hand,
  motion(since) {
    const eager = rise(since, 0.2, 0.6) * (1 - rise(since, RELEASE, CATCH));
    const gape = rise(since, RELEASE - 0.1, CATCH - 0.08) * (1 - rise(since, CATCH - 0.03, CATCH + 0.05));
    const chew = since > CHEW && since < GULP ? 0.5 - 0.5 * Math.cos((2 * Math.PI * (since - CHEW)) / 0.24) : 0;
    const gulp = bump(since, GULP, DELIGHT + 0.05);
    const hop = cheer.motion(since - DELIGHT);
    return {
      ...hop,
      roar: Math.max(hop.roar, 0.15 * eager + 0.75 * gape + 0.16 * chew),
      impact: hop.impact + 0.25 * bump(since, 0.4, 0.9) + 0.45 * bump(since, CATCH - 0.02, CATCH + 0.22) + 0.08 * chew,
      gasp: gulp,
      breathPitch: 0.3 * gulp - 0.08 * chew,
      stand: hop.stand - 0.12 * gape,
    };
  },
  particles(out, since, { centre, size, color }) {
    for (const g of glints) {
      const u = (since - DELIGHT - 0.1 - g.delay) / g.life;
      if (u <= 0 || u >= 1) continue;
      const at = [centre[0] + Math.cos(g.angle) * g.reach * size, centre[1] + size * (0.2 + g.rise * u), centre[2] + Math.sin(g.angle) * g.reach * size];
      const alpha = clamp01(u * 8) * clamp01((1 - u) * 3);
      const width = g.scale * size * (g.kind === GLINT ? 1 + 0.4 * Math.sin(since * 12 + g.spin) : 0.7);
      out.quad(at, at, width, [...color, alpha, g.kind === GLINT ? 0.7 : 0.25], g.kind, g.spin + since * 1.5);
    }
  },
  objects(since, view) {
    const thrown = meat(since, view);
    return [...(thrown ? [thrown] : []), ...crumbsAt(since, view)];
  },
};
