const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const leftOf = (f) => {
  const l = Math.hypot(f[0], f[2]) || 1;
  return [-f[2] / l, 0, f[0] / l];
};
const round = (v) => Math.round(v * 1000) / 1000 + 0;
/** Steepest climb and dive from one gate to the next, as height per distance along the course. */
const maxClimb = 0.18,
  maxDive = 0.3;

/** Moves each gate but the fixed ones within a climb or dive of its neighbours, keeping it inside its corridor. */
function flyable(gates) {
  const bound = (g, other, up, down) => {
    const ds = Math.abs(g.p.s - other.p.s);
    const span = g.p.ceiling - g.p.floor;
    const lo = g.p.floor + Math.min(g.radius + 5, span / 2),
      hi = Math.max(lo, g.p.ceiling - g.radius - 5);
    g.y = clamp(clamp(g.y, other.y - down * ds, other.y + up * ds), lo, hi);
  };
  for (let i = 1; i < gates.length; i++) if (!gates[i].fixed) bound(gates[i], gates[i - 1], maxClimb, maxDive);
  for (let i = gates.length - 2; i >= 0; i--) if (!gates[i].fixed) bound(gates[i], gates[i + 1], maxDive, maxClimb);
}

/**
 * Evenly spaced, jittered gates along a reference-scale path; the last is the finish.
 * `fixed` gates `{ s, lateral, y, radius }` replace the nearest generated gate, so a course can
 * force a line past a landmark. `maxLateral` limits how far gates stray from the centreline.
 * `share` scales the gate count with a course shortened to that share of its full length, keeping the spacing.
 * Each gate sits no higher or lower than a dragon can climb or dive from its neighbours.
 */
export function placeGates(path, random, { length, step, first = 220, fixed = [], maxLateral = Infinity, share = 1 }) {
  const gateCount = Math.max(6, Math.round((12 + Math.floor(random() * 9)) * share));
  const spacing = (length - first) / (gateCount - 1);
  const gates = [];
  for (let i = 0; i < gateCount; i++) {
    const finish = i === gateCount - 1;
    let s = first + i * spacing;
    if (i > 0 && !finish) s += (random() - 0.5) * 0.4 * spacing;
    const p = path[Math.round(s / step)];
    const span = p.ceiling - p.floor;
    const radius = Math.min(finish ? 24 : 12 + random() * 6, p.halfWidth - 4, span / 2 - 4);
    const lateralRoom = Math.min(maxLateral, Math.max(0, p.halfWidth - radius - 6));
    const lateral = finish ? 0 : (random() * 2 - 1) * lateralRoom * 0.7;
    const lo = p.floor + radius + 5,
      hi = p.ceiling - radius - 5;
    const y = finish
      ? clamp(p.position[1], lo, hi)
      : clamp(p.position[1] + (random() * 2 - 1) * span * 0.22, lo, hi);
    gates.push({ index: i, p, lateral, y, radius });
  }
  for (const want of fixed) {
    const p = path[Math.round(want.s / step)];
    let best = -1;
    gates.forEach((g, i) => {
      if (i === gates.length - 1) return;
      if (best < 0 || Math.abs(g.p.s - p.s) < Math.abs(gates[best].p.s - p.s)) best = i;
    });
    if (best < 0) continue;
    const prev = gates[best - 1]?.p.s ?? -Infinity,
      next = gates[best + 1].p.s;
    if (p.s <= prev || p.s >= next) continue;
    gates[best] = { index: best, p, lateral: want.lateral, y: want.y, radius: want.radius, fixed: true };
  }
  flyable(gates);
  return gates.map(({ index, p, lateral, y, radius }) => {
    const left = leftOf(p.forward);
    return {
      index,
      s: p.s,
      position: [p.position[0] + left[0] * lateral, y, p.position[2] + left[2] * lateral].map(round),
      forward: p.forward.map(round),
      radius: round(radius),
    };
  });
}
