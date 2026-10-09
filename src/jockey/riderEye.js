import { boneMatrices, point } from "../math3d.js";

/**
 * Where the jockey's eyes are on a tacked dragon (`withTack` with a jockey), in the racer's body
 * frame as the renderer places it (+X forward, +Y up, from the root bone), at rest. Null without a
 * rider.
 * @returns {number[] | null}
 */
export function riderEye(anatomy) {
  const goggles = anatomy.parts.find((part) => part.id === "jockey-goggles");
  if (!goggles) return null;
  const index = anatomy.bones.findIndex((bone) => bone.id === goggles.bone);
  const world = point(boneMatrices(anatomy)[index], goggles.position);
  const root = anatomy.bones[0].position;
  return world.map((v, i) => v - root[i]);
}
