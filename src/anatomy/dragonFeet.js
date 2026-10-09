import { tint } from "../palette.js";
import { add, mix, spike, surface, sweep } from "./dragonShape.js";
import { footLine, on } from "./dragonLegs.js";

// Foot types dress everything below the ankle: the metatarsus hide profile (`hide`), three forward
// toes on `toes-hind-±1` and the hallux on `hallux-hind-±1`. Toes trail back (-X) from the toe base
// with their soles on +Y; the hallux sits on the back (+Y) of the metatarsus and points the other way.

/** Centreline of forward toe `n` (-1, 0 or 1 across the foot) for a given reach, spread and girth. */
function toeLine(k, n, { reach = 1, spread = 1, girth = 1 }) {
  const r = (n ? 0.94 : 1.1) * k * reach,
    z0 = n * 0.075 * Math.max(1, girth),
    z1 = n * 0.14 * spread;
  return [
    [0.02, 0, z0 * 0.8],
    [-0.2 * r, -0.03 * r, z0 * 1.5],
    [-0.36 * r, -0.06 * r, z1],
    [-0.45 * r, -0.08 * r, z1 * 1.05],
  ];
}

function toe(parts, id, bone, line, girth, color) {
  const radii = [0.09, 0.078, 0.062, 0.052];
  sweep(
    parts,
    id,
    bone,
    line.map((p, i) => ({ p, ry: radii[i] * girth, rz: radii[i] * 0.94 * girth })),
    color,
    { segments: 6 },
  );
}

/** A digit's heading and sole direction in its bone's XY plane. */
const TOE = { heading: [-1, 0], sole: [0, 1] };
const HALLUX_TILT = 0.7;
const HALLUX = {
  heading: [Math.cos(HALLUX_TILT), Math.sin(HALLUX_TILT)],
  sole: [-Math.sin(HALLUX_TILT), Math.cos(HALLUX_TILT)],
};

/** A claw continuing a digit along its heading, dipping and hooking towards its sole. */
function talon(parts, id, bone, [x, y, z], { heading, sole }, reach, color, { size = 1, width = 1, hook = 1 } = {}) {
  const length = reach * size,
    blunt = 0.02 * (width - 1);
  const dx = 0.99 * heading[0] + 0.12 * sole[0],
    dy = 0.99 * heading[1] + 0.12 * sole[1];
  const [ax, ay] = -dy * sole[0] + dx * sole[1] < 0 ? [-dy, dx] : [dy, -dx];
  const at = (drop, ahead) => [x + (dx * drop + ax * ahead) * length, y + (dy * drop + ay * ahead) * length, z];
  sweep(
    parts,
    id,
    bone,
    [
      { p: [x, y, z], ry: 0.06 * width, rz: 0.05 * width },
      { p: at(0.12, 0.045), ry: 0.044 * width, rz: 0.036 * width },
      { p: at(0.23, 0.035 * hook), ry: 0.028 * width + 0.6 * blunt, rz: 0.022 * width },
      { p: at(0.31, -0.05 * hook), ry: 0.002 + blunt, rz: 0.002 + blunt },
    ],
    color,
    { segments: 5 },
  );
}

/** The rear toe, opposing the forward toes from the back of the metatarsus. */
function hallux(leg, { length = 1, girth = 1, claw = {}, color, clawColor } = {}) {
  const { parts, s, k, horn, scale } = leg;
  const h = k * length;
  const { heading, sole } = HALLUX;
  const along = (t, z) => [heading[0] * t * h, heading[1] * t * h, z];
  sweep(
    parts,
    `hallux-${s}`,
    leg.hallux,
    [
      { p: along(-0.04, -s * 0.02), ry: 0.085 * girth, rz: 0.08 * girth },
      { p: along(0.13, -s * 0.05), ry: 0.068 * girth, rz: 0.064 * girth },
      { p: along(0.26, -s * 0.06), ry: 0.054 * girth, rz: 0.05 * girth },
    ],
    color || scale,
    { segments: 6 },
  );
  const tip = along(0.26, -s * 0.06);
  const base = [tip[0] + sole[0] * 0.01, tip[1] + sole[1] * 0.01, tip[2]];
  talon(parts, `talon-${s}-hallux`, leg.hallux, base, HALLUX, 0.9 * k, clawColor || horn, claw);
}

