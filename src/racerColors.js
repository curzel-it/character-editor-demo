import { tint, dragonColors } from "./palette.js";
import { metalCoatOf } from "./genome/metalCoats.js";
import { t } from "./i18n.js";

const css = (rgb) =>
  `rgb(${rgb.map((v) => Math.round(Math.min(1, v) * 255)).join(" ")})`;

export function racerColors(genome) {
  const colors = dragonColors(genome);
  return {
    color: css(tint(colors.skin, 1.35)),
    accent: css(tint(colors.membrane, 1.2)),
  };
}

/** The three colour sets as CSS colours, brightened like the race tags. */
export function colorSetSwatches(genome) {
  const colors = dragonColors(genome);
  return { scales: css(tint(colors.skin, 1.35)), wings: css(tint(colors.membrane, 1.35)), underside: css(tint(colors.under, 1.35)) };
}

/** The name of the colour a colour `gene` shows on `genome`: on a metallic coat, its metal. */
export function colourName(gene, genome) {
  const coat = metalCoatOf(genome?.metal);
  if (!coat) return gene.choices[Math.floor(genome[gene.name])];
  return t(`genes.choices.metal.${gene.name === "wings" ? coat.wings : coat.body}`);
}
