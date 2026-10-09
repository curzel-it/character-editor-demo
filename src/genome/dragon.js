import { dragonHeads } from "../anatomy/dragonHeads.js";
import { dragonHeadgear } from "../anatomy/dragonHeadgear.js";
import { dragonLegShapes } from "../anatomy/dragonLegVariants.js";
import { dragonWingFingers } from "../anatomy/dragonWingFingers.js";
import { dragonFeet } from "../anatomy/dragonFeet.js";
import { dragonTailTips } from "../anatomy/dragonTailTips.js";
import { dragonHindWings } from "../anatomy/dragonHindWings.js";
import { metalCoats } from "./metalCoats.js";
import { dragonManes } from "../anatomy/dragonManes.js";
import { dragonMarkings } from "../anatomy/dragonMarkings.js";
import { breathElements } from "../breath/breathElements.js";
import { creatureScale } from "../worldScale.js";
import { dragonColours, dragonEyes } from "../palette.js";
import { withGeneLabels } from "./geneLabels.js";

const choice = (name, label, variants) => ({
  name,
  label,
  min: 0,
  max: variants.length,
  default: 0,
  choices: variants.map((variant) => variant.label),
  ids: variants.map((variant) => variant.id),
  ...(variants.some((variant) => variant.weight)
    ? { weights: variants.map((variant) => variant.weight ?? 1) }
    : {}),
  ...(variants.some((variant) => variant.bonus) ? { bonuses: variants.map((variant) => variant.bonus ?? null) } : {}),
});

/** A very rare choice gene: it passes down whole like any other, but only turns up anew at its own odds (see `inheritGenome`). */
const rare = (name, label, variants) => ({ ...choice(name, label, variants), rare: true });

const metre = (name, label, min, max, value) => ({
  name,
  label,
  min: Math.round(min * creatureScale * 100) / 100,
  max: Math.round(max * creatureScale * 100) / 100,
  default: Math.round(value * creatureScale * 100) / 100,
});

/** The choice genes picking a named colour for the scales, wings and underside. */
export const colourGenes = ["scales", "wings", "underside"];

const colourGene = (name, label) => ({ ...choice(name, label, dragonColours), group: "color", choiceKey: "colours" });

export const genes = [
  metre("body", "Torso length", 2.8, 3.55, 3.2),
  { name: "wingspan", label: "Wingspan", min: 13.5, max: 17.25, default: 16 },
  metre("neck", "Neck reach", 1.9, 2.75, 2.35),
  metre("tail", "Tail length", 4.3, 6, 5.2),
  { name: "horns", label: "Headgear size", min: 0.8, max: 1.4, default: 1.12 },
  metre("spines", "Crest height", 0.27, 0.54, 0.41),
  colourGene("scales", "Scale colour"),
  colourGene("wings", "Wing colour"),
  colourGene("underside", "Underside colour"),
  choice("head", "Head", dragonHeads),
  choice("headgear", "Headgear", dragonHeadgear),
  metre("legs", "Leg length", 1.7, 2.3, 1.97),
  metre("thighs", "Thigh girth", 0.36, 0.52, 0.44),
  choice("legShape", "Leg shape", dragonLegShapes),
  choice("wingFingers", "Wing fingers", dragonWingFingers),
  choice("feet", "Feet", dragonFeet),
  choice("tailTip", "Tail tip", dragonTailTips),
  choice("hindWings", "Hind wings", dragonHindWings),
  { ...choice("breath", "Breath", breathElements), visible: false },
  { ...choice("eyes", "Eye colour", dragonEyes), group: "color" },
  rare("metal", "Metallic coat", metalCoats),
  rare("mane", "Mane", dragonManes),
  { ...choice("markings", "Markings", dragonMarkings), group: "color" },
].map(withGeneLabels);

/** Whether `genome` has a trait to show for `gene`: a rare gene only when it carries it. */
export const showsGene = (gene, genome) => !gene.rare || Math.floor(genome?.[gene.name] ?? gene.default) !== gene.default;

export { dragonPalettes as presets } from "../palette.js";