/** Three forward toes with claws; returns their centrelines for webbing. */
function forwardToes(leg, options = {}) {
  const { parts, s, k, toes, horn, scale } = leg;
  const { girth = 1, claw = {}, color, clawColor } = options;
  const lines = [];
  for (let n = -1; n <= 1; n++) {
    const line = toeLine(k, n, options);
    toe(parts, `toe-${s}-${n + 1}`, toes, line, girth, color || scale);
    const tip = line[3];
    talon(parts, `talon-${s}-${n + 1}`, toes, [tip[0], (tip[1] * 21) / 22, tip[2]], TOE, (n ? 0.94 : 1.1) * k, clawColor || horn, claw);
    lines.push(line);
  }
  return lines;
}

function raptor(leg) {
  forwardToes(leg);
  hallux(leg);
}

/** Long, widely spread bare toes on a slender scaled tarsus, with dark needle talons. */
function eagle(leg) {
  const { parts, s, horn } = leg;
  const bare = eagleColor(leg),
    dark = tint(horn, 0.48),
    claw = { size: 1.2, width: 1, hook: 1.6 };
  forwardToes(leg, { reach: 1.2, spread: 1.75, girth: 0.8, claw, color: bare, clawColor: dark });
  hallux(leg, { length: 1.3, girth: 0.8, claw, color: bare, clawColor: dark });
  const scute = tint(bare, 0.82);
  for (let i = 0; i < 4; i++) {
    const line = footLine(leg, 0.15 + i * 0.25);
    const at = add(line.p, [0, -line.radius * 0.6, 0]);
    spike(parts, `tarsus-scute-${s}-${i}`, leg.foot, add(at, [0.04, 0, 0]), add(at, [-0.06, -0.02, 0]), 0.045, scute, {
      flat: 2.2,
      steps: 2,
      segments: 5,
    });
  }
}
const eagleColor = ({ horn, under }) => mix(horn, under, 0.45);

/** Stubby, thick toes on a plated metatarsus, with a broad sole pad and blunt hoof-like claws. */
function heavy(leg) {
  const { parts, s, k, foot, toes, horn, sole } = leg;
  const plate = tint(horn, 0.86),
    dark = tint(plate, 0.82),
    claw = { size: 0.62, width: 2, hook: 0.25 };
  forwardToes(leg, { reach: 0.72, spread: 1.35, girth: 1.6, claw });
  hallux(leg, { length: 0.8, girth: 1.5, claw });
  for (let i = 0; i < 2; i++) {
    const line = footLine(leg, 0.2 + i * 0.5),
      r = line.radius * 1.5;
    const back = [-0.29 * 0.24, -0.06 * 0.24, 0];
    const lateral = add(line.p, [0, 0, s * r * 0.82]);
    spike(parts, `foot-flank-${s}-${i}`, foot, lateral, add(add(lateral, back), [0, 0, s * 0.06]), 0.1, i ? plate : dark, {
      flat: 0.4,
      blunt: 0.35,
      steps: 2,
    });
    const top = on(line, 1.35);
    spike(parts, `foot-plate-${s}-${i}`, foot, top, add(add(top, back), [0, 0.05, 0]), 0.07, plate, {
      flat: 1.8,
      blunt: 0.35,
      steps: 2,
    });
  }
  spike(parts, `sole-pad-${s}`, toes, [0.04, -0.1, 0], [-0.22 * k, -0.16 * k, 0], 0.13, tint(sole, 0.9), {
    flat: 1.6,
    blunt: 0.7,
    steps: 3,
  });
}

/** Widely splayed toes joined by webbing, with small hooked claws. */
function webbed(leg) {
  const { parts, s, toes, membrane } = leg;
  const lines = forwardToes(leg, { reach: 1.12, spread: 2.1, girth: 0.85, claw: { size: 0.7, hook: 1.2 } });
  hallux(leg, { length: 0.9, girth: 0.85, claw: { size: 0.7 } });
  const vertices = [],
    indices = [];
  const web = tint(membrane, 0.9);
  for (const line of lines)
    for (let i = 0; i < 4; i++) {
      const [x, y, z] = i === 3 ? mix(line[2], line[3], 0.7) : line[i];
      vertices.push(x, y - 0.02, z);
    }
  for (let a = 0; a < 2; a++)
    for (let i = 0; i < 3; i++) {
      const p = a * 4 + i,
        q = p + 4;
      if (s > 0) indices.push(p, q, p + 1, p + 1, q, q + 1);
      else indices.push(p, p + 1, q, p + 1, q + 1, q);
    }
  surface(parts, `toe-web-${s}`, toes, vertices, indices, web);
}

