import { normalize } from "../vec3.js";
import { surfaceAt } from "../course/surfaceAt.js";
import { creatureScale } from "../worldScale.js";
import { ageOf } from "../dragonAge.js";
import { gravity } from "./flightModel.js";
import { froude } from "./froude.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const { length: L, speed: V, time: T } = froude;
/** Reference-scale tuning, converted by dimension; accelerations are unscaled. */
const tune = {
  touchSpeed: 5 * V,
  sink: 1.2 * V,
  decel: 3.2,
  approach: [6 * T, 11 * T],
  reach: [70 * L, 210 * L],
  lane: 11 * L,
  row: 22 * L,
  wall: 10 * L,
  flare: 2.2 * T,
  runout: 1.2 * T,
  wade: 0.3,
};
/** Seconds a landed racer stands before the recording may end. */
export const landingSettle = 4 * T;
export const landingEffort = { glide: 0.15, flare: 0.95 };

/** Root (torso) height above the ground when standing, from the leg-length gene (reference 1.97) and age. */
export function standHeight(genome, age) {
  const stage = ageOf(age),
    legs = (genome?.legs ?? 1.97) * (stage.proportions.legs ?? 1);
  return creatureScale * stage.size * (0.46 + 1.73 * (legs / 1.97));
}

const hermite = (p0, m0, p1, m1, k) => {
  const k2 = k * k,
    k3 = k2 * k;
  return {
    p: (2 * k3 - 3 * k2 + 1) * p0 + (k3 - 2 * k2 + k) * m0 + (-2 * k3 + 3 * k2) * p1 + (k3 - k2) * m1,
    v: (6 * k2 - 6 * k) * p0 + (3 * k2 - 4 * k + 1) * m0 + (-6 * k2 + 6 * k) * p1 + (3 * k2 - 2 * k) * m1,
    a: (12 * k - 6) * p0 + (6 * k - 4) * m0 + (6 - 12 * k) * p1 + (6 * k - 2) * m1,
  };
};

/** Standing root height at a surface: wading where the water is shallow, swimming where it is deep. */
export function rootHeight(spot, stand) {
  return Math.max(spot.ground, spot.level - 0.55 * stand) + stand;
}

/**
 * Whether a dragon of `age`, standing `stand` high, may set down at `spot`: anywhere dry, and for an
 * adult also where the water is very shallow (`tune.wade` of its stand height at most); kids and teens
 * keep out of water.
 */
export function footing(spot, stand, age) {
  return spot.surface !== "water" || (ageOf(age).id === "adult" && spot.level - spot.ground <= tune.wade * stand);
}

/**
 * Plans a finished racer's landing on the run-out beyond the finish: a glide down to a free lane
 * it has `footing` on, a braking flare and a touchdown. Mutates `taken`, the set of claimed `row:lane` slots.
 */
export function planLanding(racer, t, { corridor, course, taken }) {
  const v0 = Math.max(racer.v, tune.touchSpeed);
  let duration = clamp((v0 - tune.touchSpeed) / tune.decel, ...tune.approach);
  const reach = clamp((duration * (v0 + tune.touchSpeed)) / 2, ...tune.reach);
  const stand = standHeight(racer.genome, racer.age);
  const slots = [];
  for (let row = 0; !slots.some((slot) => slot.fits) || row < 3; row++) {
    const s = racer.s + reach + row * tune.row;
    const width = Math.max(0, corridor.at(s).halfWidth - tune.wall);
    const count = Math.max(1, Math.floor((2 * width) / tune.lane) + 1);
    for (let i = 0; i < count; i++) {
      if (taken.has(`${row}:${i}`)) continue;
      const u = count > 1 ? -width + (2 * width * i) / (count - 1) : 0;
      const [x, , z] = corridor.world(s, u, 0);
      const spot = ground(corridor, course, s, u);
      slots.push({ key: `${row}:${i}`, row, s, u, spot, fits: footing(spot, stand, racer.age), x, z });
    }
    if (row > 12) break;
  }
  const cost = (slot) =>
    (slot.fits ? 0 : 1e6) +
    slot.row * 1e3 +
    Math.abs(slot.u - racer.u);
  const slot = slots.reduce((best, slot) => (cost(slot) < cost(best) ? slot : best));
  taken.add(slot.key);
  const distance = slot.s - racer.s;
  duration = (2 * distance) / (v0 + tune.touchSpeed);
  const frame = corridor.at(racer.s);
  const vh = Math.sqrt(Math.max(0, racer.v * racer.v - racer.vy * racer.vy - racer.vu * racer.vu));
  return {
    start: t,
    duration,
    stand,
    from: { s: racer.s, u: racer.u, y: racer.y, vs: vh * frame.ratio, vu: racer.vu, vy: racer.vy + racer.lift },
    to: { s: slot.s, u: slot.u, y: rootHeight(slot.spot, stand) },
    surface: slot.spot.surface,
    progress: 0,
    grounded: false,
    landedAt: null,
    skid: 0,
  };
}

