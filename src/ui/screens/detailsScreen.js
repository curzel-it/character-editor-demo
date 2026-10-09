import { escapeHtml } from "../../escapeHtml.js";
import { colorSetSwatches, colourName } from "../../racerColors.js";
import { colourGenes, showsGene } from "../../genome/dragon.js";
import { statShares } from "../../statBars.js";
import { canBreathe } from "../../dragonAge.js";
import { maxStars } from "../../dragonBuild.js";
import { needValue, needsOf } from "../../stable/care.js";
import { strengthOf } from "../../stable/strength.js";
import { findWild } from "../../stable/wild.js";
import { needLook } from "../careLook.js";
import { needName } from "../careNames.js";
import { conditionRow } from "../dragonStatus.js";
import { infoTipHtml } from "../infoTip.js";
import { meterRowHtml } from "../meterRow.js";
import { liveName, parentChipsHtml } from "../parentChips.js";
import { parentSourceHtml } from "../parentKeys.js";
import { starsHtml } from "../stars.js";
import { statIcons } from "../statIcons.js";
import { statRadarHtml } from "../statRadar.js";
import { locale, t } from "../../i18n.js";

const title = (text, info) => `<h3 class="profile__title">${text}${info ? infoTipHtml(info, text) : ""}</h3>`;

/**
 * Everything about a dragon the profile keeps short: its exact stars, racing stats against their
 * five-star ceiling with the body part behind each, its needs and fatigue, every gene with the parent it
 * came from, its parents, seed and a link to its lineage.
 */
export function createDetailsScreen(ctx) {
  const { module, game } = ctx;
  const el = document.createElement("section");
  el.className = "screen details";
  let id = null,
    shown = "";

  const find = () => game.stable.dragons.find((w) => w.id === id) ?? findWild(game.stable, id);

  function racingHtml(w) {
    const breathes = canBreathe(w.age);
    const stars = new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(strengthOf(w));
    const stats = statShares(module.genes, w.genome, w.strength, breathes)
      .map((s) =>
        meterRowHtml({
          id: s.key,
          icon: statIcons[s.key],
          label: s.label,
          value: s.off ? "–" : t("detailsScreen.statValue", { now: Math.round(s.share * 100), top: Math.round(s.top * 100) }),
          progress: s.off ? 0 : s.share * 100,
          top: s.off ? undefined : s.top * 100,
          caption: s.off ? t("statBars.breathOff") : s.hint,
          off: s.off,
        }),
      )
      .join("");
    return `<div class="dz-card dz-card--parchment details-card">
      ${title(t("profileSheet.racing"), t("profileSheet.racingInfo"))}
      ${meterRowHtml({ id: "stars", label: t("profileSheet.stars"), value: `${starsHtml(Math.floor(strengthOf(w) + 1e-9))}<b>${t("detailsScreen.starsValue", { stars, max: maxStars })}</b>`, progress: (strengthOf(w) / maxStars) * 100 })}
      ${statRadarHtml(module.genes, w.genome, w.strength, breathes)}
      <div class="meter-rows">${stats}</div>
    </div>`;
  }

  function careHtml(w) {
    const condition = conditionRow(w, game.now());
    const needs = needsOf(w.age)
      .map((need) => meterRowHtml({ id: need.id, icon: needLook[need.id].icon, label: needName(need.id), value: String(Math.round(needValue(w, need.id))), progress: needValue(w, need.id) }))
      .join("");
    const fatigue = meterRowHtml({
      id: "fatigue",
      icon: "moon",
      label: t("detailsScreen.fatigue"),
      value: escapeHtml([condition.label, condition.value].filter(Boolean).join(" · ")),
      progress: Math.min(1, w.fatigue) * 100,
    });
    return `<div class="dz-card dz-card--parchment details-card">
      ${title(t("detailsScreen.care"))}
      <div class="meter-rows">${needs}${fatigue}</div>
    </div>`;
  }

  function genesHtml(w) {
    const parents = w.parents?.map((p) => ({ name: liveName(game.stable, p) }));
    const from = (gene) => (parents ? parentSourceHtml(w.from?.[gene] ?? null, parents) : "");
    const shape = module.genes
      .filter((g) => !g.choices && !g.group)
      .map((g) => meterRowHtml({ id: g.name, label: g.label, value: w.genome[g.name].toFixed(2), progress: Math.max(0.04, (w.genome[g.name] - g.min) / (g.max - g.min || 1)) * 100 }))
      .join("");
    const parts = module.genes
      .filter((g) => g.choices && !colourGenes.includes(g.name) && showsGene(g, w.genome))
      .map((g) => `<li><span>${escapeHtml(g.label)}</span><b>${escapeHtml(g.choices[Math.floor(w.genome[g.name])])}</b>${from(g.name)}</li>`)
      .join("");
    const swatches = colorSetSwatches(w.genome);
    const colors = module.genes
      .filter((g) => colourGenes.includes(g.name))
      .map((g) => `<li><i class="swatch swatch--sm" style="background:${swatches[g.name]}"></i><span>${escapeHtml(g.label)}</span><b>${escapeHtml(colourName(g, w.genome))}</b>${from(g.name)}</li>`)
      .join("");
    const blend = parents ? `<p class="dz-caption">${parents.length === 2 ? t("profileSheet.blendBoth") : t("profileSheet.blendAll", { count: parents.length })}</p>` : "";
    return `<div class="dz-card dz-card--parchment details-card">
      ${title(t("detailsScreen.genes"))}
      <h4 class="details-card__sub">${t("profileSheet.shape")}</h4>
      <div class="meter-rows">${shape}</div>${blend}
      <h4 class="details-card__sub">${t("profileSheet.body")}</h4>
      <ul class="details-list">${parts}</ul>
      <h4 class="details-card__sub">${t("profileSheet.colours")}</h4>
      <ul class="details-list details-list--colors">${colors}</ul>
    </div>`;
  }

  function originHtml(w) {
    return `<div class="dz-card dz-card--parchment details-card">
      ${title(t("detailsScreen.origin"))}
      ${w.parents ? parentChipsHtml(game.stable, w.parents) : `<p class="dz-caption">${t("lineageScreen.seedBornText")}</p>`}
      <ul class="details-list">
        <li><span>${t("detailsScreen.generation")}</span><b>${w.generation ?? 0}</b></li>
        <li><span>${t("detailsScreen.seed")}</span><b>${escapeHtml(w.seed)}</b></li>
      </ul>
      <div class="profile__buttons"><a class="dz-btn dz-btn--dark dz-btn--sm" href="#/dragon/${encodeURIComponent(w.id)}/lineage"><span class="dz-btn__label">${t("profileSheet.lineage")}</span></a></div>
    </div>`;
  }

  function render() {
    const w = find();
    if (!w) return location.replace("#/stable");
    ctx.setTitle(w.name);
    const html = `${racingHtml(w)}${careHtml(w)}${genesHtml(w)}${originHtml(w)}`;
    if (html === shown) return;
    shown = html;
    el.innerHTML = html;
  }

  return {
    el,
    show({ params }) {
      id = params.id;
      shown = "";
      render();
    },
    hide() {},
    render,
    tick: render,
  };
}
