const REACH = 1.3;

/**
 * Screen boxes `[minU, minV, maxU, maxV]` in texture space around racer bounding spheres
 * `{ center, radius }`, widened by `pad` (in uv) so the composite only searches for outlines near racers.
 * A sphere reaching behind the lens covers the whole screen; more spheres than `limit` merge into one box.
 * @returns {{ boxes: Float32Array, count: number }}
 */
export function racerBoxes(spheres, viewProjection, [padU, padV], limit) {
  const m = viewProjection;
  const found = [];
  for (const { center, radius } of spheres) {
    const r = radius * REACH;
    let box = [Infinity, Infinity, -Infinity, -Infinity];
    for (let k = 0; k < 8; k++) {
      const x = center[0] + (k & 1 ? r : -r),
        y = center[1] + (k & 2 ? r : -r),
        z = center[2] + (k & 4 ? r : -r);
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (w <= 1e-3) {
        box = [0, 0, 1, 1];
        break;
      }
      const u = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w) * 0.5 + 0.5,
        v = ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * 0.5 + 0.5;
      box = [Math.min(box[0], u), Math.min(box[1], v), Math.max(box[2], u), Math.max(box[3], v)];
    }
    box = [box[0] - padU, box[1] - padV, box[2] + padU, box[3] + padV];
    if (box[2] < 0 || box[3] < 0 || box[0] > 1 || box[1] > 1) continue;
    found.push(box);
  }
  const merged =
    found.length > limit
      ? [found.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])])]
      : found;
  const boxes = new Float32Array(limit * 4);
  merged.forEach((box, i) => boxes.set(box, i * 4));
  return { boxes, count: merged.length };
}
