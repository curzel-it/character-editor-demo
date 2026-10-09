import { applyCare, needValue } from "./care.js";

/** The share of a need every minigame refills however little is played. */
export const minigameFloor = 0.3;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** The amount (0..1) of a need a minigame refills for its `progress` (0..1). */
export const minigameAmount = (progress) => minigameFloor + (1 - minigameFloor) * clamp01(progress);

/** The stable's best score at minigame `id`, 0 before the first. */
export const bestScore = (stable, id) => stable.highscores?.[id] ?? 0;

/**
 * Settles a minigame `id` played for care action `action` on `dragon`: a new best score is kept
 * and refills the need in full, any other refills it by `progress`.
 * @param {{ action: string, id: string, progress: number, score: number }} played
 * @returns {{ amount: number, record: boolean }}
 */
export function settleMinigame(stable, dragon, { action, id, progress, score }) {
  const record = score > bestScore(stable, id);
  if (record) stable.highscores = { ...stable.highscores, [id]: score };
  const amount = record ? 1 : minigameAmount(progress);
  applyCare(dragon, action, amount);
  return { amount, record };
}

/** What `dragon`'s `need` would read (0..100) after a minigame of care action `action` refilling `amount`. */
export function minigameNeed(dragon, action, amount, need) {
  const probe = { age: dragon.age, bond: dragon.bond, care: { ...dragon.care } };
  applyCare(probe, action, amount);
  return needValue(probe, need);
}
