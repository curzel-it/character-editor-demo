import { palette, tint } from "../palette.js";
import { part } from "./parts.js";
import { surface, sweep } from "./dragonShape.js";
import { toothRow } from "./dragonTeeth.js";
import { eyeDome } from "./dragonEyes.js";

const classicFront = [[1.145, 0.135], [1.18, 0.088], [1.2, 0.035]];
const classicRow = (lengths, front, z) => [
  ...lengths.map((length, n) => ({ x: 0.2 + n * 0.089, z: z(0.228 - n * 0.0054), length, rake: 0.35 })),
  ...classicFront.map(([x, half], n) => ({ x, z: z(half), length: front[n], rake: 0.2 })),
];
const classicUpper = classicRow([0.05, 0.06, 0.075, 0.135, 0.07, 0.065, 0.08, 0.075, 0.07, 0.125, 0.065], [0.06, 0.085, 0.05], (z) => z);
const classicLower = classicRow([0.06, 0.07, 0.105, 0.07, 0.075, 0.08, 0.075, 0.11, 0.07, 0.065, 0.06], [0.06, 0.05, 0.045], (z) => z * 0.84);

const needleUpper = [
  ...[0.04, 0.05, 0.06, 0.065, 0.11, 0.07, 0.075, 0.07, 0.12, 0.075, 0.08, 0.07, 0.05, 0.045].map((length, n) => {
    const x = 0.32 + n * 0.075;
    return { x, z: Math.max(0.08, 0.15 - 0.2 * (x - 0.32)), length, rake: 0.25, splay: n > 10 ? 0.12 : 0 };
  }),
  { x: 1.36, z: 0.1, length: 0.14, rake: -0.1, splay: 0.45 },
  { x: 1.42, z: 0.05, length: 0.11, rake: -0.15, splay: 0.35 },
];
const needleLower = [
  ...[0.04, 0.05, 0.09, 0.055, 0.06, 0.065, 0.1, 0.06, 0.065, 0.07, 0.06, 0.05, 0.045].map((length, n) => {
    const x = 0.355 + n * 0.075;
    return { x, z: 0.1 - 0.035 * Math.min(1, (x - 0.35) / 0.6), length, rake: 0.25 };
  }),
  { x: 1.33, z: 0.045, length: 0.12, rake: -0.1, splay: 0.4 },
];

const viperLower = [0.045, 0.055, 0.07, 0.06, 0.075, 0.065, 0.05].map((length, n) => ({ x: 0.12 + n * 0.11, z: 0.3 - n * 0.035, length, rake: 0.3 }));

/**
 * Builds parts on `parent`, then, when the anatomy passes `rig`, moves them onto a new mouth bone at
 * `origin`. Coordinates are in the head or jaw frame before the snout compression (`muzzle`, 0.83 by
 * default), which this applies itself; `base` is the parent mouth bone's origin in that frame.
 * Without `rig` the parts simply stay on the parent bone.
 */
function onBone({ parts, rig, muzzle = 0.83 }, id, parent, origin, build, base = [0, 0, 0]) {
  const squeeze = (x) => (x > 0 ? x * muzzle : x);
  const start = parts.length;
  build();
  if (!rig) return;
  const at = [squeeze(origin[0]), origin[1], origin[2]];
  const from = [squeeze(base[0]), base[1], base[2]];
  rig(id, parent, at.map((v, k) => v - from[k]));
  for (const piece of parts.slice(start)) {
    piece.bone = id;
    if (piece.vertices) {
      const vertices = [...piece.vertices];
      for (let i = 0; i < vertices.length; i += 3)
        for (let k = 0; k < 3; k++)
          vertices[i + k] = (k ? vertices[i + k] : squeeze(vertices[i])) - at[k];
      piece.vertices = vertices;
    } else piece.position = piece.position.map((v, k) => (k ? v : squeeze(v)) - at[k]);
  }
}

/** Tongue in two pieces, a root on `tongue` and a tip on `tongue-tip`, so it can curl and flick. */
function tongueParts(context, rings, split, color) {
  const root = rings[0].p,
    joint = rings[split].p;
  onBone(context, "tongue", "jaw", root, () =>
    sweep(context.parts, "tongue", "jaw", rings.slice(0, split + 1), color, { segments: 8 }),
  );
  const tip = context.rig ? "tongue" : "jaw";
  onBone(
    context,
    "tongue-tip",
    tip,
    joint,
    () => sweep(context.parts, "tongue-tip", "jaw", rings.slice(split), color, { segments: 8 }),
    root,
  );
}

