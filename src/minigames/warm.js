import { palette } from "../palette.js";
import { makeRng } from "../rng.js";
import { eggShell } from "./eggShell.js";

/** Warmth (0..1) the egg holds between, glowing just right. */
export const warmBand = [0.5, 0.8];

const HEAT = 0.05,
  COOL = 0.6,
  FIZZLE_TO = 0.28,
  GOAL = 6,
  INTRO = 0.9,
  COSY = 1.4,
  HINT_HOLD = 0.6,
  SMOOTH = 0.35,
  FIZZLE_HINT = 0.8,
  REACH = 1.3,
  CORE = 0.12,
  FOLLOW = 16,
  TOOL_RISE = 0.35,
  POINTS = 10,
  MOTE_LIFE = 1.4,
  STEAM_LIFE = 1.1,
  GLINT_LIFE = 0.7;

const HEX = 0,
  GLINT = 3,
  ORB = 4;

const PALM = [0.05, -0.03, 0];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** The egg's warmth `dt` seconds on, rubbed through `swept` radians round it: heated by the rubbing and cooling towards nothing. */
export const warmStep = (warmth, swept, dt) => Math.max(0, warmth + HEAT * swept - COOL * warmth * dt);

/**
 * Warm as a minigame: the hand, under the finger, rubs the egg in circles and it glows warmer and
 * wobbles. Held between `warmBand` it scores every second, more for each second in a row, until
 * `GOAL` seconds are held; rubbed too fast it overheats, fizzles out in a puff of steam and cools.
 * @param {{ anatomy: object, seed: string }} options
 */
