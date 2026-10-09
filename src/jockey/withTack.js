import { transform } from "../math3d.js";
import { partTouches } from "./hideProbe.js";
import { tackMount, clearOfTack } from "./tackMount.js";
import { trimColors } from "./tackColors.js";
import { harnessParts } from "./dragonHarness.js";
import { saddleParts } from "./dragonSaddle.js";
import { riderParts } from "./riderParts.js";

/** Seat-frame boxes kept clear of crests: [[x0, x1], [y0, y1], halfWidth]. */
const clearance = {
  rider: [[-0.6, 0.8], [-0.1, 1.3], 0.5],
  saddle: [[-0.65, 0.45], [-0.1, 0.5], 0.5],
  roller: [[-0.25, 0.25], [-0.1, 0.4], 0.5],
};

/**
 * Returns a new anatomy wearing the chosen tack; each layer is optional, so the dragon can fly naked,
 * in a harness alone, saddled, or ridden. A jockey needs a saddle, so `jockey` implies `saddle`; the
 * harness is independent of both. The anatomy gains `tack` ({ harness, saddle, jockey, bone, seat },
 * where `seat` is the model-space point on the saddle) and, with a rider, `jockey` ({ id, bone, saddle }).
 * Tack that would reach into an addon's `keepClear` zone is left off rather than clip through it.
 */
export function withTack(anatomy, { harness = false, saddle = false, jockey = null } = {}) {
  const saddled = Boolean(saddle || jockey);
  if (!harness && !saddled) return anatomy;
  const frame = tackMount(anatomy);
  const trim = trimColors(jockey);
  const zones = (anatomy.addons ?? []).flatMap((addon) => addon.keepClear ?? []);
  const clear = (part) =>
    !zones.length ||
    !partTouches(part, frame.bind, frame.index, transform(), (p) =>
      zones.some(({ center, radius }) => Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]) < radius),
    );
  const parts = [
    ...(harness ? harnessParts(frame, { trim, saddled }) : []),
    ...(saddled ? saddleParts(frame, { trim }) : []),
    ...(jockey ? riderParts(frame, jockey) : []),
  ].filter(clear);
  const kept = clearOfTack(frame, anatomy.parts, clearance[jockey ? "rider" : saddled ? "saddle" : "roller"]);
  const { bone } = frame.mount;
  return {
    ...anatomy,
    parts: [...kept, ...parts],
    tack: { harness, saddle: saddled, jockey: jockey ? jockey.seed : null, bone, seat: frame.saddle },
    ...(jockey ? { jockey: { id: jockey.seed, bone, saddle: frame.saddle } } : {}),
  };
}
