import { icons } from "./icons.js";
import { t } from "../i18n.js";
import { starsOf } from "../stable/strength.js";

/** Stars out of `max`: `count` filled, then up to `reachable` outlined (still to earn), the rest greyed. */
export const starsHtml = (count, reachable = count, max = 5) =>
  `<span class="dz-stars" role="img" aria-label="${t(reachable > count ? "stars.reach" : "stars.label", { count, max, reachable })}">${Array.from(
    { length: max },
    (_, i) => `<span class="dz-icon" data-star="${i + 1}">${icons[i < count ? "star" : i < reachable ? "starReach" : "starEmpty"]}</span>`,
  ).join("")}</span>`;

/** A dragon's stars: the whole ones filled and, with `reach`, the one care is growing outlined. */
export function dragonStarsHtml(dragon, reach = true) {
  const { stars } = starsOf(dragon);
  return starsHtml(stars, reach ? Math.min(5, stars + 1) : stars);
}
