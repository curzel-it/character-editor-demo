const fade = (t) => t * t * (3 - 2 * t);

/** Seeded 2D value noise in [0, 1]. @param {() => number} random */
export function createNoise2(random) {
  const size = 256,
    table = new Float32Array(size),
    perm = new Uint8Array(size * 2);
  for (let i = 0; i < size; i++) {
    table[i] = random();
    perm[i] = i;
  }
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < size; i++) perm[i + size] = perm[i];
  const at = (x, z) => table[perm[(perm[x & 255] + z) & 511]];
  return (x, z) => {
    const xi = Math.floor(x),
      zi = Math.floor(z),
      u = fade(x - xi),
      v = fade(z - zi);
    const a = at(xi, zi),
      b = at(xi + 1, zi),
      c = at(xi, zi + 1),
      d = at(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Fractal sum of value noise, normalised to [0, 1]. */
export function fbm(noise, x, z, octaves = 3) {
  let sum = 0,
    weight = 0,
    amplitude = 1,
    frequency = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * frequency + i * 17.3, z * frequency - i * 9.1) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return sum / weight;
}

/** Smooth seeded 1D profile in [0, 1] built from a few sinusoids. */
export function createWave(random, minWavelength, maxWavelength, count = 3) {
  const waves = Array.from({ length: count }, (_, i) => ({
    k:
      (Math.PI * 2) /
      (minWavelength + random() * (maxWavelength - minWavelength)),
    phase: random() * Math.PI * 2,
    weight: 1 / (i + 1),
  }));
  const total = waves.reduce((sum, w) => sum + w.weight, 0);
  return (s) =>
    0.5 +
    (0.5 *
      waves.reduce((sum, w) => sum + Math.sin(s * w.k + w.phase) * w.weight, 0)) /
      total;
}

export const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
