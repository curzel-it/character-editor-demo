import { custodianBones } from "./custodianSkeleton.js";
import { custodianParts } from "./custodianParts.js";

/**
 * The Soul Altar's custodian as an anatomy the renderer draws like a dragon: a stooped, robed old man
 * about 1.6 m to the crown, standing on the origin and facing +X. Pose him with `custodianPose`.
 */
export const createCustodian = () => ({
  id: "custodian",
  bones: custodianBones(),
  parts: custodianParts(),
  height: 1.6,
  bounds: { center: [0.1, 0.95, 0], radius: 1.05 },
});
