const CALM = ["root", "chest", "neck-0", "neck-1", "neck-2", "head"];
const HEAD = 0.5,
  MOTION = 0.15;

/**
 * The ridden dragon's pose as seen from the saddle: the head drawn at half size so it leaves the
 * view open, and the body and neck swinging less in the air (`stand` 0..1 fades that out on the
 * ground) so the view in front of the rider stays steady.
 */
export function onboardPose(pose, stand = 0) {
  const k = MOTION + (1 - MOTION) * stand;
  const bones = { ...pose.bones };
  for (const id of CALM) {
    const delta = bones[id] ?? {};
    bones[id] = {
      ...delta,
      ...(delta.position && { position: delta.position.map((v) => v * k) }),
      ...(delta.rotation && { rotation: delta.rotation.map((v) => v * k) }),
    };
  }
  bones.head = { ...bones.head, scale: HEAD * (bones.head.scale ?? 1) };
  return { ...pose, bones };
}
