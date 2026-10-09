import { escapeHtml } from "../escapeHtml.js";
import { colorSetSwatches, colourName } from "../racerColors.js";
import { colourGenes, showsGene } from "../genome/dragon.js";
import { needValue, needsOf } from "../stable/care.js";
import { formatDuration } from "./formatDuration.js";
import { eggReady, hatchStrength, incubationProgress, timeToHatch, warmLimit } from "../stable/egg.js";
import { divisionName, leagueName } from "./leagueLook.js";
import { leavesEmpty, sendAwayQuestion } from "./wildLines.js";
import { icon } from "./icons.js";
import { meterRowHtml, updateMeterRow } from "./meterRow.js";
import { needLook } from "./careLook.js";
import { needName } from "./careNames.js";
import { moodOf } from "./mood.js";
import { statusRowHtml, updateStatusRow } from "./statusRows.js";
import { infoTipHtml } from "./infoTip.js";
import { starsHtml } from "./stars.js";
import { starsOf } from "../stable/strength.js";
import { language, locale, t } from "../i18n.js";
import { conditionRow, growthRow } from "./dragonStatus.js";
import { ageOf, canBreathe } from "../dragonAge.js";
import { breathElements, breathOf, matchup } from "../breath/breathElements.js";
import { breathLook } from "./breathLook.js";
import { findWild, onTheWay, sendToWild, timeToArrive, wildBlock } from "../stable/wild.js";
import { slumberLeft, slumbering } from "../stable/soulAltar.js";
import { parentChipsHtml } from "./parentChips.js";
import { honoursOf } from "../stable/honours.js";
import { medalRowHtml, trophyRowHtml } from "./honoursLook.js";
import { playUi } from "../sound/uiSounds.js";

const tabs = ["overview", "traits", "history"];

/** The element `element` lands on with `factor` (2 super effective). */
const against = (element, factor) => breathElements.find((e) => matchup(element.id, e.id) === factor).id;

const starsText = (stars) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 3 }).format(stars);

const incubationRow = (egg) =>
  eggReady(egg)
    ? { id: "incubation", label: t("profileSheet.readyToHatch"), value: "", progress: 100 }
    : { id: "incubation", label: t("profileSheet.hatchesIn", { time: formatDuration(timeToHatch(egg)) }), value: "", progress: incubationProgress(egg) * 100 };

/** Where the dragon is when not simply at home: in the wild, flying home or slumbering after a ritual, or null. */
function awayState(w, now) {
  if (w.wild && onTheWay(w))
    return { icon: "clock", title: t("profileSheet.onTheWayHome", { time: formatDuration(timeToArrive(w, now)) }), text: t("profileSheet.onTheWayText") };
  if (w.wild) return { icon: "mountain", title: t("profileSheet.inTheWild"), text: t("profileSheet.inTheWildText") };
  if (slumbering(w, now)) return { icon: "moon", title: t("profileSheet.slumbering", { time: formatDuration(slumberLeft(w, now)) }), text: t("profileSheet.slumberingText") };
  return null;
}

const awayHtml = (state) =>
  state ? `${icon(state.icon)}<span><b>${escapeHtml(state.title)}</b><small>${escapeHtml(state.text)}</small></span>` : "";

/**
 * The profile of the egg or dragon in view, a tabbed card rising over the Stable home: an egg's
 * incubation, warms and every parent of its ritual; a dragon (in the stable or the wild) shows
 * whether it is in the wild, flying home or slumbering, then its Overview (its mood and needs, growth and stars),
 * Traits (its breath, played in the yard from a button from the teen on, and its look) and History (its trophies and medals, record and races), with Send to the wild,
 * asked once and again when the stable would be left empty. Overview and Traits lead to the details page.
 * `onClose()` asks the stable to close it, `onLeft(dragon, flew)` follows a send to the wild (`flew`), `onBreathe(button)` plays the breath.
 */
