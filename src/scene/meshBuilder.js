/**
 * Flat-shaded triangle soup for static scenery, in the world shader's layout: positions, colors
 * (rgb + emissive), surface (facet shade, flat weight: 0 lets the shader paint strata, 2 marks foliage) and normals.
 * `lumps` lists the `[first, end)` triangle ranges drawn inside `lump`, the pieces a rounding style may smooth,
 * and `blends` those drawn inside `blend`, whose colours a soft style may blend across shared corners.
 */
export function createBuilder() {
  let parts = null;
  const positions = [],
    colors = [],
    surface = [],
    normals = [],
    lumps = [],
    blends = [];
  return {
    strata: false,
    tri(a, b, c, color, emissive = 0, shade = 1, foliage = false) {
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      const ux = b[0] - a[0],
        uy = b[1] - a[1],
        uz = b[2] - a[2],
        vx = c[0] - a[0],
        vy = c[1] - a[1],
        vz = c[2] - a[2];
      let nx = uy * vz - uz * vy,
        ny = uz * vx - ux * vz,
        nz = ux * vy - uy * vx;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
      const flat = foliage ? 2 : this.strata ? 0 : 1;
      for (let i = 0; i < 3; i++) {
        colors.push(color[0], color[1], color[2], emissive);
        surface.push(shade, flat);
        normals.push(nx, ny, nz);
      }
    },
    /** A foliage triangle with its own corner normals `[na, nb, nc]`, kept whichever side is seen. */
    shaded(a, b, c, corners, color, shade = 1) {
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      for (let i = 0; i < 3; i++) {
        colors.push(color[0], color[1], color[2], 0);
        surface.push(shade, 2);
        normals.push(corners[i][0], corners[i][1], corners[i][2]);
      }
    },
    quad(a, b, c, d, color, emissive = 0, shade = 1) {
      this.tri(a, b, c, color, emissive, shade);
      this.tri(a, c, d, color, emissive, shade);
    },
    /**
     * Draws a piece twice, each version into its own builder: `plain(builder)` for the plain styles and
     * `soft(builder)` for a soft one. The result keeps them apart as `styled: { flat, soft }`.
     */
    styled(plain, soft) {
      parts ??= { flat: createBuilder(), soft: createBuilder() };
      plain(parts.flat);
      soft(parts.soft);
    },
    /** Draws `draw()` as one rounded piece. */
    lump(draw) {
      const first = this.triangles;
      draw();
      if (this.triangles > first) lumps.push(first, this.triangles);
    },
    /** Draws `draw()` as one surface whose colours may blend from triangle to triangle. */
    blend(draw) {
      const first = this.triangles;
      draw();
      if (this.triangles > first) blends.push(first, this.triangles);
    },
    get triangles() {
      return positions.length / 9;
    },
    result: () => ({
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
      surface: new Float32Array(surface),
      normals: new Float32Array(normals),
      lumps: new Uint32Array(lumps),
      blends: new Uint32Array(blends),
      styled: parts && { flat: parts.flat.result(), soft: parts.soft.result() },
    }),
  };
}

/** Two builder results as one mesh, their styled pieces too. */
export function mergeMeshes(a, b) {
  const join = (key) => {
    const out = new Float32Array(a[key].length + b[key].length);
    out.set(a[key]);
    out.set(b[key], a[key].length);
    return out;
  };
  const ranges = (key) => {
    const out = new Uint32Array(a[key].length + b[key].length);
    out.set(a[key]);
    out.set(b[key].map((t) => t + a.positions.length / 9), a[key].length);
    return out;
  };
  const styled = a.styled && b.styled ? { flat: mergeMeshes(a.styled.flat, b.styled.flat), soft: mergeMeshes(a.styled.soft, b.styled.soft) } : (a.styled ?? b.styled ?? null);
  return { positions: join("positions"), colors: join("colors"), surface: join("surface"), normals: join("normals"), lumps: ranges("lumps"), blends: ranges("blends"), styled };
}

const ringPoint = (centre, radius, angle, y) => [centre[0] + Math.cos(angle) * radius, y, centre[1] + Math.sin(angle) * radius];

