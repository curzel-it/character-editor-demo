import { makeRng } from "../rng.js";
import { terrainHeight } from "../course/terrainHeight.js";
import { box, column, cone, frame, gableRoof, hipRoof } from "./meshBuilder.js";

const TAU = Math.PI * 2;

/** Lowest terrain under a disc, so masonry always reaches the ground. */
function footing(terrain, centre, radius) {
  let low = terrainHeight(terrain, centre[0], centre[1]);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    low = Math.min(low, terrainHeight(terrain, centre[0] + Math.cos(a) * radius, centre[1] + Math.sin(a) * radius));
  }
  return low - 2;
}

/** Arrow slits and windows: small dark quads just proud of a round wall. */
function slits(builder, centre, radius, levels, count, color, phase) {
  for (const y of levels)
    for (let k = 0; k < count; k++) {
      const a = phase + (k / count) * TAU + y * 0.37;
      const n = [Math.cos(a), Math.sin(a)],
        t = [-n[1], n[0]];
      const r = radius + 0.08,
        w = 0.55,
        h = 1.6;
      const p = (dt, dy) => [centre[0] + n[0] * r + t[0] * dt, y + dy, centre[1] + n[1] * r + t[1] * dt];
      builder.quad(p(-w, 0), p(w, 0), p(w, h), p(-w, h), color);
    }
}

function roundTower(builder, env, terrain, t, roof) {
  const c = [t.position[0], t.position[2]];
  const base = t.position[1];
  const bottom = footing(terrain, c, t.radius * 1.2);
  const sides = 12;
  const phase = t.yaw ?? 0;
  if (bottom < base - 3) column(builder, c, t.radius * 1.28, bottom, base - 1, sides, env.rock, { phase, topRadius: t.radius * 1.05 });
  column(builder, c, t.radius * 1.12, Math.min(bottom, base - 1), base + 2.5, sides, env.stoneDark, { phase, topRadius: t.radius });
  column(builder, c, t.radius, base + 2.5, t.top - 1.2, sides, env.stone, { phase });
  column(builder, c, t.radius + 0.45, t.top - 1.2, t.top, sides, env.stoneDark, { phase });
  slits(builder, c, t.radius, [base + 7, base + (t.top - base) * 0.62], 4, env.doorway, phase);
  cone(builder, c, t.radius + 0.9, t.top, t.roofTop, sides, roof, phase);
}

function squareTower(builder, env, terrain, t, roof, random) {
  const c = [t.position[0], t.position[2]];
  const base = t.position[1];
  const half = t.radius;
  const bottom = footing(terrain, c, half * 1.4);
  if (bottom < base - 3) box(builder, c, t.yaw, half * 1.25, half * 1.25, bottom, base - 1, env.rock, { top: false });
  box(builder, c, t.yaw, half * 1.08, half * 1.08, Math.min(bottom, base - 1), base + 2.5, env.stoneDark, { top: false });
  box(builder, c, t.yaw, half, half, base + 2.5, t.top, env.stone, { top: false });
  box(builder, c, t.yaw, half + 0.4, half + 0.4, t.top - 1.2, t.top, env.stoneDark, { top: false });
  windows(builder, c, t.yaw, half, half, [base + 8, base + (t.top - base) * 0.65], env.doorway);
  if (random() < 0.6) hipRoof(builder, c, t.yaw, half + 0.7, half + 0.7, t.top, t.roofTop, roof);
  else {
    box(builder, c, t.yaw, half - 0.4, half - 0.4, t.top - 1.2, t.top - 0.9, env.stoneDark);
    merlonRing(builder, c, t.yaw, half + 0.4, half + 0.4, t.top, env.stoneDark);
  }
}

function windows(builder, centre, yaw, halfA, halfB, levels, color) {
  const to = frame(centre, yaw);
  for (const y of levels)
    for (const [side, span] of [
      [0, halfA],
      [1, halfB],
      [2, halfA],
      [3, halfB],
    ]) {
      const count = Math.max(1, Math.floor(span / 3.5));
      for (let i = 0; i < count; i++) {
        const u = ((i + 0.5) / count) * 2 - 1;
        const w = 0.6,
          h = 2;
        const at = (du, dy) => {
          const off = 0.08;
          if (side === 0) return to(u * span + du, -halfB - off, y + dy);
          if (side === 2) return to(-u * span - du, halfB + off, y + dy);
          if (side === 1) return to(halfA + off, u * span + du, y + dy);
          return to(-halfA - off, -u * span - du, y + dy);
        };
        builder.quad(at(-w, 0), at(w, 0), at(w, h), at(-w, h), color);
      }
    }
}

