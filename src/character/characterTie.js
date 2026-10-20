import { meshPart, tubeSurface, mix } from "./surface.js";
import { rgbOf, shade } from "./characterColors.js";
import { torsoFront, torsoWeights } from "./characterBody.js";

/**
 * A necktie: a knot under the collar and a blade laid down the front of the shirt, ending at the belt,
 * or tucked away where a jacket, waistcoat or cardigan closes.
 * @param {import("./characterSpec.js").CharacterSpec} spec
 * @param {ReturnType<import("./characterOutfit.js").outfitOf>} outfit
 */
export function necktie(spec, j, m, outfit, marks) {
  if (spec.neck !== "tie") return [];
  const { s } = m;
  const top = outfit.top;
  const rgb = rgbOf(spec.neckColor);
  const front = torsoFront(j, m, outfit, marks);
  const weights = torsoWeights(j);
  const knotY = top.neck - 0.02 * s;
  const endY = top.vee ? top.neck - top.vee - 0.015 * s : Math.max(outfit.bottom.waist + 0.012 * s, top.hem + 0.02 * s);
  const rings = [];
  for (let k = 0; k <= 14; k++) {
    const t = k / 14;
    const y = mix(knotY - 0.01 * s, endY, t);
    const width = t < 0.9 ? mix(0.012, 0.03, t / 0.9) : mix(0.03, 0.004, (t - 0.9) / 0.1);
    rings.push({ p: [front(y) + 0.004 + 0.002 * t, y, 0], r: [0.003 * s, width * s], skin: weights(y) });
  }
  const knotAt = [front(knotY) + 0.009 * s, knotY, 0];
  return [
    meshPart("tie-blade", "chest", tubeSurface(rings, { around: 8, up: [1, 0, 0], color: () => rgb })),
    { id: "tie-knot", bone: "chest", shape: "ellipsoid", segments: 12, position: knotAt, rotation: [0, 0, 0.15], scale: [0.009 * s, 0.014 * s, 0.013 * s], color: shade(rgb, 0.92) },
  ];
}
