import { primitive } from "../geometry.js";
import { point, transform } from "../math3d.js";

const cache = new WeakMap();

/**
 * Where breath leaves the mouth, in the jaw bone's frame: just above the front of the lower palate.
 * @returns {number[]}
 */
export function mouthPoint(anatomy) {
  if (cache.has(anatomy)) return cache.get(anatomy);
  const palate = anatomy.parts.find((part) => part.bone === "jaw" && /palate/.test(part.id)) ?? anatomy.parts.find((part) => part.bone === "jaw");
  let tip = [0.2 * (anatomy.scale ?? 1), 0, 0];
  if (palate) {
    const matrix = transform(palate.position, palate.rotation, palate.scale);
    const { vertices } = primitive(palate);
    let best = -Infinity;
    for (let i = 0; i < vertices.length; i += 3) {
      const p = point(matrix, vertices.slice(i, i + 3));
      if (p[0] > best) [best, tip] = [p[0], p];
    }
  }
  const spot = [tip[0] * 0.92, tip[1] + 0.04 * (anatomy.scale ?? 1), 0];
  cache.set(anatomy, spot);
  return spot;
}