/** Crenellations: merlons around an oriented rectangle's rim at height `y`. */
function merlonRing(builder, centre, yaw, halfA, halfB, y, color) {
  const to = frame(centre, yaw);
  const edges = [
    [[-halfA, -halfB], [halfA, -halfB]],
    [[halfA, -halfB], [halfA, halfB]],
    [[halfA, halfB], [-halfA, halfB]],
    [[-halfA, halfB], [-halfA, -halfB]],
  ];
  for (const [p, q] of edges) {
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const count = Math.max(2, Math.round(length / 3));
    for (let i = 0; i < count; i++) {
      const f = (i + 0.25) / count;
      const a = p[0] + (q[0] - p[0]) * f,
        b = p[1] + (q[1] - p[1]) * f;
      const [x, , z] = to(a, b, 0);
      box(builder, [x, z], yaw, 0.7, 0.7, y, y + 1.5, color);
    }
  }
}

function curtainWall(builder, env, terrain, wall, centre) {
  const [ax, az] = wall.from,
    [bx, bz] = wall.to;
  const length = Math.hypot(bx - ax, bz - az);
  const yaw = Math.atan2(bz - az, bx - ax);
  const mid = [(ax + bx) / 2, (az + bz) / 2];
  const outward = Math.sign(-(bz - az) * (mid[0] - centre[0]) + (bx - ax) * (mid[1] - centre[1])) || 1;
  const segments = Math.max(1, Math.ceil(length / 12));
  const half = wall.thickness / 2;
  const base = centre[2];
  for (let i = 0; i < segments; i++) {
    const f0 = i / segments,
      f1 = (i + 1) / segments;
    const c = [ax + (bx - ax) * ((f0 + f1) / 2), az + (bz - az) * ((f0 + f1) / 2)];
    const segHalf = (length / segments) / 2 + 0.05;
    const bottom = footing(terrain, c, segHalf);
    if (bottom < base - 3) box(builder, c, yaw, segHalf, half * 1.9, bottom, base - 1, env.rock, { top: false });
    box(builder, c, yaw, segHalf, half * 1.25, Math.min(bottom, base - 1), base + 1.5, env.stoneDark, { top: false });
    box(builder, c, yaw, segHalf, half, base + 1.5, wall.top, env.stone);
  }
  const to = frame(mid, yaw);
  const count = Math.max(2, Math.round(length / 3));
  for (let i = 1; i < count; i++) {
    const a = -length / 2 + (i / count) * length;
    const [x, , z] = to(a, outward * (half - 0.4), 0);
    box(builder, [x, z], yaw, 0.75, 0.4, wall.top, wall.top + 1.6, env.stone);
  }
  const [px, , pz] = to(0, -outward * (half - 0.2), 0);
  box(builder, [px, pz], yaw, length / 2, 0.2, wall.top, wall.top + 0.9, env.stoneDark, { top: false });
}

function keep(builder, env, terrain, k, roof) {
  const c = [k.position[0], k.position[2]];
  const base = k.position[1];
  const ha = k.width / 2,
    hb = k.depth / 2;
  const bottom = footing(terrain, c, Math.hypot(ha, hb));
  if (bottom < base - 3) box(builder, c, k.yaw, ha * 1.15, hb * 1.15, bottom, base - 1, env.rock, { top: false });
  box(builder, c, k.yaw, ha + 0.8, hb + 0.8, Math.min(bottom, base - 1), base + 3, env.stoneDark, { top: false });
  box(builder, c, k.yaw, ha, hb, base + 3, k.top, env.stone);
  box(builder, c, k.yaw, ha + 0.5, hb + 0.5, k.top - 1.5, k.top, env.stoneDark, { top: false });
  merlonRing(builder, c, k.yaw, ha + 0.3, hb + 0.3, k.top, env.stone);
  windows(builder, c, k.yaw, ha, hb, [base + 10, base + 18, base + 26], env.doorway);
  if (k.pitched) hipRoof(builder, c, k.yaw, ha - 1.2, hb - 1.2, k.top, k.roofTop, roof, Math.max(0, ha - hb) * 0.6);
  const to = frame(c, k.yaw);
  for (const [a, b] of [
    [-ha, -hb],
    [ha, -hb],
    [ha, hb],
    [-ha, hb],
  ]) {
    const [x, , z] = to(a, b, 0);
    column(builder, [x, z], k.turretRadius, k.top - 6, k.turretTop, 8, env.stone, { cap: false });
    cone(builder, [x, z], k.turretRadius + 0.5, k.turretTop, k.turretRoofTop, 8, roof);
  }
}

