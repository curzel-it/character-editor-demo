/**
 * Flight motion: optional plain data that shapes a dragon's flight pose.
 * @typedef {object} FlightMotion
 * @property {number} [effort] 0..1 wing effort; 0.5 is a relaxed cruise, 1 a sprint.
 * @property {number} [glide] 0..1 how locked and extended the wings are (no beating at 1).
 * @property {number} [bank] Roll in radians as recorded; positive leans and turns towards +Z.
 * @property {number} [climb] Flight-path angle in radians; positive climbs, negative dives.
 * @property {number} [fatigue] 0..1 exhaustion; `exhausted: true` is shorthand for 1.
 * @property {boolean} [exhausted]
 * @property {number} [roar] 0..1 roar: a wide jaw drop with the head thrown up (see mouthEvents.js).
 * @property {number} [snap] 0..1 bite at a rival alongside; `snapSide` (±1) points at it, +1 towards +Z.
 * @property {number} [snapSide]
 * @property {number} [gasp] 0..1 extra laboured breathing on top of `fatigue`.
 * @property {number} [breath] 0..1 breath attack: the jaw wide open, the neck stretched and the head levelled at the target.
 * @property {number} [breathYaw] Radians the neck turns the head to aim a breath, positive to the left (+Z).
 * @property {number} [breathPitch] Radians the neck raises the head to aim a breath, positive up.
 * @property {number} [flare] 0..1 landing flare: body up, wings cupped forward, legs reaching down.
 * @property {number} [stand] 0..1 on the ground: adults rest on the hind legs and the planted wing hands, younger dragons stand on the hind legs with the wings folded.
 * @property {number} [impact] 0..1 touchdown crouch pulse.
 * @property {number} [wings] 0..1 take-off: frees the wings from `stand` into the flight beat while the legs stay planted (see dragonLeap.js).
 * @property {number} [spring] -1..1 take-off: the legs coiled below 0, driven straight and back off the ground above it.
 * @property {number} [sleep] 0..1 slumber: lying down curled up asleep (see dragonSlumber.js).
 * @property {number} [sleepSide] ±1, the side the sleeping neck and tail curl towards; +1 is +Z.
 * @property {number} [pushup] 0..1 workout drills on the ground (see dragonDrill.js), as are `squat`, `jack`, `crunch` (-1..1) and `flop`.
 * @property {number} [squat]
 * @property {number} [jack]
 * @property {number} [crunch]
 * @property {number} [flop]
 * @property {number} [lids] 0..1 eyes drawn shut while awake (see dragonLids.js); with `time` the eyes also blink now and then (see dragonBlink.js).
 * @property {number} [glum] 0..1 disappointed or sad: the lids lowered, their back corners drooping (see dragonExpression.js).
 * @property {number} [weary] 0..1 tired or hungry: the lids heavy.
 * @property {number} [glee] 0..1 delighted: the lower lids pushed up into smiling eyes.
 * @property {[number, number]} [gaze] Where the pupils look, `[forward, up]` within -1..1 of their reach (see dragonGaze.js); without it, and with `time`, they glance about now and then.
 * @property {number} [thump] 0..1 a hind foot thumping like a happy dog's; `thumpSide` (±1) picks the leg, +1 is +Z (see dragonThump.js).
 * @property {number} [thumpSide]
 * @property {number} [lookYaw] Radians the neck turns the head on top of any pose, standing included, positive to the left (+Z).
 * @property {number} [lookPitch] Radians the neck raises the head on top of any pose, positive up.
 * @property {number} [idle] 0..1 standing idle: with `time` the head now and then tilts curiously and the tail wags (see dragonTilt.js, dragonWag.js).
 * @property {number} [time] Absolute seconds for slow secondary cycles (breathing drift, glances,
 *   ragged beats). Omit it and those cycles fall back to loop-safe versions of the wing phase.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const smoothstep = (a, b, x) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

/** @param {FlightMotion} [motion] */
export function resolveMotion(motion = {}) {
  const number = (value, fallback) =>
    Number.isFinite(value) ? value : fallback;
  return {
    effort: clamp(number(motion.effort, 0.5), 0, 1),
    glide: clamp(number(motion.glide, 0), 0, 1),
    bank: clamp(number(motion.bank, 0), -1.2, 1.2),
    climb: clamp(number(motion.climb, 0), -1.2, 1.2),
    fatigue: clamp(number(motion.fatigue, motion.exhausted ? 1 : 0), 0, 1),
    time: Number.isFinite(motion.time) ? motion.time : null,
    roar: clamp(number(motion.roar, 0), 0, 1),
    snap: clamp(number(motion.snap, 0), 0, 1),
    snapSide: clamp(number(motion.snapSide, 1), -1, 1),
    gasp: clamp(number(motion.gasp, 0), 0, 1),
    breath: clamp(number(motion.breath, 0), 0, 1),
    breathYaw: clamp(number(motion.breathYaw, 0), -1.4, 1.4),
    breathPitch: clamp(number(motion.breathPitch, 0), -0.6, 0.6),
    flare: clamp(number(motion.flare, 0), 0, 1),
    stand: clamp(number(motion.stand, 0), 0, 1),
    impact: clamp(number(motion.impact, 0), 0, 1),
    wings: clamp(number(motion.wings, 0), 0, 1),
    spring: clamp(number(motion.spring, 0), -1, 1),
  };
}

/** Glide amount implied by effort: the race stops beating below 0.3 effort. */
export const glideFromEffort = (effort) => 1 - smoothstep(0.2, 0.34, effort);

const lags = { effort: 0.25, glide: 0.3, fatigue: 0.6 };

/**
 * Motion for a sampled race racer. Pass the previous result to ease the 20 Hz steps of `effort`
 * and a daze; scrubbing backwards or jumping more than half a second resets the easing.
 * @returns {FlightMotion}
 */
export function motionFromRacer(racer, time, previous) {
  const effort = clamp(Number.isFinite(racer.effort) ? racer.effort : 0.5, 0, 1);
  const target = {
    effort,
    glide: glideFromEffort(effort),
    bank: Number.isFinite(racer.bank) ? racer.bank : 0,
    climb: Math.asin(clamp(racer.forward?.[1] ?? 0, -1, 1)),
    fatigue: racer.effects?.some((e) => e.id === "daze") ? 0.6 : 0,
    time,
  };
  const dt = previous && Number.isFinite(time) ? time - previous.time : NaN;
  if (!(dt >= 0 && dt < 0.5)) return target;
  for (const [key, lag] of Object.entries(lags))
    target[key] =
      previous[key] + (target[key] - previous[key]) * (1 - Math.exp(-dt / lag));
  return target;
}

/** Linear blend of two motions; `time` follows `b`. */
export function blendMotion(a, b, k) {
  const from = resolveMotion(a),
    to = resolveMotion(b);
  const mixed = {};
  for (const key of ["effort", "glide", "bank", "climb", "fatigue", "flare", "stand", "impact"])
    mixed[key] = from[key] + (to[key] - from[key]) * k;
  mixed.time = b.time ?? a.time;
  return mixed;
}