/** Nostril patch on its own bone so it can flare outwards. */
function nostril(context, s, quad) {
  const mid = [0, 1, 2].map((k) => (quad[k] + quad[3 + k] + quad[6 + k] + quad[9 + k]) / 4);
  const vertices = quad.map((v, i) => {
    const shrunk = mid[i % 3] + (v - mid[i % 3]) * 0.5;
    return i % 3 === 2 ? shrunk * 0.96 : shrunk;
  });
  const centre = [0, 1, 2].map((k) => (vertices[k] + vertices[3 + k] + vertices[6 + k] + vertices[9 + k]) / 4);
  onBone(context, `nostril-${s}`, "head", centre, () =>
    surface(context.parts, `nostril-${s}`, "head", vertices, [0, 1, 2, 0, 2, 3], palette.dark),
  );
}

/** Small round nostril dot on its own bone so it can flare outwards. */
function nostrilDot(context, s, [x, y, z], size) {
  const centre = [x, y, s * z];
  onBone(context, `nostril-${s}`, "head", centre, () =>
    part(context.parts, `nostril-${s}`, "head", "ellipsoid", centre, [size * 1.2, size * 0.8, size], palette.ink, [0, 0, 0], {
      segments: 6,
    }),
  );
}

function classic(context) {
  const { parts, skin, under, ridge, horn, mouth, tongue } = context;
  sweep(
    parts,
    "cranial-planes",
    "head",
    [
      { p: [-0.19, 0.015, 0], ry: 0.29, rz: 0.305 },
      { p: [0.075, 0.035, 0], ry: 0.3, rz: 0.38 },
      { p: [0.34, -0.005, 0], ry: 0.23, rz: 0.33 },
      { p: [0.61, -0.035, 0], ry: 0.15, rz: 0.235 },
      { p: [0.91, -0.071, 0], ry: 0.125, rz: 0.23 },
      { p: [1.17, -0.05, 0], ry: 0.11, rz: 0.21 },
      { p: [1.245, -0.055, 0], ry: 0.065, rz: 0.17 },
    ],
    skin,
    { segments: 10, under: tint(skin, 0.82) },
  );
  sweep(
    parts,
    "lower-jaw",
    "jaw",
    [
      { p: [-0.1, -0.03, 0], ry: 0.18, rz: 0.275 },
      { p: [0.2, -0.065, 0], ry: 0.135, rz: 0.245 },
      { p: [0.62, -0.036, 0], ry: 0.075, rz: 0.195 },
      { p: [0.99, -0.007, 0], ry: 0.067, rz: 0.2 },
      { p: [1.18, 0.015, 0], ry: 0.05, rz: 0.158 },
    ],
    skin,
    { segments: 8, under, crisp: true },
  );
  surface(
    parts,
    "upper-palate",
    "head",
    [
      0.05, -0.18, -0.21, 0.05, -0.18, 0.21, 0.62, -0.166, -0.19, 0.62, -0.166,
      0.19, 1.19, -0.145, -0.15, 1.19, -0.145, 0.15,
    ],
    [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4],
    mouth,
  );
  surface(
    parts,
    "lower-palate",
    "jaw",
    [
      0.01, 0.064, -0.195, 0.01, 0.064, 0.195, 0.61, 0.036, -0.17, 0.61, 0.036,
      0.17, 1.15, 0.064, -0.14, 1.15, 0.064, 0.14,
    ],
    [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5],
    mouth,
  );
  tongueParts(
    context,
    [
      { p: [0.03, 0.068, 0], ry: 0.042, rz: 0.14 },
      { p: [0.44, 0.047, 0], ry: 0.044, rz: 0.125 },
      { p: [0.87, 0.069, 0], ry: 0.031, rz: 0.086 },
      { p: [1.03, 0.07, 0], ry: 0.018, rz: 0.018 },
    ],
    1,
    tongue,
  );
  for (const s of [-1, 1]) {
    const eyeZ = s * 0.33;
    surface(
      parts,
      `recessed-orbit-${s}`,
      "head",
      [
        0.07,
        0.063,
        eyeZ,
        0.18,
        0.147,
        eyeZ + s * 0.016,
        0.39,
        0.093,
        eyeZ - s * 0.004,
        0.285,
        -0.001,
        eyeZ + s * 0.009,
        0.12,
        0.005,
        eyeZ + s * 0.009,
      ],
      [0, 1, 2, 0, 2, 3, 0, 3, 4],
      palette.dark,
    );
    eyeDome(context, s, {
      at: [0.238, 0.066, s * 0.351],
      size: [0.051, 0.028],
      bulge: 0.026,
      rotation: [0, 0, -0.16],
      pupil: [0.006, 0.025],
      shift: 0.017,
    });
    sweep(
      parts,
      `brow-${s}`,
      "head",
      [
        { p: [-0.03, 0.225, s * 0.265], ry: 0.105, rz: 0.11 },
        { p: [0.18, 0.18, s * 0.353], ry: 0.085, rz: 0.083 },
        { p: [0.44, 0.125, s * 0.297], ry: 0.052, rz: 0.051 },
        { p: [0.57, 0.089, s * 0.248], ry: 0.022, rz: 0.027 },
      ],
      ridge,
      { segments: 5 },
    );
    surface(
      parts,
      `cheek-plane-${s}`,
      "head",
      [
        -0.17,
        0.075,
        s * 0.32,
        0.12,
        -0.02,
        s * 0.41,
        0.42,
        -0.145,
        s * 0.25,
        -0.1,
        -0.31,
        s * 0.29,
        -0.46,
        -0.245,
        s * 0.5,
      ],
      [0, 1, 3, 1, 2, 3, 0, 3, 4],
      ridge,
    );
    sweep(
      parts,
      `jaw-spur-${s}`,
      "head",
      [
        { p: [-0.08, -0.12, s * 0.26], ry: 0.09, rz: 0.09 },
        { p: [-0.39, -0.17, s * 0.46], ry: 0.06, rz: 0.045 },
        { p: [-0.72, -0.19, s * 0.66], ry: 0.005, rz: 0.005 },
      ],
      ridge,
      { segments: 5 },
    );
    nostril(context, s, [
        1.08,
        0.008,
        s * 0.17,
        1.245,
        -0.002,
        s * 0.17,
        1.19,
        -0.073,
        s * 0.19,
        1.1,
        -0.055,
        s * 0.2,
      ]);
    toothRow(parts, "upper-fang", "head", s, -0.164, -1, classicUpper, horn, { radius: 0.024, segments: 5 });
    toothRow(parts, "lower-fang", "jaw", s, 0.034, 1, classicLower, horn, { radius: 0.019, segments: 5 });
  }
  return {
    horn: (s) => [-0.11, 0.22, s * 0.225],
    crest: { from: [-0.21, 0.245], to: [0.39, 0.155] },
    nape: [-0.24, 0.1, 0],
    width: 0.33,
  };
}

