import { escapeHtml } from "../../escapeHtml.js";
import { formatDuration } from "../formatDuration.js";
import { timeToAdult } from "../../stable/lifeStages.js";
import { baseOdds, failureSlumber, maxParents, performRitual, ritualBlock, ritualOdds, successSlumber, topOdds } from "../../stable/soulAltar.js";
import { circleSize, joinState, ritualVerdict, slumberLine } from "../ritualReadiness.js";
import { icon } from "../icons.js";
import { dragonStarsHtml } from "../stars.js";
import { eggHtml, eggLook } from "../eggArt.js";
import { createAltarStage } from "../altarStage.js";
import { statusRowHtml, updateStatusRow } from "../statusRows.js";
import { slotMeterHtml, updateSlotMeter } from "../slotMeter.js";
import { infoTipHtml } from "../infoTip.js";
import { locale, t } from "../../i18n.js";

const hour = 3_600_000;
const percent = (odds) => new Intl.NumberFormat(locale(), { style: "percent" }).format(odds);
const oddsInfo = () =>
  t("altarScreen.oddsInfo", { base: Math.round(baseOdds * 100), top: Math.round(topOdds * 100), most: maxParents, success: successSlumber / hour, failure: failureSlumber / hour });

/**
 * The Soul Altar: a place per parent round the odds of an egg, why others cannot join (with live
 * countdowns), the free slot it needs, and Begin, which plays the ritual show full screen and ends
 * on its result card. `#/altar/<id>` arrives with that dragon in the circle.
 */
