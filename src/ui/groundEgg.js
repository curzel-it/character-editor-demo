import { eggAnatomy } from "../eggMesh.js";
import { eggLook } from "./eggArt.js";

const EGG_SIZE = 0.5;

/**
 * An egg shrunk to stand among dragons in a scene: its anatomy, its `radius` (the height its centre
 * sits at on the ground) and an `outline` of shell points around the origin, for framing.
 */
export function groundEgg(genes, egg) {
  const full = eggAnatomy(eggLook(genes, egg));
  const radius = full.bounds.radius * EGG_SIZE;
  const anatomy = { ...full, parts: full.parts.map((p) => ({ ...p, scale: [EGG_SIZE, EGG_SIZE, EGG_SIZE] })), bounds: { center: [0, 0, 0], radius } };
  const shell = full.parts[0].vertices,
    outline = [];
  for (let v = 0; v < shell.length; v += 27) outline.push([shell[v] * EGG_SIZE, shell[v + 1] * EGG_SIZE + radius, shell[v + 2] * EGG_SIZE]);
  return { anatomy, radius, outline };
}