/**
 * Advances a landing racer by dt. Sets position (s, u, y), speed, forward, bank and effort, and
 * returns a `land` event payload at touchdown.
 */
export function stepLanding(racer, t, dt, { corridor, course }) {
  const plan = racer.landing;
  const { from, to, duration } = plan;
  if (!plan.grounded) {
    const k = clamp((t - plan.start) / duration, 0, 1);
    const s = hermite(from.s, from.vs * duration, to.s, tune.touchSpeed * duration, k);
    const u = hermite(from.u, from.vu * duration, to.u, 0, k);
    const y = hermite(from.y, from.vy * duration, to.y, -tune.sink * duration, k);
    const frame = corridor.at(s.p);
    const floor = rootHeight(ground(corridor, course, s.p, u.p), plan.stand);
    racer.s = s.p;
    racer.u = u.p;
    racer.y = Math.max(y.p, floor);
    const vs = s.v / duration,
      vu = u.v / duration,
      vy = y.v / duration;
    racer.v = Math.hypot(vs, vu, vy);
    racer.vy = vy;
    racer.vu = vu;
    racer.forward = normalize([
      frame.forward[0] * vs + frame.left[0] * vu,
      vy,
      frame.forward[2] * vs + frame.left[2] * vu,
    ]);
    const bankTarget = clamp(Math.atan(u.a / (duration * duration) / gravity), -0.6, 0.6);
    racer.bank += (bankTarget - racer.bank) * Math.min(1, dt / (0.35 * T));
    racer.effort = duration * (1 - k) < tune.flare ? landingEffort.flare : landingEffort.glide;
    plan.progress = k;
    if (k < 1) return null;
    plan.grounded = true;
    plan.landedAt = t;
    plan.skid = racer.v;
    const [x, , z] = corridor.world(racer.s, racer.u, 0, frame);
    const spot = ground(corridor, course, racer.s, racer.u);
    return {
      surface: spot.surface,
      position: [x, spot.surface === "water" ? spot.level : spot.ground, z],
      forward: normalize([racer.forward[0], 0, racer.forward[2]]),
      speed: racer.v,
    };
  }
  const speed = plan.skid * clamp(1 - (t - plan.landedAt) / tune.runout, 0, 1);
  const f = racer.forward;
  const flat = Math.hypot(f[0], f[2]) || 1;
  const frame = corridor.at(racer.s);
  const along = (f[0] * frame.forward[0] + f[2] * frame.forward[2]) / flat,
    across = (f[0] * frame.left[0] + f[2] * frame.left[2]) / flat;
  const s = racer.s + speed * along * dt,
    u = racer.u + speed * across * dt;
  if (speed > 0 && footing(ground(corridor, course, s, u), plan.stand, racer.age)) {
    racer.s = s;
    racer.u = u;
  } else plan.skid = 0;
  racer.y = rootHeight(ground(corridor, course, racer.s, racer.u), plan.stand);
  racer.v = plan.skid ? speed : 0;
  racer.vy = 0;
  racer.vu = 0;
  racer.forward = [f[0] / flat, 0, f[2] / flat];
  racer.bank *= Math.max(0, 1 - dt / (0.3 * T));
  racer.effort = 0;
  return null;
}

/** The ground (and any water) at a path position, falling back to the corridor floor off the terrain. */
export function ground(corridor, course, s, u) {
  const [x, , z] = corridor.world(s, u, 0);
  const spot = surfaceAt(course, x, z);
  if (Number.isFinite(spot.ground)) return spot;
  const { floor } = corridor.at(s);
  return { ...spot, ground: floor, level: floor };
}
