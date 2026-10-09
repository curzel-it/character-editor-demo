import { escapeHtml } from "../../escapeHtml.js";
import { racePath } from "../findLeagueRace.js";
import { unfitReason } from "../../stable/condition.js";
import { slumbering } from "../../stable/soulAltar.js";
import { leagueOf, nextRaceCard, points, rivalCount, seasonLength } from "../../stable/leagues.js";
import { liveRaceOf, startNextSeason } from "../../stable/leagueRace.js";
import { divisionAfter, promotionPlaces, relegationPlaces } from "../../stable/divisions.js";
import { seasonEnd, zonedStandings } from "../../stable/seasonEnd.js";
import { icon } from "../icons.js";
import { championTitle, outcomeText, prizeStarsText } from "../seasonOutcome.js";
import { standingsListHtml } from "../standingsList.js";
import { infoTipHtml } from "../infoTip.js";
import { t } from "../../i18n.js";
import { ageNoun, courseLabel, divisionLook, divisionName, divisionTagHtml, leagueLook, leagueName, lockedText, placingsText, seasonBeginsText } from "../leagueLook.js";
import { leagueSummary, ownedPlacings } from "../leagueSummary.js";

/** Who goes up and down this season, for the next race's card and the standings. */
function zonesText(divisionId) {
  const up = divisionAfter(divisionId, "promote"),
    down = divisionAfter(divisionId, "relegate");
  const shape = `${up !== divisionId ? "up" : "champion"}${down !== divisionId ? "Down" : ""}`;
  return t(`leagueDetailScreen.zones.${shape}`, { up: promotionPlaces, down: relegationPlaces, upTo: divisionName(up), downTo: divisionName(down), division: divisionName(divisionId) });
}

const standingsInfo = () => t("leagueDetailScreen.standingsInfo", { points: points.join("-"), races: seasonLength, up: promotionPlaces, down: relegationPlaces });

/**
 * One league: the season's division, the next race and a way to enter it, the season's points
 * table with the owner's dragons highlighted and the promotion and relegation zones marked, and
 * the races run so far with their results and replays. At the end of a season it shows the
 * champion, the owner's promotion or relegation and starts the next season in the new division.
 */
