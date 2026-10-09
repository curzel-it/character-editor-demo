import { makeRng } from "../rng.js";
import { createNoise2, fbm } from "../course/noise.js";
import { frame } from "./meshBuilder.js";
import { addStableBarn } from "./stableBarn.js";
import { barrel, bucket, crate, hayBale, pebble, rusticFence, tub } from "./yardProps.js";
import { bush, flower, softTuft, tuft } from "./yardGrowth.js";

const BARN = { centre: [-11.4, -10.6], yaw: -0.61, length: 22, depth: 12, door: 5, window: -4.5 },
  DIRT = 8,
  GRASS = 34,
  CELL = 1.1,
  FENCE = [[3, -13.5], [11, -15.5], [22, -13.5], [33, -9], [42, -1]],
  BEDS = [[0, 0], [6, -1.5], [-5.5, -2.5], [2.5, -8.5], [-4, -10], [8, -8]],
  BED_OUT = 8,
  AIM_RIGHT = 4,
  BED = 3.4,
  SOFT_GRASS = 0.6;

const UP = [0, 1, 0];
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** `[x, z]` turned by `angle` about the vertical, the way that carries the barn's front round to its left end at a quarter turn. */
export const turnedBy = ([x, z], angle) => [x * Math.cos(angle) - z * Math.sin(angle), x * Math.sin(angle) + z * Math.cos(angle)];

/**
 * The sleeping side at the barn's left end: a bed per slot in an irregular grid, `[right, away]` of
 * the first as a camera there sees them, the first lying out from the end wall's middle. The beds
 * share a `turn`, the angle that carries the front's view round onto them, aimed so the end wall
 * stands behind and to the left of the first, as the front does at the front spot.
 */
function bedsOf() {
  const [cx, cz] = BARN.centre;
  const wall = [cx - Math.cos(BARN.yaw) * (BARN.length / 2), cz - Math.sin(BARN.yaw) * (BARN.length / 2)];
  const right = turnedBy([1, 0], Math.PI / 2),
    away = turnedBy([0, -1], Math.PI / 2);
  const first = [wall[0] - away[0] * BED_OUT + right[0] * 3, wall[1] - away[1] * BED_OUT + right[1] * 3];
  const aim = [wall[0] + right[0] * AIM_RIGHT, wall[1] + right[1] * AIM_RIGHT];
  const turn = Math.atan2(aim[0] - first[0], -(aim[1] - first[1]));
  return BEDS.map(([r, a]) => ({ position: [first[0] + right[0] * r + away[0] * a, 0, first[1] + right[1] * r + away[1] * a], turn }));
}

/** A bed of loose straw under a sleeping dragon: an irregular flat patch with a few tufts. */
function strawBed(builder, [x, , z], env, random) {
  const sides = 9,
    ring = Array.from({ length: sides }, (_, k) => {
      const a = (k / sides) * Math.PI * 2;
      const r = BED * (0.75 + random() * 0.35);
      return [x + Math.cos(a) * r * 1.2, 0.06, z + Math.sin(a) * r];
    });
  for (let k = 0; k < sides; k++) builder.tri([x, 0.07, z], ring[k], ring[(k + 1) % sides], lerp(env.hayDark, env.hay, random()), 0, 0.95 + random() * 0.1);
  for (let n = 0; n < 26; n++) {
    const a = random() * Math.PI * 2,
      d = Math.sqrt(random()) * BED;
    const px = x + Math.cos(a) * d * 1.1,
      pz = z + Math.sin(a) * d;
    const b = random() * Math.PI;
    builder.shaded([px - Math.cos(b) * 0.3, 0.08, pz - Math.sin(b) * 0.3], [px + Math.cos(b) * 0.3, 0.08, pz + Math.sin(b) * 0.3], [px, 0.2 + random() * 0.15, pz], [UP, UP, UP], lerp(env.hayDark, env.hay, random()));
  }
}

