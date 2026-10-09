import { palette } from "../../palette.js";
import { keeperItemParts } from "../../keeper/keeperItems.js";
import { MEAT_AT } from "../../keeper/items/feed.js";

const hold = (id, parts, radius) => ({ id, bones: [{ id: "hand", position: [0, 0, 0] }], parts, height: radius, bounds: { center: [0, 0, 0], radius } });

/** The keeper's drumstick on its own, centred on its meat, to throw: posed by `bones.hand` like the hand that held it. */
export const meatAnatomy = hold(
  "feed-meat",
  keeperItemParts("drumstick").map((p) => ({ ...p, position: p.position.map((v, k) => v - MEAT_AT[k]) })),
  0.2,
);

/** A crumb of meat a metre across, to scale down with `bones.hand.scale`. */
export const crumbAnatomies = ["meat", "seared"].map((tone) =>
  hold(`feed-crumb-${tone}`, [{ id: `feed-crumb-${tone}`, bone: "hand", shape: "box", position: [0, 0, 0], rotation: [0, 0, 0], scale: [0.5, 0.4, 0.45], color: palette.careTools.feed[tone], segments: 4 }], 0.8),
);