export function createLeagueDetailScreen(ctx) {
  const { module, game } = ctx;
  const el = document.createElement("section");
  el.className = "screen league-detail";
  let leagueId = "kids",
    key = "";

  function nextHtml(s) {
    const { league, season } = s;
    if (s.over) {
      const end = season.end ?? seasonEnd(season, game.now());
      return `<div class="dz-card dz-card--parchment league-next league-next--over">
        <span class="league-next__eyebrow">${t("leagueDetailScreen.seasonComplete", { number: season.number })}</span>
        <div class="champion">${icon("crown")}<span><small>${championTitle(end)}</small><b>${escapeHtml(end.champion?.name ?? t("leagueDetailScreen.noChampion"))}</b></span></div>
        <p class="league-outcome" data-outcome="${end.outcome}">${outcomeText(end)}</p>
        ${end.trophy ? `<p class="dz-caption">${t("leagueDetailScreen.trophyYours")}</p>` : ""}
        ${end.prize?.egg ? `<p class="dz-caption">${t("leagueDetailScreen.prizeEgg", { count: end.prize.stars, stars: prizeStarsText(end.prize.stars) })}</p>` : ""}
        <a class="dz-btn dz-btn--feature dz-btn--block" href="#/ceremony/${league.id}/${season.number}">${icon("crown")}<span class="dz-btn__label">${t("leagueDetailScreen.ceremony")}</span></a>
        <button type="button" class="dz-btn dz-btn--primary dz-btn--block" data-next-season><span class="dz-btn__label">${t("leagueDetailScreen.nextSeason", { number: season.number + 1, division: divisionName(end.next) })}</span></button>
      </div>`;
    }
    const card = nextRaceCard(season);
    const ready = s.locked ? "" : t("leagueDetailScreen.ready", { ready: s.eligible, count: s.members, age: ageNoun(league.age), ages: ageNoun(league.age, s.members) });
    return `<div class="dz-card dz-card--parchment league-next">
      <span class="league-next__eyebrow">${t("leagueDetailScreen.nextRace")}</span>
      <div class="league-next__head">
        <b>${t("leagueDetailScreen.raceOf", { number: card.index + 1, of: s.seasonLength })}</b>
        <span class="dz-tag" style="--c:${card.courseType === "canyon" ? "var(--dz-warning)" : "var(--dz-success)"}">${icon("mountain")} ${courseLabel(card.courseType)}</span>
      </div>
      <p class="dz-caption">${t("leagueDetailScreen.rivals", { count: rivalCount, division: divisionName(season.division) })} ${zonesText(season.division)} ${ready}</p>
      ${
        liveRaceOf(game.stable, league.id)
          ? `<a class="dz-btn dz-btn--primary dz-btn--block" href="#/live/${league.id}">${icon("playCircle")}<span class="dz-btn__label">${t("leagueDetailScreen.backToRace")}</span></a>`
          : s.locked
            ? `<p class="league-next__locked">${icon("lock")}<span>${escapeHtml(lockedText(game.stable, league.id))}</span></p>`
            : `<a class="dz-btn dz-btn--primary dz-btn--block" href="#/league/${league.id}/entry">${icon("race")}<span class="dz-btn__label">${t("leagueDetailScreen.enterRace")}</span></a>`
      }
    </div>`;
  }

  function standingsHtml(s) {
    const table = zonedStandings(s.season);
    if (!table.length) return `<p class="dz-caption">${t("leagueDetailScreen.noRacesYet", { points: points.join(" · ") })} ${zonesText(s.season.division)}</p>`;
    return `${standingsListHtml(table)}
      <p class="dz-caption standings__zones">${zonesText(s.season.division)}</p>`;
  }

  const winnerHtml = (winner) => `${icon("crown")} ${escapeHtml(winner?.name ?? "")}${winner?.owned ? ` ${t("leagueDetailScreen.yours")}` : ""}`;

  function racesHtml(s) {
    const races = [...s.season.races].reverse();
    if (!races.length) return `<p class="dz-caption">${t("leagueDetailScreen.racesEmpty")}</p>`;
    return `<ol class="season-races">${races
      .map((race) => {
        const winner = race.results.find((r) => r.place === 1);
        const mine = ownedPlacings(race);
        const path = racePath(s.league.id, s.season.number, race.index);
        return `<li class="season-race">
          <div class="season-race__text">
            <b>${t("leagueDetailScreen.raceTitle", { number: race.index + 1, course: courseLabel(race.field.courseType) })}</b>
            <span>${winnerHtml(winner)}</span>
            ${mine.length ? `<small>${escapeHtml(t("leagueDetailScreen.yourPlacings", { placings: placingsText(mine) }))}</small>` : ""}
          </div>
          <div class="season-race__links">
            <a class="dz-btn dz-btn--surface dz-btn--sm" href="#/results/${path}"><span class="dz-btn__label">${t("leagueDetailScreen.results")}</span></a>
            <a class="dz-btn dz-btn--info dz-btn--sm" href="#/broadcast/${path}" aria-label="${t("leagueDetailScreen.watchLabel", { number: race.index + 1 })}">${icon("play")}<span class="dz-btn__label">${t("leagueDetailScreen.watch")}</span></a>
          </div>
        </li>`;
      })
      .join("")}</ol>`;
  }

  function pastHtml() {
    const ends = game.stable.seasons.filter((end) => end.league === leagueId);
    if (!ends.length) return "";
    return `<div class="dz-card dz-card--parchment league-section">
      <h2 class="league-section__title">${t("leagueDetailScreen.pastSeasons")}</h2>
      <ol class="season-races">${ends
        .map(
          (end) => `<li class="season-race" style="--c:${divisionLook[end.division].color}">
            <div class="season-race__text">
              <b>${t("leagueDetailScreen.pastTitle", { number: end.season, division: divisionName(end.division) })}</b>
              <span>${winnerHtml(end.champion)}</span>
              <small>${outcomeText(end)}</small>
            </div>
            <div class="season-race__links">
              <a class="dz-btn dz-btn--feature dz-btn--sm" href="#/ceremony/${leagueId}/${end.season}">${icon("crown")}<span class="dz-btn__label">${t("leagueDetailScreen.ceremonyShort")}</span></a>
            </div>
          </li>`,
        )
        .join("")}</ol>
    </div>`;
  }

  function render() {
    const s = leagueSummary(game.stable, leagueId);
    key = stateKey();
    el.style.setProperty("--league-c", leagueLook[leagueId].color);
    ctx.setTitle(leagueName(leagueId));
    el.innerHTML = `
      ${nextHtml(s)}
      <div class="dz-card dz-card--parchment league-section">
        <div class="league-section__row"><h2 class="league-section__title">${t("leagueDetailScreen.standings")}${infoTipHtml(standingsInfo(), t("leagueDetailScreen.standings"))}</h2>${divisionTagHtml(s.season.division)}</div>
        ${standingsHtml(s)}
      </div>
      <div class="dz-card dz-card--parchment league-section">
        <h2 class="league-section__title">${t("leagueDetailScreen.thisSeason")}</h2>
        ${racesHtml(s)}
      </div>
      ${pastHtml()}`;
  }

  const stateKey = () => `${game.stable.leagues[leagueId].number}:${game.stable.leagues[leagueId].races.length}:${game.stable.dragons.map((w) => `${w.id}:${w.age}:${Boolean(unfitReason(w) || slumbering(w, game.now()))}`).join()}`;

  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-next-season]")) {
      startNextSeason(game.stable, module.genes, leagueId);
      ctx.save();
      ctx.notify(seasonBeginsText(leagueId, game.stable.leagues[leagueId]));
      render();
    }
  });

  return {
    el,
    show({ params }) {
      if (!leagueOf(params.id)) return location.replace("#/race");
      leagueId = params.id;
      render();
    },
    hide() {},
    render,
    tick() {
      if (stateKey() !== key) render();
    },
  };
}
