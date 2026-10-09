import { part } from "./parts.js";
import { spike } from "./dragonShape.js";

const fin = ({ parts, skin }, s, side, id, [x, y], reach, radius, flat, lift = -0.3) => {
  const base = [x, y, s * side(x, y, -0.03)];
  spike(parts, id, "head", base, [x - 1.3 * reach, y + lift * reach, base[2] + s * 0.6 * reach], radius, skin, {
    flat,
    steps: 2,
    segments: 5,
  });
};

/**
 * What the round young head wears on its cheeks, picked by the head gene the kid will grow into:
 * `build(context, s, side)` adds one cheek on side `s`, `side(x, y, lift)` being the skull's half-width.
 */
export const dragonCheeks = [
  {
    id: "spurs",
    build: (context, s, side) =>
      [[-0.04, 0], [0.02, -0.12]].forEach(([x, y]) => fin(context, s, side, `cheek-spur-${s}-${x}`, [x, y], 0.1, 0.07, 2)),
  },
  { id: "fin", build: (context, s, side) => fin(context, s, side, `cheek-fin-${s}`, [-0.02, 0.01], 0.15, 0.08, 3, 1) },
  {
    id: "pads",
    build: ({ parts, skin }, s, side) => {
      const [x, y] = [0.03, -0.1];
      part(parts, `cheek-pad-${s}`, "head", "ellipsoid", [x, y, s * side(x, y, 0)], [0.08, 0.075, 0.06], skin, [0, 0, 0], { segments: 6 });
    },
  },
  {
    id: "thorns",
    build: (context, s, side) =>
      [[-0.07, -0.02], [0, -0.1], [0.07, -0.17]].forEach(([x, y], i) =>
        fin(context, s, side, `cheek-thorn-${s}-${i}`, [x, y], 0.05, 0.035, 1, -1),
      ),
  },
  { id: "bare", build: () => {} },
];
