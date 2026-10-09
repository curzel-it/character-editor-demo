import { escapeHtml } from "../escapeHtml.js";
import { ageOf } from "../dragonAge.js";
import { t } from "../i18n.js";
import { careNeeds, needValue } from "../stable/care.js";
import { formatDuration } from "./formatDuration.js";
import { leagueForAge } from "../stable/leagues.js";
import { gameDate } from "./stableView.js";
import { summariseAway } from "../stable/awaySummary.js";
import { icon } from "./icons.js";
import { eggHtml } from "./eggArt.js";
import { needLook } from "./careLook.js";
import { needName } from "./careNames.js";
import { careMood } from "./mood.js";
import { ordinal } from "../ordinal.js";
import { leagueName } from "./leagueLook.js";
import { racePath } from "./findLeagueRace.js";
import { playUi } from "../sound/uiSounds.js";

/** How an away entry reads, as plain text: its title, detail, badge icon and colour, and the screen it opens. */
function lookOf(entry, stable) {
  const id = encodeURIComponent(entry.id);
  if (entry.type === "ready") {
    const egg = stable.eggs.find((e) => e.id === entry.id);
    return { egg, title: t("awaySheet.eggReady"), detail: egg.parents ? egg.parents.map((p) => p.name).join(" × ") : t("awaySheet.giftEgg"), badge: "sparkle", color: "var(--dz-success)", href: `#/stable/${id}` };
  }
  const w = stable.dragons.find((x) => x.id === entry.id);
  const { name } = w;
  if (entry.type === "raced") {
    const { place } = stable.leagues[entry.league].races[entry.race].results.find((r) => r.id === entry.id);
    const detail = t("awaySheet.racedDetail", { league: leagueName(entry.league), race: entry.race + 1 });
    return { w, title: t("awaySheet.raced", { name, place: ordinal(place) }), detail, badge: "flagFinish", color: "var(--dz-accent)", href: `#/results/${racePath(entry.league, entry.season, entry.race)}` };
  }
  const league = leagueForAge(w.age);
  if (entry.type === "care") {
    const need = careNeeds.find((n) => n.id === entry.need);
    const detail = t("awaySheet.careDetail", { mood: careMood(w).text, need: needName(need.id), value: Math.round(needValue(w, need.id)) });
    return { w, title: t("awaySheet.needsYou", { name }), detail, badge: needLook[need.id].icon, color: "var(--dz-warning)", href: `#/stable/${id}` };
  }
  if (entry.type === "evolve")
    return {
      w,
      title: t("awaySheet.readyToEvolve", { name }),
      detail: t(`awaySheet.evolveInto.${ageOf(entry.age).id}`),
      badge: "sparkle",
      color: "var(--dz-accent)",
      href: `#/stable/${id}`,
    };
  if (entry.type === "arrived")
    return { w, title: t("awaySheet.arrived", { name }), detail: t("awaySheet.arrivedDetail"), badge: "home", color: "var(--dz-secondary)", href: `#/stable/${id}` };
  if (entry.type === "woke")
    return { w, title: t("awaySheet.woke", { name }), detail: t("awaySheet.wokeDetail"), badge: "moon", color: "var(--dz-info)", href: `#/stable/${id}` };
  const detail = league ? t("awaySheet.fitFor", { league: league.label }) : t("awaySheet.fitToRace");
  if (entry.type === "healed") return { w, title: t("awaySheet.healed", { name }), detail, badge: "heart", color: "var(--dz-primary)", href: `#/stable/${id}/profile` };
  return { w, title: t("awaySheet.rested", { name }), detail, badge: "bedColor", color: "var(--dz-info)", href: league ? `#/league/${league.id}/entry/${id}` : `#/stable/${id}/profile` };
}

/**
 * The While you were away sheet, over the Stable home: what happened since the last visit, each
 * entry a way to the screen that deals with it. `open(visit)` shows the given visit, or the last
 * one when there is none and it is not already showing; `close()` hides it. A visit with nothing to show never opens it.
 */
export function createAwaySheet(ctx) {
  const el = document.createElement("div");
  el.className = "away";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "away-title");
  let last = null;

  function render() {
    const { stable } = ctx.game;
    const style = ctx.style();
    const items = summariseAway(stable, last.events).map((entry) => ({ entry, look: lookOf(entry, stable) }));
    const sub = t("awaySheet.wentBy", { time: formatDuration(Math.round(last.gameAway / 60_000) * 60_000), date: gameDate(stable.clock.game) });
    el.innerHTML = `
      <button type="button" class="away__scrim" data-close aria-label="${t("awaySheet.close")}" tabindex="-1"></button>
      <div class="away__sheet dz-card dz-card--parchment">
        <header class="away__head">
          <span class="dz-plate__icon">${icon("clock")}</span>
          <span class="away__heading">
            <span class="away__title" id="away-title">${t("awaySheet.title")}</span>
            <span class="away__sub">${sub}</span>
          </span>
          <button type="button" class="dz-square dz-square--light away__close" data-close aria-label="${t("awaySheet.close")}">${icon("close")}</button>
        </header>
        <ul class="away__list">${items
          .map(
            ({ entry, look }) => `<li><a class="away__item" href="${look.href}" data-go style="--c:${look.color}">
              <span class="away__art">${look.egg ? eggHtml(ctx.module.genes, look.egg, style, "egg-art--away") : `<canvas width="${ctx.thumbs.width}" height="${ctx.thumbs.height}" data-id="${escapeHtml(entry.id)}"></canvas>`}
                <span class="away__badge">${icon(look.badge)}</span></span>
              <span class="away__text"><span class="away__line">${escapeHtml(look.title)}</span><span class="away__detail">${escapeHtml(look.detail)}</span></span>
              ${icon("chevronRight")}
            </a></li>`,
          )
          .join("")}</ul>
        <button type="button" class="dz-btn dz-btn--primary dz-btn--block" data-close><span class="dz-btn__label">${t("awaySheet.back")}</span></button>
      </div>`;
    for (const canvas of el.querySelectorAll("canvas[data-id]")) {
      const w = stable.dragons.find((x) => x.id === canvas.dataset.id);
      if (w) ctx.thumbs.draw(canvas, w, style);
    }
  }

  el.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) {
      e.preventDefault();
      return location.replace(go.getAttribute("href"));
    }
    if (e.target.closest("[data-close]")) location.replace("#/stable");
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.hidden) location.replace("#/stable");
  });

  return {
    el,
    /** @param {import("./awayLog.js").Visit} [visit] */
    open(visit) {
      if (!visit && !el.hidden) return;
      if (visit) last = visit;
      render();
      if (el.hidden) playUi("open");
      el.hidden = false;
      el.querySelector(".away__close").focus({ preventScroll: true });
    },
    close() {
      el.hidden = true;
    },
    /** Whether `visit`, or the last one, has anything to show. */
    worthShowing: (visit = last) => Boolean(visit) && summariseAway(ctx.game.stable, visit.events).length > 0,
  };
}
