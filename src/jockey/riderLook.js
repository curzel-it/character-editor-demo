import { makeRng } from "../rng.js";
import { palette, pigment } from "../palette.js";
import { leather } from "./tackColors.js";

/**
 * Body builds, never the pose or the race: `girth` scales the torso and limbs, and the optional
 * factors reshape the jacket's width at the `hips`, `waist`, `chest` and `shoulders`, its depth at
 * the `bust`, and the `neck`, `thighs` and `arms`.
 */
export const riderBuilds = [
  { id: "slim", girth: 0.86, shoulders: 0.92, neck: 0.9 },
  { id: "athletic", girth: 0.96, waist: 0.88, chest: 1.1, shoulders: 1.14, arms: 1.1, thighs: 1.06 },
  { id: "average", girth: 1 },
  { id: "hourglass", girth: 0.92, hips: 1.22, waist: 0.8, chest: 0.98, bust: 1.24, shoulders: 0.9, neck: 0.86, thighs: 1.12, arms: 0.9 },
  { id: "broad", girth: 1.06, hips: 0.94, waist: 1, chest: 1.18, bust: 1.08, shoulders: 1.28, neck: 1.25, thighs: 1.06, arms: 1.2 },
  { id: "stocky", girth: 1.14, hips: 1.08, waist: 1.18, chest: 1.08, bust: 1.12, shoulders: 1.1, neck: 1.2, thighs: 1.12, arms: 1.12 },
];

const plainBuild = { hips: 1, waist: 1, chest: 1, bust: 1, shoulders: 1, neck: 1, thighs: 1, arms: 1 };

export const riderSkins = [
  { id: "porcelain", rgb: pigment(0.07, 0.6, 0.86) },
  { id: "rosy", rgb: pigment(0.03, 0.55, 0.8) },
  { id: "fair", rgb: pigment(0.07, 0.5, 0.75) },
  { id: "light", rgb: pigment(0.08, 0.48, 0.68) },
  { id: "tan", rgb: pigment(0.07, 0.44, 0.6) },
  { id: "golden", rgb: pigment(0.09, 0.45, 0.54) },
  { id: "olive", rgb: pigment(0.1, 0.34, 0.5) },
  { id: "bronze", rgb: pigment(0.07, 0.42, 0.44) },
  { id: "brown", rgb: pigment(0.06, 0.4, 0.36) },
  { id: "umber", rgb: pigment(0.05, 0.38, 0.29) },
  { id: "deep", rgb: pigment(0.05, 0.34, 0.22) },
  { id: "ebony", rgb: pigment(0.04, 0.3, 0.16) },
];

export const riderEars = [{ id: "round" }, { id: "pointed" }, { id: "long" }];

export const riderEyes = [
  { id: "brown", rgb: pigment(0.07, 0.6, 0.26) },
  { id: "dark", rgb: pigment(0.07, 0.4, 0.13) },
  { id: "hazel", rgb: pigment(0.11, 0.5, 0.36) },
  { id: "amber", rgb: pigment(0.1, 0.8, 0.45) },
  { id: "green", rgb: pigment(0.33, 0.45, 0.38) },
  { id: "blue", rgb: pigment(0.58, 0.6, 0.5) },
  { id: "grey", rgb: pigment(0.58, 0.12, 0.55) },
  { id: "violet", rgb: pigment(0.77, 0.45, 0.5) },
];

export const riderHairStyles = [
  { id: "bald" },
  { id: "buzz" },
  { id: "short" },
  { id: "quiff" },
  { id: "curly" },
  { id: "spiky" },
  { id: "mohawk" },
  { id: "bob" },
  { id: "ponytail" },
  { id: "braid" },
  { id: "pigtails" },
  { id: "bun" },
  { id: "topknot" },
  { id: "long" },
  { id: "afro" },
];

export const riderHairColors = [
  { id: "black", rgb: pigment(0.07, 0.25, 0.09) },
  { id: "espresso", rgb: pigment(0.06, 0.35, 0.16) },
  { id: "brown", rgb: pigment(0.07, 0.42, 0.25) },
  { id: "chestnut", rgb: pigment(0.04, 0.5, 0.3) },
  { id: "auburn", rgb: pigment(0.02, 0.6, 0.36) },
  { id: "ginger", rgb: pigment(0.06, 0.75, 0.48) },
  { id: "strawberry", rgb: pigment(0.06, 0.6, 0.64) },
  { id: "blond", rgb: pigment(0.12, 0.62, 0.62) },
  { id: "platinum", rgb: pigment(0.13, 0.4, 0.84) },
  { id: "grey", rgb: pigment(0.6, 0.06, 0.62) },
  { id: "white", rgb: palette.ivory },
  { id: "teal", rgb: pigment(0.48, 0.55, 0.45) },
  { id: "blue", rgb: pigment(0.6, 0.6, 0.5) },
  { id: "purple", rgb: pigment(0.77, 0.5, 0.48) },
  { id: "pink", rgb: pigment(0.93, 0.7, 0.72) },
  { id: "green", rgb: pigment(0.32, 0.5, 0.42) },
];

const naturalHair = 11;

export const riderFacialHair = [{ id: "none" }, { id: "stubble" }, { id: "moustache" }, { id: "goatee" }, { id: "beard" }, { id: "braided" }];

export const riderMarks = [{ id: "none" }, { id: "freckles" }, { id: "blush" }, { id: "paint" }];

/** Headwear on top of the head: the helmet in the silks' cap colour, a flying cap, a bandana, a circlet, a hat, or nothing. */
export const riderHats = [{ id: "cap" }, { id: "aviator" }, { id: "bandana" }, { id: "circlet" }, { id: "pointed" }, { id: "horned" }, { id: "none" }];

