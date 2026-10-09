import { metalPalette } from "../palette.js";
import { metalCoatOf } from "../genome/metalCoats.js";

/** Metal ids for the racer shader: 0 for no metal. */
export const metalIds = { gold: 1, silver: 2 };

/** The racer shader's `metalSheen` and `metalShadow` arrays, one colour per metal id from 1. */
export const metalShades = {
  sheen: Object.keys(metalIds).flatMap((metal) => metalPalette[metal].sheen),
  shadow: Object.keys(metalIds).flatMap((metal) => metalPalette[metal].shadow),
};

/** Largest angle, in radians, between a colour and its metal's hues for it to count as that metal. */
const reach = 0.05;
const unit = (c) => {
  const l = Math.hypot(c[0], c[1], c[2]) || 1;
  return [c[0] / l, c[1] / l, c[2] / l];
};
const angle = (a, b) => Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));

/**
 * Which metal a vertex colour of a dragon with `genome` shows, as a `metalIds` value: a colour counts
 * when its hue lies on the metal's scales, wings and underside or the blends between them, at any
 * brightness, which keeps tinted and shaded parts metal and the horns, claws, eyes and mouth not;
 * null for an ordinary coat.
 * @param {Record<string, number>} genome
 * @returns {((color: number[]) => number) | null}
 */
export function metalToneOf(genome) {
  const coat = metalCoatOf(genome?.metal);
  if (!coat) return null;
  const metals = [...new Set([coat.body, coat.wings])].map((metal) => {
    const { scales, wings, underside } = metalPalette[metal];
    const hues = [];
    for (const [a, b] of [[scales, underside], [scales, wings], [wings, underside]])
      for (let t = 0; t <= 1; t += 0.125) hues.push(unit(a.map((v, k) => v + (b[k] - v) * t)));
    return { id: metalIds[metal], hues };
  });
  return (color) => {
    const hue = unit(color);
    let best = 0,
      closest = reach;
    for (const { id, hues } of metals)
      for (const h of hues) {
        const a = angle(hue, h);
        if (a < closest) [best, closest] = [id, a];
      }
    return best;
  };
}