export function createAltarScreen(ctx) {
  const { module, game, thumbs } = ctx;
  const el = document.createElement("section");
  el.className = "screen altar";
  el.innerHTML = `
    <div class="altar-show" data-show hidden>
      <button type="button" class="dz-btn dz-btn--dark dz-btn--sm altar-show__skip" data-skip><span class="dz-btn__label">${t("altarScreen.skip")}</span></button>
      <div class="altar-show__foot">
        <div class="dz-dialog altar-show__dialog" data-dialog hidden>
          <span class="dz-avatar altar-show__avatar">${icon("sparkle")}</span>
          <p class="dz-dialog__line" aria-live="polite"><span class="dz-dialog__tag">${t("altarScreen.custodian")}</span><span data-line></span></p>
        </div>
      </div>
    </div>
    <div class="altar-body" data-body></div>`;
  const body = el.querySelector("[data-body]");
  const overlay = el.querySelector("[data-show]");
  const stage = createAltarStage(module, { onLine: (text) => say(text) });
  overlay.prepend(stage.el);
  /** @type {(string | null)[]} */
  let circle = [],
    /** @type {{ success: boolean, egg: object | null, odds: number, parents: object[], at: number } | null} */
    shown = null,
    style = "cozy",
    playing = false;

  const stable = () => game.stable;
  const adults = () => stable().dragons.filter((w) => w.age === "adult");
  const byId = (id) => adults().find((w) => w.id === id) ?? null;
  const parents = () => circle.filter(Boolean).map(byId);
  const others = () => [...stable().dragons.filter((w) => w.age !== "adult"), ...(stable().wild ?? [])];

  /** Keeps the picks that are still adults at home, in a circle sized for the stable. */
  function fitCircle() {
    const kept = circle.filter((id) => id && byId(id));
    const size = circleSize(stable());
    circle = Array.from({ length: size }, (_, i) => kept[i] ?? null);
  }

  function thumbHtml(w) {
    return `<canvas width="${thumbs.width}" height="${thumbs.height}" data-thumb="${escapeHtml(w.id)}"></canvas>`;
  }

  function placeHtml(id, i) {
    const w = id && byId(id);
    if (!w)
      return `<button type="button" class="altar-place altar-place--empty" style="--i:${i}" data-place="${i}" aria-label="${t("altarScreen.emptyPlace", { n: i + 1 })}">
        <span class="altar-place__art">${icon("plus")}</span></button>`;
    return `<button type="button" class="altar-place" style="--i:${i}" data-place="${i}" aria-label="${escapeHtml(t("altarScreen.leavePlace", { name: w.name }))}">
      <span class="altar-place__art">${thumbHtml(w)}</span>
      <b class="altar-place__name">${escapeHtml(w.name)}</b>
      <small class="altar-place__state" data-state="${escapeHtml(w.id)}"></small>
    </button>`;
  }

  function cardHtml(w, pickable) {
    const at = circle.indexOf(w.id);
    return `<button type="button" class="dz-roster-card altar-card" ${pickable ? `data-pick="${escapeHtml(w.id)}"` : "disabled"} aria-pressed="${at >= 0}">
      ${at >= 0 ? `<span class="altar-card__mark">${icon("sparkle")}</span>` : ""}
      <span class="dz-roster-card__art">${thumbHtml(w)}${dragonStarsHtml(w)}</span>
      <span class="dz-roster-card__name">${escapeHtml(w.name)}</span>
      <span class="dz-roster-card__sub" data-state="${escapeHtml(w.id)}"></span>
    </button>`;
  }

  const growingText = (young) =>
    escapeHtml(
      t("altarScreen.growing", {
        list: new Intl.ListFormat(locale(), { type: "unit" }).format(
          young.map((w) => t("altarScreen.growingOne", { name: w.name, age: t(`dragonAge.${w.age}`).toLowerCase(), time: formatDuration(timeToAdult(w)) })),
        ),
      }),
    );

  function resultHtml(ritual) {
    const { success, egg } = ritual;
    return `<div class="celebrate" role="dialog" aria-label="${t(success ? "altarScreen.eggLabel" : "altarScreen.silentLabel")}">
      <div class="celebrate__card dz-card dz-card--parchment altar-result ${success ? "" : "altar-result--silent"}">
        <span class="dz-stamp altar-stamp">${t(success ? "altarScreen.eggStamp" : "altarScreen.silentStamp")}</span>
        ${success ? eggHtml(module.genes, egg, style, "egg-art--large altar-egg") : `<span class="altar-result__stone" aria-hidden="true">${icon("moon")}</span>`}
        <h2 class="dz-h3">${t(success ? "altarScreen.eggTitle" : "altarScreen.silentTitle")}</h2>
        <p>${success ? t("altarScreen.eggText") : t("altarScreen.silentText", { odds: percent(ritual.odds) })}</p>
        <p class="dz-caption">${escapeHtml(slumberLine(ritual.parents, ritual.at))}</p>
        ${success ? `<a class="dz-btn dz-btn--primary dz-btn--block" href="#/stable/${encodeURIComponent(egg.id)}"><span class="dz-btn__label">${t("altarScreen.seeEgg")}</span></a>` : ""}
        <button type="button" class="dz-btn dz-btn--surface dz-btn--block" data-close><span class="dz-btn__label">${t("altarScreen.backToAltar")}</span></button>
      </div>
    </div>`;
  }

  function render() {
    fitCircle();
    const all = adults();
    const young = stable().dragons.filter((w) => w.age !== "adult");
    const growing = young.length ? `<p class="dz-caption altar-growing" data-growing>${growingText(young)}</p>` : "";
    if (all.length < 2) {
      body.innerHTML = `
        <div class="dz-card dz-card--parchment altar-empty">
          <h2 class="dz-h3">${t("altarScreen.needsTwo")}</h2>
          <p>${all.length ? escapeHtml(t("altarScreen.onlyAdult", { name: all[0].name })) : t("altarScreen.noAdults")}</p>
          ${growing}
          <a class="dz-btn dz-btn--primary dz-btn--sm" href="#/stable"><span class="dz-btn__label">${t("altarScreen.backToStable")}</span></a>
        </div>
        ${shown ? resultHtml(shown) : ""}`;
      drawThumbs();
      return;
    }
    const count = parents().length;
    const blocked = others();
    body.innerHTML = `
      <div class="altar-ring" style="--n:${circle.length}">
        <div class="altar-ring__stone" aria-live="polite">
          <b class="altar-ring__odds" data-odds>${percent(ritualOdds(count))}</b>
          <small>${t("altarScreen.chance")}${infoTipHtml(oddsInfo(), t("altarScreen.chance"))}</small>
        </div>
        ${circle.map(placeHtml).join("")}
      </div>
      <p class="dz-caption altar-tradeoff">${t("altarScreen.tradeoff")}</p>
      <div class="dz-card dz-card--parchment status altar-status">
        ${statusRowHtml(ritualVerdict(stable(), parents(), game.now()))}
        ${slotMeterHtml()}
        <button type="button" class="dz-btn dz-btn--feature dz-btn--block altar-begin" data-action="begin">${icon("sparkle")}<span class="dz-btn__label">${t("altarScreen.begin")}</span></button>
      </div>
      <h3 class="altar-subhead">${t("altarScreen.adults")}${infoTipHtml(t("altarScreen.adultsInfo"), t("altarScreen.adults"))}</h3>
      <div class="altar-cards" data-adults>${all.map((w) => cardHtml(w, true)).join("")}</div>
      ${blocked.length ? `<h3 class="altar-subhead">${t("altarScreen.cannotJoin")}</h3><div class="altar-cards">${blocked.map((w) => cardHtml(w, false)).join("")}</div>` : ""}
      ${growing}
      ${shown ? resultHtml(shown) : ""}`;
    drawThumbs();
    tick();
  }

  function drawThumbs() {
    const find = (id) => stable().dragons.find((w) => w.id === id) ?? stable().wild?.find((w) => w.id === id);
    for (const canvas of el.querySelectorAll("canvas[data-thumb]")) {
      const w = find(canvas.dataset.thumb);
      if (w) thumbs.draw(canvas, w, style);
    }
  }

  /** Refreshes countdowns, the verdict, the slots and Begin without rebuilding the screen. */
  function tick() {
    const growing = el.querySelector("[data-growing]");
    if (growing) growing.innerHTML = growingText(stable().dragons.filter((w) => w.age !== "adult"));
    const ring = el.querySelector(".altar-ring");
    if ((adults().length >= 2) !== Boolean(ring) || (ring && Number(ring.style.getPropertyValue("--n")) !== circleSize(stable()))) return render();
    if (!ring) return;
    const now = game.now();
    const everyone = [...stable().dragons, ...(stable().wild ?? [])];
    for (const node of el.querySelectorAll("[data-state]")) {
      const w = everyone.find((x) => x.id === node.dataset.state);
      if (!w) continue;
      const state = joinState(stable(), w, now);
      node.textContent = state.text;
      node.dataset.tone = state.tone;
    }
    updateStatusRow(el, ritualVerdict(stable(), parents(), now));
    updateSlotMeter(el, stable());
    el.querySelector('[data-action="begin"]').disabled = Boolean(ritualBlock(stable(), parents(), now));
  }

  function pick(id) {
    const at = circle.indexOf(id);
    if (at >= 0) circle[at] = null;
    else {
      const free = circle.indexOf(null);
      if (free < 0) return ctx.notify(t("altarScreen.circleFull"));
      circle[free] = id;
    }
    render();
  }

  /** Shows or hides the ritual show over the screen. */
  function setPlaying(on) {
    playing = on;
    overlay.hidden = !on;
    el.querySelector("[data-skip]").hidden = !on;
    if (!on) say(null);
  }

  function say(text) {
    el.querySelector("[data-dialog]").hidden = !text;
    if (text) el.querySelector("[data-line]").textContent = text;
  }

  /** Plays the ritual show full screen, ending on the result card over its last frame. */
  async function playRitual(ritual) {
    setPlaying(true);
    const look = ritual.egg ? eggLook(module.genes, ritual.egg) : null;
    await stage.play({ dragons: ritual.parents, success: ritual.success, seed: ritual.seed, look });
    if (!playing) return;
    el.querySelector("[data-skip]").hidden = true;
    shown = ritual;
    render();
  }

  function closeCard() {
    shown = null;
    stage.release();
    setPlaying(false);
    render();
  }

  function begin() {
    const chosen = parents();
    const now = game.now();
    const result = performRitual(stable(), module.genes, chosen.map((w) => w.id), now);
    if (!result) return;
    ctx.save();
    circle = circle.map(() => null);
    playRitual({ ...result, parents: chosen, at: now });
  }

  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return closeCard();
    if (e.target.closest("[data-skip]")) return stage.skip();
    const place = e.target.closest("[data-place]");
    if (place) {
      const id = circle[Number(place.dataset.place)];
      if (id) return pick(id);
      return el.querySelector("[data-adults]")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    const card = e.target.closest("[data-pick]");
    if (card) return pick(card.dataset.pick);
    const action = e.target.closest('[data-action="begin"]');
    if (action && !action.disabled) begin();
  });

  return {
    el,
    show({ params }) {
      shown = null;
      stage.release();
      setPlaying(false);
      fitCircle();
      if (params.id && byId(params.id) && !circle.includes(params.id)) {
        const free = circle.indexOf(null);
        circle[free < 0 ? 0 : free] = params.id;
      }
      render();
    },
    hide() {
      shown = null;
      stage.release();
      setPlaying(false);
    },
    /** The 3D stage, for the dev tools: `playing`, `seek(t)`, `skip()`. */
    stage,
    render,
    tick,
    setStyle(next) {
      style = next;
      stage.setStyle(next);
      if (!el.hidden) render();
    },
  };
}
