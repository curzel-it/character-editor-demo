const round = (v) => Math.round(v * 100) / 100 + 0;

/**
 * Seeded medieval castle in real-world metres (it is a scale reference, so it is not Froude-scaled).
 * `position` is the courtyard centre at the base height, `along` the unit XZ direction of its long
 * axis and `near` the unit XZ direction towards the race line. The keep stands in the near curtain.
 * Heights (`top`, `roofTop`) are absolute Y.
 */
export function castleLayout(random, { position, along, near }) {
  const [cx, base, cz] = position;
  const world = (a, b) => [cx + along[0] * a + near[0] * b, cz + along[2] * a + near[2] * b];
  const at = (a, b, y = base) => {
    const [x, z] = world(a, b);
    return [round(x), round(y), round(z)];
  };
  const yawOf = (a) => Math.atan2(along[2], along[0]) + a;
  const A = 58 + random() * 24,
    B = 36 + random() * 14;
  const wallHeight = 10 + random() * 2;
  const count = 5 + Math.floor(random() * 3);
  const phase = random() * Math.PI * 2;
  const ring = Array.from({ length: count }, (_, k) => {
    const theta = phase + ((k + (random() - 0.5) * 0.5) / count) * Math.PI * 2;
    const r = 0.9 + random() * 0.12;
    return [Math.cos(theta) * A * r, Math.sin(theta) * B * r];
  });
  const towers = ring.map(([a, b]) => {
    const round_ = random() < 0.68;
    const radius = round_ ? 5 + random() * 2.5 : 4.5 + random() * 1.5;
    const height = 20 + random() * 10;
    return {
      shape: round_ ? "round" : "square",
      position: at(a, b),
      radius: round(radius),
      top: round(base + height),
      roofTop: round(base + height + (round_ ? radius * (1.9 + random() * 0.8) : radius * 1.6)),
      yaw: round(yawOf(0)),
      local: [a, b],
    };
  });
  const walls = towers.map((t, k) => {
    const n = towers[(k + 1) % count];
    return { from: [t.position[0], t.position[2]], to: [n.position[0], n.position[2]], top: round(base + wallHeight), thickness: 3 };
  });

  let far = 0;
  walls.forEach((_, k) => {
    const mid = (k) => (towers[k].local[1] + towers[(k + 1) % count].local[1]) / 2;
    if (mid(k) < mid(far)) far = k;
  });
  const g0 = towers[far].local,
    g1 = towers[(far + 1) % count].local;
  const gateLocal = [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2];
  const gateYaw = Math.atan2(g1[1] - g0[1], g1[0] - g0[0]);
  const gateHeight = 15 + random() * 3;
  const gatehouse = {
    position: at(...gateLocal),
    yaw: round(yawOf(0) + gateYaw),
    width: 14,
    depth: 12,
    top: round(base + gateHeight),
    turretRadius: 4,
    turretTop: round(base + gateHeight + 3),
    roofTop: round(base + gateHeight + 3 + 7),
  };

  const keepWidth = 16 + random() * 5,
    keepDepth = 15 + random() * 4,
    keepHeight = 35 + random() * 5;
  const keepAlong = (random() - 0.5) * A * 0.5;
  const keepLocal = [keepAlong, B * 0.86 - keepDepth / 2];
  const pitched = random() < 0.5;
  const keep = {
    position: at(...keepLocal),
    yaw: round(yawOf(0)),
    width: round(keepWidth),
    depth: round(keepDepth),
    top: round(base + keepHeight),
    roofTop: round(base + keepHeight + (pitched ? 9 : 0)),
    pitched,
    turretRadius: 2.6,
    turretTop: round(base + keepHeight + 4),
    turretRoofTop: round(base + keepHeight + 11),
  };

  const halls = [];
  const hallCount = 1 + Math.floor(random() * 2);
  for (let i = 0; i < hallCount; i++) {
    const length = 22 + random() * 10;
    const side = i ? 1 : -1;
    const a = Math.max(-A * 0.5, Math.min(A * 0.5, gateLocal[0] + side * (length / 2 + 9 + random() * 6)));
    const b = -B * 0.42;
    halls.push({
      position: at(a, b),
      yaw: round(yawOf(0)),
      length: round(length),
      width: 9,
      top: round(base + 8 + random() * 2),
      roofTop: round(base + 14 + random() * 2),
    });
  }

  const tallest = [...towers].sort((p, q) => q.roofTop - p.roofTop).slice(0, 2);
  const banners = [
    { position: [keep.position[0], keep.roofTop, keep.position[2]], height: 8 },
    ...tallest.map((t) => ({ position: [t.position[0], t.roofTop, t.position[2]], height: 6 })),
  ].map((b) => ({ ...b, position: b.position.map(round), top: round(b.position[1] + b.height) }));

  const top = Math.max(...banners.map((b) => b.top), ...towers.map((t) => t.roofTop), gatehouse.roofTop);
  const corners = [...towers.map((t) => [t.position, t.radius * 1.5]), [keep.position, Math.hypot(keepWidth, keepDepth) / 2 + 3]];
  const radius = Math.max(...corners.map(([p, r]) => Math.hypot(p[0] - cx, p[2] - cz) + r));
  return {
    position: [cx, base, cz].map(round),
    along: [along[0], 0, along[2]].map(round),
    near: [near[0], 0, near[2]].map(round),
    width: round(2 * A),
    depth: round(2 * B),
    radius: round(radius),
    height: round(top - base),
    top: round(top),
    wallHeight: round(wallHeight),
    towers: towers.map(({ local, ...t }) => t),
    walls,
    gatehouse,
    keep,
    halls,
    banners,
  };
}

