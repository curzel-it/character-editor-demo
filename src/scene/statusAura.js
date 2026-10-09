import { multiply } from "../math3d.js";
import { statusAuras } from "../breath/statusAuras.js";
import { palette } from "../palette.js";

const keys = new WeakMap();

/** One stable plume key per anatomy and status, so each status keeps its own particles. */
function keyOf(anatomy, id) {
  if (!keys.has(anatomy)) keys.set(anatomy, new Map());
  const map = keys.get(anatomy);
  if (!map.has(id)) map.set(id, { anatomy, id });
  return map.get(id);
}

/**
 * The pulsing tint of a racer's strongest status at `time`, as `{ color, amount }`, or null: a
 * flicker while dazed.
 */
export function statusTint(racer, time) {
  const top = racer.aura?.reduce((a, b) => (b.strength > (a?.strength ?? 0) ? b : a), null);
  const color = top && palette.statusTint[top.id];
  if (!color) return null;
  const pulse = Math.sin(time * 47) > 0 ? 0.45 : 0.1;
  return { color, amount: pulse * top.strength };
}

/**
 * Plume emitters for a posed racer's statuses (`racer.aura`, `[{ id, strength }]`), spawning from
 * every bone of its body. `bones` are its bone matrices, `model` its model matrix.
 */
export function statusEmitters(racer, bones, model) {
  const points = bones.map((bone) => {
    const m = multiply(model, bone);
    return [m[12], m[13], m[14]];
  });
  return racer.aura
    .filter(({ id }) => statusAuras[id])
    .map(({ id, strength }) => ({
      key: keyOf(racer.anatomy, id),
      element: statusAuras[id],
      strength,
      origin: points[0],
      origins: points,
      direction: statusAuras[id].direction,
      radius: racer.anatomy.bounds?.radius ?? 8,
      velocity: racer.velocity ?? [0, 0, 0],
    }));
}
