import { escapeHtml } from "../../escapeHtml.js";
import { silksSwatch } from "../../jockey/jockeySilks.js";
import { fieldSize, leagueOf, leagues, nextRaceCard, raceField, seasonOver } from "../../stable/leagues.js";
import { entryBlock, liveRaceOf, ownerField, startLeagueRace } from "../../stable/leagueRace.js";
import { icon } from "../icons.js";
import { dragonStarsHtml } from "../stars.js";
import { conditionRow } from "../dragonStatus.js";
import { infoTipHtml } from "../infoTip.js";
import { t } from "../../i18n.js";
import { leagueLook, leagueName } from "../leagueLook.js";
import { favouriteOf } from "../leagueSummary.js";
import { raceForm } from "../../race/racerTraits.js";
import { raceDayForm } from "../../stable/raceDayForm.js";
import { formLine, formTagHtml } from "../formLook.js";

/**
 * Entering the next race of a league: pick the one owned dragon of its age the owner rides (the
 * unfit ones greyed with the reason; `#/league/<id>/entry/<dragon>` comes with that dragon picked, otherwise
 * the dragon selected in the stable or the first one ready is), see the field of eight in grid order with the favourite, and
 * start the race once one is picked; it goes on air live (`#/live/<league>`). While a race of the
 * league is on air the screen only offers to go back to it.
 */
