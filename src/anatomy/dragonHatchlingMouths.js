import { tint } from "../palette.js";
import { spike, sweep } from "./dragonShape.js";

const JAW = [0.035, -0.19];

/** Height of the lip at `x`, where the teeth hang from it. */
const lipLine = (x) => -0.115 - 0.02 * Math.sin(Math.PI * Math.min(1, (0.595 - x) / 0.43));

const upper = ({ parts, horn }, s, side, id, x, length, radius, tip = (z) => 0.97 * z) => {
  const y = lipLine(x),
    z = side(x, y, -0.012);
  spike(parts, `${id}-${s}`, "head", [x, y + 0.02, s * z], [x - 0.012, y - length, s * tip(z)], radius, horn, { steps: 2, segments: 4 });
};

const row = (context, s, side, id, from, to, count, length, radius) => {
  for (let i = 0; i < count; i++)
    upper(context, s, side, `${id}-${i}`, from + ((to - from) * i) / (count - 1), length, radius);
};

/** A front fang whose tip leans in to rest against the rounded side of the lower jaw, `jaw(x)` its half-width. */
const fang = (context, s, side, jaw, x, length, radius) =>
  upper(context, s, side, "fang", x, length, radius, (z) => Math.max(0.6 * z, Math.min(0.97 * z, 0.75 * jaw(x - 0.012) + 0.5 * radius)));

/** A tusk rooted in the side of the lower jaw that curves out past the lip and up along the cheek. */
const tusk = ({ parts, horn }, s, side, jaw, x, length, radius) => {
  const y = lipLine(x),
    at = (dx, dy, z, r) => ({ p: [x + dx - JAW[0], y + dy - JAW[1], s * z], ry: r, rz: r });
  sweep(
    parts,
    `tusk-${s}`,
    "jaw",
    [
      at(0, -0.035, jaw(x) - 0.5 * radius, radius),
      at(0.003, 0, side(x, y, 0.2 * radius), 0.85 * radius),
      at(0, length / 2, side(x, y + length / 4, 0), 0.5 * radius),
      at(-0.008, length, side(x, y + length / 2, -0.01), 0.002),
    ],
    horn,
    { segments: 5 },
  );
};

const beak = ({ parts, horn }, s) => {
  if (s < 0) return;
  const keratin = tint(horn, 0.92);
  sweep(
    parts,
    "upper-beak",
    "head",
    [
      { p: [0.46, -0.06, 0], ry: 0.15, rz: 0.2 },
      { p: [0.58, -0.06, 0], ry: 0.13, rz: 0.15 },
      { p: [0.68, -0.09, 0], ry: 0.095, rz: 0.1 },
      { p: [0.75, -0.14, 0], ry: 0.055, rz: 0.055 },
      { p: [0.76, -0.2, 0], ry: 0.025, rz: 0.025 },
      { p: [0.73, -0.24, 0], ry: 0.003, rz: 0.003 },
    ],
    keratin,
    { segments: 8, under: tint(keratin, 0.8) },
  );
  sweep(
    parts,
    "lower-beak",
    "jaw",
    [
      { p: [0.34, 0.07, 0], ry: 0.085, rz: 0.17 },
      { p: [0.48, 0.08, 0], ry: 0.065, rz: 0.11 },
      { p: [0.6, 0.07, 0], ry: 0.035, rz: 0.05 },
      { p: [0.65, 0.06, 0], ry: 0.003, rz: 0.003 },
    ],
    keratin,
    { segments: 8, under: tint(keratin, 0.8) },
  );
};

/**
 * The young version of the mouth the kid will grow into, picked by the head gene: a few small teeth,
 * a little beak, short tusks, a row of needles or two front fangs. `build(context, s, side, jaw)` adds it
 * on side `s`, `side(x, y, lift)` being the skull's half-width and `jaw(x)` the lower jaw's.
 */
export const dragonHatchlingMouths = [
  { id: "toothed", build: (context, s, side) => row(context, s, side, "tooth", 0.3, 0.5, 3, 0.04, 0.02) },
  { id: "beaked", build: (context, s) => beak(context, s) },
  { id: "blunt", build: (context, s, side, jaw) => tusk(context, s, side, jaw, 0.42, 0.11, 0.034) },
  { id: "needle", build: (context, s, side) => row(context, s, side, "needle", 0.26, 0.54, 5, 0.035, 0.011) },
  { id: "viper", build: (context, s, side, jaw) => fang(context, s, side, jaw, 0.46, 0.1, 0.026) },
];