function gatehouse(builder, env, terrain, g, roof, centre) {
  const c = [g.position[0], g.position[2]];
  const base = g.position[1];
  const ha = g.width / 2,
    hb = g.depth / 2;
  const bottom = footing(terrain, c, Math.hypot(ha, hb));
  box(builder, c, g.yaw, ha, hb, Math.min(bottom, base - 1), g.top, env.stone);
  merlonRing(builder, c, g.yaw, ha, hb, g.top, env.stoneDark);
  const to = frame(c, g.yaw);
  const [ox, , oz] = to(0, 1, 0);
  const out = Math.sign((ox - c[0]) * (c[0] - centre[0]) + (oz - c[1]) * (c[1] - centre[1])) || 1;
  const face = out * (hb + 0.1);
  builder.quad(to(-2.6, face, base), to(2.6, face, base), to(2.6, face, base + 7), to(-2.6, face, base + 7), env.doorway);
  builder.tri(to(-2.6, face, base + 7), to(2.6, face, base + 7), to(0, face, base + 9), env.doorway);
  for (const side of [-1, 1]) {
    const [x, , z] = to(side * (ha + 1), out * hb * 0.6, 0);
    column(builder, [x, z], g.turretRadius * 1.1, Math.min(bottom, base - 1), base + 2, 10, env.stoneDark, { topRadius: g.turretRadius });
    column(builder, [x, z], g.turretRadius, base + 2, g.turretTop, 10, env.stone);
    cone(builder, [x, z], g.turretRadius + 0.7, g.turretTop, g.roofTop, 10, roof);
  }
}

function hall(builder, env, terrain, h, roof) {
  const c = [h.position[0], h.position[2]];
  const base = h.position[1];
  const bottom = footing(terrain, c, h.width / 2);
  box(builder, c, h.yaw, h.length / 2, h.width / 2, Math.min(bottom, base - 1), h.top, env.plaster, { top: false });
  windows(builder, c, h.yaw, h.length / 2, h.width / 2, [base + 3.5], env.timber);
  gableRoof(builder, c, h.yaw, h.length / 2, h.width / 2, h.top, h.roofTop, roof, env.plaster);
}

function banner(builder, env, b, index) {
  const [x, y, z] = b.position;
  box(builder, [x, z], 0, 0.14, 0.14, y - 0.5, b.top, env.timber);
  const wind = [0.8, 0.6];
  const len = 5.5,
    drop = 3.2;
  const top = b.top - 0.3;
  const p = (along, down, wave = 0) => [x + wind[0] * along - wind[1] * wave, top - down, z + wind[1] * along + wind[0] * wave];
  const main = index % 2 ? env.bannerAlt : env.banner,
    trim = index % 2 ? env.banner : env.bannerAlt;
  builder.quad(p(0, 0), p(len * 0.5, 0, 0.5), p(len * 0.5, drop, 0.5), p(0, drop), main);
  builder.quad(p(len * 0.5, 0, 0.5), p(len, 0.25, -0.2), p(len * 0.85, drop * 0.5, 0), p(len * 0.5, drop, 0.5), trim);
  builder.tri(p(len * 0.5, drop, 0.5), p(len * 0.85, drop * 0.5, 0), p(len, drop + 0.2, -0.2), trim);
}

/** Adds a castle feature from `course.features` in real-world metres. */
export function addCastle(builder, castle, terrain, env) {
  const random = makeRng(`castle-mesh:${castle.position.join()}`);
  const roof = random() < 0.55 ? env.slate : env.roof;
  const centre = [castle.position[0], castle.position[2], castle.position[1]];
  for (const wall of castle.walls) curtainWall(builder, env, terrain, wall, centre);
  for (const t of [...castle.towers, ...(castle.outworks || [])])
    if (t.shape === "square") squareTower(builder, env, terrain, t, roof, random);
    else roundTower(builder, env, terrain, t, roof);
  keep(builder, env, terrain, castle.keep, roof);
  gatehouse(builder, env, terrain, castle.gatehouse, roof, centre);
  for (const h of castle.halls) hall(builder, env, terrain, h, roof === env.slate ? env.roof : env.slate);
  castle.banners.forEach((b, i) => banner(builder, env, b, i));
}
