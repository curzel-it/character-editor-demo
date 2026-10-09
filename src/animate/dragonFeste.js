const add = (bones, id, delta) => {
  const bone = (bones[id] ??= {});
  const rotation = bone.rotation ?? [0, 0, 0];
  bone.rotation = rotation.map((v, i) => v + delta[i]);
};

/**
 * A happy dog's greeting on top of any pose: `tailSwing` (radians) swings the tail to the left (+Z),
 * the tip furthest, `tailRaise` (radians) lifts it from the root and `wingRaise` (radians) lifts both
 * wings from the shoulder.
 * @param {Record<string, { rotation?: number[] }>} bones
 * @param {{ tailSwing?: number, tailRaise?: number, wingRaise?: number }} motion
 */
export function festePose(bones, { tailSwing = 0, tailRaise = 0, wingRaise = 0 }) {
  if (tailSwing || tailRaise) for (let i = 0; i < 7; i++) add(bones, `tail-${i}`, [0, tailSwing * (0.08 + 0.04 * i), i < 2 ? -0.5 * tailRaise : 0]);
  if (wingRaise) for (const side of [-1, 1]) add(bones, `wing-${side}`, [side * wingRaise, 0, 0]);
}
