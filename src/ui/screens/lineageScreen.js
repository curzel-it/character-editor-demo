import { escapeHtml } from "../../escapeHtml.js";
import { colorSetSwatches } from "../../racerColors.js";
import { lineageOf } from "../../stable/lineage.js";
import { findWild } from "../../stable/wild.js";
import { icon } from "../icons.js";
import { dragonStarsHtml, starsHtml } from "../stars.js";
import { parentKey, parentSourceHtml, parentTagHtml } from "../parentKeys.js";
import { locale, t } from "../../i18n.js";

const listNames = (names) =>
  names.length === 2 ? t("lineageScreen.pair", { a: names[0], b: names[1] }) : new Intl.ListFormat(locale(), { type: "conjunction" }).format(names);

/**
 * A dragon's lineage: every parent of its ritual, keyed by a lettered colour tag (tappable while still
 * owned, in the stable or the wild) with their own parents, the dragon below them, and which parent every body part and
 * colour came from, or a mutation, each mutation celebrated above them. Seed-born dragons have no parents to show.
 */
export function createLineageScreen(ctx) {
  const { module, game, thumbs } = ctx;
  const el = document.createElement("section");
  el.className = "screen lineage";
  let id = null;

  const find = () => game.stable.dragons.find((w) => w.id === id) ?? findWild(game.stable, id);
  const profileHash = (dragonId) => `#/stable/${encodeURIComponent(dragonId)}/profile`;
  const art = (key) => `<span class="lineage-art"><canvas width="${thumbs.width}" height="${thumbs.height}" data-thumb="${escapeHtml(key)}"></canvas></span>`;
  const whereabouts = (p) => t(!p.owned ? "lineageScreen.noLongerHere" : p.wild ? "lineageScreen.inTheWild" : "lineageScreen.inStable");

  function parentHtml(p, i) {
    const grand = p.parents ? escapeHtml(t("lineageScreen.childOf", { names: listNames(p.parents.map((g) => g.name)) })) : t("lineageScreen.seedBorn");
    const body = `${parentTagHtml(i)}
      ${p.genome ? art(`parent:${i}`) : `<span class="lineage-art lineage-art--none">${icon("egg")}</span>`}
      <b class="lineage-parent__name">${escapeHtml(p.name)}</b>
      ${p.genome ? dragonStarsHtml(p, false) : ""}
      <small>${t("lineageScreen.gen", { gen: p.generation })} · ${whereabouts(p)}</small>
      <small class="lineage-parent__grand">${grand}</small>`;
    return p.owned
      ? `<a class="lineage-parent ${p.wild ? "is-away" : ""}" href="${profileHash(p.id)}" aria-label="${escapeHtml(t("lineageScreen.parentLabel", { key: parentKey(i), name: p.name }))}">${body}</a>`
      : `<div class="lineage-parent is-gone" aria-label="${escapeHtml(t("lineageScreen.parentGoneLabel", { key: parentKey(i), name: p.name }))}">${body}</div>`;
  }

  function parentsHtml(parents) {
    if (parents.length === 2) return `<div class="lineage-parents">${parents.map(parentHtml).join(`<span class="lineage-parents__x" aria-hidden="true">${icon("heart")}</span>`)}</div>`;
    return `<p class="lineage-circle__title">${t("lineageScreen.ritualOf", { count: parents.length })}</p>
      <div class="lineage-parents lineage-parents--circle" data-count="${parents.length}">${parents.map(parentHtml).join("")}</div>`;
  }

  function childHtml(w) {
    return `<a class="lineage-child" href="${profileHash(w.id)}" aria-label="${escapeHtml(t("lineageScreen.childLabel", { name: w.name }))}">
      ${art("child")}
      <span class="lineage-child__text">
        <b>${escapeHtml(w.name)}</b>
        ${dragonStarsHtml(w)}
        <small>${[t("lineageScreen.gen", { gen: w.generation ?? 0 }), w.parents ? "" : t("lineageScreen.seedBornTag"), w.wild ? t("lineageScreen.inTheWild") : ""].filter(Boolean).join(" · ")}</small>
      </span>
    </a>`;
  }

  function mutationsHtml(mutations) {
    if (!mutations.length) return "";
    const traits = listNames(mutations.map((m) => `${m.label} · ${m.value}`));
    return `<div class="lineage-mutation" role="note">${icon("sparkle")}<span><b>${t("lineageScreen.mutationTitle", { count: mutations.length })}</b><small>${escapeHtml(t("lineageScreen.mutationText", { traits }))}</small></span></div>`;
  }

  function sourcesHtml(w, lineage) {
    const { parents, parts, colors, mutations } = lineage;
    const carried = (values, side) =>
      values.every((v) => v !== null)
        ? `<small class="lineage-carried">${values.map((v, i) => `<span class="${i === side ? "is-from" : ""}">${parentTagHtml(i)}${escapeHtml(v)}</span>`).join("")}</small>`
        : "";
    const partRows = parts
      .map((p) => `<li class="${p.side === null ? "is-mutation" : ""}"><span>${escapeHtml(p.label)}</span><b>${escapeHtml(p.value)}</b>${parentSourceHtml(p.side, parents)}${carried(p.parents, p.side)}</li>`)
      .join("");
    const own = colorSetSwatches(w.genome);
    const theirs = parents.map((p) => (p.genome ? colorSetSwatches(p.genome) : null));
    const colorRows = colors
      .map((c) => {
        const compare = theirs.every(Boolean)
          ? `<small class="lineage-carried lineage-swatches">${theirs.map((s, i) => `<span class="${i === c.side ? "is-from" : ""}" title="${escapeHtml(c.parents[i] ?? "")}">${parentTagHtml(i)}<i class="swatch swatch--sm" style="background:${s[c.id]}"></i></span>`).join("")}</small>`
          : "";
        return `<li class="${c.side === null ? "is-mutation" : ""}"><i class="swatch" style="background:${own[c.id]}"></i><span>${escapeHtml(c.label)} · ${escapeHtml(c.value)}</span>${parentSourceHtml(c.side, parents)}${compare}</li>`;
      })
      .join("");
    return `<div class="dz-card dz-card--parchment lineage-card">
      ${mutationsHtml(mutations)}
      <h3 class="profile__subhead">${t("lineageScreen.bodyParts")}</h3>
      <ul class="lineage-list">${partRows}</ul>
      <p class="dz-caption">${t(parents.length === 2 ? "lineageScreen.partsCaption.two" : "lineageScreen.partsCaption.many")}</p>
      <h3 class="profile__subhead">${t("lineageScreen.colours")}</h3>
      <ul class="lineage-list lineage-list--colors">${colorRows}</ul>
      <p class="dz-caption">${parents.length === 2 ? t("lineageScreen.coloursCaption.two") : t("lineageScreen.coloursCaption.many", { count: parents.length })}</p>
    </div>`;
  }

  function render() {
    const w = find();
    if (!w) return location.replace("#/stable");
    const lineage = lineageOf(game.stable, module.genes, w);
    el.innerHTML = `
      <div class="lineage-tree ${lineage ? "" : "is-wild"}">
        ${lineage ? `${parentsHtml(lineage.parents)}<span class="lineage-tree__link" aria-hidden="true"></span>` : ""}
        ${childHtml(w)}
      </div>
      ${
        lineage
          ? sourcesHtml(w, lineage)
          : `<div class="dz-card dz-card--parchment lineage-card"><h3 class="profile__subhead">${t("lineageScreen.seedBorn")}</h3>
              <p class="dz-caption">${t("lineageScreen.seedBornText")}</p></div>`
      }`;
    for (const canvas of el.querySelectorAll("canvas[data-thumb]")) {
      const key = canvas.dataset.thumb;
      const i = Number(key.split(":")[1]);
      const p = lineage?.parents[i];
      const subject = key === "child" ? w : (p.owned ?? { id: `lineage:${w.id}:${i}`, genome: p.genome, age: "adult" });
      thumbs.draw(canvas, subject, ctx.style());
    }
  }

  return {
    el,
    show({ params }) {
      id = params.id;
      render();
    },
    hide() {},
    render,
    tick() {},
    setStyle() {
      if (!el.hidden && id) render();
    },
  };
}
