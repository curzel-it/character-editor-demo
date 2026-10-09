import { escapeHtml } from "../../escapeHtml.js";
import { ordinal } from "../../ordinal.js";
import { t } from "../../i18n.js";
import { racePath } from "../findLeagueRace.js";
import { leagues, nextRaceCard } from "../../stable/leagues.js";
import { entryBlock, liveRaceOf } from "../../stable/leagueRace.js";
import { unfitReason } from "../../stable/condition.js";
import { slumbering } from "../../stable/soulAltar.js";
import { gameDate } from "../stableView.js";
import { icon } from "../icons.js";
import { blockText } from "../blockText.js";
import { ageNoun, courseLabel, divisionName, divisionTagHtml, leagueEmblemHtml, leagueLook, leagueName, lockedText, placingsText } from "../leagueLook.js";
import { leagueSummary, recentRaces } from "../leagueSummary.js";

/** How many of the stable's latest races the tab lists; each league's page has the whole season. */
const recentCount = 5;

/**
 * The Race tab: a card for each league (Kids League, Teen League, Main Event) with its season's
 * division and progress, the owner's dragons of its age and a way into the next race, then the stable's latest
 * races with their results and replays. Each card carries the league's emblem over its dragon (a rival
 * of the season, greyed, when the stable has none of its age). A league without an owned dragon of its
 * age is locked: tapping it says why instead of opening it.
 */
