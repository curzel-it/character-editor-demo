import { makeRng } from "../../rng.js";
import { groomHeartAnatomy } from "./groomHeart.js";

const LENGTH = 4.2,
  STROKES = 3,
  STROKE_FROM = 0.6,
  STROKE = 0.9,
  ORB = 4,
  GLINT = 3;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const rise = (since, from, to) => {
  const t = clamp01((since - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const strokesEnd = STROKE_FROM + STROKES * STROKE;

/** Where the comb is along its stroke `since` seconds in: 0 at the top, 1 at the bottom, and how far it is lifted off. */
function stroke(since) {
  if (since <= STROKE_FROM || since >= strokesEnd) return { along: 0, lift: 0 };
  const p = ((since - STROKE_FROM) / STROKE) % 1;
  if (p < 0.7) return { along: rise(p, 0, 0.7), lift: 0 };
  const back = rise(p, 0.7, 1);
  return { along: 1 - back, lift: Math.sin(Math.PI * back) };
}

/** How far the dragon has settled into the grooming, 0..1. */
const settle = (since) => rise(since, 0.4, 1.4) * (1 - rise(since, 3.4, 4.1));

const hearts = (() => {
  const random = makeRng("care:groom:hearts");
  return Array.from({ length: 5 }, (_, i) => ({
    at: 1.1 + i * 0.5 + random() * 0.15,
    life: 1.2 + random() * 0.2,
    across: 0.15 + random() * 0.35,
    sway: random() * Math.PI * 2,
    scale: 0.2 + random() * 0.06,
  }));
})();

const motes = (() => {
  const random = makeRng("care:groom:motes");
  return Array.from({ length: 14 }, (_, i) => ({
    at: 0.8 + random() * 2.6,
    life: 1.1 + random() * 0.6,
    angle: random() * Math.PI * 2,
    reach: 0.2 + random() * 0.35,
    rise: 0.35 + random() * 0.4,
    scale: 0.035 + random() * 0.03,
    spin: random() * Math.PI * 2,
    kind: i % 4 ? ORB : GLINT,
  }));
})();

/**
 * How a dragon reacts to Groom, and how the keeper's hand gives it: the hand runs the horn comb
 * in three long, slow strokes down its neck while the dragon settles into a crouch, turns its head
 * to the keeper and lowers it into each stroke, mouth eased open, and a few hearts float up from its head.
 * `breathTarget` is in the dragon's model frame, +Z towards the yard camera.
 */
export const groom = {
  length: LENGTH,
  hand(since) {
    const reach = rise(since, 0, 0.6) * (1 - rise(since, strokesEnd + 0.1, strokesEnd + 0.6));
    if (reach <= 0) return null;
    const { along, lift } = stroke(since);
    const at = [0.72 - 0.3 * along, -0.55 - 0.32 * along + 0.12 * lift];
    return { reach, item: "comb", at, wrist: 0.25 - 0.45 * along + 0.2 * lift, twist: -1, curl: 0.78, thumb: 0.75, roll: -0.15 - 0.2 * along };
  },
  motion(since) {
    const k = settle(since);
    const { along } = stroke(since);
    return {
      stand: 1,
      crouch: 0.7 * k,
      gasp: 0.2 * k,
      breathTarget: [4 + 1.5 * along, 1.5 - 1.5 * along, 10],
    };
  },
  particles(out, since, { centre, size, color }) {
    for (const m of motes) {
      const u = (since - m.at) / m.life;
      if (u <= 0 || u >= 1) continue;
      const at = [
        centre[0] + Math.cos(m.angle) * m.reach * size * (0.6 + 0.4 * u),
        centre[1] + m.rise * size * u,
        centre[2] + Math.sin(m.angle) * m.reach * size * (0.6 + 0.4 * u),
      ];
      const alpha = 0.8 * clamp01(u * 5) * clamp01((1 - u) * 2.5);
      out.quad(at, at, m.scale * size, [...color, alpha, m.kind === GLINT ? 0.5 : 0.15], m.kind, m.spin + since);
    }
  },
  objects(since, view) {
    const { dragon, ahead, right } = view;
    const head = dragon.bone("head");
    const facing = ahead.map((v) => -v);
    const list = [];
    for (const h of hearts) {
      const u = (since - h.at) / h.life;
      if (u <= 0 || u >= 1) continue;
      const grow = u < 0.25 ? Math.sin((Math.PI / 2) * (u / 0.25)) * (1 + 0.15 * Math.sin(Math.PI * (u / 0.25))) : 1;
      const scale = h.scale * dragon.size * grow * (1 - rise(u, 0.75, 1));
      const drift = (h.across + 0.12 * Math.sin(2 * Math.PI * u + h.sway)) * dragon.size;
      const position = [0, 1, 2].map((n) => head[n] + right[n] * drift + (n === 1 ? (0.15 + 0.45 * u) * dragon.size : 0));
      const turn = 0.5 * Math.sin(Math.PI * u * 1.5 + h.sway);
      const forward = facing.map((v, n) => v * Math.cos(turn) + right[n] * Math.sin(turn));
      list.push({ anatomy: groomHeartAnatomy(), pose: { bones: { prop: { scale } } }, position, forward, bank: 0.25 * Math.sin(2 * Math.PI * u + h.sway) });
    }
    return list;
  },
};
