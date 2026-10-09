/** Bilinear terrain height at world (x, z); clamps outside the grid. */
export function terrainHeight(terrain, x, z) {
  const { origin, cellSize, columns, rows, heights } = terrain;
  const fx = Math.max(0, Math.min(columns - 1.001, (x - origin[0]) / cellSize)),
    fz = Math.max(0, Math.min(rows - 1.001, (z - origin[1]) / cellSize));
  const c = Math.floor(fx),
    r = Math.floor(fz),
    u = fx - c,
    v = fz - r,
    k = r * columns + c;
  const a = heights[k],
    b = heights[k + 1],
    d = heights[k + columns],
    e = heights[k + columns + 1];
  return a + (b - a) * u + (d - a) * v + (a - b - d + e) * u * v;
}

/** Highest of the four grid corners around (x, z): a conservative bound for any triangulation. */
export function terrainCeilingAt(terrain, x, z) {
  const { origin, cellSize, columns, rows, heights } = terrain;
  const c = Math.max(0, Math.min(columns - 2, Math.floor((x - origin[0]) / cellSize))),
    r = Math.max(0, Math.min(rows - 2, Math.floor((z - origin[1]) / cellSize))),
    k = r * columns + c;
  return Math.max(heights[k], heights[k + 1], heights[k + columns], heights[k + columns + 1]);
}
