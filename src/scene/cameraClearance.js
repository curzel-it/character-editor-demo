const STEP = 0.01,
  RISE = 0.45,
  STEEPEST = 1.3;

/** How far from `target` along unit `d` the first of `blockers` begins, or Infinity. */
function firstHit(target, d, blockers) {
  let reach = Infinity;
  for (const { centre, yaw, halfA, halfB, top } of blockers) {
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    const ox = target[0] - centre[0],
      oz = target[2] - centre[1];
    const slabs = [
      [ox * c + oz * s, d[0] * c + d[2] * s, -halfA, halfA],
      [-ox * s + oz * c, -d[0] * s + d[2] * c, -halfB, halfB],
      [target[1], d[1], -Infinity, top],
    ];
    let enter = -Infinity,
      leave = Infinity;
    for (const [o, v, lo, hi] of slabs) {
      if (Math.abs(v) < 1e-9) {
        if (o < lo || o > hi) leave = -Infinity;
        continue;
      }
      const t0 = (lo - o) / v,
        t1 = (hi - o) / v;
      enter = Math.max(enter, Math.min(t0, t1));
      leave = Math.min(leave, Math.max(t0, t1));
    }
    if (enter <= leave && enter > 0) reach = Math.min(reach, enter);
  }
  return reach;
}

/**
 * How the camera `shot` stays clear of `blockers`, each a footprint `{ centre: [x, z], yaw, halfA,
 * halfB, top }` standing on the ground up to `top`, when one stands between it and its target: by
 * rising around the target at the same distance, at most `RISE` above where it was aimed, until it
 * sees over it. Returns the risen shot, the shot itself when nothing is in the way, or null when
 * rising is not enough.
 * @param {{ eye: number[], target: number[] }} shot
 * @param {{ centre: number[], yaw: number, halfA: number, halfB: number, top: number }[]} blockers
 */
export function riseOverBlockers(shot, blockers) {
  const { eye, target } = shot;
  const span = Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]);
  if (!span || !blockers.length) return shot;
  const d = [0, 1, 2].map((k) => (eye[k] - target[k]) / span);
  if (firstHit(target, d, blockers) >= span) return shot;
  const flat = Math.hypot(d[0], d[2]) || 1;
  const from = Math.asin(d[1]),
    to = Math.min(STEEPEST, from + RISE);
  for (let up = from + STEP; up <= to + 1e-9; up += STEP) {
    const dir = [(d[0] / flat) * Math.cos(up), Math.sin(up), (d[2] / flat) * Math.cos(up)];
    if (firstHit(target, dir, blockers) >= span) return { ...shot, eye: [0, 1, 2].map((k) => target[k] + dir[k] * span) };
  }
  return null;
}

/** Whether the walls of any of `blockers`, `margin` thicker, stand between the camera `shot` and its target or around its eye. */
export function hidesTarget({ eye, target }, blockers, margin = 0.5) {
  const span = Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]);
  if (!span) return false;
  const walls = blockers.map((b) => ({ ...b, halfA: b.wall[0] + margin, halfB: b.wall[1] + margin }));
  return firstHit(target, [0, 1, 2].map((k) => (eye[k] - target[k]) / span), walls) < span;
}

/**
 * The camera `shot` kept clear of `blockers`: risen over them as `riseOverBlockers` does, or else
 * drawn in along its line of sight to stand `margin` in front of the first.
 */
export function clearOfBlockers(shot, blockers, margin = 0.6) {
  const risen = riseOverBlockers(shot, blockers);
  if (risen) return risen;
  const { eye, target } = shot;
  const span = Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]);
  const d = [0, 1, 2].map((k) => (eye[k] - target[k]) / span);
  const at = Math.max(margin, firstHit(target, d, blockers) - margin);
  return { ...shot, eye: [0, 1, 2].map((k) => target[k] + d[k] * at) };
}
