import { rgbOf, shade, mixRgb, luminance } from "./characterColors.js";

/**
 * @typedef {{ sleeve: number, hem: number, neck: number, scoop: number, thick: number, cuff?: number[], hemBand?: number[],
 *   collar?: number[], open?: number, inner?: number[], skirt?: { length: number, flare: number, from: "waist" | "hips" },
 *   belt?: number[], hood?: boolean, pocket?: boolean, buttons?: number[], bareShoulders?: boolean, vee?: number,
 *   bib?: boolean, sleevePuff?: number, sleeveRgb?: number[] }} TopWear
 * @typedef {{ length: number, thick: number, flare: number, cuff?: number[], jodhpur?: number, skirt?: { length: number, flare: number, from: "waist" | "hips" }, bib?: boolean, waist: number }} BottomWear
 */

/**
 * Pattern painters over the torso: `y` up the body in metres from the waist, `angle` round it (0
 * the front, a quarter turn the left side), returning whether the accent shows there.
 */
const patterns = {
  plain: () => false,
  stripes: (y, angle) => Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 16) % 2 === 1,
  hoops: (y) => Math.floor(y / 0.055) % 2 === 1,
  band: (y) => y > 0.17 && y < 0.24,
  halves: (y, angle) => Math.sin(angle) > 0,
  sash: (y, angle) => Math.abs(y - 0.14 - Math.sin(angle) * 0.12 * Math.sign(Math.cos(angle))) < 0.035,
  dots: (y, angle) => {
    const row = Math.floor(y / 0.06);
    const a = (angle / (Math.PI * 2)) * 18 + (row % 2) * 0.5;
    const fy = y / 0.06 - row - 0.5,
      fa = a - Math.floor(a) - 0.5;
    return fy * fy + fa * fa * 1.2 < 0.07;
  },
  checks: (y, angle) => (Math.floor(y / 0.07) + Math.floor(((angle + Math.PI) / (Math.PI * 2)) * 12)) % 2 === 1,
  chevron: (y, angle) => Math.floor((y + Math.abs(Math.sin(angle)) * 0.09 * Math.sign(Math.cos(angle))) / 0.06) % 2 === 1,
};

/** The pattern painter for `id`. */
export const patternOf = (id) => patterns[id] ?? patterns.plain;

/**
 * What the outfit puts on the body, measured against the torso's landmarks: `hem` and `neck` are
 * heights (m) of the top's lower and upper edges, `sleeve` the share of the arm it covers, and the
 * bottom's `length` the share of the leg. Colours are renderer rgb.
 * @param {import("./characterSpec.js").CharacterSpec} spec
 * @param {{ hipY: number, waistY: number, pelvisTopY: number, chestY: number, neckBaseY: number, s: number }} marks
 */