export function createWarm({ anatomy, seed }) {
  const shell = eggShell(anatomy);
  const random = makeRng(`warm:${seed}`);
  const pointer = { down: false, x: 0, y: 0, path: [] };
  /** @type {{ points: number, combo: number, x: number, y: number }[]} */
  const events = [];
  const motes = [],
    steam = [],
    glints = [];
  let warmth = 0,
    pace = 0,
    held = 0,
    streak = 0,
    score = 0,
    step = "rub",
    stepAt = 0,
    shownAt = -Infinity,
    fizzledAt = -Infinity,
    rubbedAt = -Infinity,
    startAt = null,
    time = 0,
    moteDue = 0,
    hand = null;

  /** The state the hint names for the warmth now. */
  const state = () => (warmth > warmBand[1] ? "hot" : warmth >= warmBand[0] ? "keep" : "rub");
  const shellPoint = (racer, lift) => shell.toWorld(racer, shell.at(0.25 * Math.PI + 0.6 * Math.PI * random(), 2 * Math.PI * random(), lift));

  /** Radians the finger swept round the egg's middle on the canvas since the last frame, over the egg only. */
  function sweep(mid, radius) {
    let swept = 0;
    const path = pointer.path.splice(0, pointer.path.length - 1);
    if (path.length) path.push(pointer.path[0]);
    for (let i = 1; i < path.length; i++) {
      const [p, q] = [path[i - 1], path[i]];
      const near = (s) => {
        const d = Math.hypot(s.x - mid.x, s.y - mid.y);
        return d < REACH * radius && d > CORE * radius;
      };
      if (!near(p) || !near(q)) continue;
      const turn = Math.atan2(q.y - mid.y, q.x - mid.x) - Math.atan2(p.y - mid.y, p.x - mid.x);
      swept += Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn)));
    }
    return swept;
  }

  return {
    id: "warm",
    action: "nudge",
    get score() {
      return score;
    },
    get step() {
      return step;
    },
    get done() {
      return step === "done";
    },
    /** How much of the warming is done, 0..1. */
    get progress() {
      return clamp01(held / GOAL);
    },
    /** The warmth, 0..100, for the meter, and the band it should stay in. */
    get meter() {
      return 100 * clamp01(warmth);
    },
    band: warmBand.map((v) => 100 * v),
    takeEvents: () => events.splice(0),
    camera: () => ({ side: 1, pitch: 0.22, zoom: 1.45, focus: [0, 0.1 * shell.size, 0] }),
    pointer({ type, x, y }) {
      if (type === "down") Object.assign(pointer, { down: true, x, y, path: [{ x, y }] });
      else if (type === "move") {
        Object.assign(pointer, { x, y });
        if (pointer.down) pointer.path.push({ x, y });
      } else pointer.down = false;
    },
    update(view) {
      const elapsed = startAt === null ? 0 : Math.max(0, view.time - time),
        dt = Math.min(0.05, elapsed);
      time = view.time;
      if (startAt === null) [startAt, stepAt] = [time, time + INTRO];
      const racer = view.dragon;
      const mid = view.project(racer.position);
      const edge = view.project(racer.position.map((v, k) => v + view.right[k] * shell.size));
      const radius = Math.max(20, Math.hypot(edge.x - mid.x, edge.y - mid.y));
      if (step === "cosy") {
        if (time - stepAt > COSY) step = "done";
        warmth = Math.max(warmBand[0], warmth - 0.1 * dt);
      } else if (step !== "done") {
        const swept = time < stepAt ? 0 : sweep(mid, radius);
        if (time < stepAt) pointer.path.length = 0;
        if (swept > 0) rubbedAt = time;
        if (elapsed > 0) pace += (swept / elapsed - pace) * (1 - Math.exp(-elapsed / SMOOTH));
        warmth = warmStep(warmth, pace * dt, dt);
        if (swept > 0.05 && random() < 0.5) glints.push({ born: time, at: view.at(pointer.x, pointer.y, Math.hypot(...racer.position.map((v, k) => v - view.eye[k])) - shell.size), size: 0.09 * shell.size * (0.6 + random()), spin: random() * Math.PI });
        if (warmth >= 1) {
          [warmth, pace, step, shownAt] = [FIZZLE_TO, 0, "fizzle", time + FIZZLE_HINT];
          fizzledAt = time;
          streak = 0;
          for (let n = 0; n < 9; n++) steam.push({ born: time + 0.04 * n, at: shellPoint(racer, 0.05), rise: (0.8 + 0.8 * random()) * shell.size, size: (0.18 + 0.12 * random()) * shell.size });
        }
        const inBand = warmth >= warmBand[0] && warmth <= warmBand[1];
        if (inBand && time >= stepAt) {
          const before = Math.floor(streak);
          held += dt;
          streak += dt;
          if (Math.floor(streak) > before) {
            const combo = Math.min(4, Math.floor(streak));
            score += POINTS * combo;
            const top = view.project(racer.position.map((v, k) => v + (k === 1 ? 1.1 * shell.size : 0)));
            events.push({ points: POINTS * combo, combo, x: top.x, y: top.y });
          }
        } else streak = 0;
        const now = state();
        if (held >= GOAL) {
          [step, stepAt] = ["cosy", time];
          for (let n = 0; n < 14; n++) glints.push({ born: time + 0.05 * n, at: shellPoint(racer, 0.1), size: 0.2 * shell.size * (0.7 + random()), spin: random() * Math.PI });
        } else if (now !== step && time - shownAt > HINT_HOLD) [step, shownAt] = [now, time];
      }
      moteDue += dt * 10 * clamp01((warmth - 0.3) / 0.5) * (step === "cosy" ? 2 : 1);
      for (; moteDue >= 1; moteDue--) motes.push({ born: time, at: shellPoint(racer, 0.04), rise: (1 + random()) * shell.size, drift: (random() - 0.5) * shell.size, size: (0.05 + 0.05 * random()) * shell.size });
      const keep = (list, life) => list.splice(0, list.length, ...list.filter((p) => time - p.born < life));
      keep(motes, MOTE_LIFE);
      keep(steam, STEAM_LIFE + 0.5);
      keep(glints, GLINT_LIFE + 0.8);
    },
    /** The egg wobbling as it warms, shivering when too hot and jolting as it fizzles, its shell glowing with the warmth. */
    motion() {
      const since = time - fizzledAt;
      const fizzle = since < 1 ? 0.18 * Math.exp(-5 * since) * Math.sin(28 * since) : 0;
      const hot = clamp01((warmth - warmBand[1]) / (1 - warmBand[1]));
      const rub = Math.exp(-3 * (time - rubbedAt));
      const cosy = step === "cosy" || step === "done" ? Math.sin(Math.PI * clamp01((time - stepAt) / COSY)) : 0;
      const color = palette.eggCare.warm.map((v, k) => v + (palette.eggCare.hot[k] - v) * hot);
      return {
        roll: (0.03 + 0.05 * warmth) * rub * Math.sin(time * (5 + 6 * warmth)) + 0.025 * hot * Math.sin(time * 47) + fizzle,
        lift: 0.12 * cosy * Math.abs(Math.sin(time * 9)),
        glow: 0.03 + 0.3 * clamp01(warmth) + 0.2 * hot + 0.1 * cosy,
        glowColor: color,
      };
    },
    /** The keeper's open hand under the finger, rubbing, and resting low aside when it lifts. */
    hand(view) {
      if (step === "done") return null;
      const rest = { x: 0.78 * view.width, y: 0.74 * view.height };
      const target = pointer.down ? pointer : rest;
      hand ??= { ...rest };
      const k = 1 - Math.exp(-FOLLOW * (view.dt ?? 0.016));
      hand.x += (target.x - hand.x) * k;
      hand.y += (target.y - hand.y) * k;
      const reach = clamp01((time - (stepAt - INTRO + 0.5)) / TOOL_RISE) * (step === "cosy" ? 1 - clamp01((time - stepAt) / 0.5) : 1);
      const rub = Math.exp(-3 * (time - rubbedAt));
      return { screen: [hand.x, hand.y], anchor: PALM, reach, wrist: 0.35, twist: 0.12 * rub * Math.sin(time * 11), curl: 0.18, thumb: 0.15, spread: 0.25, roll: 0.1 * rub * Math.sin(time * 9) };
    },
    /** Warm motes rising off the shell, glints where it is rubbed and steam puffing off when it fizzles. */
    particles(out) {
      const { mote, steam: haze, light } = palette.eggCare;
      for (const m of motes) {
        const age = (time - m.born) / MOTE_LIFE;
        const at = [m.at[0] + m.drift * age, m.at[1] + m.rise * age, m.at[2]];
        out.quad(at, at, m.size * (1 - 0.5 * age), [...mote, Math.sin(Math.PI * age), 1], ORB, 0);
      }
      for (const s of steam) {
        const age = (time - s.born) / STEAM_LIFE;
        if (age <= 0 || age >= 1) continue;
        const at = [s.at[0], s.at[1] + s.rise * age, s.at[2]];
        out.quad(at, at, s.size * (0.5 + age), [...haze, 0.75 * (1 - age), 0], HEX, s.rise + age);
      }
      for (const g of glints) {
        const age = (time - g.born) / GLINT_LIFE;
        if (age <= 0 || age >= 1) continue;
        out.quad(g.at, g.at, g.size * Math.sin(Math.PI * age), [...light, 1, 0.9], GLINT, g.spin + 2 * age);
      }
    },
  };
}
