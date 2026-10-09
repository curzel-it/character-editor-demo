import { tint } from "../palette.js";
import { add, blade, mix, normalize, spike, surface, sweep } from "./dragonShape.js";

/**
 * Headgear grows in shape with `maturity` (0 for a kid, 1 for an adult; see `src/dragonAge.js`):
 * horns start as nubs and gain their curve, curl and tines; spike rows start sparse.
 */
const grown = (maturity = 1, young, adult) => Math.round(young + (adult - young) * maturity);

function crest({ parts, g, horn, maturity, crests }, head, scale) {
  const count = grown(maturity, 2, 4);
  for (let i = 0; i < count; i++) {
    const [x, y] = mix(head.crest.from, head.crest.to, i / 3);
    if (crests) {
      crests.push({ p: [x, y], height: g.spines * (1.05 - i * 0.16) * scale });
      continue;
    }
    blade(
      parts,
      `cranial-crest-${i}`,
      "head",
      [x, y, 0],
      g.horns * (0.34 - i * 0.035) * scale,
      g.spines * (1.05 - i * 0.16) * scale,
      0.047 - i * 0.006,
      horn,
    );
  }
}

function swept(context, head) {
  const { parts, g, horn, maturity } = context;
  const joints = grown(maturity, 1, 3);
  for (const s of [-1, 1]) {
    const root = head.horn(s);
    const rings = [
      { p: root, ry: 0.125, rz: 0.13 },
      { p: add(root, [0.11 - 0.4 * g.horns, 0.18, s * 0.085]), ry: 0.12, rz: 0.11 },
      { p: add(root, [0.11 - 0.78 * g.horns, 0.34, s * 0.165]), ry: 0.072, rz: 0.068 },
      { p: add(root, [0.11 - 1.26 * g.horns, 0.47, s * 0.265]), ry: 0.008, rz: 0.007 },
    ];
    // A young horn stops at an earlier joint and closes to a blunt point there.
    const tip = joints < rings.length - 1 ? { ...rings[joints], ry: 0.02, rz: 0.02 } : rings[joints];
    sweep(parts, `swept-horn-${s}`, "head", [...rings.slice(0, joints), tip], horn, { segments: 6 });
  }
  crest(context, head, 1);
}

function ram(context, head) {
  const { parts, g, horn, maturity = 1 } = context;
  const ridged = tint(horn, 0.84),
    size = 0.3 * g.horns,
    curl = 1 - 0.7 * (1 - maturity),
    thick = 1 - 0.4 * (1 - maturity),
    steps = grown(maturity, 5, 14);
  for (const s of [-1, 1]) {
    const root = head.horn(s),
      center = add(root, [-size, 0, 0]),
      rings = [];
    for (let i = 0; i <= steps; i++) {
      const turn = (i / steps) * 1.8 * Math.PI * curl,
        radius = size * (1 - (0.32 * turn) / (2 * Math.PI)),
        taper = 1 - i / steps;
      rings.push({
        p: add(center, [
          Math.cos(turn) * radius,
          Math.sin(turn) * radius,
          s * 0.3 * (i / steps),
        ]),
        ry: (0.13 * taper + 0.01) * thick,
        rz: (0.12 * taper + 0.01) * thick,
        color: i % 2 && maturity > 0.25 ? ridged : horn,
      });
    }
    sweep(parts, `ram-horn-${s}`, "head", rings, horn, { segments: 7 });
  }
  crest(context, head, 0.45);
}