export function createProfileSheet(ctx, { onClose, onLeft, onBreathe }) {
  const { module, game } = ctx;
  const el = document.createElement("div");
  el.className = "profile-sheet";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", t("profileSheet.label"));
  el.inert = true;
  let id = null,
    tab = "overview",
    /** How far the ask to send the dragon to the wild got, 1 or 2, or 0. */
    sending = 0,
    open = false;

  const findEgg = () => game.stable.eggs.find((e) => e.id === id) ?? null;
  const findDragon = () => game.stable.dragons.find((w) => w.id === id) ?? findWild(game.stable, id);
  function parentsHtml(parents) {
    return `<h3 class="profile__title">${t("profileSheet.parents")}</h3>${parentChipsHtml(game.stable, parents)}`;
  }

  function eggHtml(egg) {
    return `<div class="status">
        ${statusRowHtml(incubationRow(egg))}
        <div class="status__row"><span class="status__label">${t("profileSheet.warmed")}</span><span class="status__value" data-warmed></span>
          <span class="warm-pips" data-pips>${Array.from({ length: warmLimit }, () => `<i></i>`).join("")}</span></div>
        <div class="status__row"><span class="status__label" data-hatch-stars></span></div>
        <p class="dz-caption">${t("profileSheet.warmCaption", { limit: warmLimit })}</p>
      </div>
      ${egg.parents ? parentsHtml(egg.parents) : ""}`;
  }

  const detailsButton = (w) =>
    `<div class="profile__buttons profile__details"><a class="dz-btn dz-btn--dark dz-btn--sm" href="#/dragon/${encodeURIComponent(w.id)}/details"><span class="dz-btn__label">${t("profileSheet.details")}</span>${icon("chevronRight")}</a></div>`;

  /** The mood in a line, a chip per need of its age and, when it cannot race, why. */
  function nowHtml(w) {
    const mood = moodOf(w, "dragon", game.now(), game.stable);
    const chips = needsOf(w.age)
      .map((need) => `<span class="need-chip" aria-label="${escapeHtml(needName(need.id))} ${Math.round(needValue(w, need.id))}">${icon(needLook[need.id].icon)}<b>${Math.round(needValue(w, need.id))}</b></span>`)
      .join("");
    const condition = conditionRow(w, game.now());
    const detail = condition.tone === "happy" ? "" : [condition.label, condition.value].filter(Boolean).join(" · ");
    return `<div class="mood-line" data-tone="${mood.tone}">${icon(mood.icon)}<span>${escapeHtml(mood.text)}</span></div>
      <div class="need-chips">${chips}</div>${detail ? `<small class="mood-line__detail">${escapeHtml(detail)}</small>` : ""}`;
  }

  /** Growth towards the next age, as a meter row. */
  function ageRow(w) {
    const row = growthRow(w);
    return { id: "age", label: t(`dragonAge.${ageOf(w.age).id}`), info: t("profileSheet.growthInfo"), value: escapeHtml(row.label), progress: row.progress };
  }

  /** Stars as a meter row: whole stars, the one care is growing outlined, and how far along it is. */
  function starsRow(w) {
    const { stars, progress } = starsOf(w);
    const growing = stars < 5;
    return {
      id: "stars",
      label: t("profileSheet.stars"),
      info: t("profileSheet.starsInfo"),
      value: starsHtml(stars, growing ? stars + 1 : stars),
      progress: growing ? progress * 100 : 100,
      caption: t(growing ? "profileSheet.starsHow" : "profileSheet.starsTop"),
    };
  }

  function overviewTab(w) {
    return `<div class="now" data-now>${nowHtml(w)}</div>
      <div class="meter-rows">${meterRowHtml(ageRow(w))}${meterRowHtml(starsRow(w))}</div>
      ${detailsButton(w)}`;
  }

  function breathHtml(w) {
    const element = breathOf(w.genome);
    const look = breathLook[element.id];
    const elementLabel = t(`breathReveal.elements.${element.id}`);
    return `<ul class="trait-list">
        <li><span>${t("profileSheet.element")}</span><b>${escapeHtml(elementLabel)}</b></li>
        <li><span>${t("profileSheet.strongAgainst")}</span><b>${escapeHtml(t(`breathReveal.elements.${against(element, 2)}`))}</b></li>
        <li><span>${t("profileSheet.weakAgainst")}</span><b>${escapeHtml(t(`breathReveal.elements.${breathElements.find((e) => matchup(e.id, element.id) === 2).id}`))}</b></li>
      </ul>
      ${
        canBreathe(w.age) && slumbering(w, game.now())
          ? `<p class="dz-caption">${t("profileSheet.breathesWhenAwake")}</p>`
          : canBreathe(w.age)
            ? `<div class="profile__buttons"><button type="button" class="dz-btn dz-btn--${look.variant} dz-btn--sm" data-sheet-action="breathe">${icon(look.icon)}<span class="dz-btn__label">${escapeHtml(t("profileSheet.breatheButton", { element: elementLabel.toLocaleLowerCase(language()) }))}</span></button></div>`
            : `<p class="dz-caption">${t("profileSheet.breathesAsTeen")}</p>`
      }`;
  }

  function traitsTab(w) {
    const swatches = colorSetSwatches(w.genome);
    const parts = module.genes
      .filter((g) => g.choices && !colourGenes.includes(g.name) && g.name !== "breath" && showsGene(g, w.genome))
      .map((g) => `<li><span>${escapeHtml(g.label)}</span><b>${escapeHtml(g.choices[Math.floor(w.genome[g.name])])}</b></li>`)
      .join("");
    const colors = module.genes
      .filter((g) => colourGenes.includes(g.name))
      .map((g) => `<li><span><i class="swatch swatch--sm" style="background:${swatches[g.name]}"></i>${escapeHtml(g.label)}</span><b>${escapeHtml(colourName(g, w.genome))}</b></li>`)
      .join("");
    return `
      <h3 class="profile__title">${t("profileSheet.breath")}${canBreathe(w.age) ? infoTipHtml(t("profileSheet.breathInfo"), t("profileSheet.breath")) : ""}</h3>
      ${breathHtml(w)}
      <h3 class="profile__title">${t("profileSheet.look")}</h3>
      <ul class="trait-list">${parts}${colors}</ul>
      ${detailsButton(w)}`;
  }

  function honoursHtml(w) {
    const { trophies, medals } = honoursOf(game.stable, w.id);
    if (!trophies.length && !medals.length) return "";
    return `<h3 class="profile__title">${t("profileSheet.honours")}</h3>
      <ul class="honours profile__honours">${trophies.map((t) => trophyRowHtml(t)).join("")}${medals.map((m) => medalRowHtml(m)).join("")}</ul>`;
  }

  function historyTab(w) {
    const { starts, wins, podiums } = w.record;
    const races = w.history
      .map((h) => `<li class="dz-list__item ${h.place === 1 ? "is-highlight" : ""}"><span class="dz-list__rank">${h.place}</span><span>${t("profileSheet.of", { count: h.of })}</span><span>${escapeHtml(leagueName(h.league))}</span><span>${t("profileSheet.historyLine", { division: divisionName(h.division), season: h.season, race: h.race + 1 })}</span></li>`)
      .join("");
    return `<div class="record">
        <div><b>${starts}</b><span>${t("profileSheet.starts")}</span></div><div><b>${wins}</b><span>${t("profileSheet.wins")}</span></div><div><b>${podiums}</b><span>${t("profileSheet.podiums")}</span></div>
      </div>
      ${honoursHtml(w)}
      ${races ? `<ol class="dz-list history-list">${races}</ol>` : `<p class="dz-caption">${t("profileSheet.noRaces")}</p>`}
      ${w.wild ? "" : wildHtml(w)}`;
  }

  const tabBodies = { overview: overviewTab, traits: traitsTab, history: historyTab };

  function wildHtml(w) {
    if (wildBlock(game.stable, w.id)) return "";
    if (!sending)
      return `<div class="profile__release"><button type="button" class="dz-btn dz-btn--dark dz-btn--sm" data-sheet-action="wild"><span class="dz-btn__label">${t("profileSheet.sendToWild")}</span></button></div>
        <p class="dz-caption">${t("profileSheet.sendCaption")}</p>`;
    const empty = sending === 2;
    return `<div class="dz-card dz-card--parchment profile__release is-asking" role="alertdialog" aria-label="${t("profileSheet.sendToWild")}">
      <p>${empty ? t("profileSheet.reallySure") : escapeHtml(sendAwayQuestion(w)).replace(escapeHtml(w.name), `<b>${escapeHtml(w.name)}</b>`)}</p>
      <div class="profile__buttons">
        <button type="button" class="dz-btn ${empty ? "dz-btn--danger" : "dz-btn--dark"} dz-btn--sm" data-sheet-action="confirm-wild"><span class="dz-btn__label">${t(empty ? "profileSheet.yesSend" : "profileSheet.sendToWild")}</span></button>
        <button type="button" class="dz-btn dz-btn--surface dz-btn--sm" data-sheet-action="stay"><span class="dz-btn__label">${t("profileSheet.keep")}</span></button>
      </div>
    </div>`;
  }

  function render() {
    if (!open) return;
    const egg = findEgg(),
      w = egg ? null : findDragon();
    if (!egg && !w) return onClose();
    const scroll = el.querySelector("[data-body]")?.scrollTop ?? 0;
    const shown = egg ? ["egg"] : tabs;
    const current = egg ? "egg" : tab;
    el.innerHTML = `
      <div class="profile-sheet__tabs">
        <div class="profile-sheet__tablist" role="tablist" aria-label="${t("profileSheet.label")}">${shown
          .map((tab) => `<button type="button" class="profile-sheet__tab" role="tab" data-tab="${tab}" aria-selected="${tab === current}">${t(`profileSheet.tabs.${tab}`)}</button>`)
          .join("")}</div>
        <button type="button" class="profile-sheet__close" data-close aria-label="${t("profileSheet.close")}">${icon("close")}</button>
      </div>
      <div class="profile-sheet__card" role="tabpanel" data-body>${egg ? "" : `<div class="dz-card dz-card--parchment profile-away" data-away></div>`}${egg ? eggHtml(egg) : tabBodies[tab](w)}</div>`;
    el.querySelector("[data-body]").scrollTop = scroll;
    tick();
  }

  function tick() {
    if (!open) return;
    const egg = findEgg();
    if (egg) {
      updateStatusRow(el, incubationRow(egg));
      const warmed = el.querySelector("[data-warmed]");
      if (warmed) warmed.textContent = t("profileSheet.warmedValue", { warms: egg.warms, limit: warmLimit });
      const stars = el.querySelector("[data-hatch-stars]");
      if (stars) stars.textContent = t("profileSheet.hatchStars", { count: hatchStrength(egg), stars: starsText(hatchStrength(egg)) });
      el.querySelectorAll("[data-pips] i").forEach((pip, i) => pip.classList.toggle("is-on", i < egg.warms));
      return;
    }
    const w = findDragon();
    if (!w) return;
    const away = el.querySelector("[data-away]");
    if (away) {
      const state = awayState(w, game.now());
      away.hidden = !state;
      if (state) away.innerHTML = awayHtml(state);
    }
    const now = el.querySelector("[data-now]");
    if (now) now.innerHTML = nowHtml(w);
    updateMeterRow(el, ageRow(w));
    updateMeterRow(el, starsRow(w));
  }

  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return onClose();
    const tabButton = e.target.closest("[data-tab]");
    if (tabButton && tabButton.dataset.tab !== "egg") {
      tab = tabButton.dataset.tab;
      return render();
    }
    const button = e.target.closest("[data-sheet-action]");
    const action = button?.disabled ? null : button?.dataset.sheetAction;
    if (action === "breathe") return onBreathe?.(button);
    if (action === "wild" || action === "stay") {
      sending = action === "wild" ? 1 : 0;
      render();
    } else if (action === "confirm-wild") {
      if (sending === 1 && leavesEmpty(game.stable, id)) {
        sending = 2;
        return render();
      }
      sending = 0;
      const gone = sendToWild(game.stable, id, game.now());
      if (!gone) return render();
      ctx.save();
      ctx.notify(t("profileSheet.flewOff", { name: gone.name }));
      onLeft(gone, true);
    }
  });

  return {
    el,
    get isOpen() {
      return open;
    },
    /** Opens the sheet on the egg or dragon `itemId`, or re-renders it when already there. */
    open(itemId) {
      if (itemId !== id) {
        tab = "overview";
        sending = 0;
        el.querySelector("[data-body]")?.scrollTo(0, 0);
      }
      id = itemId;
      if (!open) playUi("open");
      open = true;
      el.inert = false;
      el.classList.add("is-open");
      render();
    },
    close() {
      if (open) playUi("close");
      open = false;
      el.inert = true;
      el.classList.remove("is-open");
    },
    render,
    tick,
  };
}
