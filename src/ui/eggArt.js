import { createRenderer } from "../render.js";
import { eggAnatomy } from "../eggMesh.js";
import { eggBaby } from "../stable/egg.js";
import { tint, dragonColors } from "../palette.js";

const size = { width: 240, height: 312 };
const view = { yaw: -0.5, pitch: 0.18, zoom: 1.28 };

/** Shell and speckles coloured like the dragon inside, or like its parents. */
export function eggLook(genes, egg) {
  const [shellGenome, spotsGenome] = egg.parents ? egg.parents.map((p) => p.genome) : Array(2).fill(eggBaby(genes, egg).genome);
  return { shell: tint(dragonColors(shellGenome).skin, 1.35), spots: tint(dragonColors(spotsGenome).membrane, 1.2), seed: egg.seed };
}

let canvas = null,
  renderer = null;
const images = new Map();

/** The egg drawn in `style` by the dragon renderer, as an image URL cached per look. */
function eggImage(genes, egg, style) {
  const look = eggLook(genes, egg);
  const key = `${style}:${look.seed}:${look.shell}:${look.spots}`;
  if (!images.has(key)) {
    canvas ??= Object.assign(document.createElement("canvas"), size);
    renderer ??= createRenderer(canvas, { transparent: true });
    renderer.render(eggAnatomy(look), { bones: {} }, { style, ...view });
    images.set(key, canvas.toDataURL());
  }
  return images.get(key);
}

/** A faceted speckled egg in the game's art style. */
export function eggHtml(genes, egg, style, className = "") {
  return `<img class="egg-art ${className}" src="${eggImage(genes, egg, style)}" alt="" aria-hidden="true">`;
}