function eye(context, s, [x, y, z], size = 1) {
  eyeDome(context, s, {
    at: [x, y, s * z],
    size: [0.051 * size, 0.032 * size],
    bulge: 0.026,
    rotation: [0, 0, -0.16],
    pupil: [0.007 * size, 0.027 * size],
    shift: 0.017 * size,
  });
}

function beaked(context) {
  const { parts, skin, under, ridge, horn, mouth, tongue } = context;
  const keratin = tint(horn, 0.92);
  sweep(
    parts,
    "cranial-dome",
    "head",
    [
      { p: [-0.19, 0.02, 0], ry: 0.29, rz: 0.3 },
      { p: [0.02, 0.08, 0], ry: 0.33, rz: 0.34 },
      { p: [0.26, 0.06, 0], ry: 0.28, rz: 0.31 },
      { p: [0.48, 0, 0], ry: 0.2, rz: 0.22 },
      { p: [0.56, -0.02, 0], ry: 0.17, rz: 0.19 },
    ],
    skin,
    { segments: 10, under: tint(skin, 0.82) },
  );
  sweep(
    parts,
    "upper-beak",
    "head",
    [
      { p: [0.5, -0.01, 0], ry: 0.175, rz: 0.195 },
      { p: [0.78, -0.03, 0], ry: 0.13, rz: 0.14 },
      { p: [1.02, -0.07, 0], ry: 0.09, rz: 0.09 },
      { p: [1.18, -0.14, 0], ry: 0.055, rz: 0.05 },
      { p: [1.23, -0.24, 0], ry: 0.025, rz: 0.022 },
      { p: [1.19, -0.3, 0], ry: 0.003, rz: 0.003 },
    ],
    keratin,
    { segments: 8, under: tint(keratin, 0.8) },
  );
  sweep(
    parts,
    "lower-beak",
    "jaw",
    [
      { p: [-0.1, -0.05, 0], ry: 0.18, rz: 0.24 },
      { p: [0.3, -0.07, 0], ry: 0.14, rz: 0.19 },
      { p: [0.5, -0.058, 0], ry: 0.115, rz: 0.146 },
      { p: [0.501, -0.058, 0], ry: 0.115, rz: 0.146, color: keratin },
      { p: [0.62, -0.05, 0], ry: 0.1, rz: 0.12, color: keratin },
      { p: [0.92, -0.01, 0], ry: 0.055, rz: 0.055, color: keratin },
      { p: [1.02, 0.02, 0], ry: 0.004, rz: 0.004, color: keratin },
    ],
    skin,
    { segments: 8, under, crisp: true },
  );
  surface(
    parts,
    "upper-palate",
    "head",
    [
      0.05, -0.17, -0.2, 0.05, -0.17, 0.2, 0.55, -0.15, -0.15, 0.55, -0.15,
      0.15, 1.05, -0.16, -0.06, 1.05, -0.16, 0.06,
    ],
    [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4],
    mouth,
  );
  surface(
    parts,
    "lower-palate",
    "jaw",
    [
      0.01, 0.06, -0.19, 0.01, 0.06, 0.19, 0.6, 0.04, -0.12, 0.6, 0.04, 0.12,
      0.92, 0.03, -0.04, 0.92, 0.03, 0.04,
    ],
    [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5],
    mouth,
  );
  tongueParts(
    context,
    [
      { p: [0.05, 0.078, 0], ry: 0.03, rz: 0.09 },
      { p: [0.36, 0.066, 0], ry: 0.028, rz: 0.066 },
      { p: [0.62, 0.056, 0], ry: 0.016, rz: 0.032 },
      { p: [0.72, 0.052, 0], ry: 0.004, rz: 0.004 },
    ],
    1,
    tongue,
  );
  for (const s of [-1, 1]) {
    eye(context, s, [0.2, 0.12, 0.33], 1.35);
    sweep(
      parts,
      `brow-${s}`,
      "head",
      [
        { p: [0.04, 0.26, s * 0.25], ry: 0.06, rz: 0.07 },
        { p: [0.22, 0.25, s * 0.3], ry: 0.05, rz: 0.05 },
        { p: [0.38, 0.17, s * 0.25], ry: 0.015, rz: 0.015 },
      ],
      ridge,
      { segments: 5 },
    );
    nostril(context, s, [
        0.66,
        0.03,
        s * 0.155,
        0.8,
        0.02,
        s * 0.14,
        0.78,
        -0.02,
        s * 0.15,
        0.67,
        -0.01,
        s * 0.16,
      ]);
  }
  return {
    horn: (s) => [-0.08, 0.28, s * 0.2],
    crest: { from: [-0.2, 0.3], to: [0.3, 0.33] },
    nape: [-0.22, 0.12, 0],
    width: 0.34,
  };
}

