import { keeperFingers } from "./keeperHand.js";

/**
 * The keeper's hand posed as `{ bones }` for the renderer. `wrist` bends the hand up (positive,
 * the palm turning forward) or down, `twist` rolls it on the forearm, `curl` (0 flat, 1 a fist)
 * closes the fingers, `thumb` (0 open, 1 across the palm) closes the thumb and `spread` fans the fingers.
 * @param {{ wrist?: number, twist?: number, curl?: number, thumb?: number, spread?: number }} [hand]
 */
export function keeperHandPose({ wrist = 0, twist = 0, curl = 0, thumb = 0, spread = 0 } = {}) {
  const bones = { hand: { rotation: [twist, 0, wrist] } };
  keeperFingers.forEach((_, i) => {
    const fan = spread * (1.5 - i) * 0.12;
    bones[`finger-${i}-0`] = { rotation: [0, fan, -1.45 * curl - 0.08] };
    bones[`finger-${i}-1`] = { rotation: [0, 0, -1.6 * curl - 0.12] };
  });
  bones["thumb-0"] = { rotation: [0.5 * thumb, -0.5 * thumb, -0.35 * thumb - 0.1] };
  bones["thumb-1"] = { rotation: [0, 0, -0.9 * thumb - 0.1] };
  return { bones };
}
