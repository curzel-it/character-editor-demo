import { sub } from "../vec3.js";

const STEPS = 400,
  SPACING = 16,
  BEAD = 5,
  HEX = 0;

/**
 * An aimed throw's `arc` dotted onto the billboards `out` for its first `end` seconds, the dots evenly
 * spaced on screen in `view` and fading along it, with a ring where it ends; `time` turns the ring.
 * @param {{ at: (t: number) => number[] }} arc
 */
export function drawAimTrace(out, view, arc, end, time) {
  let last = view.project(arc.at(0));
  for (let i = 1; i <= STEPS; i++) {
    const at = arc.at((i / STEPS) * end);
    const seen = view.project(at);
    if (!seen.front || Math.hypot(seen.x - last.x, seen.y - last.y) < SPACING) continue;
    last = seen;
    out.quad(at, at, 0.007 * Math.hypot(...sub(at, view.eye)), [1, 1, 1, 0.95 - 0.45 * (i / STEPS), 0.15], BEAD, 0);
  }
  const land = arc.at(end);
  out.quad(land, land, 0.02 * Math.hypot(...sub(land, view.eye)), [1, 1, 1, 0.5, 0.3], HEX, time * 2);
}
