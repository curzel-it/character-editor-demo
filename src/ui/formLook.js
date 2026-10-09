import { leagueForAge, nextRaceCard, seasonOver } from "../stable/leagues.js";
import { raceDayForm } from "../stable/raceDayForm.js";
import { escapeHtml } from "../escapeHtml.js";
import { t } from "../i18n.js";

const colors = { perfect: "var(--dz-success)", off: "var(--dz-warning)" };

/** The shape `dragon` is in at game time `now` for its league's next race, or null without one to enter. */
export function nextForm(stable, dragon, now) {
  const season = stable.leagues?.[leagueForAge(dragon.age)?.id];
  return season && !seasonOver(season) ? raceDayForm(stable, nextRaceCard(season).raceSeed, dragon.id, now) : null;
}

/** A tag for a form out of the usual that explains itself when tapped (see `installInfoTips`), or nothing. */
export const formTagHtml = (form) =>
  colors[form]
    ? `<button type="button" class="dz-tag form-tag" data-form="${form}" data-info="${escapeHtml(t(`formLook.info.${form}`))}" aria-expanded="false" style="--c:${colors[form]}">${escapeHtml(t(`formLook.${form}`))}</button>`
    : "";

/** "Vex is in perfect shape today", or null for a usual day. */
export const formLine = (form, name) => (colors[form] ? t(`formLook.line.${form}`, { name }) : null);
