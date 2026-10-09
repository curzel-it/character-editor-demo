import { riderBody } from "./riderBody.js";

const BONE = "rider";

/** Standing at ease, feet planted and arms by the sides, hair hanging behind and goggles pushed up: origin on the ground between the feet. */
const standing = {
  hip: [0, 0.92, 0.1],
  knee: [0.04, 0.5, 0.11],
  ankle: [0, 0.09, 0.11],
  toe: [0.15, 0.03, 0.11],
  shoulder: [-0.01, 1.42, 0.19],
  elbow: [-0.05, 1.15, 0.25],
  wrist: [0.03, 0.92, 0.27],
  head: [0.01, 1.64, 0],
  pelvis: [-0.02, 0.9, 0],
  nape: [-0.01, 1.47, 0],
  tilt: 0.05,
  trail: [-0.3, -1, 0],
  goggles: "up",
};

/**
 * The rider on foot, in the same silks and look they ride in, as a one-bone anatomy the dragon
 * renderer draws: about 1.8 m tall, facing +X.
 * @param {import("./createJockey.js").Rider} jockey
 */
export function riderFigure(jockey) {
  const parts = [];
  const rigid = (id, mesh) => parts.push({ id: `rider-${id}`, bone: BONE, shape: "mesh", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: mesh.colors.slice(0, 3), ...mesh });
  const shape = (id, kind, position, scale, color, rotation = [0, 0, 0]) => parts.push({ id: `rider-${id}`, bone: BONE, shape: kind, position, rotation, scale, color });
  riderBody(standing, jockey, { rigid, shape });
  return { bones: [{ id: BONE, position: [0, 0, 0] }], parts, bounds: { center: [0, 0.9, 0], radius: 1 } };
}
