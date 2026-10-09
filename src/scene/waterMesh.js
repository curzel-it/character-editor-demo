const OPEN = [0, 1e4];

/**
 * Lake surfaces and the river ribbon from valley course features, for the water shader (see
 * waterShaders.js). `banks` holds, per vertex, the signed offset across the river and its half-width
 * (metres), so the shader can find the distance to either bank; lakes are open water. Courses without
 * water give an empty mesh.
 * @returns {{ positions: Float32Array, banks: Float32Array }}
 */
export function buildWaterMesh(course) {
  const positions = [],
    banks = [];
  const tri = (a, b, c, bank = [OPEN, OPEN, OPEN]) => {
    positions.push(...a, ...b, ...c);
    for (const k of bank) banks.push(...k);
  };
  const lakes = (course.features || []).filter((f) => f.type === "lake");
  for (const lake of lakes) {
    const [cx, , cz] = lake.position;
    const f = lake.forward,
      l = [-f[2], 0, f[0]];
    const y = lake.level + 0.25;
    const at = (a) => {
      const u = Math.cos(a) * lake.halfLength * 1.16,
        v = Math.sin(a) * lake.halfWidth * 1.16;
      return [cx + f[0] * u + l[0] * v, y, cz + f[2] * u + l[2] * v];
    };
    const centre = [cx, y, cz];
    for (let k = 0; k < 40; k++) tri(at((k / 40) * Math.PI * 2), at(((k + 1) / 40) * Math.PI * 2), centre);
  }
  const inLake = (x, z) =>
    lakes.some((lake) => {
      const dx = x - lake.position[0],
        dz = z - lake.position[2];
      const a = (dx * lake.forward[0] + dz * lake.forward[2]) / lake.halfLength,
        b = (-dx * lake.forward[2] + dz * lake.forward[0]) / lake.halfWidth;
      return a * a + b * b < 1;
    });
  for (const river of (course.features || []).filter((f) => f.type === "river")) {
    const points = river.points;
    const edges = points.map((p, i) => {
      const a = points[Math.max(0, i - 1)],
        b = points[Math.min(points.length - 1, i + 1)];
      const dx = b[0] - a[0],
        dz = b[2] - a[2],
        len = Math.hypot(dx, dz) || 1;
      const lx = -dz / len,
        lz = dx / len;
      return [
        [p[0] + lx * p[3], p[1], p[2] + lz * p[3]],
        [p[0] - lx * p[3], p[1], p[2] - lz * p[3]],
      ];
    });
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i],
        b = points[i + 1];
      if (a[3] < 0.5 && b[3] < 0.5) continue;
      if (inLake(a[0], a[2]) && inLake(b[0], b[2])) continue;
      const left = (p) => [p[3], p[3]],
        right = (p) => [-p[3], p[3]];
      tri(edges[i][0], edges[i + 1][0], edges[i + 1][1], [left(a), left(b), right(b)]);
      tri(edges[i][0], edges[i + 1][1], edges[i][1], [left(a), right(b), right(a)]);
    }
  }
  return { positions: new Float32Array(positions), banks: new Float32Array(banks) };
}
