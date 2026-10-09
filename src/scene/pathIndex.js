/**
 * Nearest-point lookups against a polyline of `{ position, forward?, halfWidth? }` samples, bucketed
 * on a grid of `cell` metres. `clearance(x, z)` is the horizontal distance beyond the corridor edge,
 * negative inside, and Infinity farther than a bucket away.
 */
export function createPathIndex(samples, cell = 300) {
  const buckets = new Map();
  const key = (c, r) => c * 73856093 + r;
  samples.forEach((p, i) => {
    const k = key(Math.floor(p.position[0] / cell), Math.floor(p.position[2] / cell));
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  });
  function nearest(x, z) {
    const c = Math.floor(x / cell),
      r = Math.floor(z / cell);
    let best = -1,
      bestD = Infinity;
    for (let dc = -1; dc <= 1; dc++)
      for (let dr = -1; dr <= 1; dr++)
        for (const i of buckets.get(key(c + dc, r + dr)) || []) {
          const p = samples[i].position;
          const d = (p[0] - x) ** 2 + (p[2] - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
    return best < 0 ? null : { index: best, sample: samples[best], distance: Math.sqrt(bestD) };
  }
  function clearance(x, z) {
    const hit = nearest(x, z);
    if (!hit) return Infinity;
    const { sample } = hit;
    if (!sample.forward) return hit.distance - (sample.halfWidth ?? 0);
    const f = sample.forward,
      l = Math.hypot(f[0], f[2]) || 1;
    const lateral = (-(x - sample.position[0]) * f[2] + (z - sample.position[2]) * f[0]) / l;
    return Math.abs(lateral) - sample.halfWidth;
  }
  return { nearest, clearance };
}
