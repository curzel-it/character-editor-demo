import { warmEgg } from "./egg.js";
import { bestScore } from "./minigameResult.js";

/** Keeps `score` as the stable's best at minigame `id` when it beats it; true when it did. */
function keepBest(stable, id, score) {
  if (score <= bestScore(stable, id)) return false;
  stable.highscores = { ...stable.highscores, [id]: score };
  return true;
}

/**
 * Settles Warm played on `egg`: however little was played it warms the egg (`warmEgg`), and a
 * warm that beats the best score is kept as the new best.
 * @returns {{ warmed: boolean, record: boolean }}
 */
export function settleWarm(stable, egg, { id, score }, now) {
  const warmed = warmEgg(egg, now);
  const record = warmed && keepBest(stable, id, score);
  return { warmed, record };
}
