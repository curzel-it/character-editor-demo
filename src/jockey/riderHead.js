import { palette, tint } from "../palette.js";
import { cranium, jaw } from "./riderHeadFrame.js";

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lips = [0.62, 0.3, 0.28];
const blush = [0.95, 0.45, 0.45];
const sides = [-1, 1];

/** Ears at the sides of the head: round, pointed or long and swept back like an elf's. */
function ears(head, style, skin) {
  for (const s of sides) {
    if (style === "round") {
      head.shape(`ear-${s}`, "ellipsoid", [-0.008, -0.01, 0.09 * s], [0.022, 0.034, 0.014], skin, [0, -0.25 * s, 0]);
      continue;
    }
    const reach = style === "long" ? 1.7 : 1;
    head.rigid(`ear-${s}`, [
      { p: [0, -0.04, 0.086 * s], r: [0.012, 0.02] },
      { p: [-0.01, 0, 0.092 * s], r: [0.012, 0.026] },
      { p: [-0.03 * reach, 0.04 * reach, (0.096 + 0.012 * reach) * s], r: [0.008, 0.016] },
      { p: [-0.05 * reach, 0.075 * reach, (0.1 + 0.02 * reach) * s], r: [0.003, 0.004] },
    ], { segments: 6, up: [1, 0, 0], color: () => skin });
  }
}

/** Freckles, blush or stripes of paint in the silks' accent. */
function marks(head, mark, skin, accent) {
  if (mark === "freckles")
    for (const [x, y, z] of [[0.104, -0.022, 0.016], [0.1, -0.03, 0.03], [0.096, -0.02, 0.045], [0.09, -0.034, 0.058], [0.098, -0.036, 0.04], [0.093, -0.026, 0.052]])
      for (const s of sides) head.shape(`freckle-${s}-${z}`, "ellipsoid", [x, y, z * s], [0.003, 0.004, 0.004], tint(skin, 0.72));
  if (mark === "blush") for (const s of sides) head.shape(`blush-${s}`, "ellipsoid", [0.08, -0.036, 0.056 * s], [0.012, 0.014, 0.02], mix(skin, blush, 0.5), [0, -0.6 * s, 0]);
  if (mark === "paint")
    for (const s of sides)
      for (const k of [0, 1]) head.shape(`paint-${s}-${k}`, "box", [0.08 - k * 0.006, -0.03 - k * 0.018, 0.06 * s], [0.004, 0.005, 0.026], accent, [0, -0.7 * s, 0.2]);
}

/** Stubble, a moustache, a goatee or a full beard in the hair's colour, the full one perhaps braided. */
function facialHair(head, style, hair, skin) {
  if (style === "none") return false;
  if (style === "stubble") {
    head.shape("stubble", "ellipsoid", [jaw.centre[0] + 0.001, jaw.centre[1] - 0.006, 0], jaw.radii.map((r) => r * 1.035), mix(skin, hair, 0.4));
    return true;
  }
  for (const s of sides) head.shape(`moustache-${s}`, "ellipsoid", [0.102, -0.056, 0.018 * s], [0.012, 0.01, 0.026], hair, [0.4 * s, -0.3 * s, 0]);
  if (style === "goatee") head.shape("goatee", "ellipsoid", [0.086, -0.112, 0], [0.026, 0.032, 0.026], hair, [0, 0, -0.3]);
  if (style === "beard" || style === "braided") head.shape("beard", "ellipsoid", [0.03, -0.082, 0], [0.086, 0.08, 0.08], hair);
  if (style === "braided") {
    for (let k = 0; k < 4; k++) head.shape(`beard-braid-${k}`, "ellipsoid", [0.08 - k * 0.006, -0.16 - k * 0.032, 0], [0.022, 0.022, 0.022].map((r) => r * (1 - k * 0.1)), hair);
    head.shape("beard-tie", "ellipsoid", [0.058, -0.28, 0], [0.014, 0.014, 0.014], palette.gold);
  }
  return true;
}

/**
 * The rider's head below the hair: the skull, ears, eyes under their brows, nose and mouth, with
 * the face's marks and facial hair, posed by the head's frame.
 * @param {ReturnType<import("./riderHeadFrame.js").headFrame>} head
 */
export function riderHead(head, look, accent) {
  const { skin, hairRgb: hair, eyes } = look;
  head.shape("skull", "ellipsoid", cranium.centre, cranium.radii, skin);
  head.shape("jaw", "ellipsoid", jaw.centre, jaw.radii, skin);
  ears(head, look.ears, skin);
  for (const s of sides) {
    const z = 0.037 * s;
    const yaw = [0, -0.38 * s, 0];
    head.shape(`eye-white-${s}`, "ellipsoid", [0.084, -0.004, z], [0.016, 0.019, 0.016], palette.ivory, yaw);
    head.shape(`iris-${s}`, "ellipsoid", [0.092, -0.004, z * 0.98], [0.01, 0.0145, 0.0115], eyes, yaw);
    head.shape(`pupil-${s}`, "ellipsoid", [0.098, -0.004, z * 0.96], [0.006, 0.0085, 0.0065], palette.ink, yaw);
    head.shape(`glint-${s}`, "ellipsoid", [0.1, 0.002, z * 0.9], [0.003, 0.0035, 0.0035], [1, 1, 1], yaw);
    head.shape(`lash-${s}`, "box", [0.092, 0.013, z], [0.006, 0.0035, 0.018], palette.ink, [0.12 * s, -0.38 * s, 0]);
    head.shape(`brow-${s}`, "box", [0.094, 0.038, 0.04 * s], [0.006, 0.0042, 0.021], hair, [-0.14 * s, -0.4 * s, 0]);
  }
  head.shape("nose", "ellipsoid", [0.1, -0.03, 0], [0.018, 0.028, 0.016], tint(skin, 0.97), [0, 0, 0.25]);
  const bearded = facialHair(head, look.facialHair, hair, skin);
  head.shape("mouth", "ellipsoid", [bearded ? 0.104 : 0.096, -0.074, 0], [0.007, 0.006, 0.02], mix(skin, lips, 0.55), [0, 0, 0.15]);
  marks(head, look.marks, skin, accent);
}