function blunt(context) {
  const { parts, skin, under, ridge, horn, mouth, tongue } = context;
  sweep(
    parts,
    "cranial-block",
    "head",
    [
      { p: [-0.19, 0.015, 0], ry: 0.29, rz: 0.31 },
      { p: [0.05, 0.04, 0], ry: 0.31, rz: 0.42 },
      { p: [0.32, 0.02, 0], ry: 0.28, rz: 0.43 },
      { p: [0.58, -0.02, 0], ry: 0.24, rz: 0.38 },
      { p: [0.74, -0.03, 0], ry: 0.2, rz: 0.32 },
      { p: [0.8, -0.03, 0], ry: 0.1, rz: 0.18 },
    ],
    skin,
    { segments: 8, under: tint(skin, 0.82) },
  );
  sweep(
    parts,
    "lower-jaw",
    "jaw",
    [
      { p: [-0.1, -0.05, 0], ry: 0.2, rz: 0.3 },
      { p: [0.3, -0.08, 0], ry: 0.18, rz: 0.36 },
      { p: [0.7, -0.06, 0], ry: 0.15, rz: 0.35 },
      { p: [0.92, -0.03, 0], ry: 0.12, rz: 0.3 },
      { p: [0.98, -0.02, 0], ry: 0.05, rz: 0.16 },
    ],
    skin,
    { segments: 8, under, crisp: true },
  );
  surface(
    parts,
    "upper-palate",
    "head",
    [
      0.05, -0.22, -0.3, 0.05, -0.22, 0.3, 0.45, -0.24, -0.34, 0.45, -0.24,
      0.34, 0.75, -0.2, -0.25, 0.75, -0.2, 0.25,
    ],
    [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4],
    mouth,
  );
  surface(
    parts,
    "lower-palate",
    "jaw",
    [
      0, 0.1, -0.26, 0, 0.1, 0.26, 0.5, 0.1, -0.3, 0.5, 0.1, 0.3, 0.9, 0.08,
      -0.22, 0.9, 0.08, 0.22,
    ],
    [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5],
    mouth,
  );
  tongueParts(
    context,
    [
      { p: [0.05, 0.1, 0], ry: 0.04, rz: 0.16 },
      { p: [0.5, 0.11, 0], ry: 0.05, rz: 0.18 },
      { p: [0.75, 0.11, 0], ry: 0.02, rz: 0.08 },
    ],
    1,
    tongue,
  );
  sweep(
    parts,
    "nose-boss",
    "head",
    [
      { p: [0.46, 0.21, 0], ry: 0.03, rz: 0.08 },
      { p: [0.6, 0.23, 0], ry: 0.07, rz: 0.13 },
      { p: [0.74, 0.15, 0], ry: 0.03, rz: 0.06 },
    ],
    ridge,
    { segments: 6 },
  );
  for (const s of [-1, 1]) {
    eye(context, s, [0.26, 0.13, 0.4], 0.8);
    sweep(
      parts,
      `brow-${s}`,
      "head",
      [
        { p: [-0.05, 0.28, s * 0.28], ry: 0.11, rz: 0.12 },
        { p: [0.22, 0.27, s * 0.37], ry: 0.1, rz: 0.1 },
        { p: [0.42, 0.2, s * 0.34], ry: 0.05, rz: 0.05 },
      ],
      ridge,
      { segments: 5 },
    );
    sweep(
      parts,
      `tusk-${s}`,
      "jaw",
      [
        { p: [0.76, 0.06, s * 0.27], ry: 0.065, rz: 0.06 },
        { p: [0.8, 0.28, s * 0.31], ry: 0.045, rz: 0.042 },
        { p: [0.72, 0.47, s * 0.31], ry: 0.003, rz: 0.003 },
      ],
      horn,
      { segments: 6 },
    );
    for (let n = 0; n < 4; n++)
      sweep(
        parts,
        `lower-tooth-${s}-${n}`,
        "jaw",
        [
          { p: [0.22 + n * 0.13, 0.09, s * 0.29], ry: 0.03, rz: 0.03 },
          { p: [0.21 + n * 0.13, 0.17, s * 0.29], ry: 0.002, rz: 0.002 },
        ],
        horn,
        { segments: 5 },
      );
    nostril(context, s, [
        0.78,
        0.02,
        s * 0.1,
        0.8,
        0,
        s * 0.2,
        0.8,
        -0.07,
        s * 0.19,
        0.78,
        -0.06,
        s * 0.1,
      ]);
  }
  return {
    horn: (s) => [-0.05, 0.27, s * 0.3],
    crest: { from: [-0.2, 0.3], to: [0.3, 0.3] },
    nape: [-0.2, 0.12, 0],
    width: 0.43,
  };
}

