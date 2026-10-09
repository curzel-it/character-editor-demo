/** Orthonormal body frame of a racer: forward, banked left (wing axis) and banked up. */
export function racerFrame(forward, bank = 0) {
  const fl = Math.hypot(...forward) || 1;
  const f = forward.map((v) => v / fl);
  const ll = Math.hypot(f[2], f[0]) || 1;
  const left = [-f[2] / ll, 0, f[0] / ll];
  const up = [left[1] * f[2] - left[2] * f[1], left[2] * f[0] - left[0] * f[2], left[0] * f[1] - left[1] * f[0]];
  const c = Math.cos(bank),
    s = Math.sin(bank);
  return {
    forward: f,
    up: up.map((v, i) => v * c + left[i] * s),
    left: left.map((v, i) => v * c - up[i] * s),
  };
}
