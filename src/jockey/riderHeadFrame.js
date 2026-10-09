/** The skull's main ellipsoid and the jaw below it, in the head's frame (+X the face, +Y the crown). */
export const cranium = { centre: [0, 0.012, 0], radii: [0.104, 0.112, 0.094] };
export const jaw = { centre: [0.022, -0.05, 0], radii: [0.082, 0.078, 0.074] };
/** The hair's cap over the cranium, set back so the forehead shows. */
export const hairCap = { centre: [-0.016, 0.022, 0], radii: [0.113, 0.114, 0.102] };

/**
 * Places parts in the head's frame: `at` maps a point from it into the pose, `turn` a rotation,
 * `local` a direction from the pose into it, and `shape` and `rigid` wrap the pose's placers, `rigid` taking tube rings in the head's frame.
 * @param {number[]} head the head's centre in the pose
 * @param {number} tilt how far the crown tips forward, in radians
 * @param {number} size how much larger than life the head is drawn
 */
export function headFrame(head, tilt, { rigid, shape }, tube, size = 1) {
  const c = Math.cos(tilt) * size,
    s = Math.sin(tilt) * size;
  const at = ([x, y, z]) => [head[0] + x * c + y * s, head[1] - x * s + y * c, head[2] + z * size];
  const grow = (r) => (Array.isArray(r) ? r.map((v) => v * size) : r * size);
  const turn = ([x, y, z] = [0, 0, 0]) => [x, y, z - tilt];
  return {
    at,
    turn,
    local: ([x, y, z]) => [(x * c - y * s) / size, (x * s + y * c) / size, z],
    up: [s / size, c / size, 0],
    shape: (id, kind, p, radii, color, rotation) => shape(id, kind, at(p), grow(radii), color, turn(rotation)),
    rigid: (id, rings, options) => rigid(id, tube(rings.map((ring) => ({ ...ring, p: at(ring.p), r: grow(ring.r) })), { up: [s, c, 0], ...options, ...(options.up ? { up: at(options.up).map((v, k) => v - head[k]) } : {}) })),
  };
}
