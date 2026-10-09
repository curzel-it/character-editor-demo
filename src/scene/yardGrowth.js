import { add, cross, normalize, scale } from "../vec3.js";

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const pick = (list, random) => list[Math.floor(random() * list.length)];

/** A tuft of grass: a few blades fanning out from one root, each a thin leaning triangle. */
export function tuft(builder, x, z, height, env, random) {
  const blades = 3 + Math.floor(random() * 3);
  const base = pick(env.blades, random);
  for (let k = 0; k < blades; k++) {
    const a = random() * Math.PI * 2,
      lean = 0.15 + random() * 0.35,
      h = height * (0.6 + random() * 0.5),
      w = 0.06 + random() * 0.05;
    const c = Math.cos(a),
      s = Math.sin(a);
    const color = lerp(base, env.meadow, random() * 0.4);
    builder.tri([x - s * w, 0, z + c * w], [x + s * w, 0, z - c * w], [x + c * lean * h, h, z + s * lean * h], color, 0, 0.9 + random() * 0.2, true);
  }
}

/**
 * A soft tuft for the Cozy style: three short, broad blades curling out from one root to blunt tips,
 * their normals leaning up, so the clump lights like the ground it grows from with brighter tips.
 */
export function softTuft(builder, x, z, height, env, random) {
  const base = lerp(env.grass, pick(env.blades, random), 0.5);
  const a0 = random() * Math.PI * 2;
  for (let k = 0; k < 3; k++) {
    const a = a0 + (k / 3) * Math.PI * 2 + (random() - 0.5) * 0.8,
      h = height * (0.65 + random() * 0.45),
      w = 0.07 + random() * 0.04,
      lean = 0.25 + random() * 0.3;
    const out = [Math.cos(a), 0, Math.sin(a)],
      side = [-out[2], 0, out[0]];
    const at = (along, across, up) => [x + out[0] * along + side[0] * across, up, z + out[2] * along + side[2] * across];
    const tilt = (f) => normalize([out[0] * f, 1, out[2] * f]);
    const root = [at(0, -w, 0), at(0, w, 0)],
      mid = [at(lean * h * 0.35, -w, h * 0.55), at(lean * h * 0.35, w, h * 0.55)],
      shoulder = [at(lean * h * 0.75, -w * 0.7, h * 0.88), at(lean * h * 0.75, w * 0.7, h * 0.88)],
      tip = at(lean * h, 0, h);
    const up = [0, 1, 0],
      bend = tilt(0.35),
      curl = tilt(0.7);
    const top = lerp(base, env.meadow, 0.55);
    builder.shaded(root[0], root[1], mid[1], [up, up, bend], base, 0.95);
    builder.shaded(root[0], mid[1], mid[0], [up, bend, bend], base, 0.95);
    builder.shaded(mid[0], mid[1], shoulder[1], [bend, bend, curl], top, 1.04);
    builder.shaded(mid[0], shoulder[1], shoulder[0], [bend, curl, curl], top, 1.04);
    builder.shaded(shoulder[0], shoulder[1], tip, [curl, curl, curl], top, 1.08);
  }
}

/** A flower: a stem and a little star of petals in one of the meadow's colours. */
export function flower(builder, x, z, env, random) {
  const h = 0.2 + random() * 0.25,
    r = 0.07 + random() * 0.04;
  const color = pick(env.blooms, random);
  builder.tri([x - 0.02, 0, z], [x + 0.02, 0, z], [x, h, z], env.bush, 0, 1, true);
  const a0 = random() * Math.PI;
  for (let k = 0; k < 3; k++) {
    const a = a0 + (k / 3) * Math.PI * 2;
    builder.tri([x, h, z], [x + Math.cos(a) * r, h + 0.04, z + Math.sin(a) * r], [x + Math.cos(a + 1.2) * r, h - 0.03, z + Math.sin(a + 1.2) * r], color, 0, 1.05);
  }
}