/** Two walking toes and a raised inner toe carrying a huge sickle claw, like a dromaeosaur. */
function sickle(leg) {
  const { parts, s, k, toes, horn, scale } = leg;
  for (const [index, n] of [[0, 0], [1, s * 0.9]]) {
    const line = toeLine(k, n, { reach: 1.05, spread: 0.9, girth: 1.1 });
    toe(parts, `toe-${s}-${index}`, toes, line, 1.1, scale);
    const tip = line[3];
    talon(parts, `talon-${s}-${index}`, toes, [tip[0], (tip[1] * 21) / 22, tip[2]], TOE, k, horn);
  }
  const h = k * 1.05;
  const knuckle = [-0.16 * h, -0.22 * h, -s * 0.12];
  sweep(
    parts,
    `toe-${s}-sickle`,
    toes,
    [
      { p: [0.02, 0, -s * 0.06], ry: 0.11, rz: 0.1 },
      { p: [-0.08 * h, -0.12 * h, -s * 0.1], ry: 0.095, rz: 0.088 },
      { p: knuckle, ry: 0.08, rz: 0.075 },
    ],
    scale,
    { segments: 6 },
  );
  const tip = add(knuckle, [-0.32 * h, 0.2 * h, 0]);
  spike(parts, `talon-${s}-sickle`, toes, knuckle, tip, 0.085, horn, { bend: [-0.16 * h, -0.14 * h, 0], steps: 7, flat: 0.55 });
  hallux(leg, { length: 0.7, girth: 0.9, claw: { size: 0.7 } });
}

/** Slender songbird toes curled round a long hallux over a gripping pad, all with fine, strongly hooked claws. */
function perching(leg) {
  const { parts, s, k, toes, sole } = leg;
  const claw = { size: 1.1, width: 0.85, hook: 1.6 };
  forwardToes(leg, { reach: 1.1, spread: 1.15, girth: 0.85, claw });
  hallux(leg, { length: 1.45, girth: 0.9, claw });
  spike(parts, `sole-pad-${s}`, toes, [0.04, 0.03, 0], [-0.12 * k, 0.03, 0], 0.06, tint(sole, 0.9), { flat: 1.4, blunt: 0.7, steps: 2 });
}

/** Gecko-like toes that end in broad, flat adhesive discs, with tiny claws tucked above them. */
function gecko(leg) {
  const { parts, s, k, toes, under } = leg;
  const pad = tint(under, 0.85),
    claw = { size: 0.45, hook: 1.4 };
  const lines = forwardToes(leg, { reach: 1.05, spread: 1.9, girth: 0.8, claw });
  lines.forEach((line, n) => {
    const tip = line[3],
      back = mix(line[2], line[3], 0.35);
    spike(parts, `toe-pad-${s}-${n}`, toes, back, add(tip, [-0.05 * k, -0.03 * k, 0]), 0.05 * k, pad, {
      flat: 2.4,
      blunt: 0.75,
      steps: 3,
      segments: 7,
    });
  });
  hallux(leg, { length: 0.9, girth: 0.8, claw });
}

/** Foot types share the foot, toe and hallux bones, so every leg shape and pose accepts them. */
export const dragonFeet = [
  { id: "raptor", label: "Raptor talons", build: raptor },
  { id: "eagle", label: "Eagle grip", build: eagle, hide: (leg) => ({ tarsus: 0.64, color: eagleColor(leg) }) },
  { id: "heavy", label: "Heavy pads", build: heavy, hide: () => ({ tarsus: 1.5 }) },
  { id: "webbed", label: "Webbed", build: webbed, hide: () => ({ tarsus: 0.95 }) },
  { id: "sickle", label: "Sickle claw", build: sickle, hide: () => ({ tarsus: 1.05 }) },
  { id: "perching", label: "Perching grip", build: perching },
  { id: "gecko", label: "Gecko pads", build: gecko, hide: () => ({ tarsus: 0.9 }) },
];
