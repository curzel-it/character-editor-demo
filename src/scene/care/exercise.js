import { makeRng } from "../../rng.js";
import { palette } from "../../palette.js";

const LENGTH = 4.2,
  UP = 0.75,
  DOWN = 2.25,
  LAND = 2.45,
  PUFF = 0,
  STREAK = 2;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const rise = (since, from, to) => {
  const t = clamp01((since - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const bump = (since, from, to) => (since > from && since < to ? Math.sin((Math.PI * (since - from)) / (to - from)) : 0);
const flight = (since) => rise(since, UP - 0.15, UP + 0.3) * (1 - rise(since, DOWN - 0.2, LAND));

/** Seconds into the reaction when the dragon thumps back down. */
export const exerciseLanding = LAND;

const random = makeRng("care:exercise");
const gusts = Array.from({ length: 22 }, (_, i) => ({ at: UP + 0.1 + i * 0.065, angle: random() * Math.PI * 2, reach: 0.6 + 0.5 * random(), life: 0.7 + 0.3 * random(), scale: 0.13 + 0.08 * random() }));
const landing = Array.from({ length: 16 }, (_, i) => ({ at: LAND - 0.05 + 0.06 * random(), angle: (i / 16) * Math.PI * 2 + 0.3 * random(), reach: 0.9 + 0.5 * random(), life: 0.8 + 0.4 * random(), scale: 0.16 + 0.1 * random() }));
const streaks = Array.from({ length: 18 }, (_, i) => ({ at: UP + 0.1 + i * 0.075, angle: i * 2.4 + random(), tilt: 0.25 + 0.6 * random() }));
const drops = Array.from({ length: 16 }, (_, i) => ({ at: LAND + 0.1 + i * 0.09, angle: i * 2.4 + random(), out: 0.5 + 0.4 * random(), up: 0.8 + 0.5 * random() }));

/** A dust puff `p` blown out along the ground from under the dragon. */
function puff(out, since, p, centre, size, ground, color) {
  const u = (since - p.at) / p.life;
  if (u <= 0 || u >= 1) return;
  const spread = 1 - (1 - u) ** 2;
  const at = [centre[0] + Math.cos(p.angle) * p.reach * size * spread, ground + 0.05 * size + 0.18 * size * u, centre[2] + Math.sin(p.angle) * p.reach * size * spread];
  const alpha = 0.9 * clamp01(u * 8) * (1 - u) ** 1.5;
  out.quad(at, at, p.scale * size * (0.6 + 0.8 * u), [...color, alpha, 0], PUFF, p.angle + u);
}

/**
 * How a dragon reacts to Exercise, and how the keeper's hand gives it: the keeper raises a training
 * flag and waves it briskly, the dragon crouches and beats its wings hard, lifting off the ground in
 * a whirl of dust and effort lines, drops back with a thump that throws a ring of dust, and pants proudly
 * with drops of sweat flying off it.
 */
export const exercise = {
  length: LENGTH,
  hand(since) {
    const reach = rise(since, 0, 0.4) * (1 - rise(since, 2.4, 2.85));
    if (reach <= 0) return null;
    const wave = since > 0.4 ? Math.sin((2 * Math.PI * (since - 0.4)) / 0.42) * (1 - rise(since, 2.1, 2.5)) : 0;
    const high = rise(since, 0.25, 0.55);
    return { reach, item: "flag", at: [0.42 - 0.05 * wave, -0.96 + 0.1 * high], wrist: 0.35 + 0.25 * wave, twist: 0.55, curl: 0.78, thumb: 0.75, roll: 0.5 + 0.15 * wave };
  },
  motion(since) {
    const fly = flight(since);
    const beat = Math.sin(2 * Math.PI * (since - UP) * 1.6);
    const pant = rise(since, LAND + 0.1, LAND + 0.4) * (1 - rise(since, LENGTH - 0.5, LENGTH));
    return {
      impact: bump(since, 0.35, UP + 0.05) + bump(since, LAND - 0.12, LAND + 0.35),
      stand: 1 - 0.85 * fly,
      glide: 1 - fly,
      effort: 0.5 + 0.45 * fly,
      flare: 0.5 * fly,
      climb: 0.1 * fly,
      gasp: pant * (0.55 + 0.45 * Math.sin(2 * Math.PI * since * 2.6)),
      roar: 0.25 * fly,
      lift: fly * (0.2 + 0.04 * beat),
    };
  },
  particles(out, since, { centre, size, color }) {
    const ground = centre[1] - size;
    const dust = palette.careTools.exercise.dust;
    for (const p of gusts) puff(out, since, p, centre, size * (0.5 + 0.6 * flight(p.at + 0.2)), ground, dust);
    for (const p of landing) puff(out, since, p, centre, size, ground, dust);
    const lift = 0.2 * size * flight(since);
    for (const s of streaks) {
      const u = (since - s.at) / 0.3;
      if (u <= 0 || u >= 1) continue;
      const dir = [Math.cos(s.angle) * Math.cos(s.tilt), Math.sin(s.tilt), Math.sin(s.angle) * Math.cos(s.tilt)];
      const end = (r) => [0, 1, 2].map((k) => centre[k] + (k === 1 ? lift + 0.2 * size : 0) + dir[k] * r * size);
      const from = 0.8 + 0.45 * u;
      out.quad(end(from), end(from + 0.4), 0.05 * size, [...color, Math.sin(Math.PI * u), 0.6], STREAK);
    }
    for (const d of drops) {
      const u = (since - d.at) / 0.75;
      if (u <= 0 || u >= 1) continue;
      const at = (t) => [centre[0] + Math.cos(d.angle) * d.out * size * (0.3 + t), centre[1] + 0.5 * size + (d.up * t - 1.8 * t * t) * size, centre[2] + Math.sin(d.angle) * d.out * size * (0.3 + t)];
      out.quad(at(u - 0.12), at(u), 0.06 * size, [...color, clamp01(u * 8) * clamp01((1 - u) * 4), 0.6], STREAK);
    }
  },
};
