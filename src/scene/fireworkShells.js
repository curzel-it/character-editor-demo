/**
 * @typedef {{ dir: number[], speed: number, life: number, drag: number, fall: number, trail: number,
 *   segments: number, head: number, twinkle: number, strobe: number, crackle: number, drips: number }} Star
 */

const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** A random rotation, applied to a direction. */
function turner(random) {
  const a = random() * Math.PI * 2,
    b = Math.acos(random() * 2 - 1),
    c = random() * Math.PI * 2;
  const [ca, sa, cb, sb, cc, sc] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b), Math.cos(c), Math.sin(c)];
  return ([x, y, z]) => {
    const x1 = x * ca - z * sa,
      z1 = x * sa + z * ca;
    const y2 = y * cb - z1 * sb,
      z2 = y * sb + z1 * cb;
    return [x1 * cc - y2 * sc, x1 * sc + y2 * cc, z2];
  };
}

/** `count` directions spread evenly over the sphere, jittered. */
function sphere(count, random, jitter = 0.08) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const offset = random() * Math.PI * 2;
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count,
      r = Math.sqrt(1 - y * y),
      a = i * golden + offset;
    return unit([r * Math.cos(a) + (random() - 0.5) * jitter, y + (random() - 0.5) * jitter, r * Math.sin(a) + (random() - 0.5) * jitter]);
  });
}

const base = { trail: 0, segments: 1, head: 1, twinkle: 0, strobe: 0, crackle: 0, drips: 0 };

/** Fire: a round peony of gold stars that crackle into sparks as they burn out. */
function peony(count, random) {
  return sphere(count, random).map((dir) => ({
    ...base,
    dir,
    speed: 0.88 + 0.16 * random(),
    life: 1.3 + 0.45 * random(),
    drag: 2.2,
    fall: 0.55,
    trail: 0.16,
    segments: 2,
    head: 1.1,
    twinkle: 0.15,
    crackle: random() < 0.6 ? 3 : 0,
  }));
}

/** Water: a crystal of spokes along a cube's axes and diagonals, glittering where it hangs. */
function crystal(count, random) {
  const turn = turner(random);
  const spokes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) spokes.push(unit([x, y, z]));
  const stars = [];
  const steps = [0.3, 0.55, 0.8, 1.05];
  for (let i = 0; stars.length < count * 0.9; i++) {
    const spoke = spokes[i % spokes.length],
      step = steps[Math.floor(i / spokes.length) % steps.length];
    stars.push({ dir: turn(spoke), speed: step * (i < spokes.length * steps.length ? 1 : 0.9 + 0.2 * random()), long: i % spokes.length < 6 });
  }
  const rest = sphere(count - stars.length, random, 0.3).map((dir) => ({ dir, speed: 0.25 + 0.3 * random() }));
  return [...stars, ...rest].map(({ dir, speed, long }) => ({
    ...base,
    dir,
    speed: speed * (long ? 1.12 : 0.92),
    life: 1.9 + 0.5 * random(),
    drag: 2.8,
    fall: 0.06,
    trail: 0.1,
    head: 1.5,
    twinkle: 0.65,
  }));
}

/** Nature: a weeping willow whose long trails droop and drip. */
function willow(count, random) {
  return sphere(count, random, 0.2).map(([x, y, z]) => ({
    ...base,
    dir: unit([x, Math.abs(y) * 0.8 + 0.25, z]),
    speed: 0.62 + 0.2 * random(),
    life: 2.3 + 0.6 * random(),
    drag: 1.7,
    fall: 0.85,
    trail: 0.5,
    segments: 4,
    head: 0.8,
    twinkle: 0.1,
    drips: random() < 0.5 ? 2 : 1,
  }));
}

/** Storm: a tilted ring that strobes, with forks of lightning from its heart. */
function ring(count, random) {
  const turn = turner(random);
  const ringCount = Math.round(count * 0.72);
  const stars = Array.from({ length: ringCount }, (_, i) => {
    const a = (i / ringCount) * Math.PI * 2 + (random() - 0.5) * 0.05;
    return { dir: turn(unit([Math.cos(a), (random() - 0.5) * 0.06, Math.sin(a)])), speed: 1 + 0.08 * random() };
  });
  const inner = sphere(count - ringCount, random, 0.3).map((dir) => ({ dir, speed: 0.4 + 0.3 * random() }));
  return [...stars, ...inner].map((star) => ({
    ...base,
    ...star,
    life: 0.95 + 0.35 * random(),
    drag: 3,
    fall: 0.12,
    trail: 0.09,
    head: 1.3,
    strobe: 0.28,
  }));
}

/** Earth: a heavy burst of big, slow stars that tumble down fast in short, thick trails. */
function boulders(count, random) {
  return sphere(Math.round(count * 0.7), random, 0.35).map((dir) => ({
    ...base,
    dir,
    speed: 0.7 + 0.25 * random(),
    life: 1.4 + 0.4 * random(),
    drag: 2.6,
    fall: 1.3,
    trail: 0.12,
    segments: 2,
    head: 1.8,
  }));
}

const patterns = { fire: peony, nature: willow, earth: boulders, storm: ring, water: crystal };

/**
 * The stars of one element's burst, in unit terms: `dir` and `speed` (the share of the burst's reach
 * where the star comes to rest), `life` in seconds, `drag` per second, `fall` as reach per second
 * squared, and how it draws: a `trail` of that many seconds in `segments`, a glinting `head`, `twinkle`
 * and `strobe` shares, and the `crackle` sparks and nature `drips` it leaves.
 * @param {string} element a `breathElements` id
 * @param {number} count
 * @param {() => number} random
 * @returns {Star[]}
 */
export function shellStars(element, count, random) {
  return (patterns[element] ?? peony)(count, random);
}
