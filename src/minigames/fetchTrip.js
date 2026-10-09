const WATCH = 0.45,
  TURN = 0.35,
  LEAP = 0.3,
  OUT = 0.9,
  SEARCH = 0.45,
  BACK = 1.8,
  LAND = 0.4,
  PRANCE = 1.1,
  PROUD = 0.9,
  NEAR = 2.4,
  HOPS = 3;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t) => t * t * (3 - 2 * t);
const bump = (t, from, to) => (t > from && t < to ? Math.sin((Math.PI * (t - from)) / (to - from)) : 0);
const yawOf = (v) => Math.atan2(v[2], v[0]);
const heading = (a) => [Math.cos(a), 0, Math.sin(a)];

/** The heading `k` of the way from `a` to `b`, the short way round. */
function turnTo(a, b, k) {
  const from = yawOf(a);
  const off = Math.atan2(Math.sin(yawOf(b) - from), Math.cos(yawOf(b) - from));
  return heading(from + off * ease(clamp01(k)));
}

/**
 * The dragon's run after a throw: it watches the stick go, turns after it, leaps up and flies off
 * `distance` metres along `dir`, there `arrive` seconds after the throw or as soon as it can, swoops
 * down to snatch up what it finds, flies back carrying it, lands
 * behind its spot, prances back to it beaming and holds its find up proudly before dropping it. `from` is its
 * spot, `facing` the way it faces there and `radius` its size. `at(since)` gives where it is (`position`,
 * its height over the ground as Y), its `forward`, its pose `motion`, whether it is `carrying` and whether
 * it has `dropped` its find; `length` is when it is done.
 * @param {{ from: number[], facing: number[], dir: number[], distance: number, radius: number, arrive?: number }} trip
 */
export function fetchTrip({ from, facing, dir, distance, radius, arrive = 0 }) {
  const turned = WATCH + TURN,
    leapt = turned + LEAP,
    out = Math.max(leapt + OUT, arrive),
    back = out + SEARCH,
    home = back + BACK,
    landed = home + LAND,
    pranced = landed + PRANCE,
    length = pranced + PROUD;
  const ground = (k) => from.map((v, i) => v + dir[i] * k);
  const near = ground(NEAR * radius);
  const far = ground(distance);
  const high = 0.15 * distance + 0.6 * radius;

  function at(since) {
    const t = Math.max(0, since);
    if (t < leapt) {
      const look = bump(t, 0, WATCH + 0.2);
      const crouch = bump(t, WATCH, leapt);
      const rise = t > turned ? ease((t - turned) / LEAP) : 0;
      return {
        position: [from[0], rise * 0.4 * radius, from[2]],
        forward: turnTo(facing, dir, (t - WATCH) / TURN),
        motion: { breathPitch: 0.55 * look, impact: 0.6 * crouch, stand: 1 - rise, wings: rise, spring: t > turned ? -1 + 2 * rise : -crouch, roar: 0.3 * look },
        carrying: false,
        dropped: false,
      };
    }
    if (t < back) {
      const u = clamp01((t - leapt) / (out - leapt));
      const along = distance * u * u * (1.6 - 0.6 * u);
      const height = 0.4 * radius * (1 - bump(t, out, back)) + high * Math.sin(Math.PI * Math.min(1, u * 1.05));
      return { position: [from[0] + dir[0] * along, height, from[2] + dir[2] * along], forward: dir, motion: { stand: 0, glide: 0, effort: 0.9, climb: 0.5 * Math.cos(Math.PI * u) }, carrying: false, dropped: false };
    }
    if (t < landed) {
      const u = clamp01((t - back) / BACK);
      const k = 1 - (1 - u) ** 2;
      const flare = ease(clamp01((t - home + 0.5) / 0.5));
      const position = far.map((v, i) => v + (near[i] - v) * k);
      position[1] = t < home ? (0.5 * high * (1 - k) + 0.6 * radius) * (1 - flare) : 0;
      const touch = bump(t, home - 0.05, landed);
      return {
        position,
        forward: dir.map((v) => -v),
        motion: { stand: t < home ? 0.6 * flare : 1, glide: 0.3, effort: 0.6 * (1 - flare), climb: -0.3 * (1 - flare), flare: t < home ? flare : 0, impact: 0.8 * touch, roar: 0.25 },
        carrying: true,
        dropped: false,
      };
    }
    if (t < pranced) {
      const u = (t - landed) / PRANCE;
      const position = near.map((v, i) => v + (from[i] - v) * ease(u));
      position[1] = 0.18 * radius * Math.abs(Math.sin(Math.PI * HOPS * u));
      return { position, forward: dir.map((v) => -v), motion: { impact: 0.5 * (1 - Math.abs(Math.sin(Math.PI * HOPS * u))), breathPitch: 0.2, roar: 0.25, glee: ease(clamp01(u / 0.3)) }, carrying: true, dropped: false };
    }
    const u = clamp01((t - pranced) / PROUD);
    const drop = u > 0.8;
    return {
      position: [from[0], 0, from[2]],
      forward: turnTo(dir.map((v) => -v), facing, u / 0.5),
      motion: { breathPitch: 0.35 * bump(u, 0, 0.9) - (drop ? 0.2 : 0), breathYaw: 0.25 * Math.sin(u * 14) * bump(u, 0.2, 0.85), roar: drop ? 0.5 : 0.25, impact: 0.3 * bump(u, 0.8, 1), glee: 1 - ease(clamp01((u - 0.8) / 0.2)) },
      carrying: !drop,
      dropped: drop,
    };
  }

  return { length, at, landsAt: out };
}
