import { palette, tint } from "../palette.js";
import { part } from "./parts.js";
import { surface, sweep } from "./dragonShape.js";
import { eyeDome } from "./dragonEyes.js";

const SKULL = [
  { p: [-0.5, 0.1, 0], ry: 0.03, rz: 0.03 },
  { p: [-0.47, 0.1, 0], ry: 0.15, rz: 0.16 },
  { p: [-0.4, 0.1, 0], ry: 0.23, rz: 0.245 },
  { p: [-0.3, 0.1, 0], ry: 0.26, rz: 0.28 },
  { p: [-0.16, 0.13, 0], ry: 0.36, rz: 0.4 },
  { p: [0.04, 0.12, 0], ry: 0.37, rz: 0.43 },
  { p: [0.24, 0.07, 0], ry: 0.31, rz: 0.37 },
  { p: [0.4, 0, 0], ry: 0.2, rz: 0.25 },
  { p: [0.5, -0.03, 0], ry: 0.16, rz: 0.19 },
  { p: [0.57, -0.04, 0], ry: 0.12, rz: 0.14 },
  { p: [0.61, -0.05, 0], ry: 0.05, rz: 0.06 },
];

const LOWER_JAW = [
  { p: [-0.06, 0.1, 0], ry: 0.08, rz: 0.2 },
  { p: [0.12, 0.06, 0], ry: 0.13, rz: 0.26 },
  { p: [0.3, 0.06, 0], ry: 0.1, rz: 0.2 },
  { p: [0.43, 0.08, 0], ry: 0.06, rz: 0.12 },
  { p: [0.49, 0.1, 0], ry: 0.03, rz: 0.05 },
];

/** The closed lower jaw's half-width at `x` along the head; 0 past its tip. */
function jawSide(x) {
  const at = x - 0.035,
    i = LOWER_JAW.findIndex(({ p }) => p[0] >= at);
  if (i < 0) return 0;
  if (i === 0) return LOWER_JAW[0].rz;
  const a = LOWER_JAW[i - 1],
    b = LOWER_JAW[i];
  return a.rz + ((b.rz - a.rz) * (at - a.p[0])) / (b.p[0] - a.p[0]);
}

/** The skull's half-width at `x` and height `y`, `lift` out from its surface; 0 where it misses. */
function skullSide(x, y, lift = 0) {
  const i = Math.max(0, SKULL.findIndex(({ p }) => p[0] >= x) - 1),
    a = SKULL[i],
    b = SKULL[Math.min(SKULL.length - 1, i + 1)],
    t = b === a ? 0 : Math.min(1, Math.max(0, (x - a.p[0]) / (b.p[0] - a.p[0]))),
    at = (k) => a[k] + (b[k] - a[k]) * t,
    cy = a.p[1] + (b.p[1] - a.p[1]) * t,
    h = (y - cy) / at("ry");
  return h * h < 1 ? at("rz") * Math.sqrt(1 - h * h) + lift : 0;
}

/**
 * The round head kids wear, whatever head they grow into: a round skull on a short snout with a
 * cream chin, big slit eyes that face forward and the `cheeks` (see
 * `dragonCheeks.js`) and young mouth (`dragonHatchlingMouths.js`) of the head they will grow into. The jaw closes when posed level with the head.
 */
export function hatchlingHead(context) {
  const { parts, skin, under, mouth, cheeks, teeth } = context;
  sweep(parts, "cranial-block", "head", SKULL, skin, { segments: 12, under: tint(skin, 0.85) });
  sweep(parts, "lower-jaw", "jaw", LOWER_JAW, under, { segments: 10, under });
  surface(
    parts,
    "upper-palate",
    "head",
    [-0.1, -0.12, -0.26, -0.1, -0.12, 0.26, 0.2, -0.13, -0.24, 0.2, -0.13, 0.24, 0.44, -0.1, -0.1, 0.44, -0.1, 0.1],
    [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4],
    mouth,
  );
  surface(
    parts,
    "lower-palate",
    "jaw",
    [-0.1, 0.15, -0.24, -0.1, 0.15, 0.24, 0.2, 0.15, -0.2, 0.2, 0.15, 0.2, 0.42, 0.13, -0.08, 0.42, 0.13, 0.08],
    [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5],
    mouth,
  );
  for (const s of [-1, 1]) {
    eye(context, s);
    cheeks.build(context, s, skullSide);
    teeth.build(context, s, skullSide, jawSide);
    const nose = [0.6, -0.01];
    part(parts, `nostril-${s}`, "head", "ellipsoid", [...nose, s * skullSide(...nose) * 0.55], [0.02, 0.014, 0.016], palette.ink, [0, 0, 0], {
      segments: 5,
    });
  }
  return {
    horn: (s) => [-0.12, 0.42, s * 0.2],
    crest: { from: [-0.3, 0.34], to: [0.12, 0.62] },
    nape: [-0.3, 0.2, 0],
    width: 0.4,
  };
}

/** A big eye with a slit pupil in a dark rim, turned towards the front. */
function eye(context, s) {
  const turn = 0.6,
    x = 0.27,
    y = 0.15,
    centre = [x, y, s * skullSide(x, y, 0.01)],
    rotation = [0, s * turn, 0],
    out = (d) => [centre[0] + d * Math.sin(turn), centre[1], centre[2] + s * d * Math.cos(turn)];
  eyeDome(context, s, { at: out(0.01), size: [0.15, 0.16], bulge: 0.1, rotation, pupil: [0.032, 0.13] });
}