/** A round bush of faceted leaf clumps, sometimes in bloom. */
export function bush(builder, x, z, radius, env, random, blooming = false) {
  const clumps = 4 + Math.floor(random() * 3);
  for (let n = 0; n < clumps; n++) {
    const a = (n / clumps) * Math.PI * 2 + random(),
      d = n ? radius * (0.35 + random() * 0.35) : 0;
    const cx = x + Math.cos(a) * d,
      cz = z + Math.sin(a) * d,
      r = radius * (n ? 0.5 + random() * 0.25 : 0.75),
      cy = r * (n ? 0.7 : 1);
    const color = lerp(env.bush, env.bushLight, random());
    const turn = random() * Math.PI;
    const ring = (k, up, f) => {
      const b = turn + ((k + (up > 0.5 ? 0.5 : 0)) / 6) * Math.PI * 2;
      return [cx + Math.cos(b) * r * f, cy + r * up, cz + Math.sin(b) * r * f];
    };
    const top = [cx, cy + r * 0.95, cz],
      bottom = [cx, Math.max(0, cy - r * 0.8), cz];
    builder.lump(() => {
      for (let k = 0; k < 6; k++) {
        const shade = 1 + random() * 0.08;
        builder.tri(ring(k, 0, 1), ring(k + 1, 0, 1), ring(k, 0.6, 0.72), color, 0, shade);
        builder.tri(ring(k + 1, 0, 1), ring(k + 1, 0.6, 0.72), ring(k, 0.6, 0.72), color, 0, shade * 0.98);
        builder.tri(ring(k, 0.6, 0.72), ring(k + 1, 0.6, 0.72), top, color, 0, shade * 1.04);
        builder.tri(ring(k + 1, 0, 1), ring(k, 0, 1), bottom, color, 0, 0.78);
      }
    });
    if (blooming)
      for (let k = 0; k < 3; k++) {
        const b = random() * Math.PI * 2,
          up = 0.3 + random() * 0.6;
        const facing = normalize([Math.cos(b), up * 0.8, Math.sin(b)]);
        blossom(builder, [cx + facing[0] * r * 0.95, cy + facing[1] * r * 0.95, cz + facing[2] * r * 0.95], facing, env.blooms[n % env.blooms.length], env, b * 3);
      }
  }
}

/** A five-petalled flower facing `facing` (a unit vector) at `at`, turned by `twist`, each petal and the heart a little lump. */
function blossom(builder, at, facing, color, env, twist) {
  const side = Math.abs(facing[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize(cross(facing, side)),
    v = cross(facing, u);
  const heart = color === env.blooms[1] ? env.hayDark : env.blooms[1];
  for (let k = 0; k < 5; k++) {
    const a = twist + (k / 5) * Math.PI * 2;
    const along = add(scale(u, Math.cos(a)), scale(v, Math.sin(a))),
      across = add(scale(u, -Math.sin(a)), scale(v, Math.cos(a)));
    lens(builder, add(at, scale(along, 0.09)), along, across, facing, [0.075, 0.05, 0.02], color, 1.08);
  }
  lens(builder, add(at, scale(facing, 0.02)), u, v, facing, [0.04, 0.04, 0.03], heart, 1);
}

/** A little closed lens: a diamond of half sizes `[a, b, c]` along the axes `x`, `y` and `z`. */
function lens(builder, centre, x, y, z, [a, b, c], color, shade) {
  const tip = (axis, size) => add(centre, scale(axis, size));
  const ring = [tip(x, a), tip(y, b), tip(x, -a), tip(y, -b)];
  builder.lump(() => {
    for (let k = 0; k < 4; k++) {
      builder.tri(ring[k], ring[(k + 1) % 4], tip(z, c), color, 0, shade);
      builder.tri(ring[(k + 1) % 4], ring[k], tip(z, -c), color, 0, shade * 0.9);
    }
  });
}

