import { add, dot, normalize, scale, sub } from "../vec3.js";
import { apply, euler, turning } from "../mat3.js";
import { eyeFrame } from "../anatomy/dragonEyes.js";
import { smoothstep } from "./flightMotion.js";
import { hash } from "./flightNoise.js";

/** Seconds each idle glance holds before the eyes pick where to look next. */
const SLOT = 2.6;
/** Seconds the pupils take to slide to a new glance. */
const SHIFT = 0.3;
/** Share of glances spent looking straight ahead. */
const AHEAD = 0.45;

const pupils = new WeakMap();

/**
 * Where an idle dragon's eyes look at `time` (seconds) as `[forward, up]`, each -1..1 of the
 * pupils' reach: now and then they slide off to one side, mostly forwards or back, hold there a
 * while and come back to the rest, which looks straight out. The same `seed` and `time` always look
 * the same way.
 * @param {number} time
 * @param {number} seed
 * @returns {[number, number]}
 */
export function glanceOf(time, seed) {
  const at = time + 7.3 * hash(seed, 31),
    n = Math.floor(at / SLOT),
    k = smoothstep(0, SHIFT, at - n * SLOT);
  const [a, b] = [target(seed, n - 1), target(seed, n)];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

function target(seed, n) {
  if (hash(seed + 3, n) < AHEAD) return [0, 0];
  const forward = 2 * hash(seed + 5, n) - 1,
    up = 0.6 * (2 * hash(seed + 7, n) - 1);
  return [Math.sign(forward) * (0.45 + 0.55 * Math.abs(forward)), up];
}

/**
 * Slides each slit pupil over its iris towards `gaze` (`[forward, up]`, a direction no longer
 * than 1, in shares of the pupil's `gaze` reach): the pupil turns round the eye's ellipsoid and
 * rides on its surface, so it never leaves the iris or shows its edge.
 * @param {Record<string, { position?: number[], rotation?: number[] }>} bones
 * @param {{ parts: object[] }} anatomy
 * @param {[number, number]} gaze
 */
export function gazePose(bones, anatomy, [forward, up]) {
  const length = Math.hypot(forward, up);
  if (length < 1e-4) return;
  const k = Math.min(1, 1 / length);
  for (const eye of eyesOf(anatomy)) {
    const yaw = forward * k * eye.reach[forward > 0 ? 0 : 1],
      pitch = up * k * eye.reach[2];
    const [x, y, z] = eye.rest,
      tilted = [x, y * Math.cos(pitch) + z * Math.sin(pitch), z * Math.cos(pitch) - y * Math.sin(pitch)],
      u = [tilted[0] * Math.cos(yaw) + tilted[2] * Math.sin(yaw), tilted[1], tilted[2] * Math.cos(yaw) - tilted[0] * Math.sin(yaw)];
    const to = eye.toHead(u.map((v, i) => v * eye.radii[i])),
      turn = turning(eye.normalAt(eye.rest), eye.normalAt(u));
    bones[eye.bone] = { position: sub(to, apply(turn, eye.from)), rotation: euler(turn) };
  }
}

function eyesOf(anatomy) {
  if (pupils.has(anatomy)) return pupils.get(anatomy);
  const eyes = [];
  for (const s of [-1, 1]) {
    const pupil = anatomy.parts.find(({ id }) => id === `pupil-${s}`),
      eye = anatomy.parts.find(({ id }) => id === `eye-${s}`);
    if (!pupil?.gaze || !eye) continue;
    const { along, up, normal, radii } = eyeFrame(eye, s);
    const toHead = ([a, b, c]) => add(add(scale(along, a), scale(up, b)), scale(normal, c));
    const x = dot(pupil.position, along) / radii[0],
      y = dot(pupil.position, up) / radii[1],
      rest = [x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))];
    eyes.push({
      bone: pupil.bone,
      reach: pupil.gaze,
      radii,
      rest,
      toHead,
      from: toHead(rest.map((v, i) => v * radii[i])),
      normalAt: (u) => toHead(normalize(u.map((v, i) => v / radii[i]))),
    });
  }
  pupils.set(anatomy, eyes);
  return eyes;
}
