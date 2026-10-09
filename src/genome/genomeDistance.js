import { colourOf } from "../palette.js";
import { standout } from "../dragonBuild.js";

/** How much each kind of difference counts: the coat reads first, then the parts, then the proportions and the build. */
const colourWeights = { scales: 4, wings: 2.5, underside: 1.5 };
const partWeight = 1;
const shapeWeight = 1;
const buildWeight = 3;
const maxRgb = Math.sqrt(3);

/** How different two dragons look and race, 0 for twins; larger is further apart. */
export function genomeDistance(genes, a, b) {
  let sum = standout(genes, a) === standout(genes, b) ? 0 : buildWeight;
  for (const gene of genes) {
    const x = a[gene.name],
      y = b[gene.name];
    if (gene.name in colourWeights) {
      const [p, q] = [colourOf(x), colourOf(y)];
      sum += (colourWeights[gene.name] * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])) / maxRgb;
    } else if (gene.choices) sum += Math.floor(x) === Math.floor(y) ? 0 : partWeight;
    else sum += (shapeWeight * Math.abs(x - y)) / (gene.max - gene.min);
  }
  return sum;
}
