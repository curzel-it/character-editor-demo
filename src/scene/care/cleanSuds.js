import { makeRng } from "../../rng.js";
import { palette } from "../../palette.js";
import { cleanBeats } from "./cleanBeats.js";

const HEX = 0,
  SHARD = 1,
  GLINT = 3,
  ORB = 4,
  STREAK = 2,
  GRAVITY = 2.6,
  POP = 0.14;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const [scrubFrom, scrubTo] = cleanBeats.scrub;
const [shakeFrom, shakeTo] = cleanBeats.shake;
const [shineFrom, shineTo] = cleanBeats.shine;

/** A direction around the body, mostly sideways and up, from two random numbers. */
const around = (u, v, up = 0.6) => {
  const angle = u * Math.PI * 2,
    y = up * (2 * v - 0.6);
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  return [Math.cos(angle) * r, y, Math.sin(angle) * r];
};

const bubbles = (() => {
  const random = makeRng("care:clean:bubbles");
  return Array.from({ length: 32 }, (_, i) => {
    const born = scrubFrom + 0.1 + (i / 32) * (scrubTo - scrubFrom + 0.2) + random() * 0.1;
    const life = 0.8 + random() * 0.6;
    return {
      born,
      end: Math.min(born + life, shakeFrom + 0.05 + random() * 0.25),
      from: around(random(), random(), 0.45),
      reach: 0.42 + random() * 0.25,
      rise: 0.3 + random() * 0.3,
      wobble: random() * Math.PI * 2,
      scale: 0.075 + random() * 0.06,
    };
  });
})();

const drops = (() => {
  const random = makeRng("care:clean:drops");
  return Array.from({ length: 46 }, (_, i) => ({
    born: shakeFrom + 0.1 + (i / 46) * (shakeTo - shakeFrom - 0.25) + random() * 0.05,
    life: 0.45 + random() * 0.3,
    from: around(random(), random(), 0.4),
    speed: 1.5 + random() * 1.1,
    up: 0.5 + random() * 0.8,
    swirl: (i % 2 ? 1 : -1) * (0.4 + random() * 0.5),
    scale: 0.02 + random() * 0.015,
    mist: i % 6 === 0,
  }));
})();

const glints = (() => {
  const random = makeRng("care:clean:glints");
  return Array.from({ length: 12 }, (_, i) => ({
    born: shineFrom + (i / 12) * (shineTo - shineFrom - 0.45),
    life: 0.4 + random() * 0.15,
    from: around(random(), random(), 0.8),
    reach: 0.3 + random() * 0.2,
    scale: 0.15 + random() * 0.08,
    spin: random() * Math.PI,
  }));
})();

const plus = (centre, dir, k, lift = 0) => [centre[0] + dir[0] * k, centre[1] + dir[1] * k + lift, centre[2] + dir[2] * k];

/** Soap bubbles welling up off the body as it is scrubbed, rising and popping, all at once as it shakes. */
function drawBubbles(out, since, { centre, size, color }) {
  for (const b of bubbles) {
    if (since < b.born || since > b.end + POP) continue;
    const age = Math.min(since, b.end) - b.born;
    const sway = 0.04 * size * Math.sin(b.wobble + 5 * age);
    const at = plus(centre, b.from, (b.reach + 0.05 * age) * size, b.rise * size * age - 0.25 * size);
    at[0] += sway;
    at[2] += sway;
    const grow = clamp01(age / 0.2);
    const width = b.scale * size * (0.4 + 0.6 * grow);
    if (since <= b.end) {
      out.quad(at, at, width, [...color, 0.5, 0.3], HEX, b.wobble);
      const shine = [at[0], at[1] + 0.45 * width, at[2]];
      out.quad(shine, shine, 0.45 * width, [...palette.sky, 1, 0.6], ORB, 0);
      continue;
    }
    const pop = (since - b.end) / POP;
    for (let k = 0; k < 5; k++) {
      const a = b.wobble + (k / 5) * Math.PI * 2;
      const p = [at[0] + Math.cos(a) * width * (1 + 1.6 * pop), at[1] + Math.sin(a) * width * (1 + 1.6 * pop), at[2]];
      out.quad(p, p, 0.28 * width, [...palette.sky, 1 - pop, 0.5], SHARD, a);
    }
  }
}

/** Water flung off in a spray of streaks as the dragon shakes, falling away, with a few puffs of mist. */
function drawDrops(out, since, { centre, size, color }) {
  for (const d of drops) {
    const age = since - d.born;
    if (age <= 0 || age >= d.life) continue;
    const start = plus(centre, d.from, 0.4 * size, -0.1 * size);
    const out3 = [d.from[0] - d.swirl * d.from[2], 0, d.from[2] + d.swirl * d.from[0]];
    const v = [out3[0] * d.speed * size, d.up * size, out3[2] * d.speed * size];
    const at = (t) => [start[0] + v[0] * t, start[1] + v[1] * t - 0.5 * GRAVITY * size * t * t, start[2] + v[2] * t];
    const head = at(age),
      tail = at(Math.max(0, age - 0.07));
    const alpha = clamp01(age * 20) * clamp01((d.life - age) * 5);
    if (d.mist) {
      const width = (0.05 + 0.1 * age) * size;
      out.quad(head, head, width, [...palette.sky, 0.35 * alpha, 0.1], HEX, d.swirl + age);
    } else out.quad(tail, head, d.scale * size, [...color, 0.95 * alpha, 0.35], STREAK, 0);
  }
}

/** Glints twinkling over the clean, dry body. */
function drawGlints(out, since, { centre, size, color }) {
  for (const g of glints) {
    const age = (since - g.born) / g.life;
    if (age <= 0 || age >= 1) continue;
    const at = plus(centre, g.from, g.reach * size, 0.1 * size);
    const width = g.scale * size * Math.sin(Math.PI * age);
    out.quad(at, at, width, [...palette.sky.map((v, k) => (v + color[k]) / 2), 1, 0.8], GLINT, g.spin + 2 * age);
  }
}

/**
 * The Clean reaction's particles `since` seconds in, around `centre` for a dragon about `size`
 * metres long, in the action's `color`.
 */
export function cleanSuds(out, since, at) {
  drawBubbles(out, since, at);
  drawDrops(out, since, at);
  drawGlints(out, since, at);
}
