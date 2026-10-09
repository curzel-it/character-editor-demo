import { racerFrame } from "../scene/racerFrame.js";

const MAX_YAW = 1.3,
  MAX_PITCH = 0.5;

/**
 * Yaw and pitch in radians from a flying racer's heading to a target point, clamped to how far the
 * neck can turn: yaw positive to its left, pitch positive up.
 */
export function breathAim(position, forward, bank, target) {
  const { forward: f, left, up } = racerFrame(forward, bank ?? 0);
  const d = target.map((v, k) => v - position[k]);
  const dot = (a) => a[0] * d[0] + a[1] * d[1] + a[2] * d[2];
  const x = dot(f),
    y = dot(left),
    z = dot(up);
  const clamp = (v, m) => Math.max(-m, Math.min(m, v));
  return { yaw: clamp(Math.atan2(y, x), MAX_YAW), pitch: clamp(Math.atan2(z, Math.hypot(x, y)), MAX_PITCH) };
}