/** Long, narrow gharial snout ending in a bulb with pinprick nostrils, interlocking needle teeth and raised eyes. */
function needle(context) {
  const { parts, skin, under, ridge, horn, mouth, tongue } = context;
  sweep(
    parts,
    "cranial-planes",
    "head",
    [
      { p: [-0.19, 0.02, 0], ry: 0.29, rz: 0.3 },
      { p: [0.05, 0.06, 0], ry: 0.3, rz: 0.35 },
      { p: [0.3, 0.02, 0], ry: 0.21, rz: 0.25 },
      { p: [0.5, -0.04, 0], ry: 0.12, rz: 0.14 },
      { p: [0.9, -0.07, 0], ry: 0.085, rz: 0.1 },
      { p: [1.24, -0.075, 0], ry: 0.08, rz: 0.095 },
      { p: [1.37, -0.07, 0], ry: 0.11, rz: 0.14 },
      { p: [1.47, -0.075, 0], ry: 0.05, rz: 0.07 },
    ],
    skin,
    { segments: 10, under: tint(skin, 0.82) },
  );
  sweep(
    parts,
    "lower-jaw",
    "jaw",
    [
      { p: [-0.1, -0.03, 0], ry: 0.17, rz: 0.26 },
      { p: [0.25, -0.05, 0], ry: 0.12, rz: 0.18 },
      { p: [0.56, -0.02, 0], ry: 0.065, rz: 0.1 },
      { p: [1.0, 0.0, 0], ry: 0.055, rz: 0.08 },
      { p: [1.3, 0.02, 0], ry: 0.055, rz: 0.08 },
      { p: [1.38, 0.025, 0], ry: 0.02, rz: 0.035 },
    ],
    skin,
    { segments: 8, under, crisp: true },
  );
  surface(
    parts,
    "upper-palate",
    "head",
    [
      0.05, -0.18, -0.2, 0.05, -0.18, 0.2, 0.6, -0.15, -0.09, 0.6, -0.15, 0.09,
      1.34, -0.15, -0.07, 1.34, -0.15, 0.07,
    ],
    [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4],
    mouth,
  );
  surface(
    parts,
    "lower-palate",
    "jaw",
    [
      0.01, 0.06, -0.18, 0.01, 0.06, 0.18, 0.6, 0.04, -0.07, 0.6, 0.04, 0.07,
      1.3, 0.07, -0.05, 1.3, 0.07, 0.05,
    ],
    [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5],
    mouth,
  );
  tongueParts(
    context,
    [
      { p: [0.03, 0.068, 0], ry: 0.03, rz: 0.1 },
      { p: [0.4, 0.05, 0], ry: 0.026, rz: 0.06 },
      { p: [0.8, 0.052, 0], ry: 0.016, rz: 0.035 },
      { p: [0.96, 0.055, 0], ry: 0.004, rz: 0.004 },
    ],
    1,
    tongue,
  );
  for (const s of [-1, 1]) {
    eye(context, s, [0.17, 0.2, 0.27], 1.1);
    sweep(
      parts,
      `brow-${s}`,
      "head",
      [
        { p: [-0.04, 0.29, s * 0.2], ry: 0.07, rz: 0.07 },
        { p: [0.16, 0.28, s * 0.27], ry: 0.06, rz: 0.055 },
        { p: [0.34, 0.18, s * 0.2], ry: 0.015, rz: 0.015 },
      ],
      ridge,
      { segments: 5 },
    );
    nostrilDot(context, s, [1.4, 0.0, 0.065], 0.015);
    toothRow(parts, "upper-fang", "head", s, -0.14, -1, needleUpper, horn);
    toothRow(parts, "lower-fang", "jaw", s, 0.03, 1, needleLower, horn, { radius: 0.016 });
  }
  return {
    horn: (s) => [-0.1, 0.25, s * 0.2],
    crest: { from: [-0.21, 0.29], to: [0.28, 0.26] },
    nape: [-0.23, 0.1, 0],
    width: 0.32,
  };
}

