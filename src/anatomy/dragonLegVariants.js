import { tint } from "../palette.js";
import { add, blade, mix, spike, sweep } from "./dragonShape.js";
import { on, shinLine } from "./dragonLegs.js";

function raptor(leg) {
  const { parts, s, thigh, foot, ridge, b } = leg;
  blade(parts, `heel-spur-${s}`, foot, [0.03, 0.09, 0], 0.34, 0.2, 0.05, ridge);
  blade(parts, `thigh-spur-${s}`, thigh, [-0.12, -0.08, s * 0.3 * b], 0.3, 0.1, 0.04, ridge, s * 0.06);
}

const VANE = [
  [0, 0.4],
  [0.2, 0.85],
  [0.5, 1],
  [0.75, 0.85],
  [0.92, 0.5],
  [1, 0.12],
];

/** Feathered thigh "trousers": staggered rows of broad vanes lying down the thigh over a slender shank. */
function feathered(leg) {
  const { parts, s, k, b, thigh, skin } = leg;
  const thighRings = [
    { p: [0.03, 0.02, s * 0.03], ry: 0.5 * b, rz: 0.28 * b },
    { p: [0.1 * k, -0.34 * k, s * 0.07], ry: 0.37 * b, rz: 0.28 * b },
    { p: [0.17 * k, -0.56 * k, s * 0.04], ry: 0.28 * b, rz: 0.24 * b },
  ];
  const rows = [
    { at: 0, length: 0.26, flare: 0.02, color: tint(skin, 1.04) },
    { at: 0.35, length: 0.32, flare: 0.02, color: tint(skin, 1.12) },
    { at: 0.8, length: 0.32, flare: 0, color: tint(skin, 1.2) },
    { at: 1.2, length: 0.22, flare: 0, color: tint(skin, 1.28) },
  ].map((row) => {
    const i = row.at < 1 ? 0 : 1,
      t = row.at - i,
      [from, to] = [thighRings[i], thighRings[i + 1]];
    return { ...row, centre: mix(from.p, to.p, t), ry: from.ry + (to.ry - from.ry) * t, rz: from.rz + (to.rz - from.rz) * t };
  });
  const count = 11;
  rows.forEach((row, r) => {
    const { centre } = row;
    for (let i = 0; i < count; i++) {
      const phi = (-0.72 + 1.44 * ((i + (r % 2) * 0.5) / (count - 0.5))) * Math.PI;
      const normal = [Math.cos(phi) / row.ry, 0, (s * Math.sin(phi)) / row.rz],
        out = normal.map((v) => v / Math.hypot(...normal));
      const base = add(centre, [Math.cos(phi) * row.ry * 0.97, 0, s * Math.sin(phi) * row.rz * 0.97]);
      const length = row.length * k,
        tip = add(base, [out[0] * row.flare * length - 0.12 * length, -length, out[2] * row.flare * length]);
      const width = 0.15 * b,
        shade = tint(row.color, i % 2 ? 0.95 : 1.03);
      const rings = VANE.map(([t, w]) => ({
        p: add(mix(base, tip, t), out.map((v) => v * 0.015 * length * 4 * t * (1 - t))),
        ry: width * w,
        rz: 0.012 + 0.012 * (1 - t),
      }));
      sweep(parts, `thigh-feather-${s}-${r}-${i}`, thigh, rings, shade, { segments: 4, across: out });
    }
  });
}

/** Thick stubby legs armoured with overlapping bony scutes, dorsal plates and a knee boss. */
function armoured(leg) {
  const { parts, s, k, shin, thigh, horn, ridge, b } = leg;
  const plate = tint(horn, 0.86),
    dark = tint(plate, 0.82),
    knob = tint(ridge, 0.9);
  const scutes = (bone, name, line, grow, n, size) => {
    const along = line.up[1] ? [-line.up[1], line.up[0], 0] : [-1, 0, 0];
    const back = along.map((v) => v * 0.3 * size);
    const r = line.radius * grow;
    const lateral = add(line.p, [0, 0, s * r * 0.82]);
    spike(parts, `${name}-flank-${s}-${n}`, bone, lateral, add(add(lateral, back), [0, 0, s * 0.07]), 0.13 * size, n % 2 ? plate : dark, {
      flat: 0.4,
      blunt: 0.35,
      steps: 2,
    });
    const belly = on(line, -grow * 0.85);
    spike(parts, `${name}-keel-${s}-${n}`, bone, belly, add(add(belly, back), line.up.map((v) => -v * 0.05)), 0.06 * size, n % 2 ? dark : plate, {
      flat: 2.4,
      blunt: 0.35,
      steps: 2,
    });
  };
  for (let i = 0; i < 4; i++) {
    const line = shinLine(leg, 0.1 + i * 0.25),
      grow = i < 2 ? 1.28 : 1.75;
    scutes(shin, "shin", line, grow, i, 1);
    blade(parts, `shin-plate-${s}-${i}`, shin, on(line, grow * 0.8), 0.36 - i * 0.03, 0.18 - i * 0.02, 0.09, plate);
  }
  spike(parts, `thigh-scute-${s}`, thigh, [0.06 * k, -0.3 * k, s * 0.4 * b], [0.02 * k, -0.3 * k, s * 0.52 * b], 0.1, knob, {
    blunt: 0.5,
    steps: 2,
  });
  spike(parts, `knee-boss-${s}`, shin, [0.05, 0.12, s * 0.03], [0.22, 0.04, s * 0.05], 0.15, plate, { blunt: 0.55, flat: 1.1 });
}

/** Rooster-like legs: a tall serrated crest down the back and long, upswept tarsal and heel spurs. */
function spurred(leg) {
  const { parts, s, k, b, thigh, shin, foot, ridge, horn } = leg;
  for (let i = 0; i < 5; i++) {
    const line = shinLine(leg, 0.08 + i * 0.2),
      h = 0.3 - i * 0.03;
    blade(parts, `shin-crest-${s}-${i}`, shin, on(line, 0.85), 0.24, h, 0.028, i % 2 ? horn : ridge);
  }
  for (let i = 0; i < 3; i++) {
    const at = mix([0.0, -0.02, 0], [0.1 * k, -0.34 * k, s * 0.05], i / 2);
    blade(parts, `thigh-crest-${s}-${i}`, thigh, add(at, [-0.44 * b, 0.02, 0]), 0.36 - i * 0.04, 0.12, 0.028, i % 2 ? horn : ridge);
  }
  spike(parts, `heel-spur-${s}`, foot, [0.02, 0.1, 0], [-0.04, 0.56, s * 0.03], 0.07, horn, { bend: [0.1, 0, 0] });
  spike(parts, `tarsal-spur-${s}`, foot, [-0.15 * k, 0.06, -s * 0.05], [-0.36 * k, 0.44, -s * 0.12], 0.065, horn, {
    bend: [0.08, 0.02, 0],
  });
}

/**
 * Leg shapes dress the thigh, shin and ankle on the shared hind-leg bone chain, so every pose,
 * gene and foot type keeps working. `hide` shapes the skinned hide down to the ankle.
 */
export const dragonLegShapes = [
  { id: "raptor", label: "Raptor", build: raptor },
  { id: "feathered", label: "Feathered", build: feathered, hide: { knee: 0.82, shank: 0.6, ankle: 0.7 } },
  { id: "armoured", label: "Armoured", build: armoured, hide: { knee: 1.28, shank: 1.85, ankle: 1.7, hip: 1.06, shankAt: 0.44 } },
  { id: "spurred", label: "Spurred", build: spurred, hide: { knee: 0.92, shank: 0.82, ankle: 0.9 } },
];
