import { normalizeSpec, defaultSpec } from "./characterSpec.js";

/** Curated characters to start from, each a few traits over the defaults. */
export const starters = [
  {
    id: "rider",
    spec: { name: "Kael", skin: "#c98f5c", hair: "ponytail", hairColor: "#3a2518", top: "silks", pattern: "hoops", topColor: "#25386b", topAccent: "#f2cf4a", bottom: "breeches", bottomColor: "#f6f2e9", shoes: "tallBoots", shoesColor: "#1f2433", hat: "helmet", hatColor: "#25386b", gloves: "gloves", glovesColor: "#6e4a2f", eyes: "almond", build: 0.3, muscle: 0.5 },
  },
  {
    id: "wizard",
    spec: { name: "Orin", skin: "#f2d2b6", hair: "long", hairColor: "#c4c4c8", facialHair: "fullBeard", top: "tunic", topColor: "#5b3a78", topAccent: "#e8b54a", pattern: "plain", bottom: "longSkirt", bottomColor: "#5b3a78", shoes: "slippers", shoesColor: "#6e4a2f", hat: "wizard", hatColor: "#5b3a78", glasses: "round", glassesColor: "#e8b54a", eyes: "droopy", brows: "bushy", height: 0.35, build: 0.55, faceLength: 0.6 },
  },
  {
    id: "ranger",
    spec: { name: "Briar", skin: "#a86f45", hair: "braid", hairColor: "#8a3b22", top: "hoodie", topColor: "#2f5d3a", topAccent: "#d6bf94", bottom: "trousers", bottomColor: "#6f7339", shoes: "boots", shoesColor: "#6e4a2f", back: "quiver", backColor: "#6e4a2f", cheekMarks: "freckles", eyes: "classic", eyeColor: "#3f8a4a", muscle: 0.55 },
  },
  {
    id: "tinker",
    spec: { name: "Pip", skin: "#e6b98f", hair: "curls", hairColor: "#d9793a", top: "tee", topColor: "#f6f2e9", bottom: "overalls", bottomColor: "#3359c4", shoes: "sneakers", shoesColor: "#cf3236", glasses: "goggles", glassesColor: "#6e4a2f", lensColor: "#e3a33c", cheekMarks: "both", gloves: "mitts", glovesColor: "#36383d", headSize: 0.7, height: 0.2, eyes: "big" },
  },
  {
    id: "bard",
    spec: { name: "Marlo", skin: "#57321f", hair: "afro", hairColor: "#1d1716", top: "vest", topColor: "#8f2a52", topAccent: "#f6f2e9", bottom: "trousers", bottomColor: "#36383d", shoes: "shoes", shoesColor: "#1f2433", hat: "beret", hatColor: "#cf3236", neck: "bowtie", neckColor: "#e8b54a", facialHair: "moustache", mouth: "grin", earrings: "hoops", jewelColor: "#e8b54a" },
  },
  {
    id: "pilot",
    spec: { name: "Vesper", skin: "#d9a172", hair: "bob", hairColor: "#1d1716", top: "jacket", topColor: "#6e4a2f", topAccent: "#eadcbf", bottom: "breeches", bottomColor: "#d6bf94", shoes: "tallBoots", shoesColor: "#36383d", hat: "aviator", hatColor: "#6e4a2f", neck: "longScarf", neckColor: "#cf3236", eyes: "cat", lashes: "flick", lips: 0.6, marking: "mole" },
  },
  {
    id: "royal",
    spec: { name: "Isla", skin: "#f7dccb", hair: "wavy", hairColor: "#e6c47d", top: "dress", topColor: "#7fb6e6", topAccent: "#f6f2e9", shoes: "shoes", shoesColor: "#f6f2e9", hat: "crown", jewelColor: "#e8b54a", neck: "necklace", back: "cape", backColor: "#25386b", eyes: "big", lashes: "long", eyeColor: "#3d74c4", cheekMarks: "blush", lips: 0.45 },
  },
  {
    id: "explorer",
    spec: { name: "Tamsin", skin: "#b5885a", hair: "pigtails", hairColor: "#5e3a22", top: "tee", topColor: "#d6a531", pattern: "plain", bottom: "shorts", bottomColor: "#6f7339", shoes: "boots", shoesColor: "#6e4a2f", hat: "sunHat", hatColor: "#eadcbf", topAccent: "#cf3236", back: "satchel", backColor: "#a8482a", cheekMarks: "freckles", legs: 0.55 },
  },
  {
    id: "rebel",
    spec: { name: "Nyx", skin: "#cfe3ef", hair: "mohawk", hairColor: "#ef8fb1", hairTips: "none", top: "jacket", topColor: "#1f2433", topAccent: "#cf3236", bottom: "jeans", bottomColor: "#36383d", shoes: "boots", shoesColor: "#1f2433", glasses: "shades", glassesColor: "#26272b", earrings: "studs", jewelColor: "#c9ced6", marking: "stripes", markColor: "#ef8fb1", eyes: "almond", mouth: "smirk", brows: "straight" },
  },
  {
    id: "cozy",
    spec: { name: "Juniper", skin: "#efc2ae", hair: "shag", hairColor: "#a8723f", top: "sweater", topColor: "#ea8fab", pattern: "band", topAccent: "#f6f2e9", bottom: "longSkirt", bottomColor: "#8ea57a", shoes: "clogs", shoesColor: "#b08a5c", hat: "beanie", hatColor: "#f3c3c4", neck: "scarf", neckColor: "#9fd9bd", cheekMarks: "blush", eyes: "round", build: 0.5 },
  },
  {
    id: "knight",
    spec: { name: "Rook", skin: "#8f5a36", hair: "crop", hairColor: "#3a2518", facialHair: "beard", top: "tunic", topColor: "#69778a", topAccent: "#cf3236", pattern: "halves", bottom: "trousers", bottomColor: "#36383d", shoes: "tallBoots", shoesColor: "#6e4a2f", hat: "horns", hatColor: "#69778a", gloves: "gauntlets", glovesColor: "#5d636d", back: "cape", backColor: "#cf3236", jaw: 0.8, shoulders: 0.8, muscle: 0.8, height: 0.75 },
  },
  {
    id: "sprite",
    spec: { name: "Lumi", skin: "#a9c79a", hair: "spaceBuns", hairColor: "#8fdcb5", hairTips: "#79b8ef", top: "dress", topColor: "#9fd9bd", topAccent: "#f3c3c4", shoes: "slippers", shoesColor: "#f3c3c4", hat: "flowers", hatColor: "#ea8fab", back: "wings", backColor: "#cfe3ef", ears: "elf", eyes: "big", eyeColor: "#7a55b8", height: 0.05, headSize: 0.8, cheekMarks: "blush" },
  },
];

/** A starter as a complete character. */
export const starterSpec = (starter) => normalizeSpec(starter.spec, defaultSpec());
