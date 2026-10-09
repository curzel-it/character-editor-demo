import { resolveMotion } from "./flightMotion.js";

/**
 * Preview-only body attitude: rolls the root by `bank` and pitches it by `climb`, as the race
 * view does with its orientation matrix. Do not apply it where the scene already orients racers.
 */
export function withAttitude(pose, motion) {
  const { bank, climb } = resolveMotion(motion);
  const root = pose.bones.root || {};
  const rotation = root.rotation || [0, 0, 0];
  return {
    bones: {
      ...pose.bones,
      root: {
        ...root,
        rotation: [rotation[0] + bank, rotation[1], rotation[2] + climb],
      },
    },
  };
}
