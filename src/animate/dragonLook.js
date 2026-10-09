const SHARE = { "neck-0": 0.3, "neck-1": 0.25, "neck-2": 0.2, head: 0.25 };

/**
 * Turns the neck and head by `lookYaw` (radians, positive to the left, +Z) and `lookPitch` (positive
 * up) on top of whatever pose they hold, standing included, spread along the neck.
 * @param {Record<string, { rotation?: number[] }>} bones
 * @param {{ lookYaw?: number, lookPitch?: number }} motion
 */
export function lookPose(bones, { lookYaw = 0, lookPitch = 0 }) {
  if (!lookYaw && !lookPitch) return;
  for (const [id, share] of Object.entries(SHARE)) {
    const bone = (bones[id] ??= {});
    const [x = 0, y = 0, z = 0] = bone.rotation ?? [];
    bone.rotation = [x, y - share * lookYaw, z + share * lookPitch];
  }
}
