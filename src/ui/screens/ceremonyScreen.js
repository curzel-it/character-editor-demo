import { escapeHtml } from "../../escapeHtml.js";
import { ordinal } from "../../ordinal.js";
import { leagueOf, seasonOver } from "../../stable/leagues.js";
import { startNextSeason } from "../../stable/leagueRace.js";
import { findSeasonEnd } from "../../stable/seasonEnd.js";
import { medalOf } from "../../stable/honours.js";
import { icon } from "../icons.js";
import { createPodiumStage, trophyLands } from "../podiumStage.js";
import { championTitle, outcomeText, prizeStarsText } from "../seasonOutcome.js";
import { standingsListHtml } from "../standingsList.js";
import { honourIconHtml } from "../honoursLook.js";
import { divisionName, leagueLook, leagueName, seasonBeginsText } from "../leagueLook.js";
import { t } from "../../i18n.js";
import { playUi } from "../../sound/uiSounds.js";
import { playRace } from "../../sound/raceSounds.js";

/** The stamp over the scene once the cup is handed out, from the owner's side of the season. */
function stampText(end) {
  if (end.trophy) return t("ceremonyScreen.stamps.champions");
  if (end.owner?.rank === 1) return t("ceremonyScreen.stamps.divisionChamps", { division: divisionName(end.division) });
  if (end.outcome === "promoted") return t("ceremonyScreen.stamps.promoted");
  if (end.outcome === "relegated") return t("ceremonyScreen.stamps.relegated");
  if (end.owner && end.owner.rank <= 3) return t("ceremonyScreen.stamps.place", { place: ordinal(end.owner.rank) });
  return t("ceremonyScreen.stamps.over");
}

/** What the owner took home this season: the trophy, a medal for a place on the podium and its prize egg. */
function honoursHtml(end) {
  const owner = end.owner;
  const lines = [];
  if (end.trophy) lines.push(`<li class="honour">${honourIconHtml("trophy", "gold")}<span><b>${t("ceremonyScreen.trophy", { league: escapeHtml(leagueName(end.league)) })}</b><small>${t("ceremonyScreen.trophyDetail", { name: escapeHtml(end.trophy.name) })}</small></span></li>`);
  if (owner && owner.rank <= 3) {
    const medal = medalOf(owner.rank);
    lines.push(`<li class="honour">${honourIconHtml("medal", medal.id)}<span><b>${t("ceremonyScreen.medal", { place: ordinal(owner.rank) })}</b><small>${t("ceremonyScreen.medalDetail", { name: escapeHtml(owner.lead.name), place: ordinal(owner.rank), division: divisionName(end.division) })}</small></span></li>`);
  }
  if (end.prize) {
    const left = end.prize.left ? ` ${t("ceremonyScreen.prizeLeft", { name: escapeHtml(end.prize.left.name) })}` : "";
    lines.push(`<li class="honour"><span class="honour-icon">${icon("egg")}</span><span><b>${t("ceremonyScreen.prizeEgg")}</b><small>${t("ceremonyScreen.prizeDetail", { count: end.prize.stars, stars: prizeStarsText(end.prize.stars) })}${left}</small></span></li>`);
  }
  return lines.length ? `<ul class="honours ceremony__honours">${lines.join("")}</ul>` : "";
}

/**
 * The awards ceremony after the last race of a season: the podium scene with the top three and
 * their riders, the cup handed to the champion, the owner's promotion or relegation and what they
 * won (a prize egg with every podium place), the final standings, and Next season while that season still waits for it. It reads the
 * season's end from the league or, once the next season began, from the stable's history.
 */
