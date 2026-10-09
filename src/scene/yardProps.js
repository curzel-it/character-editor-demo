import { box, column, frame, softBox } from "./meshBuilder.js";

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * A rustic post-and-rail fence through the points `[x, z]` on flat ground, its posts leaning a
 * little and its rails sagging between them.
 */
export function rusticFence(builder, points, env, random, { height = 1.9, gap = 3.2 } = {}) {
  const posts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / gap));
    for (let k = i ? 1 : 0; k <= n; k++) posts.push(lerp(a, b, k / n));
  }
  const tops = posts.map(([x, z]) => {
    const lean = [(random() - 0.5) * 0.25, (random() - 0.5) * 0.25];
    const top = height + (random() - 0.5) * 0.25;
    const r = 0.17 + random() * 0.05;
    const color = lerp(env.plankDark, env.plank, random());
    const ring = (y, k) => {
      const a = (k / 5) * Math.PI * 2;
      const t = y / top;
      return [x + Math.cos(a) * r + lean[0] * t, y, z + Math.sin(a) * r + lean[1] * t];
    };
    builder.lump(() => {
      for (let k = 0; k < 5; k++) builder.quad(ring(-0.2, k), ring(-0.2, k + 1), ring(top, k + 1), ring(top, k), color, 0, k % 2 ? 0.92 : 1);
      builder.tri(ring(top, 0), ring(top, 2), ring(top + 0.12, 1), color);
      builder.tri(ring(top, 2), ring(top, 4), ring(top + 0.12, 3), color);
    });
    return lean;
  });
  for (let i = 0; i < posts.length - 1; i++) {
    const [a, b] = [posts[i], posts[i + 1]];
    for (const y of [0.75, height - 0.4]) {
      const sag = 0.06 + random() * 0.08,
        color = lerp(env.plankDark, env.plankPale, random()),
        t = 0.09;
      const la = tops[i].map((v) => (v * y) / height),
        lb = tops[i + 1].map((v) => (v * y) / height);
      const p0 = [a[0] + la[0], y, a[1] + la[1]],
        p1 = [b[0] + lb[0], y + (random() - 0.5) * 0.1, b[1] + lb[1]];
      const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - sag, (p0[2] + p1[2]) / 2];
      builder.lump(() => {
        for (const [q0, q1] of [[p0, mid], [mid, p1]]) {
          builder.quad([q0[0], q0[1] - t, q0[2]], [q1[0], q1[1] - t, q1[2]], [q1[0], q1[1] + t, q1[2]], [q0[0], q0[1] + t, q0[2]], color, 0, 1);
          builder.quad([q0[0], q0[1] + t, q0[2]], [q1[0], q1[1] + t, q1[2]], [q1[0] + 0.02, q1[1] + t, q1[2] + 0.1], [q0[0] + 0.02, q0[1] + t, q0[2] + 0.1], color, 0, 1.08);
        }
      });
    }
  }
}

