import { feedItems } from "./items/feed.js";
import { playItems } from "./items/play.js";
import { cleanItems } from "./items/clean.js";
import { exerciseItems } from "./items/exercise.js";
import { groomItems } from "./items/groom.js";

const items = { ...feedItems, ...playItems, ...cleanItems, ...exerciseItems, ...groomItems };

/** The parts of keeper item `id` on the hand bone, held in a fist (`curl` and `thumb` near 0.75), or none. */
export const keeperItemParts = (id) => items[id]?.() ?? [];