export function createCeremonyScreen(ctx) {
  const { module, game } = ctx;
  const el = document.createElement("section");
  el.className = "screen ceremony";
  el.innerHTML = `
    <div class="ceremony__stage" data-stage>
      <div class="ceremony__tags" data-tags></div>
      <div class="ceremony__head" data-head>
        <button type="button" class="topbar__back" data-back aria-label="${t("app.back")}">${icon("chevronLeft")}</button>
        <h1 class="topbar__title">${t("ceremonyScreen.title")}</h1>
      </div>
      <div class="ceremony__stamp" data-stamp hidden></div>
    </div>
    <div class="ceremony__body" data-body></div>`;
  const $ = (selector) => el.querySelector(selector);
  let target = null,
    end = null,
    landed = false;

  const stage = createPodiumStage(module, {
    frameArea: () => {
      const box = stage.el.getBoundingClientRect();
      return { top: $("[data-head]").getBoundingClientRect().bottom - box.top + 116, bottom: box.height - 12 };
    },
    onFrame({ time, tags }) {
      const width = stage.el.clientWidth;
      for (const at of tags) {
        const tag = $(`[data-tag="${CSS.escape(at.id)}"]`);
        if (!tag) continue;
        tag.hidden = !at.visible;
        tag.style.transform = `translate(${Math.min(width - 60, Math.max(60, at.x))}px, ${at.y}px) translate(-50%, -25%)`;
      }
      if (!landed && time > trophyLands) {
        landed = true;
        $("[data-stamp]").hidden = false;
        if (time < trophyLands + 0.5) {
          playUi("fanfare");
          playRace("cheer");
        }
      }
    },
  });
  $("[data-stage]").prepend(stage.el);

  const pending = () => {
    const season = game.stable.leagues[target.leagueId];
    return season?.number === target.season && seasonOver(season);
  };

  function tagHtml(row) {
    const medal = medalOf(row.rank);
    return `<span class="ceremony__tag${row.owned ? " is-owned" : ""}" data-tag="${escapeHtml(row.id)}" hidden>
      <i class="ceremony__place" style="--metal:${medal ? `var(--dz-${medal.id})` : "var(--dz-surface)"}">${row.rank}</i>
      <span><b>${escapeHtml(row.lead.name)}</b><small>${row.owned ? t("ceremonyScreen.you") : escapeHtml(row.name)}</small></span>
    </span>`;
  }

  function render() {
    const league = leagueOf(target.leagueId);
    end = league && findSeasonEnd(game.stable, target.leagueId, target.season);
    if (!end) return location.replace(`#/league/${encodeURIComponent(target.leagueId)}`);
    el.style.setProperty("--league-c", leagueLook[league.id].color);
    const offPodium = end.owner && end.owner.rank > 3 ? [end.owner] : [];
    $("[data-tags]").innerHTML = [...end.podium, ...offPodium].filter((r) => r.look).map((r) => tagHtml(r)).join("");
    $("[data-stamp]").innerHTML = `<span class="dz-stamp ceremony__stamp-text" data-outcome="${end.outcome}">${escapeHtml(stampText(end))}</span>`;
    renderBody();
  }

  function renderBody() {
    const next = pending();
    $("[data-body]").innerHTML = `
      <div class="dz-card dz-card--parchment ceremony__card">
        <div class="champion">${icon("crown")}<span><small>${championTitle(end)}</small><b>${escapeHtml(end.champion?.name ?? t("ceremonyScreen.noChampion"))}</b></span></div>
        <p class="league-outcome" data-outcome="${end.outcome}">${outcomeText(end)}</p>
        ${honoursHtml(end)}
      </div>
      <div class="dz-card dz-card--parchment ceremony__card">
        <h2 class="league-section__title">${t("ceremonyScreen.finalStandings")}</h2>
        ${standingsListHtml(end.standings)}
      </div>
      <div class="ceremony__actions">
        ${next ? `<button type="button" class="dz-btn dz-btn--primary dz-btn--block" data-next-season><span class="dz-btn__label">${t("ceremonyScreen.nextSeason", { number: end.season + 1, division: divisionName(end.next) })}</span></button>` : ""}
        <button type="button" class="dz-btn dz-btn--surface dz-btn--block" data-replay>${icon("playCircle")}<span class="dz-btn__label">${t("ceremonyScreen.replay")}</span></button>
        <a class="dz-btn dz-btn--dark dz-btn--block" href="#/league/${encodeURIComponent(target.leagueId)}">${icon("league")}<span class="dz-btn__label">${t("ceremonyScreen.backToLeague")}</span></a>
      </div>`;
  }

  function play() {
    landed = false;
    $("[data-stamp]").hidden = true;
    stage.setCeremony({ podium: end.podium, owner: end.owner, division: end.division, seed: `${end.league}:${end.season}` });
    stage.show();
  }

  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-back]")) return ctx.back(`#/league/${encodeURIComponent(target.leagueId)}`);
    if (e.target.closest("[data-replay]")) {
      el.closest(".screens")?.scrollTo({ top: 0, behavior: "smooth" });
      return play();
    }
    if (e.target.closest("[data-next-season]") && pending()) {
      startNextSeason(game.stable, module.genes, target.leagueId);
      ctx.save();
      ctx.notify(seasonBeginsText(target.leagueId, game.stable.leagues[target.leagueId]));
      ctx.go(`#/league/${encodeURIComponent(target.leagueId)}`);
    }
  });

  return {
    el,
    /** The scene, for the evidence tools: `seek(seconds)`. */
    stage,
    show({ params }) {
      target = { leagueId: params.league, season: Number(params.season) };
      render();
      if (end) play();
    },
    hide() {
      stage.hide();
    },
    render() {
      if (end) renderBody();
    },
    tick() {},
    setStyle: (style) => stage.setStyle(style),
  };
}