export function createRaceEntryScreen(ctx) {
  const { module, game } = ctx;
  const el = document.createElement("section");
  el.className = "screen race-entry";
  /** @type {Map<string, string | null>} */
  const picked = new Map(leagues.map((l) => [l.id, null]));
  let leagueId = "kids",
    /** @type {string | null} */
    from = null,
    key = "";

  const season = () => game.stable.leagues[leagueId];
  const members = () => game.stable.dragons.filter((w) => w.age === leagueOf(leagueId).age);
  const pick = () => picked.get(leagueId);
  const pickedDragon = () => game.stable.dragons.find((w) => w.id === pick()) ?? null;

  const fit = (id) => {
    const dragon = members().find((w) => w.id === id);
    return Boolean(dragon) && !entryBlock(game.stable, dragon, leagueId, game.now());
  };

  /**
   * Keeps the pick while it can race. Without one it picks the dragon the owner came from (none when
   * that one cannot race, so its reason shows), else the dragon selected in the stable, else the first one ready.
   */
  function prune() {
    if (fit(pick())) return;
    const ready = members().find((w) => fit(w.id));
    const fallback = fit(ctx.selected()) ? ctx.selected() : ready?.id ?? null;
    picked.set(leagueId, members().some((w) => w.id === from) ? (fit(from) ? from : null) : fallback);
  }

  /** Fitness to race, such as `Tired, rested in 12m`. */
  function condText(w) {
    const cond = conditionRow(w, game.now());
    return [cond.label, cond.value].filter(Boolean).join(", ");
  }

  function pickHtml(w) {
    const block = entryBlock(game.stable, w, leagueId, game.now());
    const on = pick() === w.id;
    const cond = conditionRow(w, game.now());
    const rider = game.stable.owner;
    const form = formLine(raceDayForm(game.stable, nextRaceCard(season()).raceSeed, w.id, game.now()), w.name);
    return `<button type="button" class="entry-pick" role="radio" data-pick="${escapeHtml(w.id)}" aria-checked="${on}" ${block ? "disabled" : ""}>
      <span class="entry-pick__art"><canvas width="${ctx.thumbs.width}" height="${ctx.thumbs.height}"></canvas></span>
      <span class="entry-pick__text">
        <span class="entry-pick__name"><b>${escapeHtml(w.name)}</b>${dragonStarsHtml(w)}</span>
        <span class="entry-pick__rider"><i class="entry-pick__silks" style="background:${silksSwatch(rider.silks)}"></i>${escapeHtml(rider.name)}</span>
        <span class="entry-pick__cond" data-tone="${cond.tone}" data-cond="${escapeHtml(w.id)}">${escapeHtml(condText(w))}</span>
        ${form ? `<span class="entry-pick__form">${escapeHtml(form)}</span>` : ""}
      </span>
      <span class="entry-pick__check" aria-hidden="true"></span>
    </button>`;
  }

  function fieldHtml() {
    const dragon = pickedDragon();
    const field = dragon ? ownerField(game.stable, leagueId, dragon, game.now()) : raceField(season());
    const owned = new Set([pick()]);
    const favourite = favouriteOf(module.genes, field.participants);
    return `<ol class="dz-list entry-field">${field.participants
      .map(
        (p, i) => `<li class="dz-list__item ${owned.has(p.id) ? "is-highlight" : ""}"><span class="dz-list__rank">${i + 1}</span>
          <span class="entry-field__name">${escapeHtml(p.name)}</span>
          ${p === favourite ? `<span class="dz-tag entry-field__fav" style="--c:var(--dz-accent)">${t("raceEntryScreen.fav")}</span>` : ""}
          ${formTagHtml(p.form ?? raceForm(field.raceSeed, p.id))}
          ${dragonStarsHtml(p, false)}</li>`,
      )
      .join("")}</ol>`;
  }

  function render() {
    const league = leagueOf(leagueId);
    const s = season();
    const name = leagueName(leagueId);
    key = stateKey();
    el.style.setProperty("--league-c", leagueLook[leagueId].color);
    if (seasonOver(s)) {
      el.innerHTML = `<div class="dz-card dz-card--parchment league-section"><p>${t("raceEntryScreen.seasonOver", { number: s.number })}</p>
        <a class="dz-btn dz-btn--primary dz-btn--block" href="#/league/${league.id}"><span class="dz-btn__label">${escapeHtml(name)}</span></a></div>`;
      return;
    }
    const onAir = liveRaceOf(game.stable, leagueId);
    if (onAir) {
      const rider = game.stable.dragons.find((w) => w.id === onAir.dragon)?.name ?? onAir.field.participants.find((p) => p.id === onAir.dragon)?.name;
      el.innerHTML = `<div class="dz-card dz-card--parchment league-section"><p>${t("raceEntryScreen.onAir", { number: s.races.length + 1, name: escapeHtml(rider ?? t("raceEntryScreen.yourDragonLower")) })}</p>
        <a class="dz-btn dz-btn--primary dz-btn--block" href="#/live/${league.id}">${icon("playCircle")}<span class="dz-btn__label">${t("raceEntryScreen.backToRace")}</span></a></div>`;
      return;
    }
    prune();
    const mine = members().sort((a, b) => Boolean(entryBlock(game.stable, a, leagueId, game.now())) - Boolean(entryBlock(game.stable, b, leagueId, game.now())));
    const yours = t("raceEntryScreen.yourDragon");
    const action = pick() ? "start" : mine.some((w) => !entryBlock(game.stable, w, leagueId, game.now())) ? "pick" : mine.length ? "noneReady" : "noneToRide";
    el.innerHTML = `
      <div class="dz-card dz-card--parchment league-section">
        <div class="league-section__row"><h2 class="league-section__title">${yours}${infoTipHtml(t("raceEntryScreen.pickInfo"), yours)}</h2></div>
        ${
          mine.length
            ? `<div class="entry-picks" role="radiogroup" aria-label="${yours}">${mine.map(pickHtml).join("")}</div>`
            : `<p class="dz-caption">${t(`raceEntryScreen.noneOfAge.${league.age}`)}</p>`
        }
      </div>
      <div class="dz-card dz-card--parchment league-section">
        <div class="league-section__row"><h2 class="league-section__title">${t("raceEntryScreen.field")}${infoTipHtml(t("raceEntryScreen.fieldInfo"), t("raceEntryScreen.field"))}</h2><span class="dz-caption">${t("raceEntryScreen.starters", { count: pick() ? fieldSize : fieldSize - 1 })}</span></div>
        ${fieldHtml()}
      </div>
      <button type="button" class="dz-btn dz-btn--primary dz-btn--block entry-start" data-start ${!pick() ? "disabled" : ""}>${icon("flagFinish")}<span class="dz-btn__label">${t(`raceEntryScreen.actions.${action}`)}</span></button>
      <p class="dz-caption entry-note">${t("raceEntryScreen.autopilot")}</p>`;
    for (const canvas of el.querySelectorAll("[data-pick] canvas")) {
      const dragon = game.stable.dragons.find((w) => w.id === canvas.closest("[data-pick]").dataset.pick);
      ctx.thumbs.draw(canvas, dragon, ctx.style());
    }
  }

  const stateKey = () => `${leagueId}:${season().number}:${season().races.length}:${Boolean(season().live)}:${members().map((w) => `${w.id}:${Boolean(entryBlock(game.stable, w, leagueId, game.now()))}`).join()}`;

  function tick() {
    if (stateKey() !== key) return render();
    for (const w of members()) {
      const node = el.querySelector(`[data-cond="${CSS.escape(w.id)}"]`);
      if (node) node.textContent = condText(w);
    }
  }

  function choose(id) {
    picked.set(leagueId, id);
    render();
  }

  function start() {
    if (!pick()) return;
    const onAir = startLeagueRace(game.stable, leagueId, pick(), game.now());
    if (!onAir) return render();
    picked.set(leagueId, null);
    ctx.save();
    location.replace(`#/live/${encodeURIComponent(leagueId)}`);
  }

  el.addEventListener("click", (e) => {
    const button = e.target.closest("[data-pick]");
    if (button && !button.disabled) return choose(button.dataset.pick);
    if (e.target.closest("[data-start]")) start();
  });

  return {
    el,
    show({ params }) {
      if (!leagueOf(params.id)) return location.replace("#/race");
      leagueId = params.id;
      from = params.dragon ?? null;
      picked.set(leagueId, null);
      render();
    },
    hide() {},
    render,
    tick,
    setStyle() {
      if (!el.hidden) render();
    },
  };
}