export const riderGoggles = [
  { id: "smoke", rgb: palette.glass },
  { id: "amber", rgb: pigment(0.09, 0.85, 0.5) },
  { id: "emerald", rgb: pigment(0.4, 0.6, 0.4) },
  { id: "sky", rgb: pigment(0.55, 0.7, 0.62) },
  { id: "rose", rgb: pigment(0.95, 0.65, 0.66) },
  { id: "mirror", rgb: palette.gold },
];

export const riderScarves = [{ id: "none" }, { id: "short" }, { id: "long" }];

/** Kit colours for gloves, boots and breeches; `silks` takes the silks' accent. */
const kit = {
  leather: leather,
  black: palette.dark,
  white: palette.ivory,
  cream: pigment(0.12, 0.45, 0.82),
  tan: pigment(0.08, 0.4, 0.62),
  brown: pigment(0.07, 0.45, 0.24),
  grey: pigment(0.6, 0.06, 0.55),
};
const kitOptions = (ids) => ids.map((id) => ({ id, rgb: kit[id] }));
export const riderGloves = [...kitOptions(["leather", "black", "white"]), { id: "silks" }];
export const riderBoots = [...kitOptions(["black", "brown", "tan", "white"]), { id: "silks" }];
export const riderBreeches = [...kitOptions(["white", "cream", "tan", "grey", "black"]), { id: "silks" }];

/**
 * The look's fields with their options, in the order a picker shows them: `group` is the maker's
 * group and `swatch` marks the fields picked by colour.
 */
export const riderLookFields = [
  { key: "build", options: riderBuilds, group: "body" },
  { key: "ears", options: riderEars, group: "body" },
  { key: "skin", options: riderSkins, group: "body", swatch: true },
  { key: "marks", options: riderMarks, group: "face" },
  { key: "eyes", options: riderEyes, group: "face", swatch: true },
  { key: "hair", options: riderHairStyles, group: "hair" },
  { key: "facialHair", options: riderFacialHair, group: "hair" },
  { key: "hairColor", options: riderHairColors, group: "hair", swatch: true },
  { key: "hat", options: riderHats, group: "accessories" },
  { key: "goggles", options: riderGoggles, group: "accessories" },
  { key: "scarf", options: riderScarves, group: "accessories" },
  { key: "breeches", options: riderBreeches, group: "kit" },
  { key: "gloves", options: riderGloves, group: "kit" },
  { key: "boots", options: riderBoots, group: "kit" },
];

/**
 * @typedef {{ build: string, skin: string, ears: string, eyes: string, hair: string, hairColor: string, facialHair: string,
 *   marks: string, hat: string, goggles: string, scarf: string, gloves: string, boots: string, breeches: string }} RiderLook
 */

const pickFrom = (random, options) => options[Math.floor(random() * options.length)].id;
const mostly = (random, share, usual, options) => (random() < share ? usual : pickFrom(random, options));

/**
 * A seeded look: any build, skin, eyes and hair, rarely a dyed colour, pointed ears or face paint,
 * and mostly the silks cap and plain kit.
 * @returns {RiderLook}
 */
export function createRiderLook(seed) {
  const random = makeRng(`look:${seed}`);
  return {
    build: pickFrom(random, riderBuilds),
    skin: pickFrom(random, riderSkins),
    ears: mostly(random, 0.85, "round", riderEars),
    eyes: pickFrom(random, riderEyes.slice(0, 7)),
    hair: pickFrom(random, riderHairStyles),
    hairColor: random() < 0.08 ? pickFrom(random, riderHairColors.slice(naturalHair)) : pickFrom(random, riderHairColors.slice(0, naturalHair)),
    facialHair: mostly(random, 0.7, "none", riderFacialHair),
    marks: mostly(random, 0.7, "none", riderMarks),
    hat: mostly(random, 0.75, "cap", riderHats),
    goggles: pickFrom(random, riderGoggles),
    scarf: mostly(random, 0.6, "none", riderScarves),
    gloves: mostly(random, 0.6, "leather", riderGloves),
    boots: mostly(random, 0.6, "black", riderBoots),
    breeches: mostly(random, 0.6, "white", riderBreeches),
  };
}

/** @returns {RiderLook} the saved look, each unknown field falling back to the seeded one. */
export function restoreRiderLook(saved, seed) {
  const base = createRiderLook(seed);
  return Object.fromEntries(riderLookFields.map(({ key, options }) => [key, options.some((o) => o.id === saved?.[key]) ? saved[key] : base[key]]));
}

const byId = (options, id) => options.find((o) => o.id === id) ?? options[0];

/** The look as numbers and colours for the rider model; kit set to `silks` takes `accent`. */
export function riderLookParts(look, accent) {
  const kitRgb = (options, id) => byId(options, id).rgb ?? accent;
  return {
    build: { ...plainBuild, ...byId(riderBuilds, look.build) },
    skin: byId(riderSkins, look.skin).rgb,
    ears: look.ears,
    eyes: byId(riderEyes, look.eyes).rgb,
    hair: look.hair,
    hairRgb: byId(riderHairColors, look.hairColor).rgb,
    facialHair: look.facialHair,
    marks: look.marks,
    hat: look.hat,
    lens: byId(riderGoggles, look.goggles).rgb,
    scarf: look.scarf,
    gloves: kitRgb(riderGloves, look.gloves),
    boots: kitRgb(riderBoots, look.boots),
    breeches: kitRgb(riderBreeches, look.breeches),
  };
}
