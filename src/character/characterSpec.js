import { eyeColors, fabricColors, fancyHairColors, fancySkinTones, hairColors, isHex, lensColors, metalColors, skinTones } from "./characterColors.js";

/**
 * @typedef {{ id: string, label: string }} Choice
 * @typedef {"full" | "head" | "face" | "eyes" | "upper" | "lower" | "feet"} Focus
 * @typedef {{ key: string, group: string, section: string, label: string, kind: "slider", min?: string, max?: string, default: number, focus: Focus, shown?: (spec: CharacterSpec) => boolean }} SliderField
 * @typedef {{ key: string, group: string, section: string, label: string, kind: "choice", options: Choice[], default: string, focus: Focus, shown?: (spec: CharacterSpec) => boolean }} ChoiceField
 * @typedef {{ key: string, group: string, section: string, label: string, kind: "color", swatches: { id: string, hex: string }[][], default: string, focus: Focus, shown?: (spec: CharacterSpec) => boolean }} ColorField
 * @typedef {SliderField | ChoiceField | ColorField} Field
 * @typedef {Record<string, string | number> & { name: string }} CharacterSpec
 */

const choices = (entries) => entries.map(([id, label]) => ({ id, label }));

export const groups = [
  { id: "body", label: "Body", icon: "body" },
  { id: "face", label: "Face", icon: "face" },
  { id: "eyes", label: "Eyes", icon: "eye" },
  { id: "hair", label: "Hair", icon: "hair" },
  { id: "outfit", label: "Outfit", icon: "shirt" },
  { id: "extras", label: "Extras", icon: "hat" },
];

export const hairStyles = choices([
  ["bald", "Bald"],
  ["buzz", "Buzz"],
  ["crop", "Crop"],
  ["sidePart", "Side part"],
  ["quiff", "Quiff"],
  ["spiky", "Spiky"],
  ["mohawk", "Mohawk"],
  ["curls", "Curls"],
  ["afro", "Afro"],
  ["bob", "Bob"],
  ["shag", "Shag"],
  ["wavy", "Wavy"],
  ["long", "Long"],
  ["ponytail", "Ponytail"],
  ["bun", "Bun"],
  ["spaceBuns", "Space buns"],
  ["pigtails", "Pigtails"],
  ["braid", "Braid"],
]);

const noneOr = (entries) => choices([["none", "None"], ...entries]);

