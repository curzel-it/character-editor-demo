import { lowestPoint } from "../scene/groundContact.js";
import { restingMotion } from "../dragonThumbnails.js";

const SOLE = 0.02,
  CROUCH = 0.45,
  PUSH = 0.18,
  TUCK = 0.5,
  TOP = 0.69,
  BEATS = 1.8,
  LEAVE = 2.4,
  OUT = 3,
  EXTEND = 0.25,
  HOP = 1.6,
  UP = 2.6,
  ARRIVE_AT = 0.2,
  FLIGHT = 1.9,
  SETTLE = 1.3,
  TURN = 0.8,
  IN = 11,
  HIGH = 6,
  APPROACH = [0.42, -0.91],
  EGG_TRIP = 1.3,
  EGG_HOP = 0.26,
  EGG_WAY = [-0.99, 0.12],
  EGG_REACH = 14;

const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const unit = ([x, y, z]) => {
  const n = Math.hypot(x, y, z) || 1;
  return [x / n, y / n, z / n];
};

/** Seconds into a swap when the newcomer comes in, and when the camera has settled on it. */
export const swapTimes = { arrive: ARRIVE_AT, framed: ARRIVE_AT + FLIGHT };

/** The dragon lifted so its lowest point sits `air` over the ground at `position`. */
function grounded(anatomy, pose, position, forward, air) {
  const lift = SOLE - lowestPoint(anatomy, pose, position, forward) + air;
  return { anatomy, pose, position: [position[0], position[1] + lift, position[2]], forward };
}

const crouches = new WeakMap();

/** How high the root sits over the spot at the bottom of the take-off crouch, kept per anatomy so the wings beating below the feet never move it. */
function crouchedLift(module, entry, spot) {
  if (!crouches.has(entry.anatomy)) {
    const pose = module.pose(entry.anatomy, TOP, { ...restingMotion, glide: 0, effort: 1, climb: 1, impact: 1, wings: 1, spring: -1 });
    crouches.set(entry.anatomy, SOLE - lowestPoint(entry.anatomy, pose, spot.position, spot.forward));
  }
  return crouches.get(entry.anatomy);
}

/**
 * The dragon leaving the spot `since` seconds into a swap: a crouch with the wings raised high, a
 * push off the legs into the first downstroke, a few hard beats low over the ground and a climb
 * away along its heading. Null once it is gone.
 */
function dragonLeaving(module, entry, spot, since) {
  if (since >= LEAVE) return null;
  const r = entry.anatomy.bounds.radius;
  const age = since - CROUCH,
    air = Math.max(0, age - PUSH);
  const beat = age < 0 ? TOP : TOP + BEATS * age;
  const pose = module.pose(entry.anatomy, beat % 1, {
    ...restingMotion,
    time: since,
    glide: 0,
    effort: 1,
    climb: 1,
    stand: 1 - smooth(0, PUSH, age),
    impact: smooth(0, CROUCH, since) * (1 - smooth(0, PUSH, age)),
    wings: smooth(0.1 * CROUCH, CROUCH, since),
    spring: age < 0 ? -smooth(0, CROUCH, since) : smooth(0, PUSH, age) * (1 - smooth(PUSH, PUSH + TUCK, age)),
  });
  if (age < 0) return grounded(entry.anatomy, pose, spot.position, spot.forward, 0);
  const at = spot.position.map((v, k) => v + spot.forward[k] * OUT * r * air * air);
  const rise = r * (EXTEND * smooth(0, PUSH, age) + HOP * air + UP * air * air);
  return { anatomy: entry.anatomy, pose, position: [at[0], at[1] + crouchedLift(module, entry, spot) + rise, at[2]], forward: spot.forward };
}

/**
 * The dragon arriving `since` seconds into a swap: gliding in low over the meadow to the right of
 * the barn, flaring, touching down with a crouch and turning onto the spot's heading as it stands.
 */
function dragonArriving(module, entry, spot, since) {
  const t = since - ARRIVE_AT;
  if (t < 0) return null;
  const r = entry.anatomy.bounds.radius;
  const u = clamp(t / FLIGHT),
    s = 1 - (1 - u) ** 2;
  const from = [spot.position[0] + APPROACH[0] * IN * r, spot.position[2] + APPROACH[1] * IN * r];
  const at = [from[0] + (spot.position[0] - from[0]) * s, spot.position[1], from[1] + (spot.position[2] - from[1]) * s];
  const age = t - FLIGHT;
  const stand = age >= 0 ? smooth(0, SETTLE, age) : 0;
  const impact = age < 0 ? 0 : age < 0.08 ? age / 0.08 : Math.exp(-(age - 0.08) / 0.28);
  const flare = smooth(0.7, 0.97, u) * (1 - stand);
  const turn = age >= 0 ? smooth(0, TURN, age) : 0;
  const heading = unit([-APPROACH[0] + (spot.forward[0] + APPROACH[0]) * turn, 0, -APPROACH[1] + (spot.forward[2] + APPROACH[1]) * turn]);
  const pose = module.pose(entry.anatomy, (t * 1.4) % 1, { ...restingMotion, time: since, glide: smooth(0.3, 0.75, u), effort: 0.7 * (1 - u), flare, stand, impact });
  return grounded(entry.anatomy, pose, at, heading, HIGH * r * (1 - s) ** 1.4);
}

/** An egg hopping along the way out of the yard, `k` of the way from the spot (0) to off frame (1). */
function eggOnTheWay(entry, spot, k, since) {
  const away = EGG_REACH * k;
  const hop = Math.abs(Math.sin((Math.PI * since) / EGG_HOP)) * 0.35 * entry.radius * (k > 0 && k < 1 ? 1 : 0);
  const position = [spot.position[0] + EGG_WAY[0] * away, entry.radius + hop, spot.position[2] + EGG_WAY[1] * away];
  return { anatomy: entry.anatomy, pose: { bones: {} }, position, forward: [-EGG_WAY[1], 0, EGG_WAY[0]], bank: 0.25 * Math.sin((2 * Math.PI * since) / EGG_HOP) * (k > 0 && k < 1 ? 1 : 0) };
}

/** Whether `entry` is a dragon lying asleep, which cannot fly in or out. */
const sleeper = (entry) => !entry.egg && entry.sleep > 0;

/**
 * The racers of a swap from `from` to `to`, both yard entries, `since` seconds in: dragons fly out
 * and in, eggs hop off and back along the barn front. Sleepers are left out: one leaving is simply
 * gone, one arriving is just there from `swapTimes.arrive` on, posed as usual by the stage.
 */
export function swapRacers(module, { from, to }, spot, since) {
  const out = [];
  if (from && !sleeper(from))
    out.push(from.egg ? (since < EGG_TRIP ? eggOnTheWay(from, spot, smooth(0, EGG_TRIP, since), since) : null) : dragonLeaving(module, from, spot, since));
  const t = since - ARRIVE_AT;
  if (to.egg) out.push(t >= 0 ? eggOnTheWay(to, spot, 1 - smooth(0, EGG_TRIP, t), t) : null);
  else if (!sleeper(to)) out.push(dragonArriving(module, to, spot, since));
  return out.filter(Boolean);
}

/** Seconds into a swap to `to` after which it just stands on the spot. */
export const swapLength = (to) => ARRIVE_AT + (to.egg ? EGG_TRIP : sleeper(to) ? 0 : FLIGHT + SETTLE);
