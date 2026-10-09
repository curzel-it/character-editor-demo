import { tint } from "../palette.js";
import { add, spike, sweep } from "./dragonShape.js";

// A wing hand has six digits: three spars carry the membrane and three free fingers sit on
// `wing-hand-±1`, at the wrist, the leading-edge knuckle where the wing folds. The membrane lies
// behind (-X) and below it, so the fingers grow forward and up to stay clear through the stroke.

const ROOT = [0.06, 0.02, -0.03];

/** Three free fingers fanned forward straight from the wrist; `claw` is null or the claw's size, hook and girth. */
function fingers({ parts, s, hand, horn, ridge }, { reach, girth, rise = 0.015, curl = 0.09, spread = 0.11, color = ridge, knuckles = 0, claw }) {
  const root = [ROOT[0], ROOT[1], s * ROOT[2]];
  for (let n = 0; n < 3; n++) {
    const dz = s * (n - 1) * spread,
      length = reach * (1 - 0.14 * Math.abs(n - 1));
    const knuckle = add(root, [0.02, 0, dz * 0.3]);
    const bend = add(root, [0.64 * length, rise, dz * 1.4]);
    const end = add(root, [length, -curl, dz * 1.9]);
    const joint = girth * (1 + knuckles);
    sweep(
      parts,
      `wing-finger-${s}-${n}`,
      hand,
      [
        { p: add(root, [-0.1, -0.02, dz * 0.1]), ry: joint * 1.2, rz: joint * 1.2 },
        { p: knuckle, ry: joint, rz: joint },
        { p: add(knuckle, [0.32 * length, 0.4 * rise, dz * 0.25]), ry: girth * 0.85, rz: girth * 0.85 },
        { p: bend, ry: joint * 0.85, rz: joint * 0.85 },
        { p: add(bend, [0.18 * length, -0.4 * curl, dz * 0.2]), ry: girth * 0.7, rz: girth * 0.7 },
        { p: end, ry: (claw ? 0.65 : 0.45 + 0.4 * knuckles) * girth, rz: (claw ? 0.65 : 0.45 + 0.4 * knuckles) * girth },
      ],
      color,
      { segments: 5 },
    );
    if (claw)
      spike(parts, `wing-claw-${s}-${n}`, hand, end, add(end, [0.1 * claw.size * (1 - claw.hook), -claw.size, dz * 0.2]), claw.girth, horn, {
        bend: [0.35 * claw.size * claw.hook, 0.01, 0],
        blunt: claw.blunt ?? 0,
        steps: 3,
        segments: 5,
      });
  }
}

function claws(context) {
  fingers(context, { reach: 0.5, girth: 0.04, curl: 0.09, claw: { size: 0.17, hook: 1, girth: 0.03 } });
}

function long(context) {
  fingers(context, { reach: 0.74, girth: 0.032, rise: 0.06, curl: 0.13, spread: 0.13, knuckles: 0.2, claw: { size: 0.1, hook: 0.8, girth: 0.02 } });
}

function stubby(context) {
  fingers(context, { reach: 0.34, girth: 0.055, curl: 0.05, spread: 0.1, claw: { size: 0.09, hook: 0.3, girth: 0.042, blunt: 0.35 } });
}

function bony(context) {
  fingers(context, { reach: 0.56, girth: 0.03, rise: 0.04, curl: 0.06, spread: 0.12, knuckles: 0.6, color: tint(context.horn, 1.12) });
}

function spikes({ parts, s, hand, horn }) {
  [
    { tip: [0.56, 0.2, s * 0.16], radius: 0.06 },
    { tip: [0.62, 0.26, 0], radius: 0.07 },
    { tip: [0.54, 0.2, -s * 0.18], radius: 0.06 },
  ].forEach(({ tip, radius }, n) =>
    spike(parts, `wing-finger-${s}-${n}`, hand, [-0.02, 0.02, s * (n - 1) * -0.03], tip, radius, horn, { bend: [0, 0.06, 0] }),
  );
}

export const dragonWingFingers = [
  { id: "claws", label: "Hooked claws", build: claws },
  { id: "long", label: "Long fingers", build: long },
  { id: "stubby", label: "Stubby fingers", build: stubby },
  { id: "bony", label: "Bare bones", build: bony },
  { id: "spikes", label: "Spikes", build: spikes },
];