/** Broad, flat, triangular head with swept jaw corners, pinprick nostrils and a pair of long front fangs. */
function viper(context) {
  const { parts, skin, under, ridge, horn, mouth, tongue } = context;
  sweep(
    parts,
    "cranial-wedge",
    "head",
    [
      { p: [-0.19, 0.015, 0], ry: 0.27, rz: 0.3 },
      { p: [-0.02, 0.02, 0], ry: 0.25, rz: 0.52 },
      { p: [0.22, 0.0, 0], ry: 0.21, rz: 0.47 },
      { p: [0.5, -0.03, 0], ry: 0.17, rz: 0.34 },
      { p: [0.76, -0.06, 0], ry: 0.13, rz: 0.22 },
      { p: [0.88, -0.07, 0], ry: 0.06, rz: 0.12 },
    ],
    skin,
    { segments: 10, under: tint(skin, 0.82) },
  );
  sweep(
    parts,
    "lower-jaw",
    "jaw",
    [
      { p: [-0.1, -0.03, 0], ry: 0.16, rz: 0.4 },
      { p: [0.25, -0.05, 0], ry: 0.13, rz: 0.38 },
      { p: [0.55, -0.03, 0], ry: 0.09, rz: 0.27 },
      { p: [0.8, 0.0, 0], ry: 0.06, rz: 0.15 },
      { p: [0.88, 0.01, 0], ry: 0.02, rz: 0.06 },
    ],
    skin,
    { segments: 8, under, crisp: true },
  );
  surface(
    parts,
    "upper-palate",
    "head",
    [
      0.05, -0.2, -0.36, 0.05, -0.2, 0.36, 0.45, -0.19, -0.28, 0.45, -0.19, 0.28,
      0.8, -0.18, -0.14, 0.8, -0.18, 0.14,
    ],
    [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4],
    mouth,
  );
  surface(
    parts,
    "lower-palate",
    "jaw",
    [
      0.01, 0.07, -0.33, 0.01, 0.07, 0.33, 0.45, 0.06, -0.26, 0.45, 0.06, 0.26,
      0.78, 0.05, -0.12, 0.78, 0.05, 0.12,
    ],
    [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5],
    mouth,
  );
  tongueParts(
    context,
    [
      { p: [0.05, 0.075, 0], ry: 0.025, rz: 0.07 },
      { p: [0.42, 0.065, 0], ry: 0.022, rz: 0.05 },
      { p: [0.7, 0.06, 0], ry: 0.012, rz: 0.03 },
      { p: [0.86, 0.06, 0], ry: 0.004, rz: 0.004 },
    ],
    1,
    tongue,
  );
  for (const s of [-1, 1]) {
    eye(context, s, [0.28, 0.1, 0.43], 1.05);
    sweep(
      parts,
      `brow-${s}`,
      "head",
      [
        { p: [0.08, 0.2, s * 0.36], ry: 0.07, rz: 0.1 },
        { p: [0.28, 0.2, s * 0.44], ry: 0.05, rz: 0.08 },
        { p: [0.45, 0.14, s * 0.38], ry: 0.015, rz: 0.02 },
      ],
      ridge,
      { segments: 5 },
    );
    sweep(
      parts,
      `jaw-corner-${s}`,
      "head",
      [
        { p: [-0.05, -0.08, s * 0.44], ry: 0.1, rz: 0.08 },
        { p: [-0.28, -0.12, s * 0.58], ry: 0.07, rz: 0.05 },
        { p: [-0.46, -0.16, s * 0.64], ry: 0.005, rz: 0.005 },
      ],
      ridge,
      { segments: 5 },
    );
    sweep(
      parts,
      `upper-fang-${s}-0`,
      "head",
      [
        { p: [0.68, -0.15, s * 0.2], ry: 0.028, rz: 0.028 },
        { p: [0.675, -0.22, s * 0.22], ry: 0.02, rz: 0.02 },
        { p: [0.67, -0.3, s * 0.24], ry: 0.002, rz: 0.002 },
      ],
      horn,
      { segments: 5 },
    );
    toothRow(parts, "lower-tooth", "jaw", s, 0.06, 1, viperLower, horn, { radius: 0.02 });
    nostrilDot(context, s, [0.83, 0.014, 0.06], 0.014);
  }
  return {
    horn: (s) => [-0.06, 0.2, s * 0.34],
    crest: { from: [-0.2, 0.26], to: [0.25, 0.2] },
    nape: [-0.22, 0.08, 0],
    width: 0.5,
  };
}

export const dragonHeads = [
  { id: "toothed", label: "Toothed", build: classic },
  { id: "beaked", label: "Beaked", build: beaked },
  { id: "blunt", label: "Blunt", build: blunt },
  { id: "needle", label: "Needle snout", build: needle },
  { id: "viper", label: "Viper", build: viper },
];