/** Every editable trait, in the order the editor shows them. */
export const fields = /** @type {Field[]} */ ([
  { key: "height", group: "body", section: "Shape", label: "Height", kind: "slider", min: "Short", max: "Tall", default: 0.5, focus: "full" },
  { key: "build", group: "body", section: "Shape", label: "Build", kind: "slider", min: "Slender", max: "Heavy", default: 0.4, focus: "full" },
  { key: "muscle", group: "body", section: "Shape", label: "Muscle", kind: "slider", min: "Soft", max: "Strong", default: 0.35, focus: "full" },
  { key: "shoulders", group: "body", section: "Shape", label: "Shoulders", kind: "slider", min: "Narrow", max: "Broad", default: 0.5, focus: "upper" },
  { key: "chest", group: "body", section: "Shape", label: "Chest", kind: "slider", min: "Flat", max: "Full", default: 0.3, focus: "upper" },
  { key: "waist", group: "body", section: "Shape", label: "Waist", kind: "slider", min: "Narrow", max: "Wide", default: 0.45, focus: "upper" },
  { key: "hips", group: "body", section: "Shape", label: "Hips", kind: "slider", min: "Narrow", max: "Wide", default: 0.45, focus: "lower" },
  { key: "legs", group: "body", section: "Shape", label: "Legs", kind: "slider", min: "Short", max: "Long", default: 0.5, focus: "full" },
  { key: "headSize", group: "body", section: "Shape", label: "Head size", kind: "slider", min: "Small", max: "Big", default: 0.55, focus: "full" },
  { key: "skin", group: "body", section: "Skin", label: "Skin tone", kind: "color", swatches: [skinTones, fancySkinTones], default: "#e6b98f", focus: "face" },

  { key: "faceWidth", group: "face", section: "Face shape", label: "Width", kind: "slider", min: "Narrow", max: "Wide", default: 0.5, focus: "face" },
  { key: "faceLength", group: "face", section: "Face shape", label: "Length", kind: "slider", min: "Short", max: "Long", default: 0.4, focus: "face" },
  { key: "jaw", group: "face", section: "Face shape", label: "Jaw", kind: "slider", min: "Soft", max: "Square", default: 0.35, focus: "face" },
  { key: "chin", group: "face", section: "Face shape", label: "Chin", kind: "slider", min: "Round", max: "Pointed", default: 0.4, focus: "face" },
  { key: "cheeks", group: "face", section: "Face shape", label: "Cheeks", kind: "slider", min: "Hollow", max: "Chubby", default: 0.5, focus: "face" },
  {
    key: "nose",
    group: "face",
    section: "Nose",
    label: "Nose",
    kind: "choice",
    options: choices([["button", "Button"], ["round", "Round"], ["straight", "Straight"], ["pointed", "Pointed"], ["snub", "Snub"], ["broad", "Broad"], ["hooked", "Hooked"], ["dot", "Tiny"]]),
    default: "button",
    focus: "face",
  },
  { key: "noseSize", group: "face", section: "Nose", label: "Nose size", kind: "slider", min: "Small", max: "Large", default: 0.45, focus: "face" },
  {
    key: "mouth",
    group: "face",
    section: "Mouth",
    label: "Mouth",
    kind: "choice",
    options: choices([["smile", "Smile"], ["grin", "Grin"], ["soft", "Soft"], ["smirk", "Smirk"], ["neutral", "Neutral"], ["cat", "Cat"], ["open", "Cheery"], ["pout", "Pout"]]),
    default: "smile",
    focus: "face",
  },
  { key: "lips", group: "face", section: "Mouth", label: "Lip tint", kind: "slider", min: "None", max: "Bold", default: 0.25, focus: "face" },
  {
    key: "ears",
    group: "face",
    section: "Ears",
    label: "Ears",
    kind: "choice",
    options: choices([["round", "Round"], ["small", "Small"], ["big", "Big"], ["pointed", "Pointed"], ["elf", "Elf"], ["droopy", "Droopy"]]),
    default: "round",
    focus: "head",
  },
  {
    key: "cheekMarks",
    group: "face",
    section: "Marks",
    label: "Cheeks",
    kind: "choice",
    options: noneOr([["blush", "Blush"], ["freckles", "Freckles"], ["both", "Both"]]),
    default: "blush",
    focus: "face",
  },
  {
    key: "marking",
    group: "face",
    section: "Marks",
    label: "Markings",
    kind: "choice",
    options: noneOr([["mole", "Beauty mark"], ["stripes", "War paint"], ["dots", "Dots"], ["scar", "Scar"], ["star", "Star"], ["tattoo", "Swirl"]]),
    default: "none",
    focus: "face",
  },
  { key: "markColor", group: "face", section: "Marks", label: "Paint colour", kind: "color", swatches: [fabricColors], default: "#cf3236", focus: "face", shown: (s) => ["stripes", "dots", "star", "tattoo"].includes(String(s.marking)) },

  {
    key: "eyes",
    group: "eyes",
    section: "Eyes",
    label: "Shape",
    kind: "choice",
    options: choices([["round", "Round"], ["classic", "Classic"], ["almond", "Almond"], ["big", "Sparkly"], ["sleepy", "Sleepy"], ["bead", "Bead"], ["cat", "Cat"], ["droopy", "Gentle"]]),
    default: "round",
    focus: "eyes",
  },
  { key: "eyeColor", group: "eyes", section: "Eyes", label: "Colour", kind: "color", swatches: [eyeColors], default: "#4a2c1a", focus: "eyes" },
  { key: "eyeSize", group: "eyes", section: "Eyes", label: "Size", kind: "slider", min: "Small", max: "Big", default: 0.5, focus: "eyes" },
  { key: "eyeSpacing", group: "eyes", section: "Eyes", label: "Spacing", kind: "slider", min: "Close", max: "Wide", default: 0.5, focus: "eyes" },
  { key: "eyeHeight", group: "eyes", section: "Eyes", label: "Height", kind: "slider", min: "Low", max: "High", default: 0.5, focus: "eyes" },
  { key: "eyeTilt", group: "eyes", section: "Eyes", label: "Tilt", kind: "slider", min: "Down", max: "Up", default: 0.5, focus: "eyes" },
  { key: "lashes", group: "eyes", section: "Lashes & brows", label: "Lashes", kind: "choice", options: noneOr([["soft", "Soft"], ["long", "Long"], ["flick", "Flick"]]), default: "soft", focus: "eyes" },
  {
    key: "brows",
    group: "eyes",
    section: "Lashes & brows",
    label: "Brows",
    kind: "choice",
    options: noneOr([["soft", "Soft"], ["thick", "Thick"], ["thin", "Thin"], ["arched", "Arched"], ["straight", "Straight"], ["bushy", "Bushy"], ["dots", "Dots"]]),
    default: "soft",
    focus: "eyes",
  },
  { key: "browHeight", group: "eyes", section: "Lashes & brows", label: "Brow height", kind: "slider", min: "Low", max: "High", default: 0.5, focus: "eyes" },

  { key: "hair", group: "hair", section: "Hair", label: "Style", kind: "choice", options: hairStyles, default: "shag", focus: "head" },
  { key: "hairColor", group: "hair", section: "Hair", label: "Colour", kind: "color", swatches: [hairColors, fancyHairColors], default: "#5e3a22", focus: "head" },
  { key: "hairTips", group: "hair", section: "Hair", label: "Dyed tips", kind: "color", swatches: [[{ id: "none", hex: "none" }, ...hairColors.slice(6)], fancyHairColors], default: "none", focus: "head", shown: (s) => s.hair !== "bald" && s.hair !== "buzz" },
  { key: "hairVolume", group: "hair", section: "Hair", label: "Volume", kind: "slider", min: "Flat", max: "Full", default: 0.5, focus: "head", shown: (s) => s.hair !== "bald" },
  {
    key: "facialHair",
    group: "hair",
    section: "Facial hair",
    label: "Facial hair",
    kind: "choice",
    options: noneOr([["stubble", "Stubble"], ["moustache", "Moustache"], ["handlebar", "Handlebar"], ["goatee", "Goatee"], ["chinstrap", "Chinstrap"], ["beard", "Beard"], ["fullBeard", "Big beard"]]),
    default: "none",
    focus: "face",
  },

  {
    key: "top",
    group: "outfit",
    section: "Top",
    label: "Top",
    kind: "choice",
    options: choices([["tee", "T-shirt"], ["longsleeve", "Long sleeve"], ["tank", "Tank"], ["sweater", "Sweater"], ["hoodie", "Hoodie"], ["jacket", "Jacket"], ["tunic", "Tunic"], ["silks", "Racing silks"], ["vest", "Waistcoat"], ["dress", "Dress"]]),
    default: "sweater",
    focus: "upper",
  },
  { key: "topColor", group: "outfit", section: "Top", label: "Main colour", kind: "color", swatches: [fabricColors], default: "#21858a", focus: "upper" },
  { key: "topAccent", group: "outfit", section: "Top", label: "Accent", kind: "color", swatches: [fabricColors], default: "#f2cf4a", focus: "upper" },
  {
    key: "pattern",
    group: "outfit",
    section: "Top",
    label: "Pattern",
    kind: "choice",
    options: choices([["plain", "Plain"], ["stripes", "Stripes"], ["hoops", "Hoops"], ["band", "Band"], ["halves", "Halves"], ["sash", "Sash"], ["dots", "Dots"], ["checks", "Checks"], ["chevron", "Chevron"]]),
    default: "plain",
    focus: "upper",
  },
  {
    key: "bottom",
    group: "outfit",
    section: "Bottom",
    label: "Bottom",
    kind: "choice",
    options: choices([["trousers", "Trousers"], ["jeans", "Jeans"], ["shorts", "Shorts"], ["skirt", "Skirt"], ["longSkirt", "Long skirt"], ["breeches", "Breeches"], ["leggings", "Leggings"], ["overalls", "Overalls"]]),
    default: "trousers",
    focus: "lower",
    shown: (s) => s.top !== "dress",
  },
  { key: "bottomColor", group: "outfit", section: "Bottom", label: "Colour", kind: "color", swatches: [fabricColors], default: "#36383d", focus: "lower", shown: (s) => s.top !== "dress" },
  {
    key: "shoes",
    group: "outfit",
    section: "Shoes",
    label: "Shoes",
    kind: "choice",
    options: choices([["sneakers", "Sneakers"], ["boots", "Boots"], ["tallBoots", "Riding boots"], ["shoes", "Shoes"], ["sandals", "Sandals"], ["slippers", "Slippers"], ["clogs", "Clogs"]]),
    default: "boots",
    focus: "feet",
  },
  { key: "shoesColor", group: "outfit", section: "Shoes", label: "Colour", kind: "color", swatches: [fabricColors], default: "#6e4a2f", focus: "feet" },
  { key: "gloves", group: "outfit", section: "Gloves", label: "Gloves", kind: "choice", options: noneOr([["gloves", "Gloves"], ["mitts", "Fingerless"], ["gauntlets", "Gauntlets"]]), default: "none", focus: "upper" },
  { key: "glovesColor", group: "outfit", section: "Gloves", label: "Colour", kind: "color", swatches: [fabricColors], default: "#6e4a2f", focus: "upper", shown: (s) => s.gloves !== "none" },

  {
    key: "hat",
    group: "extras",
    section: "Headwear",
    label: "Headwear",
    kind: "choice",
    options: noneOr([["cap", "Cap"], ["beanie", "Beanie"], ["helmet", "Riding helmet"], ["aviator", "Aviator"], ["sunHat", "Sun hat"], ["wizard", "Wizard"], ["beret", "Beret"], ["bandana", "Bandana"], ["headband", "Headband"], ["flowers", "Flower crown"], ["crown", "Crown"], ["horns", "Horned helm"], ["catEars", "Cat ears"]]),
    default: "none",
    focus: "head",
  },
  { key: "hatColor", group: "extras", section: "Headwear", label: "Colour", kind: "color", swatches: [fabricColors, metalColors], default: "#cf3236", focus: "head", shown: (s) => s.hat !== "none" },
  { key: "glasses", group: "extras", section: "Eyewear", label: "Eyewear", kind: "choice", options: noneOr([["round", "Round"], ["square", "Square"], ["cateye", "Cat-eye"], ["shades", "Shades"], ["goggles", "Goggles"], ["monocle", "Monocle"]]), default: "none", focus: "face" },
  { key: "glassesColor", group: "extras", section: "Eyewear", label: "Frame", kind: "color", swatches: [metalColors, fabricColors], default: "#26272b", focus: "face", shown: (s) => s.glasses !== "none" },
  { key: "lensColor", group: "extras", section: "Eyewear", label: "Lenses", kind: "color", swatches: [lensColors], default: "#d9eef2", focus: "face", shown: (s) => s.glasses !== "none" && s.glasses !== "monocle" },
  { key: "neck", group: "extras", section: "Neck", label: "Neckwear", kind: "choice", options: noneOr([["scarf", "Scarf"], ["longScarf", "Long scarf"], ["bandana", "Bandana"], ["necklace", "Necklace"], ["bowtie", "Bow tie"], ["collar", "Ruff"]]), default: "none", focus: "upper" },
  { key: "neckColor", group: "extras", section: "Neck", label: "Colour", kind: "color", swatches: [fabricColors, metalColors], default: "#ec8a35", focus: "upper", shown: (s) => s.neck !== "none" },
  { key: "back", group: "extras", section: "Back", label: "On the back", kind: "choice", options: noneOr([["cape", "Cape"], ["backpack", "Backpack"], ["satchel", "Satchel"], ["wings", "Little wings"], ["quiver", "Quiver"]]), default: "none", focus: "upper" },
  { key: "backColor", group: "extras", section: "Back", label: "Colour", kind: "color", swatches: [fabricColors], default: "#8f2a52", focus: "upper", shown: (s) => s.back !== "none" },
  { key: "earrings", group: "extras", section: "Jewellery", label: "Earrings", kind: "choice", options: noneOr([["studs", "Studs"], ["hoops", "Hoops"], ["drops", "Drops"]]), default: "none", focus: "head" },
  { key: "jewelColor", group: "extras", section: "Jewellery", label: "Metal", kind: "color", swatches: [metalColors], default: "#e8b54a", focus: "head", shown: (s) => s.earrings !== "none" || s.neck === "necklace" || s.hat === "crown" },
]);

