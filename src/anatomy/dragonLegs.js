import { tint } from "../palette.js";
import { add, mix, sweep } from "./dragonShape.js";

/** Reference leg length (knee, ankle and toe-base bone offsets summed) and thigh radius the genes scale. */
export const legReference = { legs: 1.97, thighs: 0.44 };

/**
 * Hind legs rigged in a mid-tuck flight rest: a thigh sunk into the body, a shin sloping back,
 * a trailing metatarsus and a foot of forward toes against a hallux. Every leg shape and foot type
 * shares this bone chain. The leg shape dresses the thigh, shin and ankle; the foot type dresses
 * the metatarsus and toes; one skinned hide runs through both. `hip` places the thigh on the root:
 * a share of the half body length along it, a height and a half-width per unit of girth.
 */
export function buildLegs(context, shape, foot) {
  const { rig, g, l, girth = 1, skin, under, hip = [-0.5, -0.2, 0.27] } = context;
  const k = g.legs / legReference.legs,
    b = g.thighs / legReference.thighs,
    lean = 0.55 + 0.45 * b;
  for (const s of [-1, 1]) {
    const thigh = rig(`leg-hind-${s}`, "root", [l * hip[0], hip[1], s * hip[2] * girth]);
    const shin = rig(`shin-hind-${s}`, thigh, [0.2 * k, -0.66 * k, s * 0.13]);
    const footBone = rig(`foot-hind-${s}`, shin, [-0.74 * k, -0.3 * k, s * 0.03]);
    const toes = rig(`toes-hind-${s}`, footBone, [-0.46 * k, -0.1 * k, 0]);
    const hallux = rig(`hallux-hind-${s}`, footBone, [-0.38 * k, 0.06 - 0.08 * k, 0]);
    const leg = {
      ...context,
      s, k, b, lean, thigh, shin, foot: footBone, toes, hallux,
      scale: tint(skin, 0.9),
      sole: tint(under, 0.7),
    };
    legHide(leg, shape.hide || {}, foot.hide?.(leg) || {});
    shape.build(leg);
    foot.build(leg);
  }
}

/** Points on the leg's upper (up-back) line, in the bone's frame: shin from knee to ankle, foot from ankle to toes. */
export const shinLine = ({ k, lean }, t) => {
  const p = t < 0.35
    ? mix([0.02, 0.14, 0], [-0.2 * k, -0.06 * k, 0], t / 0.35)
    : mix([-0.2 * k, -0.06 * k, 0], [-0.56 * k, -0.23 * k, 0], (t - 0.35) / 0.65);
  const radius = t < 0.35 ? 0.25 * lean : 0.24 * lean * (1 - t) + 0.14 * t;
  return { p, radius, up: [-0.38, 0.925, 0] };
};
export const footLine = ({ k }, t) => ({
  p: mix([0.02, 0.02, 0], [-0.22 * k, -0.05 * k, 0], t),
  radius: 0.15 * (1 - t) + 0.11 * t,
  up: [-0.21, 0.98, 0],
});
/** A point on a leg line's surface, `scale` radii along its up normal (negative for the underside). */
export const on = ({ p, radius, up }, scale, lift = 0) => add(p, up.map((v) => v * (radius * scale + lift)));

/**
 * The skinned hide from hip to toe base. The leg `profile` multiplies radii from the hip to the
 * ankle: `hip`, `knee`, `shank` (lower shin, ring at `shankAt` along it) and `ankle`. Thick ankles
 * need the shank ring higher so the ankle bend spreads over a longer span. The `foot` profile sets
 * the metatarsus radius (`tarsus`) and an optional `color` for the bare foot.
 */
export function legHide(leg, profile = {}, foot = {}) {
  const { parts, ring, s, k, b, lean, thigh, shin, toes, skin, under } = leg;
  const { knee = 1, shank = 1, ankle = 1, hip = 1, shankAt = 0.56 } = profile;
  const { tarsus = 1, color } = foot;
  const mid = (ankle + 2 * tarsus) / 3;
  const bare = (entry) => (color ? { ...entry, color } : entry);
  sweep(
    parts,
    `hindlimb-hide-${s}`,
    "root",
    [
      ring(thigh, [0.04, 0.34, -s * 0.08], 0.36 * b, 0.26 * b, "root", 0.35),
      ring(thigh, [0.03, 0.02, s * 0.03], 0.5 * b * hip, 0.28 * b * hip, "root", 0.8),
      ring(thigh, [0.1 * k, -0.34 * k, s * 0.07], 0.37 * b * hip, 0.28 * b * hip),
      ring(thigh, [0.17 * k, -0.56 * k, s * 0.04], 0.28 * b * hip, 0.24 * b * hip),
      ring(shin, [0.02, 0.14, 0], 0.27 * lean * knee, 0.22 * lean * knee, thigh, 0.5),
      ring(shin, [-0.2 * k, -0.06 * k, 0], 0.24 * lean * knee, 0.19 * lean * knee, thigh, 0.97),
      ring(shin, [-shankAt * k, -0.41 * shankAt * k, 0], 0.14 * shank, 0.13 * shank),
      ring(leg.foot, [0.02, 0.02, 0], 0.15 * ankle, 0.14 * ankle, shin, 0.5),
      bare(ring(leg.foot, [-0.22 * k, -0.05 * k, 0], 0.105 * mid, 0.12 * mid)),
      bare(ring(toes, [0.1 * k, 0.02, 0], 0.1 * tarsus ** 0.5, 0.13 * tarsus, leg.foot, 0.25)),
      bare(ring(toes, [0.015 * k, 0.01, 0], 0.09 * tarsus ** 0.5, 0.14 * tarsus, leg.foot, 0.6)),
      bare(ring(toes, [-0.08 * tarsus ** 0.5, -0.03 * tarsus ** 0.5, 0], 0.06 * tarsus, 0.11 * tarsus)),
    ],
    skin,
    { segments: 12, under, crisp: true, skinned: true },
  );
}
