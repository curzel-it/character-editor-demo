import { makeRng } from "../rng.js";
import { fields, defaultSpec, normalizeSpec } from "./characterSpec.js";
import { skinTones, fancySkinTones, hairColors, fancyHairColors, eyeColors, fabricColors, metalColors, lensColors, rgbOf, luminance } from "./characterColors.js";

const NAMES = [
  "Wren", "Ash", "Juniper", "Rowan", "Sage", "Marlo", "Tove", "Ilse", "Kit", "Remy", "Nia", "Otto", "Pia", "Ezra", "Lark", "Bo",
  "Cass", "Dax", "Elio", "Faye", "Gus", "Hana", "Ivo", "Jaya", "Kai", "Luz", "Milo", "Nell", "Oona", "Pax", "Quinn", "Rio",
  "Suki", "Tam", "Uma", "Vale", "Wynn", "Xan", "Yara", "Zeb", "Arlo", "Bea", "Cyan", "Dot", "Edda", "Finn", "Gem", "Hux",
  "Isla", "Jem", "Kenji", "Lumi", "Maya", "Noor", "Odin", "Petra", "Rafa", "Sol", "Teo", "Una", "Vera", "Wilda", "Yuki", "Zuri",
];

/** A random given name. */
export const randomName = (random = Math.random) => NAMES[Math.floor(random() * NAMES.length)];

const hueOf = (hex) => {
  const [r, g, b] = rgbOf(hex);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  if (max - min < 0.08) return null;
  const h = max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min);
  return ((h * 60 + 360) % 360) / 360;
};

const neutrals = ["#f6f2e9", "#eadcbf", "#d6bf94", "#b08a5c", "#6e4a2f", "#36383d", "#1f2433", "#69778a", "#25386b"];

/** A main colour and an accent that reads against it: complementary, a split, or a light or dark neutral. */
function scheme(random) {
  const colourful = fabricColors.filter((c) => hueOf(c.hex) !== null && !neutrals.includes(c.hex));
  const main = colourful[Math.floor(random() * colourful.length)].hex;
  const h = hueOf(main);
  const mode = random();
  let accent;
  if (mode < 0.35) accent = luminance(rgbOf(main)) > 0.5 ? "#1f2433" : "#f6f2e9";
  else {
    const target = (h + (mode < 0.7 ? 0.5 : mode < 0.85 ? 0.42 : 0.58)) % 1;
    const ranked = colourful.filter((c) => Math.abs(luminance(rgbOf(c.hex)) - luminance(rgbOf(main))) > 0.12).sort((a, b) => Math.abs(((hueOf(a.hex) - target + 1.5) % 1) - 0.5) - Math.abs(((hueOf(b.hex) - target + 1.5) % 1) - 0.5));
    accent = (ranked[0] ?? { hex: "#f6f2e9" }).hex;
  }
  return { main, accent };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];
const choose = (random, key) => pick(random, fields.find((f) => f.key === key).options).id;
const often = (random, share, value, otherwise) => (random() < share ? value : otherwise());
const middling = (random, spread = 1) => 0.5 + ((random() + random() + random()) / 3 - 0.5) * 2 * spread;

/**
 * A random but harmonious character: natural skin and hair most of the time, an outfit from a colour
 * scheme with neutral trousers and shoes, a few accessories. Groups listed in `keep` hold their values
 * from `base`, as does the name unless `rename`.
 * @param {{ seed?: string, base?: object, keep?: Set<string> | string[], rename?: boolean, only?: string }} [options]
 */
export function randomSpec({ seed = String(Math.random()), base = defaultSpec(), keep = [], rename = true, only } = {}) {
  const random = makeRng(`character:${seed}`);
  const s = {};
  s.name = rename ? randomName(random) : base.name;
  for (const key of ["height", "build", "muscle", "shoulders", "waist", "hips", "legs"]) s[key] = middling(random, 0.85);
  s.chest = random() * 0.85;
  s.headSize = middling(random, 0.7);
  s.skin = often(random, 0.94, pick(random, skinTones).hex, () => pick(random, fancySkinTones).hex);
  for (const key of ["faceWidth", "faceLength", "jaw", "chin", "cheeks", "noseSize", "eyeSize", "eyeSpacing", "eyeHeight", "eyeTilt", "browHeight"]) s[key] = middling(random, 0.75);
  for (const key of ["nose", "mouth", "ears", "eyes", "lashes", "brows"]) s[key] = choose(random, key);
  s.ears = often(random, 0.75, "round", () => choose(random, "ears"));
  s.lips = random() * 0.6;
  s.cheekMarks = choose(random, "cheekMarks");
  s.marking = often(random, 0.75, "none", () => choose(random, "marking"));
  s.markColor = pick(random, fabricColors).hex;
  s.eyeColor = pick(random, eyeColors).hex;
  s.hair = choose(random, "hair");
  const fancyHair = random() < 0.14;
  s.hairColor = fancyHair ? pick(random, fancyHairColors).hex : pick(random, hairColors).hex;
  s.hairTips = often(random, 0.88, "none", () => pick(random, fancyHairColors).hex);
  s.hairVolume = middling(random, 0.8);
  s.facialHair = often(random, 0.72, "none", () => choose(random, "facialHair"));
  const { main, accent } = scheme(random);
  s.top = choose(random, "top");
  s.topColor = main;
  s.topAccent = accent;
  s.pattern = often(random, 0.45, "plain", () => choose(random, "pattern"));
  s.bottom = choose(random, "bottom");
  s.bottomColor = often(random, 0.7, pick(random, neutrals), () => pick(random, fabricColors).hex);
  s.shoes = choose(random, "shoes");
  s.shoesColor = often(random, 0.75, pick(random, ["#6e4a2f", "#36383d", "#1f2433", "#f6f2e9", "#b08a5c"]), () => accent);
  s.gloves = often(random, 0.85, "none", () => choose(random, "gloves"));
  s.glovesColor = pick(random, ["#6e4a2f", "#36383d", accent]);
  s.hat = often(random, 0.62, "none", () => choose(random, "hat"));
  s.hatColor = often(random, 0.5, accent, () => pick(random, fabricColors).hex);
  s.glasses = often(random, 0.78, "none", () => choose(random, "glasses"));
  s.glassesColor = pick(random, metalColors).hex;
  s.lensColor = often(random, 0.85, "#d9eef2", () => pick(random, lensColors).hex);
  s.neck = often(random, 0.7, "none", () => choose(random, "neck"));
  s.neckColor = often(random, 0.5, accent, () => pick(random, fabricColors).hex);
  s.back = often(random, 0.82, "none", () => choose(random, "back"));
  s.backColor = often(random, 0.5, main, () => pick(random, fabricColors).hex);
  s.earrings = often(random, 0.8, "none", () => choose(random, "earrings"));
  s.jewelColor = pick(random, metalColors.slice(0, 3)).hex;
  const held = new Set(keep);
  const out = normalizeSpec(s, base);
  for (const field of fields) if (held.has(field.group) || (only && field.group !== only)) out[field.key] = base[field.key];
  if (only) out.name = base.name;
  return out;
}
