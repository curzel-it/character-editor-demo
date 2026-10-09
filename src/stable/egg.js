import { makeGenome } from "../subjects.js";
import { inheritGenome } from "../genome/inheritGenome.js";
import { stageDurations } from "./lifeStages.js";

const minute = 60_000,
  hour = 60 * minute;
/** The most warms an egg takes; each skips `warmSkip` of incubation and adds `warmStars` at hatch. */
export const warmLimit = 4;
export const warmSkip = hour;
/** Game time between two warms of the same egg. */
export const warmCooldown = hour;
/** How long the gift egg incubates, short enough to hatch in the owner's first session. */
export const giftIncubation = 20 * minute;
export const warmStars = 0.125;
export const maxStars = 5;

/** Stars an altar egg hatches at: half its parents' average strength. */
export const headStart = (parents) => parents.reduce((sum, p) => sum + (p.strength ?? 1), 0) / parents.length / 2;

/**
 * A new egg; `parents` are two or more dragons (an altar egg) or omitted (the gift egg, a prize egg).
 * `incubationTime` is game time it takes to hatch: `stageDurations.egg`, or `giftIncubation` for the gift.
 * Each parent keeps its own parents for the family tree. `stars` is the strength it hatches at before
 * warms: the parents' head start, else 1.
 */
export const createEgg = (seed, now, parents = null, stars = parents ? headStart(parents) : 1, incubationTime = stageDurations.egg) => ({
  id: `egg-${seed}`,
  seed: String(seed),
  laidAt: now,
  incubation: 0,
  incubationTime,
  warms: 0,
  warmedAt: null,
  stars,
  parents:
    parents?.map(({ id, name, genome, generation, strength, parents: grand }) => ({ id, name, genome: { ...genome }, generation, strength, parents: grand?.map((g) => ({ id: g.id, name: g.name })) ?? null })) ?? null,
});

/** The one baby the egg holds, fixed by its seed and parents: a seeded genome, or a child of its parents. */
export function eggBaby(genes, egg) {
  if (!egg.parents) return { genome: makeGenome(genes, egg.seed), from: null };
  return inheritGenome(genes, egg.parents.map((p) => p.genome), egg.seed);
}

/** Game time the egg takes to hatch. */
export const incubationTime = (egg) => egg.incubationTime ?? stageDurations.egg;

export const eggReady = (egg) => egg.incubation >= incubationTime(egg);

/** Game time left until the egg is ready to hatch. */
export const timeToHatch = (egg) => Math.max(0, incubationTime(egg) - egg.incubation);

/** Share of the incubation done, 0..1. */
export const incubationProgress = (egg) => Math.min(1, egg.incubation / incubationTime(egg));

/** Incubates the egg by `dt` game ms; returns true when that makes it ready. */
export function incubate(egg, dt) {
  const was = eggReady(egg);
  egg.incubation = Math.min(incubationTime(egg), egg.incubation + dt);
  return !was && eggReady(egg);
}

/** The strength the egg hatches at: its stars plus its warms, at most `maxStars`. */
export const hatchStrength = (egg) => Math.min(maxStars, egg.stars + warmStars * egg.warms);

const cooledAt = (egg) => (egg.warmedAt ?? -Infinity) + warmCooldown;

/** Whether the egg can be warmed at `now`: `warmCooldown` after the last warm, `warmLimit` times, until it is ready. */
export const canWarm = (egg, now) => egg.warms < warmLimit && now >= cooledAt(egg) && !eggReady(egg);

/** Warms the egg at `now`, skipping `warmSkip` of its incubation; false when `canWarm` refuses. */
export function warmEgg(egg, now) {
  if (!canWarm(egg, now)) return false;
  egg.warms++;
  egg.warmedAt = now;
  incubate(egg, warmSkip);
  return true;
}

/** Game time until the egg can be warmed again: 0 when it can now, null when it never will. */
export function timeToWarm(egg, now) {
  if (egg.warms >= warmLimit || eggReady(egg)) return null;
  return Math.max(0, cooledAt(egg) - now);
}
