const mix = (a, b, k) => a + (b - a) * k;
const WING = /^(wing|spar|hindwing)-/;

/** The flight pose's wing bones, kept before the ground poses fold them so `leapPose` can free them again. */
export function wingsOf(bones) {
  return Object.fromEntries(Object.entries(bones).filter(([id]) => WING.test(id)).map(([id, bone]) => [id, structuredClone(bone)]));
}

const add = (bones, id, delta) => {
  const bone = (bones[id] ??= {});
  const rotation = bone.rotation ?? [0, 0, 0];
  bone.rotation = rotation.map((v, i) => v + delta[i]);
};

/**
 * Take-off layered over the ground poses. `wings` (0..1) frees the wings from the stand back into
 * the `flight` beat while the legs stay planted; `spring` (-1..1) coils the legs below 0 and above
 * it drives them straight and back off the ground, the toes pointed and the body pitched up.
 */
export function leapPose(bones, flight, { wings, spring }) {
  if (wings > 0)
    for (const [id, bone] of Object.entries(bones)) {
      if (!WING.test(id)) continue;
      const free = flight[id] ?? {};
      bone.rotation = (bone.rotation ?? [0, 0, 0]).map((v, i) => mix(v, free.rotation?.[i] ?? 0, wings));
      if (bone.position || free.position) bone.position = (bone.position ?? [0, 0, 0]).map((v, i) => mix(v, free.position?.[i] ?? 0, wings));
    }
  if (spring > 0) {
    add(bones, "root", [0, 0, 0.22 * spring]);
    add(bones, "chest", [0, 0, 0.08 * spring]);
    for (const side of [-1, 1]) {
      add(bones, `leg-hind-${side}`, [0, 0, -0.65 * spring]);
      add(bones, `shin-hind-${side}`, [0, 0, -0.15 * spring]);
      add(bones, `foot-hind-${side}`, [0, 0, -0.45 * spring]);
      add(bones, `toes-hind-${side}`, [0, 0, -0.7 * spring]);
      add(bones, `hallux-hind-${side}`, [0, 0, -0.5 * spring]);
    }
    add(bones, "neck-0", [0, 0, 0.12 * spring]);
    add(bones, "head", [0, 0, -0.3 * spring]);
    for (let i = 0; i < 7; i++) add(bones, `tail-${i}`, [0, 0, -0.04 * spring]);
  } else if (spring < 0) {
    const coil = -spring;
    add(bones, "root", [0, 0, -0.12 * coil]);
    for (const side of [-1, 1]) {
      add(bones, `leg-hind-${side}`, [0, 0, 0.35 * coil]);
      add(bones, `shin-hind-${side}`, [0, 0, 0.25 * coil]);
      add(bones, `foot-hind-${side}`, [0, 0, -0.25 * coil]);
    }
    add(bones, "neck-0", [0, 0, -0.1 * coil]);
    add(bones, "head", [0, 0, 0.15 * coil]);
  }
}