/**
 * Castle volumes as vertical capsules `{ a: [x, z], b: [x, z], radius, top }` for corridor clearance.
 * Every mesh the scene draws for the castle lies inside these.
 */
export function castleSolids(castle) {
  const flat = (p) => [p[0], p[2]];
  const box = (p, yaw, halfA, halfB, top, pad = 1.5) => {
    const d = [Math.cos(yaw), Math.sin(yaw)];
    const long = halfA >= halfB;
    const reach = long ? halfA - halfB : halfB - halfA;
    const axis = long ? d : [-d[1], d[0]];
    return {
      a: [p[0] - axis[0] * reach, p[2] - axis[1] * reach],
      b: [p[0] + axis[0] * reach, p[2] + axis[1] * reach],
      radius: Math.min(halfA, halfB) * Math.SQRT2 + pad,
      top,
    };
  };
  return [
    ...castle.towers.map((t) => ({ a: flat(t.position), b: flat(t.position), radius: t.radius * (t.shape === "square" ? Math.SQRT2 : 1) + 2, top: t.roofTop })),
    ...castle.walls.map((w) => ({ a: w.from, b: w.to, radius: w.thickness / 2 + 1.5, top: w.top + 1.5 })),
    box(castle.keep.position, castle.keep.yaw, castle.keep.width / 2, castle.keep.depth / 2, Math.max(castle.keep.roofTop, castle.keep.turretRoofTop), 3.5),
    box(castle.gatehouse.position, castle.gatehouse.yaw, castle.gatehouse.width / 2 + 4, castle.gatehouse.depth / 2, castle.gatehouse.roofTop, 2),
    ...castle.halls.map((h) => box(h.position, h.yaw, h.length / 2, h.width / 2, h.roofTop, 1.5)),
    ...castle.banners.map((b) => ({ a: flat(b.position), b: flat(b.position), radius: 6, top: b.top })),
    ...(castle.outworks || []).map((t) => ({ a: flat(t.position), b: flat(t.position), radius: t.radius + 2, top: t.roofTop })),
  ];
}