function frill({ parts, g, horn, membrane, maturity }, head) {
  const count = grown(maturity, 5, 9),
    [x, y] = head.nape,
    spikes = [];
  for (let i = 0; i < count; i++) {
    const angle = -1.35 + (2.7 * i) / (count - 1),
      base = [x, y + Math.cos(angle) * 0.2, Math.sin(angle) * head.width * 0.85],
      direction = normalize([-0.55, Math.cos(angle), Math.sin(angle) * 1.1]),
      length = g.horns * 0.62 * (0.7 + 0.3 * Math.cos(angle)),
      tip = add(base, direction.map((v) => v * length));
    spikes.push(base, mix(base, tip, 0.82));
    sweep(
      parts,
      `frill-spike-${i}`,
      "head",
      [
        { p: base, ry: 0.05, rz: 0.05 },
        { p: mix(base, tip, 0.6), ry: 0.03, rz: 0.03 },
        { p: tip, ry: 0.002, rz: 0.002 },
      ],
      horn,
      { segments: 5 },
    );
  }
  const indices = [];
  for (let i = 0; i < count - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  surface(parts, "frill-web", "head", spikes.flat(), indices, membrane);
}

/** A ring of short spikes around the back of the skull, longest at the nape. */
function crown({ parts, g, horn, maturity }, head) {
  const count = grown(maturity, 5, 11),
    [x, y] = head.nape,
    dark = tint(horn, 0.86);
  for (let i = 0; i < count; i++) {
    const angle = -1.5 + (3 * i) / (count - 1),
      c = Math.cos(angle),
      base = [x + 0.12 + 0.1 * c, y + 0.1 + c * 0.13, Math.sin(angle) * head.width * 0.8],
      direction = normalize([-0.7, 0.55 + 0.6 * c, Math.sin(angle) * 0.9]),
      length = g.horns * (0.2 + 0.2 * (1 - Math.abs(Math.sin(angle)))),
      tip = add(base, direction.map((v) => v * length));
    spike(parts, `crown-spike-${i}`, "head", base, tip, 0.05, i % 2 ? dark : horn, { steps: 3, segments: 5 });
  }
}

/** Branching antlers: a swept beam from each horn root with tines rising off it. */
function antlers(context, head) {
  const { parts, g, horn, maturity } = context;
  const beam = tint(horn, 0.9),
    reach = grown(maturity, 2, 4),
    tines = grown(maturity, 0, 3);
  for (const s of [-1, 1]) {
    const root = head.horn(s),
      k = g.horns;
    const points = [
      root,
      add(root, [-0.2 * k, 0.3 * k, s * 0.12 * k]),
      add(root, [-0.55 * k, 0.55 * k, s * 0.3 * k]),
      add(root, [-0.95 * k, 0.72 * k, s * 0.42 * k]),
    ].slice(0, reach);
    sweep(
      parts,
      `antler-beam-${s}`,
      "head",
      points.map((p, i) => {
        const tip = i === points.length - 1 ? 3 : i;
        return { p, ry: 0.09 - tip * 0.027, rz: 0.085 - tip * 0.025 };
      }),
      beam,
      { segments: 6 },
    );
    // [from, to, along, reach, sprout]: a tine grows once the antler is `sprout` tines along.
    [
      [1, 2, 0.3, [0.2 * k, 0.4 * k, s * 0.08 * k], 1],
      [2, 3, 0.4, [0.05 * k, 0.42 * k, s * 0.16 * k], 2],
      [0, 1, 0.6, [0.28 * k, 0.1 * k, s * 0.12 * k], 0],
    ]
      .filter(([, to, , , sprout]) => sprout < tines && to < points.length)
      .forEach(([from, to, along, tip], n) => {
        const base = mix(points[from], points[to], along);
        spike(parts, `antler-tine-${s}-${n}`, "head", base, add(base, tip), 0.05 - n * 0.008, horn, {
          bend: [0, 0.04, 0],
          steps: 3,
          segments: 5,
        });
      });
  }
  crest(context, head, 0.6);
}

export const dragonHeadgear = [
  { id: "swept", label: "Swept horns", build: swept },
  { id: "ram", label: "Ram horns", build: ram },
  { id: "frill", label: "Frill", build: frill },
  { id: "crown", label: "Spiked crown", build: crown },
  { id: "antlers", label: "Antlers", build: antlers },
];
