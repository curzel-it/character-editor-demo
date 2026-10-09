/**
 * Keeps solid landmarks out of the flyable corridor. `solids` are vertical capsules
 * `{ a: [x, z], b: [x, z], radius, top }` in the path's units. Where a solid reaches into a sample's
 * corridor slab, the corridor narrows to pass beside it, or, if that would leave less than
 * `minHalfWidth`, its floor rises above the solid's top. Mutates and returns `path`.
 */
export function clearCorridor(path, solids, { margin, clearance, minHalfWidth, minSpan, reach }) {
  for (const p of path) {
    const f = p.forward,
      l = Math.hypot(f[0], f[2]) || 1;
    const fx = f[0] / l,
      fz = f[2] / l;
    for (const solid of solids) {
      if (solid.top <= p.floor) continue;
      let low = Infinity,
        high = -Infinity;
      for (let k = 0; k <= 8; k++) {
        const x = solid.a[0] + ((solid.b[0] - solid.a[0]) * k) / 8,
          z = solid.a[1] + ((solid.b[1] - solid.a[1]) * k) / 8;
        const dx = x - p.position[0],
          dz = z - p.position[2];
        const along = dx * fx + dz * fz,
          lateral = -dx * fz + dz * fx;
        if (Math.abs(along) > reach + solid.radius) continue;
        low = Math.min(low, lateral - solid.radius);
        high = Math.max(high, lateral + solid.radius);
      }
      if (low > high) continue;
      const edge = p.halfWidth + margin;
      if (high < -edge || low > edge) continue;
      const room = low > 0 ? low - margin : high < 0 ? -high - margin : -Infinity;
      if (room >= minHalfWidth) p.halfWidth = Math.min(p.halfWidth, room);
      else {
        p.floor = Math.max(p.floor, solid.top + clearance);
        p.ceiling = Math.max(p.ceiling, p.floor + minSpan);
      }
    }
  }
  return path;
}
