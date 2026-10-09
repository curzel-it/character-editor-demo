import { makeRng } from "../rng.js";
import { terrainHeight } from "../course/terrainHeight.js";
import { box, frame, gableRoof } from "./meshBuilder.js";

/** A cottage or barn: walls, a door and a gable roof, footed on the lowest corner. */
function house(builder, terrain, x, z, yaw, length, width, eaves, ridge, walls, roof, door) {
  const to = frame([x, z], yaw);
  let low = Infinity;
  for (const [a, b] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const [px, , pz] = to((a * length) / 2, (b * width) / 2, 0);
    low = Math.min(low, terrainHeight(terrain, px, pz));
  }
  box(builder, [x, z], yaw, length / 2, width / 2, low - 1.5, low + eaves, walls, { top: false });
  const face = width / 2 + 0.06;
  builder.quad(to(-0.7, face, low), to(0.7, face, low), to(0.7, face, low + 2.2), to(-0.7, face, low + 2.2), door);
  gableRoof(builder, [x, z], yaw, length / 2, width / 2, low + eaves, low + ridge, roof, walls);
}

function flatEnough(terrain, x, z, reach) {
  const h = [
    terrainHeight(terrain, x - reach, z - reach),
    terrainHeight(terrain, x + reach, z - reach),
    terrainHeight(terrain, x + reach, z + reach),
    terrainHeight(terrain, x - reach, z + reach),
  ];
  return Math.max(...h) - Math.min(...h) < reach * 0.35;
}

/**
 * A village at the castle's gate and farmsteads across the valley floor, clear of the corridor and
 * the river. Returns the discs they occupy so trees keep out.
 */
export function addSettlements(builder, course, env, cover, corridor, river) {
  const random = makeRng(`settlements:${course.seed}`);
  const { terrain } = course;
  const taken = [];
  const free = (x, z, radius, gap) =>
    corridor.clearance(x, z) > gap &&
    (river?.clearance(x, z) ?? Infinity) > radius + 4 &&
    taken.every((t) => Math.hypot(x - t.position[0], z - t.position[2]) > t.radius + radius) &&
    flatEnough(terrain, x, z, radius) &&
    cover(x, terrainHeight(terrain, x, z), z, 1).kind !== "water";

  const castle = course.features?.find((f) => f.type === "castle");
  if (castle) {
    taken.push({ position: castle.position, radius: castle.radius + 6 });
    for (const t of castle.outworks || []) taken.push({ position: t.position, radius: t.radius + 6 });
    const [cx, , cz] = castle.position;
    const g = castle.gatehouse.position;
    const out = Math.atan2(g[2] - cz, g[0] - cx);
    let built = 0;
    for (let tries = 0; tries < 160 && built < 14; tries++) {
      const a = out + (random() - 0.5) * 2.2;
      const d = castle.radius + 14 + random() * 90;
      const x = cx + Math.cos(a) * d,
        z = cz + Math.sin(a) * d;
      const length = 8 + random() * 5,
        width = 5.5 + random() * 2;
      if (!free(x, z, length * 0.6, 8)) continue;
      const yaw = a + Math.PI / 2 + (random() - 0.5) * 0.5;
      house(builder, terrain, x, z, yaw, length, width, 4.5 + random() * 2, 8.5 + random() * 2.5, env.plaster, random() < 0.75 ? env.roof : env.slate, env.timber);
      taken.push({ position: [x, 0, z], radius: length * 0.6 });
      built++;
    }
  }

  const path = course.path;
  let farms = 0;
  for (let tries = 0; tries < 260 && farms < 12; tries++) {
    const p = path[Math.floor(random() * path.length)];
    const f = p.forward,
      l = Math.hypot(f[0], f[2]) || 1;
    const side = random() < 0.5 ? -1 : 1;
    const lateral = side * (p.halfWidth + 50 + random() * 220);
    const x = p.position[0] - (f[2] / l) * lateral,
      z = p.position[2] + (f[0] / l) * lateral;
    if (!free(x, z, 22, 30)) continue;
    const kind = cover(x, terrainHeight(terrain, x, z), z, 1).kind;
    if (kind !== "field" && kind !== "meadow") continue;
    const yaw = random() * Math.PI;
    const to = frame([x, z], yaw);
    house(builder, terrain, x, z, yaw, 12, 7, 5, 9.5, env.plaster, env.roof, env.timber);
    const [bx, , bz] = to(3, -14, 0);
    house(builder, terrain, bx, bz, yaw + Math.PI / 2, 16, 9, 6, 11.5, env.timber, env.slate, env.doorway);
    taken.push({ position: [x, 0, z], radius: 22 });
    farms++;
  }
  return taken;
}
