import { createEgg } from "./egg.js";
import { divisionRank } from "./divisions.js";
import { onAirBlock } from "./onAir.js";
import { slotsFree } from "./stableSlots.js";
import { goWild } from "./wild.js";

/** Stars a prize egg hatches at, by division (weakest first) and podium place (3rd, 2nd, 1st). */
export const prizeStarsTable = [
  [1, 1.25, 1.5],
  [1.5, 1.75, 2],
  [2, 2.25, 2.5],
];

/** Stars of the prize egg for podium place `rank` (1..3) in `division`, or null off the podium. */
export const prizeStars = (division, rank) => (rank >= 1 && rank <= 3 ? prizeStarsTable[divisionRank(division)][3 - rank] : null);

/** The dragon that makes room for a prize egg in a full stable: the oldest one not on air, or null. */
export function oldestDragon(stable) {
  const free = stable.dragons.filter((w) => !onAirBlock(stable, w.id));
  return free.reduce((oldest, w) => (!oldest || w.hatchedAt < oldest.hatchedAt ? w : oldest), null);
}

/**
 * Lays the owner's prize egg for a season's `end` when its best dragon finished on the podium: a
 * fresh seeded genome hatching at `prizeStars`. A full stable makes room by sending its oldest
 * dragon to the wild. Returns `{ egg, stars, left }` (`left` the dragon that left, or null), or null
 * without a podium place or a slot to free.
 * @returns {{ egg: object, stars: number, left: { id: string, name: string } | null } | null}
 */
export function awardPrizeEgg(stable, end, now) {
  const stars = prizeStars(end.division, end.owner?.rank ?? 0);
  if (stars === null) return null;
  let left = null;
  if (!slotsFree(stable)) {
    const oldest = oldestDragon(stable);
    if (!oldest) return null;
    goWild(stable, oldest, now);
    left = { id: oldest.id, name: oldest.name };
  }
  const egg = createEgg(`${stable.seed}:prize:${end.league}:${end.season}`, now, null, stars);
  stable.eggs.push(egg);
  return { egg, stars, left };
}
