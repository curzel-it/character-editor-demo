const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// True when two distant stretches of the path pass close enough to thin the ground between them.
function folded(path, wall) {
  for (let i = 0; i < path.length; i += 2)
    for (let j = i + 2; j < path.length; j += 2) {
      const a = path[i],
        b = path[j];
      const gap = a.halfWidth + b.halfWidth + wall;
      if (b.s - a.s < gap * 1.6) continue;
      if (Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]) < gap)
        return true;
    }
  return false;
}

/**
 * Integrates a heading profile into a centreline starting at the origin along +X, at reference scale.
 * `profile(s, turnScale)` returns `{ halfWidth, floor, ceiling, heading, ... }`; the turn rate is
 * limited by the corridor width, and turns are damped until stretches no longer fold within `wall`.
 */
export function tracePath(profile, { count, step, wall = 230, turnRadius = 90 }) {
  const trace = (turnScale) => {
    const samples = [];
    let x = 0,
      z = 0,
      h = 0;
    for (let i = 0; i < count; i++) {
      const s = i * step,
        p = profile(s, turnScale);
      const y = p.floor + (p.ceiling - p.floor) * 0.42;
      if (i > 0) {
        const dy = y - samples[i - 1].position[1];
        const flat = Math.sqrt(Math.max(1, step * step - dy * dy));
        const turn = step / (Math.max(p.halfWidth, samples[i - 1].halfWidth) + turnRadius);
        h += clamp(profile(s - step / 2, turnScale).heading - h, -turn, turn);
        x += Math.cos(h) * flat;
        z += Math.sin(h) * flat;
      }
      samples.push({ s, position: [x, y, z], ...p });
    }
    return samples;
  };
  let path = trace(1);
  for (let scale = 0.8; scale > 0.2 && folded(path, wall); scale *= 0.8) path = trace(scale);
  for (let i = 0; i < count; i++) {
    const a = path[Math.max(0, i - 1)].position,
      b = path[Math.min(count - 1, i + 1)].position;
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      l = Math.hypot(...d);
    path[i].forward = d.map((v) => v / l);
  }
  return path;
}
