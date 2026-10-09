import { maxShare, maxStars, statKeys, statLevels } from "./dragonBuild.js";
import { t } from "./i18n.js";

export { statKeys };

/**
 * Each racing stat of a genome at `strength` stars as `{ key, label, level, share, top }`: `share`
 * is the level against the largest a build reaches (0..1, a rare gene's bonus can fill it) and `top` the same build at 5 stars.
 * A kid's Breath is `off`, since it cannot breathe yet.
 */
export function statShares(genes, genome, strength, breathes = true) {
  const now = statLevels(genes, genome, strength),
    top = statLevels(genes, genome, maxStars);
  const full = maxStars * maxShare;
  return statKeys.map((key) => ({
    key,
    label: t(`statBars.${key}`),
    hint: t(`statBars.hints.${key}`),
    level: now[key],
    share: Math.min(1, now[key] / full),
    top: Math.min(1, top[key] / full),
    off: key === "breath" && !breathes,
  }));
}