export const fieldByKey = new Map(fields.map((f) => [f.key, f]));

export const NAME_LENGTH = 24;

/** @returns {CharacterSpec} the default character. */
export function defaultSpec() {
  return /** @type {CharacterSpec} */ ({ name: "Wren", ...Object.fromEntries(fields.map((f) => [f.key, f.default])) });
}

/** Whether `value` is a valid value for `field`. */
export function validValue(field, value) {
  if (field.kind === "slider") return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
  if (field.kind === "choice") return field.options.some((o) => o.id === value);
  return value === "none" ? field.swatches.some((row) => row.some((s) => s.hex === "none")) : isHex(value);
}

/**
 * Any saved or pasted value as a complete spec: each missing or invalid field falls back to `base`
 * (the defaults when omitted) and sliders are clamped into 0..1.
 * @returns {CharacterSpec}
 */
export function normalizeSpec(value, base = defaultSpec()) {
  const out = /** @type {CharacterSpec} */ ({ ...base });
  if (!value || typeof value !== "object") return out;
  if (typeof value.name === "string") out.name = value.name.replace(/\s+/g, " ").trim().slice(0, NAME_LENGTH) || base.name;
  for (const field of fields) {
    let v = value[field.key];
    if (field.kind === "slider" && typeof v === "number" && Number.isFinite(v)) v = Math.max(0, Math.min(1, v));
    if (field.kind === "color" && typeof v === "string") v = v.toLowerCase();
    if (validValue(field, v)) out[field.key] = v;
  }
  return out;
}

/** Whether `field` applies to `spec` (a colour of a garment that is not worn does not). */
export const fieldShown = (field, spec) => !field.shown || field.shown(spec);

/** The label of `spec[key]` for a choice field. */
export function choiceLabel(key, spec) {
  const field = fieldByKey.get(key);
  return field?.kind === "choice" ? (field.options.find((o) => o.id === spec[key])?.label ?? "") : "";
}
