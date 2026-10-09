/** A faceted puff: an octagonal lens, flat beneath, domed above. */
function puff(builder, [x, y, z], [rx, ry, rz], env, random) {
  const sides = 8,
    a0 = random() * Math.PI;
  const ring = (k, f, h) => {
    const a = a0 + (k / sides) * Math.PI * 2;
    return [x + Math.cos(a) * rx * f, y + h, z + Math.sin(a) * rz * f];
  };
  const top = [x, y + ry, z],
    bottom = [x, y - ry * 0.15, z];
  builder.lump(() => {
    for (let k = 0; k < sides; k++) {
      const shade = 1.2 + random() * 0.1;
      builder.quad(ring(k, 1, 0), ring(k + 1, 1, 0), ring(k + 1, 0.7, ry * 0.6), ring(k, 0.7, ry * 0.6), env.cloud, 0, shade);
      builder.tri(ring(k, 0.7, ry * 0.6), ring(k + 1, 0.7, ry * 0.6), top, env.cloud, 0, shade);
      builder.tri(ring(k + 1, 1, 0), ring(k, 1, 0), bottom, env.cloudShade, 0, 1.1);
    }
  });
}

/**
 * Fair-weather clouds in a ring around `centre` [x, z], each a cluster of puffs with a flat base,
 * high enough to sit over the far ranges.
 */
export function addClouds(builder, centre, env, random, { count = 16, near = 7000, far = 11000, base = 1300 } = {}) {
  for (let n = 0; n < count; n++) {
    const a = (n / count) * Math.PI * 2 + random() * 0.4,
      d = near + random() * (far - near);
    const cx = centre[0] + Math.cos(a) * d,
      cz = centre[1] + Math.sin(a) * d,
      cy = base + random() * 900;
    const size = 450 + random() * 450,
      puffs = 4 + Math.floor(random() * 4);
    const along = [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)];
    for (let k = 0; k < puffs; k++) {
      const t = puffs > 1 ? k / (puffs - 1) - 0.5 : 0;
      const r = size * (0.5 + 0.5 * Math.cos(t * Math.PI)) * (0.7 + random() * 0.4);
      const off = t * size * 2.6 + (random() - 0.5) * size * 0.3;
      puff(builder, [cx + along[0] * off, cy, cz + along[1] * off], [r, r * (0.55 + random() * 0.3), r * 0.8], env, random);
    }
  }
}
