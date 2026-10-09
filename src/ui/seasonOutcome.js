import { escapeHtml } from "../escapeHtml.js";
import { ordinal } from "../ordinal.js";
import { topDivision } from "../stable/divisions.js";
import { locale, t } from "../i18n.js";
import { divisionName } from "./leagueLook.js";

/** What the owner's place means at the end of the season, from `seasonEnd`, as markup. */
export function outcomeText(end) {
  if (!end.owner) return t("seasonOutcome.noneRaced", { division: divisionName(end.division) });
  const vars = { place: ordinal(end.owner.rank) };
  if (end.outcome === "promoted") return t("seasonOutcome.promoted", { ...vars, division: divisionName(end.next) });
  if (end.outcome === "relegated") return t("seasonOutcome.relegated", { ...vars, division: divisionName(end.next) });
  return t("seasonOutcome.stayed", { ...vars, division: divisionName(end.division) });
}

/** A prize egg's stars as text, such as 1.25. */
export const prizeStarsText = (stars) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(stars);

/** The champion's title: `League champion` in the top division, else `Bronze champion` and so on. */
export const championTitle = (end) => (topDivision(end.division) ? t("seasonOutcome.leagueChampion") : t("seasonOutcome.divisionChampion", { division: divisionName(end.division) }));