/** A staved barrel bound in iron hoops, a little lid on top. */
export function barrel(builder, x, z, env, random, { height = 1.35, radius = 0.55, tilt = 0, lid = true } = {}) {
  const staves = 10,
    bulge = radius * 1.12;
  const color = () => lerp(env.plankDark, env.plank, random());
  const ring = (k, y) => {
    const a = (k / staves) * Math.PI * 2 + tilt;
    const r = radius + (bulge - radius) * Math.sin((Math.PI * y) / height);
    return [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
  };
  const levels = [0, height * 0.5, height];
  builder.lump(() => {
    for (let k = 0; k < staves; k++) {
      const c = color();
      for (let l = 0; l < 2; l++) builder.quad(ring(k, levels[l]), ring(k + 1, levels[l]), ring(k + 1, levels[l + 1]), ring(k, levels[l + 1]), c, 0, 0.94 + random() * 0.1);
      if (lid) builder.tri(ring(k, height), ring(k + 1, height), [x, height - 0.04, z], env.plankPale, 0, 0.9);
    }
  });
  for (const y of [0.18, height * 0.5 - 0.06, height - 0.24])
    builder.lump(() => column(builder, [x, z], radius + (bulge - radius) * Math.sin((Math.PI * (y + 0.06)) / height) + 0.03, y, y + 0.12, staves, env.iron, { phase: tilt }));
}

/** A planked crate with framed edges. */
export function crate(builder, x, z, yaw, size, env, random, y = 0) {
  const h = size / 2;
  box(builder, [x, z], yaw, h, h, y, y + size, lerp(env.plankDark, env.plankPale, random()), { shade: 0.95 + random() * 0.1 });
  const to = frame([x, z], yaw);
  const t = 0.07;
  for (const [a, b] of [[-h, -h], [h, -h], [h, h], [-h, h]]) {
    const [px, , pz] = to(a, b, 0);
    softBox(builder, [px, pz], yaw, t * 1.4, t * 1.4, y, y + size, env.beam);
  }
  for (const yy of [y + t, y + size - t])
    for (const [a, b, ha, hb] of [[0, -h, h, t], [0, h, h, t], [-h, 0, t, h], [h, 0, t, h]]) {
      const [px, , pz] = to(a, b, 0);
      softBox(builder, [px, pz], yaw, ha + 0.02, hb + 0.02, yy - t, yy + t, env.beam);
    }
  for (const s of [-1, 1]) {
    const p = (a, yy) => to(a, s * (h + 0.04), yy);
    builder.quad(p(-h + t, y + t), p(-h + 3 * t, y + t), p(h - t, y + size - t), p(h - 3 * t, y + size - t), env.beam, 0, 0.9);
  }
}

/** A rectangular hay bale with rounded shoulders and two bands of twine. */
export function hayBale(builder, x, z, yaw, env, random, y = 0) {
  const to = frame([x, z], yaw);
  const a = 1.25,
    b = 0.62,
    h = 0.85,
    r = 0.14;
  const color = lerp(env.hayDark, env.hay, 0.5 + random() * 0.5);
  softBox(builder, [x, z], yaw, a, b - r, y, y + h, color, { shade: 0.96 + random() * 0.08 });
  softBox(builder, [x, z], yaw, a - r, b, y + r, y + h - r, color, { shade: 1 });
  softBox(builder, [x, z], yaw, a - r * 0.5, b - r * 0.5, y + r * 0.5, y + h - r * 0.5, color, { shade: 1.02 });
  for (const s of [-0.45, 0.45]) {
    const [px, , pz] = to(s * a, 0, 0);
    box(builder, [px, pz], yaw, 0.04, b + 0.01, y - 0.01, y + h + 0.01, env.hayDark);
  }
  for (let k = 0; k < 10; k++) {
    const u = (random() * 2 - 1) * a,
      side = random() < 0.5 ? -1 : 1;
    const p = to(u, side * b, y + random() * h);
    const q = to(u + (random() - 0.5) * 0.3, side * (b + 0.12), p[1] + 0.25);
    builder.tri([p[0] - 0.04, p[1], p[2]], [p[0] + 0.04, p[1], p[2]], q, env.hay);
  }
}

/** A half-barrel water tub, brimming. */
export function tub(builder, x, z, env, random) {
  barrel(builder, x, z, env, random, { height: 0.95, radius: 1.05, lid: false });
  column(builder, [x, z], 1.12, 0.84, 0.86, 12, env.water, { cap: true });
}

/** A wooden bucket with a rope handle. */
export function bucket(builder, x, z, env, random) {
  builder.lump(() => column(builder, [x, z], 0.28, 0, 0.5, 8, lerp(env.plankDark, env.plank, random()), { topRadius: 0.34 }));
  builder.lump(() => column(builder, [x, z], 0.35, 0.36, 0.42, 8, env.iron));
  column(builder, [x, z], 0.3, 0.42, 0.43, 8, env.water, { cap: true });
}

/** A flat low-poly stone half sunk in the ground. */
export function pebble(builder, x, z, size, env, random) {
  const color = lerp(env.footingDark, env.pebble, random());
  const a0 = random() * Math.PI,
    stretch = 0.7 + random() * 0.6;
  const ring = [0, 1, 2, 3, 4].map((k) => {
    const a = a0 + (k / 5) * Math.PI * 2;
    const r = size * (0.8 + random() * 0.4);
    return [x + Math.cos(a) * r * stretch, 0.02, z + Math.sin(a) * r];
  });
  const top = [x + (random() - 0.5) * size * 0.4, size * (0.3 + random() * 0.25), z];
  builder.lump(() => {
    for (let k = 0; k < 5; k++) builder.tri(ring[k], ring[(k + 1) % 5], top, color, 0, 0.92 + random() * 0.14);
  });
}