export function outfitOf(spec, marks) {
  const main = rgbOf(spec.topColor);
  const accent = rgbOf(spec.topAccent);
  const darker = shade(main, 0.84);
  const { hipY, waistY, pelvisTopY, chestY, neckBaseY, s } = marks;
  const shirt = luminance(accent) > 0.55 ? accent : rgbOf("#f6f2e9");
  /** @type {Record<string, TopWear>} */
  const tops = {
    tee: { sleeve: 0.4, hem: hipY - 0.01 * s, neck: neckBaseY, scoop: 0.012 * s, thick: 0.005, cuff: darker },
    longsleeve: { sleeve: 1, hem: hipY - 0.012 * s, neck: neckBaseY, scoop: 0.006 * s, thick: 0.005, cuff: accent, collar: darker },
    tank: { sleeve: 0, hem: hipY - 0.005 * s, neck: neckBaseY - 0.005 * s, scoop: 0.07 * s, thick: 0.004, bareShoulders: true },
    sweater: { sleeve: 1, hem: hipY - 0.03 * s, neck: neckBaseY + 0.03 * s, scoop: 0, thick: 0.012, cuff: darker, hemBand: darker, collar: darker },
    hoodie: { sleeve: 1, hem: hipY - 0.035 * s, neck: neckBaseY, scoop: 0.01 * s, thick: 0.013, cuff: darker, hemBand: darker, hood: true, pocket: true, buttons: accent },
    jacket: { sleeve: 1, hem: hipY - 0.05 * s, neck: neckBaseY + 0.01 * s, scoop: 0, thick: 0.014, cuff: darker, open: 0.05 * s, inner: shirt, collar: darker, buttons: accent },
    tunic: { sleeve: 0.82, hem: waistY - 0.02 * s, neck: neckBaseY, scoop: 0.018 * s, thick: 0.008, cuff: accent, belt: rgbOf("#6e4a2f"), skirt: { length: 0.34, flare: 0.05, from: "waist" }, vee: 0.05 * s },
    silks: { sleeve: 1, hem: hipY - 0.02 * s, neck: neckBaseY + 0.012 * s, scoop: 0, thick: 0.007, cuff: main, collar: accent, sleeveRgb: accent },
    vest: { sleeve: 1, hem: hipY - 0.01 * s, neck: neckBaseY + 0.01 * s, scoop: 0, thick: 0.009, cuff: shirt, sleeveRgb: shirt, vee: 0.13 * s, inner: shirt, buttons: accent, collar: shirt },
    dress: { sleeve: 0.22, hem: waistY - 0.03 * s, neck: neckBaseY - 0.01 * s, scoop: 0.03 * s, thick: 0.006, belt: accent, skirt: { length: 0.56, flare: 0.1, from: "waist" }, sleevePuff: 0.018 },
  };
  const top = tops[spec.top] ?? tops.tee;
  const bottomRgb = rgbOf(spec.bottomColor);
  /** @type {Record<string, BottomWear>} */
  const bottoms = {
    trousers: { length: 1, thick: 0.008, flare: 0.006, waist: pelvisTopY + 0.01 * s },
    jeans: { length: 0.97, thick: 0.008, flare: 0.004, cuff: shade(bottomRgb, 1.25), waist: pelvisTopY },
    shorts: { length: 0.36, thick: 0.012, flare: 0.016, waist: pelvisTopY + 0.01 * s },
    skirt: { length: 0, thick: 0, flare: 0, skirt: { length: 0.4, flare: 0.08, from: "waist" }, waist: waistY },
    longSkirt: { length: 0, thick: 0, flare: 0, skirt: { length: 0.88, flare: 0.13, from: "waist" }, waist: waistY },
    breeches: { length: 0.62, thick: 0.006, flare: 0, jodhpur: 0.022, waist: pelvisTopY + 0.01 * s },
    leggings: { length: 1, thick: 0.002, flare: 0, waist: pelvisTopY + 0.01 * s },
    overalls: { length: 1, thick: 0.01, flare: 0.006, bib: true, waist: pelvisTopY },
  };
  const bottom = spec.top === "dress" ? { length: 0, thick: 0, flare: 0, waist: waistY } : (bottoms[spec.bottom] ?? bottoms.trousers);
  const patternId = spec.top === "silks" && spec.pattern === "plain" ? "sash" : spec.pattern;
  const tucked = Boolean(bottom.bib) || (bottom.skirt && !top.skirt && top.hem < bottom.waist);
  return {
    top: { ...top, ...(tucked ? { hem: Math.max(top.hem, bottom.waist - 0.005), hemBand: undefined, tucked: true } : {}), main, accent, pattern: patternOf(patternId), fine: ["chevron", "sash", "dots"].includes(patternId) },
    bottom: { ...bottom, rgb: bottomRgb },
    shoes: shoeOf(spec),
    gloves: spec.gloves === "none" ? null : { kind: spec.gloves, rgb: rgbOf(spec.glovesColor) },
  };
}

/** The shoe's look: how far up the shin its shaft reaches (share of the shin), its sole, and its body. */
export function shoeOf(spec) {
  const rgb = rgbOf(spec.shoesColor);
  const sole = luminance(rgb) > 0.6 ? shade(rgb, 0.7) : mixRgb(rgb, [0.95, 0.93, 0.88], 0.0);
  const shoes = {
    sneakers: { shaft: 0.04, sole: [0.96, 0.95, 0.92], soleHeight: 0.022, width: 1.08, toe: 1.05, laces: [0.97, 0.97, 0.95], stripe: shade(rgb, 1.5) },
    boots: { shaft: 0.26, sole: shade(rgb, 0.45), soleHeight: 0.016, width: 1.06, toe: 1, cuff: shade(rgb, 0.8) },
    tallBoots: { shaft: 0.78, sole: shade(rgb, 0.4), soleHeight: 0.014, width: 1.02, toe: 1, cuff: shade(rgb, 0.78) },
    shoes: { shaft: 0.0, sole: shade(rgb, 0.5), soleHeight: 0.01, width: 0.96, toe: 1.02 },
    sandals: { shaft: 0.0, sole: shade(rgb, 0.85), soleHeight: 0.014, width: 0.98, toe: 1, open: true },
    slippers: { shaft: 0.0, sole: shade(rgb, 0.7), soleHeight: 0.012, width: 1.16, toe: 1.1, puff: true },
    clogs: { shaft: 0.0, sole: shade(rgb, 0.6), soleHeight: 0.02, width: 1.14, toe: 1.12, puff: true },
  };
  return { kind: spec.shoes, rgb, ...(shoes[spec.shoes] ?? shoes.boots), sole: (shoes[spec.shoes] ?? shoes.boots).sole ?? sole };
}
