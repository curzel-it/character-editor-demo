/**
 * Faceted props built as a one-bone anatomy, so the scene draws them like a racer: lit, shaded,
 * outlined and casting shadows in either style. Triangles wind counter-clockwise seen from outside.
 */
export function createPropMesh() {
  const vertices = [],
    colors = [];
  const prop = {
    tri(a, b, c, color) {
      vertices.push(...a, ...b, ...c);
      colors.push(...color, ...color, ...color);
    },
    quad(a, b, c, d, color) {
      prop.tri(a, b, c, color);
      prop.tri(a, c, d, color);
    },
    /** An upright box from `y0` to `y1` around [x, z], half sizes `hx` and `hz`; `top` colours its lid. */
    box([x, z], hx, hz, y0, y1, color, top = color) {
      const c = (sx, y, sz) => [x + sx * hx, y, z + sz * hz];
      prop.quad(c(-1, y0, 1), c(1, y0, 1), c(1, y1, 1), c(-1, y1, 1), color);
      prop.quad(c(1, y0, -1), c(-1, y0, -1), c(-1, y1, -1), c(1, y1, -1), color);
      prop.quad(c(1, y0, 1), c(1, y0, -1), c(1, y1, -1), c(1, y1, 1), color);
      prop.quad(c(-1, y0, -1), c(-1, y0, 1), c(-1, y1, 1), c(-1, y1, -1), color);
      prop.quad(c(-1, y1, 1), c(1, y1, 1), c(1, y1, -1), c(-1, y1, -1), top);
    },
    /**
     * A body of revolution around the Y axis through [x, z]: `rings` are [radius, y] from the bottom
     * up, `sides` facets around; a ring of radius 0 closes it.
     */
    lathe([x, z], rings, sides, color) {
      const at = (r, y, i) => {
        const a = (i / sides) * Math.PI * 2;
        return [x + Math.cos(a) * r, y, z - Math.sin(a) * r];
      };
      for (let k = 0; k < rings.length - 1; k++) {
        const [r0, y0] = rings[k],
          [r1, y1] = rings[k + 1];
        for (let i = 0; i < sides; i++) {
          const a = at(r0, y0, i),
            b = at(r0, y0, i + 1),
            c = at(r1, y1, i + 1),
            d = at(r1, y1, i);
          if (r0 > 0) prop.tri(a, b, c, color);
          if (r1 > 0) prop.tri(a, c, d, color);
        }
      }
    },
    /** The anatomy the scene renderer takes, its bounds around every vertex. */
    anatomy() {
      const min = [Infinity, Infinity, Infinity],
        max = [-Infinity, -Infinity, -Infinity];
      for (let v = 0; v < vertices.length; v += 3)
        for (let k = 0; k < 3; k++) {
          min[k] = Math.min(min[k], vertices[v + k]);
          max[k] = Math.max(max[k], vertices[v + k]);
        }
      const center = min.map((v, k) => (v + max[k]) / 2);
      return {
        bones: [{ id: "prop", position: [0, 0, 0] }],
        parts: [{ bone: "prop", shape: "mesh", vertices: [...vertices], indices: Array.from({ length: vertices.length / 3 }, (_, i) => i), colors: [...colors] }],
        bounds: { center, radius: Math.hypot(...max.map((v, k) => v - center[k])) },
      };
    },
  };
  return prop;
}
