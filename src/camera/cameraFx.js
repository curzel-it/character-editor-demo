import { add, cross, dot, length, normalize, scale, sub } from "../vec3.js";

// Incommensurate sines: smooth, deterministic handheld noise in [-1, 1].
const wobble = (t, a, b, c) => (Math.sin(t * a) * 0.5 + Math.sin(t * b + 1.7) * 0.3 + Math.sin(t * c + 4.1) * 0.2);

/**
 * Handheld motion for a director shot at race time t, as a pure function of both.
 * Uses the shot's `shake`, `roll`, `energy` and touchdown `thud` (0 when absent). `motion` scales every effect,
 * so reduced-motion viewers can pass a small value. Returns a new shot.
 */
export function applyCameraFx(shot, t, { motion = 1 } = {}) {
  const shake = (shot.shake ?? 0) * motion,
    energy = shot.energy ?? 0;
  const view = sub(shot.target, shot.eye);
  const distance = length(view);
  if (!distance) return shot;
  const dir = scale(view, 1 / distance);
  const baseUp = shot.up ?? [0, 1, 0];
  const right = normalize(cross(dir, baseUp)),
    up = cross(right, dir);
  // Angular amplitude grows with speed and shrinks with the lens, so long lenses stay usable.
  const amp = shake * (0.0025 + 0.011 * energy) * Math.min(1.4, (shot.fov ?? 0.8) / 0.7);
  const jitter = shake * energy * 0.004 * Math.min(1.4, (shot.fov ?? 0.8) / 0.7);
  // A touchdown near a camera on the ground: a sharp, fast-decaying jolt, mostly vertical.
  const thud = (shot.thud ?? 0) * motion;
  const yaw =
      amp * wobble(t, 3.1, 7.3, 13.7) + jitter * wobble(t, 29.3, 41.9, 57.1) + thud * 0.012 * wobble(t + 2, 41.3, 59.9, 73.1),
    pitch =
      amp * wobble(t + 11, 2.7, 6.1, 15.3) + jitter * wobble(t + 5, 31.7, 43.1, 61.3) + thud * 0.032 * wobble(t + 9, 37.1, 53.3, 67.7);
  const target = add(shot.eye, scale(add(dir, add(scale(right, yaw), scale(up, pitch))), distance));
  const angle =
    (shot.roll ?? 0) * motion + shake * energy * 0.012 * wobble(t + 3, 1.9, 4.7, 9.1) + thud * 0.02 * wobble(t + 7, 29.9, 47.3, 61.7);
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const rolled = normalize(add(scale(up, c), scale(right, s)));
  const kick = 1 + 0.2 * energy * motion * (shot.shot === "leader" || shot.shot === "rider" ? 0.3 : 1);
  const fov = Math.min(1.35, (shot.fov ?? 0.8) * kick * (1 - 0.05 * thud));
  return { ...shot, target, up: dot(rolled, rolled) > 0.5 ? rolled : baseUp, fov };
}
