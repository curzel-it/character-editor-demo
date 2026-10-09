import { escapeHtml } from "../escapeHtml.js";
import { ordinal } from "../ordinal.js";
import { t } from "../i18n.js";
import { icon } from "./icons.js";
import { divisionName, leagueName } from "./leagueLook.js";

/** The colour token of each medal and of each division's cup. */
export const metalColor = { gold: "var(--dz-gold)", silver: "var(--dz-silver)", bronze: "var(--dz-bronze)" };

/** A medal or cup icon in its metal. @param {"medal" | "trophy"} kind */
export const honourIconHtml = (kind, metal) => `<span class="honour-icon" style="--metal:${metalColor[metal]}">${icon(kind)}</span>`;

/** An honour as a list row, headed by the dragon's name when `name` is set, else by the title. */
const rowHtml = (iconHtml, title, detail, dragon) =>
  `<li class="honour">${iconHtml}<span><b>${dragon ? escapeHtml(dragon) : title}</b><small>${dragon ? `${title} · ` : ""}${detail}</small></span></li>`;

/** A trophy as a list row: League champion, the league and the season. */
export const trophyRowHtml = (trophy, { name = false } = {}) =>
  rowHtml(
    honourIconHtml("trophy", trophy.division),
    t("honoursLook.leagueChampion"),
    t("honoursLook.trophyDetail", { league: escapeHtml(leagueName(trophy.league)), division: divisionName(trophy.division), season: trophy.season }),
    name && trophy.name,
  );

/** A medal as a list row: the place, the league, its division and the season. */
export const medalRowHtml = (m, { name = false } = {}) =>
  rowHtml(
    honourIconHtml("medal", m.medal),
    t("honoursLook.medalTitle", { place: ordinal(m.place), division: divisionName(m.division) }),
    t("honoursLook.medalDetail", { league: escapeHtml(leagueName(m.league)), season: m.season }),
    name && m.name,
  );

/** A dragon's best honour as a small badge with the count of all of them, or nothing. */
export function honourBadgeHtml(honours) {
  if (!honours.best) return "";
  const kind = honours.best === "trophy" ? "trophy" : "medal";
  const metal = honours.best === "trophy" ? "gold" : honours.best;
  return `<span class="honour-badge" title="${t("honoursLook.count", { count: honours.count })}">${honourIconHtml(kind, metal)}${honours.count > 1 ? `<b>${honours.count}</b>` : ""}</span>`;
}
