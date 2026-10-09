import { ceremonyPalette as C, tint } from "../palette.js";
import { createPropMesh } from "./propMesh.js";

const SIDES = 10;

/**
 * The league cup as a prop `size` metres tall, standing on its foot at the origin, in the metal of
 * a division (`gold`, `silver` or `bronze`): a stepped foot, a stem with a knop, a deep bowl with a
 * rolled rim and a handle either side.
 * @param {"gold" | "silver" | "bronze"} metal
 */
export function trophyAnatomy(metal, size) {
  const prop = createPropMesh();
  const s = (rings) => rings.map(([r, y]) => [r * size, y * size]);
  const shine = C.metals[metal],
    shade = tint(shine, 0.78),
    base = C.pole;
  prop.lathe([0, 0], s([[0, 0], [0.24, 0], [0.24, 0.07], [0.2, 0.09], [0.2, 0.15], [0.12, 0.17], [0, 0.17]]), SIDES, base);
  prop.lathe([0, 0], s([[0, 0.17], [0.1, 0.17], [0.05, 0.24], [0.045, 0.34], [0.09, 0.37], [0.045, 0.4], [0.05, 0.46], [0.12, 0.5], [0, 0.5]]), SIDES, shade);
  prop.lathe([0, 0], s([[0, 0.48], [0.18, 0.5], [0.29, 0.6], [0.34, 0.74], [0.35, 0.9], [0.39, 0.95], [0.33, 0.96], [0, 0.9]]), SIDES, shine);
  for (const side of [-1, 1]) {
    const x = (r) => side * r * size;
    const bar = 0.035 * size;
    prop.box([x(0.4), 0], bar, bar, 0.62 * size, 0.86 * size, shine);
    prop.box([x(0.36), 0], 0.05 * size, bar, 0.84 * size, 0.86 * size + bar * 2, shine);
    prop.box([x(0.35), 0], 0.06 * size, bar, 0.6 * size, 0.6 * size + bar * 2, shine);
  }
  return prop.anatomy();
}
