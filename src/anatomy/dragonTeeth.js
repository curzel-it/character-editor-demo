import { sweep } from "./dragonShape.js";

/**
 * A row of teeth, one per entry of `teeth`: `x` along the jaw, `z` the root's half-width, `length`,
 * `rake` (share of the length the tip falls back along the jaw) and `splay` (share it leans out).
 * `y` is the gum line, `up` is 1 for teeth rising from the lower jaw and -1 for teeth hanging from
 * the upper one. The two sides are not mirror images: each side gets its own small wobble in
 * length, rake and spacing, so the rows read as grown rather than stamped.
 */
export function toothRow(parts, id, bone, s, y, up, teeth, color, { radius = 0.018, segments = 4 } = {}) {
  teeth.forEach(({ x, z, length, rake = 0.2, splay = 0 }, n) => {
    const wobble = Math.sin(n * 2.3 + s * 1.7),
      size = length * (1 + 0.14 * wobble),
      lean = rake + 0.08 * Math.sin(n * 3.1 - s * 0.9),
      root = [x + 0.006 * Math.sin(n * 1.9 + s * 2.2), y, s * z],
      at = (t, bend) => [root[0] - lean * size * bend, y + up * size * t, s * (z + splay * size * bend)];
    const thick = radius * Math.min(1.3, Math.max(0.7, size / 0.09));
    sweep(
      parts,
      `${id}-${s}-${n}`,
      bone,
      [
        { p: root, ry: thick, rz: thick },
        { p: at(0.6, 0.45), ry: thick * 0.6, rz: thick * 0.6 },
        { p: at(1, 1), ry: 0.001, rz: 0.001 },
      ],
      color,
      { segments },
    );
  });
}
