import { normalize } from "../vec3.js";
import { makeRng } from "../rng.js";
import { genes } from "../genome/dragon.js";
import { dragonLegShapes } from "../anatomy/dragonLegVariants.js";
import { minSpeed, flapClimb, lateralSpeed, lateralAccel } from "./flightModel.js";
import { standHeight, ground, rootHeight } from "./landing.js";
import { froude } from "./froude.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const { speed: V, time: T } = froude;
/** Reference-scale tuning, converted by dimension; accelerations are unscaled. */
const tune = {
  push: 6 * V,
  thrust: 6.5,
  react: [0.12 * T, 0.45 * T],
  climbTime: 0.5 * T,
  slowClimb: 0.35,
  timeout: 15 * T,
};
/** The legs' spring off the ground by leg shape: `push` scales the jump, `angle` (radians) tips it up from level. */
const legPush = {
  raptor: { push: 1, angle: 0.5 },
  feathered: { push: 0.9, angle: 0.75 },
  armoured: { push: 0.85, angle: 0.35 },
  spurred: { push: 1.15, angle: 0.5 },
};
const legGene = genes.find((g) => g.name === "legs");

/**
 * The jump a dragon's legs give it off the grid: forward and upward speed (m/s) from leg shape,
 * leg length and Weight. Longer legs push harder, heavier bodies leave slower.
 * @returns {{ forward: number, up: number }}
 */
export function launchPush(genome, stats) {
  const shape = dragonLegShapes[clamp(Math.floor(genome?.legShape) || 0, 0, dragonLegShapes.length - 1)];
  const legs = legPush[shape.id] ?? legPush.raptor;
  const length = Number.isFinite(genome?.legs)
    ? clamp((genome.legs - legGene.min) / (legGene.max - legGene.min), 0, 1) - 0.5
    : 0;
  const speed = (tune.push * legs.push * (1 + 0.3 * length)) / Math.sqrt(stats.weight);
  return { forward: speed * Math.cos(legs.angle), up: speed * Math.sin(legs.angle) };
}

/**
 * A racer standing on the ground below its grid slot: its path position, the takeoff it will make at
 * Go, after a reaction time seeded by race and racer, and `climbOut`, the slot's altitude, which it
 * climbs to flat out.
 */
export function planTakeoff(entry, slot, stats, seed, { corridor, course }) {
  const p = corridor.project(slot.position);
  const stand = standHeight(entry.genome, entry.age);
  const random = makeRng(`launch:${seed}:${entry.id}`);
  const [lo, hi] = tune.react;
  return {
    s: p.s,
    u: p.u,
    y: rootHeight(ground(corridor, course, p.s, p.u), stand),
    takeoff: {
      stand,
      launchAt: lo + (hi - lo) * random() * 0.75,
      push: launchPush(entry.genome, stats),
      grounded: true,
      vh: 0,
    },
    climbOut: p.y,
  };
}

/**
 * Advances a racer through its takeoff by dt: standing until its launch, then a leg jump and hard
 * wingbeats until it flies at `minSpeed` inside the corridor's band. Returns a
 * `launch` event payload at the jump; clears `racer.takeoff` once airborne.
 */
export function stepTakeoff(racer, t, dt, decision, { corridor, course }) {
  const plan = racer.takeoff;
  const S = racer.stats;
  const frame = corridor.at(racer.s);
  const spot = ground(corridor, course, racer.s, racer.u);
  const floor = rootHeight(spot, plan.stand);
  if (plan.grounded) {
    racer.y = floor;
    racer.effort = 0;
    if (t < plan.launchAt) return null;
    plan.grounded = false;
    plan.vh = plan.push.forward;
    racer.vy = plan.push.up;
    racer.effort = 1;
    racer.v = Math.hypot(plan.vh, racer.vy);
    const [x, , z] = corridor.world(racer.s, racer.u, 0, frame);
    return {
      surface: spot.surface,
      position: [x, spot.surface === "water" ? spot.level : spot.ground, z],
      forward: [frame.forward[0], 0, frame.forward[2]],
      speed: racer.v,
    };
  }
  racer.effort = 1;
  plan.vh = Math.max(0, plan.vh + tune.thrust * Math.sqrt(S.climb / (6 * V)) * Math.max(0, 1 - plan.vh / S.topSpeed) * dt);
  const lift = tune.slowClimb + (1 - tune.slowClimb) * clamp(plan.vh / minSpeed, 0, 1);
  const climb = flapClimb(S) * lift;
  racer.vy += (climb - racer.vy) * Math.min(1, dt / tune.climbTime);
  const latMax = lateralSpeed(plan.vh),
    latCap = lateralAccel(S) * dt;
  racer.vu += clamp(clamp(decision.uWish, -latMax, latMax) - racer.vu, -latCap, latCap);
  racer.s += plan.vh * frame.ratio * dt;
  racer.u += racer.vu * dt;
  racer.y = Math.max(floor, racer.y + racer.vy * dt);
  racer.v = Math.hypot(plan.vh, racer.vy, racer.vu);
  racer.forward = normalize([
    frame.forward[0] * plan.vh + frame.left[0] * racer.vu,
    racer.vy,
    frame.forward[2] * plan.vh + frame.left[2] * racer.vu,
  ]);
  racer.bank *= Math.max(0, 1 - dt / (0.3 * T));
  const { lo } = corridor.band(racer.s, racer.u, frame, 3 * froude.length);
  if ((racer.y >= lo && plan.vh >= minSpeed) || t - plan.launchAt > tune.timeout) racer.takeoff = null;
  return null;
}
