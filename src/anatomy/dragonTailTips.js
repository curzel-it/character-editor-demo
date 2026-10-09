import { tint } from "../palette.js";
import { add, mix, spike, surface, sweep } from "./dragonShape.js";

// Tail tips dress the end of `tail-6`, whose tip lies at [-e, 0.025, 0] with e = tail / 7. Each
// build returns `reach`: how far past the tail end the tip extends, so the framing sphere grows.

/** A thin solid from a closed outline: `outline` points and a top/bottom ridge offset by `lift`. */
function slab(parts, id, bone, outline, lift, color) {
  const centre = outline.reduce((sum, p) => add(sum, p.map((v) => v / outline.length)), [0, 0, 0]);
  const vertices = [...add(centre, lift), ...add(centre, lift.map((v) => -v)), ...outline.flat()];
  const indices = [];
  for (let i = 0; i < outline.length; i++) {
    const a = 2 + i,
      b = 2 + ((i + 1) % outline.length);
    indices.push(0, a, b, 1, b, a);
  }
  surface(parts, id, bone, vertices, indices, color);
}

function plain() {
  return { reach: 0 };
}

/** The heraldic spade: a flat, faceted arrowhead lying across the tail. */
function spade({ parts, e, membrane, ridge }) {
  const y = 0.025;
  slab(
    parts,
    "tail-spade",
    "tail-6",
    [
      [-e * 0.55, y, 0],
      [-e * 0.95, y, 0.3],
      [-e * 0.88, y, 0.12],
      [-e - 0.62, y, 0],
      [-e * 0.88, y, -0.12],
      [-e * 0.95, y, -0.3],
    ].reverse(),
    [0, 0.05, 0],
    tint(membrane, 0.85),
  );
  sweep(
    parts,
    "tail-spade-rib",
    "tail-6",
    [
      { p: [-e * 0.5, y + 0.02, 0], ry: 0.035, rz: 0.035 },
      { p: [-e - 0.45, y + 0.02, 0], ry: 0.006, rz: 0.006 },
    ],
    ridge,
    { segments: 5 },
  );
  return { reach: 0.62 };
}

/** A horizontal fan of bony rays joined by membrane, like a bird's tail. */
function fan({ parts, e, membrane, horn }) {
  const count = 7,
    base = [-e * 0.8, 0.03, 0],
    rim = [];
  for (let i = 0; i < count; i++) {
    const angle = -0.9 + (1.8 * i) / (count - 1),
      length = 0.75 - 0.12 * Math.abs(angle),
      tip = add(base, [-Math.cos(angle) * length, 0, Math.sin(angle) * length]);
    rim.push(tip);
    spike(parts, `tail-fan-ray-${i}`, "tail-6", base, tip, 0.028, horn, { steps: 3, segments: 4 });
  }
  const vertices = [...base],
    indices = [];
  for (let i = 0; i < count; i++) {
    const inner = mix(rim[i], rim[Math.min(count - 1, i + 1)], 0.5);
    vertices.push(...rim[i], ...add(mix(base, inner, 0.82), [0, -0.01, 0]));
  }
  for (let i = 0; i < count - 1; i++) {
    const tip = 1 + i * 2,
      notch = tip + 1,
      next = tip + 2;
    indices.push(0, notch, tip, 0, next, notch);
  }
  surface(parts, "tail-fan-web", "tail-6", vertices, indices, tint(membrane, 0.9));
  return { reach: 0.8 };
}

/** A bony club ringed with blunt knobs. */
function club({ parts, e, horn, ridge }) {
  const bone = tint(horn, 0.86),
    centre = [-e - 0.1, 0.03, 0];
  sweep(
    parts,
    "tail-club",
    "tail-6",
    [
      { p: [-e * 0.7, 0.03, 0], ry: 0.05, rz: 0.05 },
      { p: add(centre, [0.14, 0, 0]), ry: 0.16, rz: 0.2 },
      { p: centre, ry: 0.2, rz: 0.25 },
      { p: add(centre, [-0.16, 0, 0]), ry: 0.14, rz: 0.17 },
      { p: add(centre, [-0.24, 0, 0]), ry: 0.03, rz: 0.03 },
    ],
    bone,
    { segments: 8 },
  );
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.3,
      out = [0, Math.cos(angle) * 0.8, Math.sin(angle)];
    const at = add(centre, [0, out[1] * 0.17, out[2] * 0.21]);
    spike(parts, `tail-club-knob-${i}`, "tail-6", at, add(at, out.map((v) => v * 0.13)), 0.07, ridge, { blunt: 0.5, steps: 2 });
  }
  return { reach: 0.35 };
}

/** A venom bulb ending in a barb that curls up and forward, like a scorpion's. */
function stinger({ parts, e, horn, ridge }) {
  const bulb = [-e - 0.12, 0.06, 0];
  sweep(
    parts,
    "tail-sting-bulb",
    "tail-6",
    [
      { p: [-e * 0.7, 0.03, 0], ry: 0.04, rz: 0.04 },
      { p: add(bulb, [0.1, -0.01, 0]), ry: 0.1, rz: 0.09 },
      { p: bulb, ry: 0.12, rz: 0.1 },
      { p: add(bulb, [-0.1, 0.05, 0]), ry: 0.07, rz: 0.06 },
    ],
    tint(ridge, 1.1),
    { segments: 7 },
  );
  const root = add(bulb, [-0.1, 0.05, 0]);
  spike(parts, "tail-sting", "tail-6", root, add(root, [0.02, 0.5, 0]), 0.065, horn, {
    bend: [-0.3, 0.02, 0],
    steps: 6,
  });
  return { reach: 0.45 };
}

/** A vertical forked fin, like a fish's caudal fin. */
function fin({ parts, e, membrane, ridge }) {
  const web = tint(membrane, 0.88);
  slab(
    parts,
    "tail-fin",
    "tail-6",
    [
      [-e * 0.45, 0.04, 0],
      [-e - 0.4, 0.5, 0],
      [-e - 0.22, 0.04, 0],
      [-e - 0.36, -0.36, 0],
      [-e * 0.6, 0.0, 0],
    ],
    [0, 0, 0.02],
    web,
  );
  for (const [n, tip] of [[0, [-e - 0.4, 0.5, 0]], [1, [-e - 0.36, -0.36, 0]]])
    spike(parts, `tail-fin-ray-${n}`, "tail-6", [-e * 0.7, 0.03, 0], tip, 0.03, ridge, { steps: 3, segments: 4 });
  return { reach: 0.42 };
}

export const dragonTailTips = [
  { id: "plain", label: "Tapered", build: plain },
  { id: "spade", label: "Spade", build: spade },
  { id: "fan", label: "Fan", build: fan },
  { id: "club", label: "Club", build: club },
  { id: "stinger", label: "Stinger", build: stinger },
  { id: "fin", label: "Forked fin", build: fin },
];
