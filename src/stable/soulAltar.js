import { makeRng } from "../rng.js";
import { createEgg } from "./egg.js";
import { unfitReason } from "./condition.js";
import { onAirBlock } from "./onAir.js";
import { slotsFree } from "./stableSlots.js";

const hour = 3_600_000;
export const minParents = 2;
export const maxParents = 6;
export const baseOdds = 0.36;
export const topOdds = 0.9;
export const successSlumber = 3 * hour;
export const failureSlumber = 1 * hour;

/** Chance, 0..1, that a ritual of `count` parents makes an egg: `baseOdds` for two, each extra parent adding less than the last, up to `topOdds` at `maxParents`. */
export const ritualOdds = (count) =>
  count < minParents ? 0 : baseOdds + (topOdds - baseOdds) * (Math.log(Math.min(count, maxParents) / minParents) / Math.log(maxParents / minParents));

export const slumbering = (w, now) => (w.slumberUntil ?? -Infinity) > now;

/** Game time until `w` wakes, 0 when awake. */
export const slumberLeft = (w, now) => Math.max(0, (w.slumberUntil ?? -Infinity) - now);

/** `slumbering` while `w` sleeps after a ritual, or null; a slumbering dragon cannot race. */
export const slumberBlock = (w, now) => (slumbering(w, now) ? "slumbering" : null);

/**
 * Why `parents` cannot hold a ritual now as a block code, with the parent's `name` and its own
 * block `reason` where they matter, or null when they can. A parent missing from `stable.dragons`
 * (in the wild, released) is unavailable.
 * @param {object} stable
 * @param {object[]} parents
 * @param {number} now
 */
export function ritualBlock(stable, parents, now) {
  const unique = new Set(parents.filter(Boolean));
  if (unique.size < minParents || unique.size !== parents.length) return "ritual.needTwo";
  for (const w of parents) {
    if (!stable.dragons.includes(w)) return { code: "ritual.notInStable", name: w.name };
    if (w.age !== "adult") return "ritual.adultsOnly";
    const unfit = onAirBlock(stable, w.id) ?? unfitReason(w);
    if (unfit) return { code: "ritual.unfit", name: w.name, reason: unfit };
    if (slumbering(w, now)) return { code: "ritual.slumbering", name: w.name };
  }
  if (!slotsFree(stable)) return "stableFull";
  return null;
}

/**
 * Holds a ritual of `parentIds`; its seed is stable for this stable and how many rituals it has held.
 * Every parent slumbers afterwards. Returns null when `ritualBlock` refuses.
 * @returns {{ success: boolean, egg: object | null, odds: number, seed: string } | null}
 */
export function performRitual(stable, genes, parentIds, now) {
  const parents = parentIds.map((id) => stable.dragons.find((w) => w.id === id));
  if (parents.some((w) => !w) || ritualBlock(stable, parents, now)) return null;
  stable.rituals = (stable.rituals ?? 0) + 1;
  const seed = `${stable.seed}:ritual:${stable.rituals}`;
  const odds = ritualOdds(parents.length);
  const success = makeRng(seed)() < odds;
  const egg = success ? createEgg(seed, now, parents) : null;
  if (egg) stable.eggs.push(egg);
  for (const w of parents) w.slumberUntil = now + (success ? successSlumber : failureSlumber);
  return { success, egg, odds, seed };
}