/**
 * The stable set around the spot at the origin, which the camera sees from +Z: the barn behind and
 * to the left with its door, banner and lantern facing the spot, a fence running off to the right with
 * hay behind it, a water tub, crates and barrels, a dirt yard trodden towards the barn door and
 * grass, flowers and bushes around it, and straw beds at the barn's left end where sleeping dragons
 * lie. Overhangs go to `overhang`, which casts no baked shadow; the barn itself goes to `barnParts`,
 * its own `{ builder, overhang }`. Props and bushes that may stand between the camera and the dragon each go to a
 * builder of their own from `screen()`, so the stable can fade them. The meadow's grass is styled: blades for the plain styles, softer and
 * sparser tufts for a soft one. Returns the barn's footprint in `blockers` and the beds' places as `beds`.
 */
export function addYardSet(builder, overhang, seed, env, barnParts, screen) {
  const random = makeRng(`yard-set:${seed}`);
  const softRandom = makeRng(`yard-set:${seed}:soft-grass`);
  const noise = createNoise2(makeRng(`yard-set:${seed}:ground`));
  const barn = addStableBarn(barnParts.builder, barnParts.overhang, BARN, env, random);
  const toBarn = frame(BARN.centre, BARN.yaw);
  const nearBarn = (a, b) => {
    const [x, , z] = toBarn(a, BARN.depth / 2 + b, 0);
    return [x, z];
  };
  const doorstep = nearBarn(BARN.door, 2);
  const beds = bedsOf();
  for (const bed of beds) strawBed(builder, bed.position, env, random);
  const onBed = (x, z) => beds.some(({ position: [bx, , bz] }) => Math.hypot(x - bx, z - bz) < BED * 1.1);

  /** How far into the trodden dirt a ground point is: above 1 inside, fading out over the edge. */
  const dirt = (x, z) => {
    const ragged = 0.75 + 0.5 * fbm(noise, x / 7, z / 7, 2);
    const open = 1 - Math.hypot(x / (DIRT * 1.15), z / DIRT) / ragged;
    const [dx, dz] = [doorstep[0] - x, doorstep[1] - z];
    const along = Math.max(0, Math.min(1, (x * doorstep[0] + z * doorstep[1]) / (doorstep[0] ** 2 + doorstep[1] ** 2)));
    const path = 1 - Math.hypot(x - doorstep[0] * along, z - doorstep[1] * along) / (3.2 * ragged);
    return Math.max(open, path, 1 - Math.hypot(dx, dz) / (4.5 * ragged)) * 4;
  };

  const jitter = (i, j) => {
    const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    const k = Math.sin(i * 269.5 + j * 183.3) * 24634.6345;
    return [(h - Math.floor(h) - 0.5) * CELL * 0.7, (k - Math.floor(k) - 0.5) * CELL * 0.7];
  };
  const corner = (i, j) => {
    const [jx, jz] = jitter(i, j);
    return [i * CELL + jx, j * CELL + jz];
  };
  builder.blend(() => {
    for (let i = Math.floor(-GRASS / CELL); i < GRASS / CELL; i++)
      for (let j = Math.floor(-GRASS / CELL); j < (GRASS * 0.6) / CELL; j++) {
        const quad = [corner(i, j), corner(i, j + 1), corner(i + 1, j + 1), corner(i + 1, j)];
        for (const tri of [[0, 1, 2], [0, 2, 3]]) {
          const ps = tri.map((k) => quad[k]);
          const cx = (ps[0][0] + ps[1][0] + ps[2][0]) / 3,
            cz = (ps[0][1] + ps[1][1] + ps[2][1]) / 3;
          const d = dirt(cx, cz);
          const grass = lerp(env.grass, env.meadow, fbm(noise, cx / 9 - 3, cz / 9, 2) ** 1.5);
          const color = d > 0 ? lerp(grass, lerp(env.dirtDark, env.dirt, fbm(noise, cx / 4 + 5, cz / 4, 2)), Math.min(1, d)) : grass;
          builder.tri(...ps.map(([x, z]) => [x, d > 0 ? 0.04 : 0.025, z]), color, 0, 0.97 + random() * 0.06);
        }
      }
  });

  rusticFence(builder, FENCE, env, random);
  const stack = screen();
  for (const [x, z, yaw, y] of [[13, -19, 0.2, 0], [15.6, -18.5, 0.15, 0], [14.2, -18.8, 0.1, 0.85], [17.5, -20.5, 1.4, 0]]) hayBale(stack, x, z, yaw, env, random, y);

  tub(screen(), 6.2, -5.2, env, random);
  bucket(screen(), 4.6, -3.6, env, random);
  const crates = screen();
  for (const [a, b, size, y] of [[-1, 1.3, 1.2, 0], [0.4, 1.6, 1, 0], [-0.4, 1.4, 0.85, 1.2]]) {
    const [x, z] = nearBarn(a, b);
    crate(crates, x, z, BARN.yaw + (random() - 0.5) * 0.3, size, env, random, y);
  }
  for (const [a, b] of [[9.8, 1.1], [10.9, 2.2], [9.4, 2.5]]) {
    const [x, z] = nearBarn(a, b);
    barrel(screen(), x, z, env, random, { tilt: random() * 3 });
  }
  const bales = screen();
  for (const [a, b, yaw] of [[-8.5, 1.6, 0.1], [-8.2, 1.7, 0.2]]) {
    const [x, z] = nearBarn(a, b);
    hayBale(bales, x, z, BARN.yaw + yaw, env, random, a === -8.2 ? 0.85 : 0);
  }

  for (const [x, z, r, bloom] of [[12.5, -4, 1.5, true], [17, -11, 1.8, false], [27, -8, 2, true], [5, -14, 1.2, false], [-16, 9, 1.8, true]]) bush(screen(), x, z, r, env, random, bloom);
  for (const [a, b, r] of [[-11, 0.8, 1.4], [12.2, 0.9, 1.6], [3.6, 1, 0.9]]) {
    const [x, z] = nearBarn(a, b);
    bush(screen(), x, z, r, env, random, true);
  }

  for (let n = 0; n < 22000; n++) {
    const x = (random() * 2 - 1) * GRASS,
      z = -GRASS + random() * GRASS * 1.6;
    const d = dirt(x, z);
    if (d > 0.6 || inside(barn, x, z, 0.3) || onBed(x, z)) continue;
    if (d > 0 && random() < 0.4) continue;
    if (d < -1.5 && random() < 0.5) continue;
    if (random() < 0.08) flower(builder, x, z, env, random);
    else {
      const height = 0.22 + random() * 0.28 * (1 - Math.max(0, d));
      builder.styled(
        (plain) => tuft(plain, x, z, height, env, random),
        (soft) => softRandom() < SOFT_GRASS && softTuft(soft, x, z, height, env, softRandom),
      );
    }
  }
  for (let n = 0; n < 22; n++) {
    const x = (random() * 2 - 1) * DIRT,
      z = (random() * 2 - 1) * DIRT;
    if (dirt(x, z) > 0.3 && !inside(barn, x, z, 0)) pebble(builder, x, z, 0.14 + random() * 0.2, env, random);
  }
  return { blockers: [barn], beds };
}

/** Whether `[x, z]` lies within `footprint`, grown by `margin`. */
export function inside({ centre, yaw, halfA, halfB }, x, z, margin) {
  const dx = x - centre[0],
    dz = z - centre[1];
  const a = dx * Math.cos(yaw) + dz * Math.sin(yaw),
    b = -dx * Math.sin(yaw) + dz * Math.cos(yaw);
  return Math.abs(a) < halfA + margin && Math.abs(b) < halfB + margin;
}