/** Vertical frustum around `centre` [x, z]; `cap` closes the top. */
export function column(builder, centre, radius, y0, y1, sides, color, { phase = 0, topRadius = radius, cap = false, shade = 1 } = {}) {
  for (let k = 0; k < sides; k++) {
    const a = phase + (k / sides) * Math.PI * 2,
      b = phase + ((k + 1) / sides) * Math.PI * 2;
    builder.quad(
      ringPoint(centre, radius, a, y0),
      ringPoint(centre, radius, b, y0),
      ringPoint(centre, topRadius, b, y1),
      ringPoint(centre, topRadius, a, y1),
      color,
      0,
      shade,
    );
    if (cap) builder.tri(ringPoint(centre, topRadius, a, y1), ringPoint(centre, topRadius, b, y1), [centre[0], y1, centre[1]], color, 0, shade);
  }
}

/** Cone from a ring at `y0` to an apex at `apexY`. */
export function cone(builder, centre, radius, y0, apexY, sides, color, phase = 0) {
  const apex = [centre[0], apexY, centre[1]];
  for (let k = 0; k < sides; k++) {
    const a = phase + (k / sides) * Math.PI * 2,
      b = phase + ((k + 1) / sides) * Math.PI * 2;
    builder.tri(ringPoint(centre, radius, a, y0), ringPoint(centre, radius, b, y0), apex, color, 0, 0.96 + (k % 2) * 0.06);
  }
}

/** Local frame helper: `to(a, b, y)` maps offsets along `yaw` (a) and across it (b) to world. */
export function frame(centre, yaw) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return (a, b, y) => [centre[0] + c * a - s * b, y, centre[1] + s * a + c * b];
}

/** Oriented box; `top: false` leaves it open for a roof. */
export function box(builder, centre, yaw, halfA, halfB, y0, y1, color, { top = true, shade = 1 } = {}) {
  const to = frame(centre, yaw);
  const corners = [
    [-halfA, -halfB],
    [halfA, -halfB],
    [halfA, halfB],
    [-halfA, halfB],
  ];
  for (let k = 0; k < 4; k++) {
    const [a0, b0] = corners[k],
      [a1, b1] = corners[(k + 1) % 4];
    builder.quad(to(a0, b0, y0), to(a1, b1, y0), to(a1, b1, y1), to(a0, b0, y1), color, 0, shade * (k % 2 ? 0.97 : 1));
  }
  if (top) builder.quad(...corners.map(([a, b]) => to(a, b, y1)), color, 0, shade);
}

/** `box` drawn as a lump, so a rounding style softens it into a pillow or a log. */
export function softBox(builder, ...rest) {
  builder.lump(() => box(builder, ...rest));
}

/** Pyramid or hipped roof over an oriented rectangle; `ridge` > 0 stretches the apex into a ridge. */
export function hipRoof(builder, centre, yaw, halfA, halfB, y0, apexY, color, ridge = 0) {
  const to = frame(centre, yaw);
  const p = [to(-halfA, -halfB, y0), to(halfA, -halfB, y0), to(halfA, halfB, y0), to(-halfA, halfB, y0)];
  const r0 = to(-ridge, 0, apexY),
    r1 = to(ridge, 0, apexY);
  builder.quad(p[0], p[1], r1, r0, color, 0, 0.94);
  builder.quad(p[2], p[3], r0, r1, color, 0, 1.04);
  builder.tri(p[1], p[2], r1, color, 0, 1);
  builder.tri(p[3], p[0], r0, color, 0, 0.98);
}

/** Gable roof along the yaw axis, closing both gable ends in `wall` colour. */
export function gableRoof(builder, centre, yaw, halfA, halfB, y0, ridgeY, color, wall, overhang = 0.6) {
  const to = frame(centre, yaw);
  const a = halfA + overhang,
    b = halfB + overhang;
  const drop = ((ridgeY - y0) / halfB) * overhang;
  builder.quad(to(-a, -b, y0 - drop), to(a, -b, y0 - drop), to(a, 0, ridgeY), to(-a, 0, ridgeY), color, 0, 0.94);
  builder.quad(to(a, b, y0 - drop), to(-a, b, y0 - drop), to(-a, 0, ridgeY), to(a, 0, ridgeY), color, 0, 1.04);
  builder.tri(to(-halfA, -halfB, y0), to(-halfA, halfB, y0), to(-halfA, 0, ridgeY), wall);
  builder.tri(to(halfA, halfB, y0), to(halfA, -halfB, y0), to(halfA, 0, ridgeY), wall);
}
