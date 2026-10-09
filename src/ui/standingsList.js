import { escapeHtml } from "../escapeHtml.js";
import { t } from "../i18n.js";

/** A points table (`zonedStandings` rows) with its head: place, stable, wins and points, owned rows highlighted and zones marked. */
export const standingsListHtml = (table) => `<div class="standings__head" aria-hidden="true"><span>#</span><span>${t("standingsList.stable")}</span><span>${t("standingsList.wins")}</span><span>${t("standingsList.points")}</span></div>
  <ol class="dz-list standings">${table
    .map(
      (r) => `<li class="dz-list__item ${r.owned ? "is-highlight" : ""}"${r.zone ? ` data-zone="${r.zone}"` : ""}><span class="dz-list__rank">${r.rank}</span>
        <span class="standings__name">${escapeHtml(r.name)}</span><span class="standings__wins">${r.wins}</span><b class="standings__points">${r.points}</b></li>`,
    )
    .join("")}</ol>`;