export function createRacesScreen(ctx) {
  const { game } = ctx;
  const el = document.createElement("section");
  el.className = "screen races";
  let key = "";

  /** The dragon that fronts a league card: a fit one first. */
  const face = (age, leagueId) => {
    const members = game.stable.dragons.filter((w) => w.age === age);
    return members.find((w) => !entryBlock(game.stable, w, leagueId, game.now())) ?? members[0] ?? null;
  };

  /** The owner's dragons of a league's age, each with why it cannot race now, if it cannot. */
  function rosterHtml(league) {
    const members = game.stable.dragons.filter((w) => w.age === league.age);
    if (!members.length) return `<span class="league-card__roster is-empty">${t("racesScreen.noneOfAge", { age: ageNoun(league.age) })}</span>`;
    return `<span class="league-card__roster">${members
      .map((w) => {
        const block = entryBlock(game.stable, w, league.id, game.now());
        return `<span class="${block ? "is-blocked" : ""}">${escapeHtml(w.name)}${block ? ` <small>${escapeHtml(blockText(block).toLowerCase())}</small>` : ""}</span>`;
      })
      .join("")}</span>`;
  }

  /** The card's call to action: enter the next race, or open the page that starts the next season. */
  function actionHtml(s) {
    if (liveRaceOf(game.stable, s.league.id)) return `<a class="dz-btn dz-btn--primary dz-btn--sm league-card__action" href="#/live/${s.league.id}">${icon("playCircle")}<span class="dz-btn__label">${t("racesScreen.onAir")}</span></a>`;
    if (s.locked) return "";
    if (s.over) return `<a class="dz-btn dz-btn--primary dz-btn--sm league-card__action" href="#/league/${s.league.id}"><span class="dz-btn__label">${t("racesScreen.newSeason")}</span></a>`;
    return `<a class="dz-btn dz-btn--primary dz-btn--sm league-card__action" href="#/league/${s.league.id}/entry">${icon("race")}<span class="dz-btn__label">${t("racesScreen.enter")}</span></a>`;
  }

  function cardHtml(s) {
    const { league, season } = s;
    const dragon = face(league.age, league.id) ?? season.rivals[0];
    const best = s.bestPlace ? t(`racesScreen.best.${s.zone ?? "hold"}`, { place: ordinal(s.bestPlace) }) : t("racesScreen.noPoints");
    const next = s.over ? t("racesScreen.complete") : t("racesScreen.nextRace", { number: s.racesRun + 1, of: s.seasonLength, course: courseLabel(nextRaceCard(season).courseType) });
    return `<div class="dz-card league-card ${s.locked ? "is-locked" : ""}" style="--c:${leagueLook[league.id].color}" data-league="${league.id}">
      <span class="league-card__art">
        ${dragon ? `<canvas width="${ctx.portraits.width}" height="${ctx.portraits.height}" data-dragon="${escapeHtml(dragon.id)}"></canvas>` : ""}
        ${leagueEmblemHtml(league.id)}
        ${s.locked ? `<span class="league-card__padlock">${icon("lock")}</span>` : ""}
      </span>
      <span class="league-card__body">
        <a class="league-card__title" href="#/league/${league.id}">${escapeHtml(leagueName(league.id))}</a>
        ${rosterHtml(league)}
        ${s.locked ? `<span class="league-card__why" data-why hidden>${escapeHtml(lockedText(game.stable, league.id))}</span>` : ""}
        <span class="league-card__season">${divisionTagHtml(season.division)} ${t("racesScreen.season", { number: season.number, next })}</span>
        <span class="dz-progress dz-progress--light" style="--value:${(s.racesRun / s.seasonLength) * 100}"></span>
        <span class="league-card__meta">${s.locked ? `<b class="league-card__lock">${t("racesScreen.locked")}</b>` : `<b>${icon("crown")}${best}</b>`}${actionHtml(s)}</span>
      </span>
      <span class="league-card__go">${icon("chevronRight")}</span>
    </div>`;
  }

  function pastHtml({ league, season, race, placings }) {
    const path = racePath(league.id, season, race.index);
    const title = { league: leagueName(league.id), number: race.index + 1 };
    return `<li class="season-race" style="--c:${leagueLook[league.id].color}">
      <div class="season-race__text">
        <b>${escapeHtml(t("racesScreen.raceTitle", title))}</b>
        <span>${escapeHtml(placingsText(placings))}</span>
        <small>${escapeHtml(t("racesScreen.raceDetail", { season, division: divisionName(race.division), course: courseLabel(race.field.courseType), date: gameDate(race.at) }))}</small>
      </div>
      <div class="season-race__links">
        <a class="dz-btn dz-btn--surface dz-btn--sm" href="#/results/${path}"><span class="dz-btn__label">${t("racesScreen.results")}</span></a>
        <a class="dz-btn dz-btn--info dz-btn--sm" href="#/broadcast/${path}" aria-label="${escapeHtml(t("racesScreen.watchLabel", title))}">${icon("play")}<span class="dz-btn__label">${t("racesScreen.watch")}</span></a>
      </div>
    </li>`;
  }

  function render() {
    const summaries = leagues.map((l) => leagueSummary(game.stable, l.id));
    const past = recentRaces(game.stable);
    key = stateKey();
    el.innerHTML = `
      <div class="league-cards">${summaries.map(cardHtml).join("")}</div>
      <p class="dz-caption races__note">${t("racesScreen.note")}</p>
      <div class="dz-card dz-card--parchment league-section">
        <h2 class="league-section__title">${t("racesScreen.recent")}</h2>
        ${
          past.length
            ? `<ol class="season-races">${past.slice(0, recentCount).map(pastHtml).join("")}</ol>
              ${past.length > recentCount ? `<p class="dz-caption">${t("racesScreen.moreOnLeague")}</p>` : ""}`
            : `<p class="dz-caption">${t("racesScreen.empty")}</p>`
        }
      </div>`;
    const shown = [...game.stable.dragons, ...summaries.flatMap((s) => s.season.rivals)];
    for (const canvas of el.querySelectorAll("canvas[data-dragon]")) {
      const dragon = shown.find((w) => w.id === canvas.dataset.dragon);
      ctx.portraits.draw(canvas, dragon, ctx.style());
    }
  }

  /** A locked league's card says why instead of opening the league. */
  el.addEventListener("click", (e) => {
    const card = e.target.closest(".league-card.is-locked");
    if (!card) return;
    e.preventDefault();
    const why = card.querySelector("[data-why]");
    why.hidden = false;
    card.querySelector(".league-card__roster").hidden = true;
    card.classList.remove("is-nudged");
    void card.offsetWidth;
    card.classList.add("is-nudged");
  });

  const stateKey = () =>
    Object.values(game.stable.leagues).map((s) => `${s.number}:${s.races.length}`).join() +
    game.stable.dragons.map((w) => `${w.id}:${w.age}:${w.name}:${unfitReason(w)}:${slumbering(w, game.now())}`).join();

  return {
    el,
    show: render,
    hide() {},
    render,
    tick() {
      if (stateKey() !== key) render();
    },
    setStyle() {
      if (!el.hidden) render();
    },
  };
}
