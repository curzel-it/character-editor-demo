import { escapeHtml } from "../../escapeHtml.js";
import { ordinal } from "../../ordinal.js";
import { racerColors } from "../../racerColors.js";
import { points, seasonLength } from "../../stable/leagues.js";
import { zonedStandings } from "../../stable/seasonEnd.js";
import { icon } from "../icons.js";
import { statusRowHtml, updateStatusRow } from "../statusRows.js";
import { conditionRow } from "../dragonStatus.js";
import { findLeagueRace, racePath } from "../findLeagueRace.js";
import { outcomeText } from "../seasonOutcome.js";
import { language, t } from "../../i18n.js";
import { leagueName } from "../leagueLook.js";

const PHOTO_FINISH = 0.25;
/** Seconds with two decimals in the current language, such as `1.25` or `1,25`; `pad` keeps two whole digits. */
const seconds = (s, pad = false) => new Intl.NumberFormat(language(), { minimumIntegerDigits: pad ? 2 : 1, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(s);
const time = (s) => (s === null || s === undefined ? t("resultsScreen.dnf") : `${Math.floor(s / 60)}:${seconds(s % 60, true)}`);
const pointsOf = (place) => points[place - 1] ?? 0;

/**
 * A league race's results, every finisher with its dragon's portrait: the podium (a photo finish
 * when the first two were close), the order with times, gaps and points, what the race did to each owned dragon, and the season standings
 * after it with the promotion and relegation zones, the way to the awards ceremony after the
 * season's last race, then Watch again and Back to league.
 */
export function createResultsScreen(ctx) {
  const { game } = ctx;
  const el = document.createElement("section");
  el.className = "screen detail results-screen";
  let target = null;

  const dragonOf = (id) => game.stable.dragons.find((w) => w.id === id) ?? null;
  const portraitHtml = (id) => `<canvas width="${ctx.thumbs.width}" height="${ctx.thumbs.height}" data-portrait="${escapeHtml(id)}"></canvas>`;
  const conditionId = (id) => `condition-${id}`;

  function podiumHtml(results, colors) {
    const [first, second, third] = results;
    const close = first && second && first.time !== null && second.time !== null && second.time - first.time < PHOTO_FINISH;
    const step = (r, place) =>
      r
        ? `<li class="podium__step podium__step--${place}${r.owned ? " is-owned" : ""}">
            <span class="podium__portrait" style="--c:${colors.get(r.id)}">${portraitHtml(r.id)}</span>
            <b class="podium__name">${escapeHtml(r.name)}</b>
            <span class="podium__time">${time(r.time)}</span>
            <span class="podium__block">${ordinal(place)}</span>
          </li>`
        : "";
    return `<ol class="podium" aria-label="${t("resultsScreen.podium")}">${step(second, 2)}${step(first, 1)}${step(third, 3)}</ol>
      ${close ? `<p class="photo-finish"><span class="dz-tag" style="--c:var(--dz-accent)">${t("resultsScreen.photoFinish")}</span> ${t("resultsScreen.photoMargin", { name: escapeHtml(first.name), gap: seconds(second.time - first.time) })}</p>` : ""}`;
  }

  function orderHtml(results, colors) {
    const winner = results[0]?.time;
    return `<ol class="dz-list results-order">${results
      .map(
        (r) => `<li class="dz-list__item${r.owned ? " is-highlight" : ""}">
          <span class="dz-list__rank">${r.place}</span>
          <span class="results-order__name"><span class="results-order__thumb" style="--c:${colors.get(r.id)}">${portraitHtml(r.id)}</span><span>${escapeHtml(r.name)}${r.teamName ? `<small class="results-order__team">${escapeHtml(r.teamName)}</small>` : ""}</span></span>
          <span class="results-order__time">${time(r.time)}<small>${r.place === 1 || r.time === null || winner === null ? "" : t("resultsScreen.gap", { gap: seconds(r.time - winner) })}</small></span>
          <span class="results-order__points">+${pointsOf(r.place)}</span>
        </li>`,
      )
      .join("")}</ol>`;
  }

  function ownedHtml(results, now) {
    const ours = results.filter((r) => r.owned);
    if (!ours.length) return "";
    return `<div class="dz-card dz-card--parchment results-owned">
      <h3 class="results__subhead">${t("resultsScreen.yourDragons")}</h3>
      ${ours
        .map((r) => {
          const w = dragonOf(r.id);
          const head = `<span class="results-owned__place">${ordinal(r.place)}</span>
            <span class="results-owned__name">${escapeHtml(w?.name ?? r.name)}</span>
            <span class="results-owned__points">${t("resultsScreen.points", { count: pointsOf(r.place) })}</span>`;
          if (!w) return `<div class="results-owned__item"><div class="results-owned__head">${head}</div><p class="dz-caption">${t("resultsScreen.gone")}</p></div>`;
          const { starts, wins, podiums } = w.record;
          return `<div class="results-owned__item">
            <a class="results-owned__head" href="#/stable/${encodeURIComponent(w.id)}/profile">${head}${icon("chevronRight")}</a>
            ${statusRowHtml({ ...conditionRow(w, now), id: conditionId(w.id) })}
            <p class="results-owned__record">${t("resultsScreen.starts", { count: starts })} · ${t("resultsScreen.wins", { count: wins })} · ${t("resultsScreen.podiums", { count: podiums })}</p>
          </div>`;
        })
        .join("")}
    </div>`;
  }

  function standingsHtml(season, index) {
    const table = zonedStandings({ ...season, races: season.races.slice(0, index + 1) });
    const rows = table.filter((row, i) => i < 8 || row.owned);
    return `<div class="dz-card dz-card--parchment results-standings">
      <h3 class="results__subhead">${t("resultsScreen.standingsAfter", { number: index + 1, of: seasonLength })}</h3>
      <ol class="dz-list dz-list--compact results-standings__list">${rows
        .map(
          (row) => `<li class="dz-list__item${row.owned ? " is-highlight" : ""}"${row.zone ? ` data-zone="${row.zone}"` : ""}>
            <span class="dz-list__rank">${row.rank}</span>
            <span class="results-standings__row"><span>${escapeHtml(row.name)}</span><b>${row.points}</b></span>
          </li>`,
        )
        .join("")}</ol>
    </div>`;
  }

  /** After the season's last race, the way to its awards ceremony. */
  function ceremonyHtml(season, index) {
    if (index !== seasonLength - 1 || !season.end) return "";
    return `<div class="dz-card dz-card--parchment results-ceremony">
      <h3 class="results__subhead">${t("resultsScreen.seasonOver", { number: season.number })}</h3>
      <p class="league-outcome" data-outcome="${season.end.outcome}">${outcomeText(season.end)}</p>
      <a class="dz-btn dz-btn--feature dz-btn--block" href="#/ceremony/${encodeURIComponent(target.leagueId)}/${season.number}">${icon("crown")}<span class="dz-btn__label">${t("resultsScreen.ceremony")}</span></a>
    </div>`;
  }

  function render() {
    const found = target && findLeagueRace(game.stable, target.leagueId, target.season, target.index);
    if (!found) return location.replace(`#/league/${encodeURIComponent(target?.leagueId ?? "")}`);
    const { league, season, race } = found;
    const results = [...race.results].sort((a, b) => a.place - b.place);
    const colors = new Map(race.field.participants.map((p) => [p.id, racerColors(p.genome).color]));
    const best = results.find((r) => r.owned);
    const leagueHash = encodeURIComponent(target.leagueId);
    ctx.setTitle(t("resultsScreen.title", { league: leagueName(league.id), number: target.index + 1 }));
    el.innerHTML = `
      <div class="results-hero">
        <span class="dz-stamp results-hero__stamp">${best ? t("resultsScreen.stamp", { place: ordinal(best.place).toUpperCase() }) : t("resultsScreen.finish")}</span>
        ${podiumHtml(results, colors)}
      </div>
      <div class="dz-card dz-card--parchment results-card">
        <h3 class="results__subhead">${t("resultsScreen.order")}</h3>
        ${orderHtml(results, colors)}
      </div>
      ${ownedHtml(results, game.now())}
      ${standingsHtml(season, target.index)}
      ${ceremonyHtml(season, target.index)}
      <div class="actions results-actions" style="--n:2">
        <a class="dz-btn dz-btn--tile dz-btn--primary" href="#/broadcast/${racePath(target.leagueId, season.number, target.index)}">${icon("playCircle")}<span class="dz-btn__label">${t("resultsScreen.watchAgain")}</span></a>
        <a class="dz-btn dz-btn--tile dz-btn--dark" href="#/league/${leagueHash}">${icon("league")}<span class="dz-btn__label">${t("resultsScreen.backToLeague")}</span></a>
      </div>`;
    const field = new Map(race.field.participants.map((p) => [p.id, p]));
    for (const canvas of el.querySelectorAll("canvas[data-portrait]")) {
      const dragon = field.get(canvas.dataset.portrait);
      if (dragon) ctx.thumbs.draw(canvas, dragon, ctx.style());
    }
  }

  function tick() {
    const found = target && findLeagueRace(game.stable, target.leagueId, target.season, target.index);
    if (!found) return;
    for (const r of found.race.results) {
      const w = r.owned && dragonOf(r.id);
      if (w) updateStatusRow(el, { ...conditionRow(w, game.now()), id: conditionId(w.id) });
    }
  }

  return {
    el,
    show({ params }) {
      target = { leagueId: params.league, season: Number(params.season), index: Number(params.race) };
      render();
    },
    hide() {},
    render,
    tick,
    setStyle() {
      if (!el.hidden && target) render();
    },
  };
}
