import { tint, palette } from "../palette.js";
import { mix } from "./dragonShape.js";

/** Coat markings, drawn by the racer shader over the scale colour; `kind` is the shader's id for each. */
export const dragonMarkings = [
  { id: "none", label: "None", kind: 0, weight: 9 },
  { id: "leopard", label: "Leopard spots", kind: 1, weight: 1 },
  { id: "zebra", label: "Zebra stripes", kind: 2, weight: 1 },
  { id: "cow", label: "Cow patches", kind: 3, weight: 1 },
];

const WINGS = /^(wing|spar|hindwing)/;
const ARMS = /^wing-arm-hide/;
const LEGS = /^hindlimb/;
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Lets markings show on the wing arms and every part drawn in the scale colour except the wings: `markings` is 1,
 * or -1 on the legs, whose stripes run round them. The underside and the backs of the legs stay bare through each
 * part's `marks`.
 * @param {{ id: string, color: number[], markings?: number }[]} parts
 * @param {number[]} skin
 */
export function markParts(parts, skin) {
  for (const part of parts)
    if (ARMS.test(part.id) || (part.color === skin && !WINGS.test(part.id))) part.markings = LEGS.test(part.id) ? -1 : 1;
}

/**
 * The markings a genome wears, or null: the shader's `kind`, a `color` well apart from the scales and a `seed`
 * placing the pattern, from the shape genes so it stays put while colours change.
 * @param {Record<string, number>} genome
 * @param {number[]} skin
 */
export function markingsOf(genome, skin) {
  const variant = dragonMarkings[Math.max(0, Math.min(dragonMarkings.length - 1, Math.floor(genome.markings) || 0))];
  if (!variant.kind) return null;
  const color = luminance(skin) > 0.22 ? tint(skin, 0.3) : mix(skin, palette.ivory, 0.5);
  const seed = ["body", "wingspan", "neck", "tail"].reduce((sum, name, i) => sum + (genome[name] || 0) * [37.1, 11.3, 23.9, 7.7][i], 0);
  return { kind: variant.kind, color, seed: [(seed * 7.13) % 97, (seed * 3.71) % 89] };
}
