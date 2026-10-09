import { riderNameLength } from "../jockey/createJockey.js";
import { jockeyName } from "../jockey/jockeyName.js";
import { createRiderLook } from "../jockey/riderLook.js";
import { createSilks } from "../jockey/jockeySilks.js";
import { bindPickers, revealSwatches } from "./pickerFields.js";
import { lookFromChange, riderLookFieldsHtml } from "./riderLookFields.js";
import { silksFieldsHtml, silksFromChange } from "./silksFields.js";
import { icon } from "./icons.js";
import { t } from "../i18n.js";

export const makerGroups = ["body", "face", "hair", "accessories", "jacket", "kit"];

/** The groups that frame the face close up, bareheaded so the hair shows. */
const faceGroups = new Set(["face", "hair"]);

const FOCUS_REACH = 96;

/** @typedef {{ name?: string, look?: Partial<import("../jockey/riderLook.js").RiderLook>, silks?: import("../jockey/jockeySilks.js").Silks }} RiderChange */

/**
 * The rider's name with a dice for another, as its own field.
 * @param {string} label
 */
export function riderNameHtml(label = t("riderMaker.name")) {
  return `<div class="maker__name">
    <input class="text-input maker__name-input" data-maker-name maxlength="${riderNameLength}" autocomplete="off" aria-label="${label}" />
    <button type="button" class="maker__rename" data-maker-rename aria-label="${t("riderMaker.randomName")}" title="${t("riderMaker.randomName")}">${icon("dice")}</button>
  </div>`;
}

/**
 * The rider maker: optionally the name, a Surprise me that rolls a whole new look and silks, then
 * every group of pickers and colour rows one under the other, Body, Face, Hair, Accessories, Jacket
 * and Kit. `rider()` reads the rider being made, `onChange(change)` asks for a change, after which
 * the host calls `render()`. `follow(scroller, edge)` watches which group is scrolled up to `edge()`,
 * the client y where the visible list starts, and reports it to `onFocus(group)`; `shown()` is the
 * rider to preview.
 * @param {{ id: string, named?: boolean, rider: () => import("../jockey/createJockey.js").Rider, onChange: (change: RiderChange) => void, onFocus?: (group: string) => void }} options
 */
export function createRiderMaker({ id, named = true, rider, onChange, onFocus }) {
  const el = document.createElement("div");
  el.className = "maker";
  let focus = makerGroups[0];
  el.innerHTML = `
    <div class="maker__head">
      ${named ? riderNameHtml() : ""}
      <button type="button" class="dz-btn dz-btn--accent dz-btn--sm maker__random" data-maker-random>${icon("dice")}<span>${t("riderMaker.random")}</span></button>
    </div>
    ${makerGroups
      .map(
        (group) => `<section class="maker__group" data-maker-group="${group}">
      <h3 class="maker__title">${t(`riderMaker.groups.${group}`)}</h3>
      <div data-maker-fields></div>
    </section>`,
      )
      .join("")}`;
  const roll = () => String(Math.floor(Math.random() * 1e9));
  bindPickers(el);

  function render() {
    const { name, look, silks } = rider();
    const input = el.querySelector("[data-maker-name]");
    if (input && document.activeElement !== input) input.value = name;
    for (const section of el.querySelectorAll("[data-maker-group]")) {
      const group = section.dataset.makerGroup;
      const fields = section.querySelector("[data-maker-fields]");
      fields.innerHTML = group === "jacket" ? silksFieldsHtml(silks, `${id}-silks`) : riderLookFieldsHtml(look, group, `${id}-look`);
      revealSwatches(fields);
    }
  }

  /** The last group whose title has scrolled up to the list's top edge, else the first. */
  function focused(edge) {
    let found = makerGroups[0];
    for (const section of el.querySelectorAll("[data-maker-group]")) if (section.getBoundingClientRect().top <= edge + FOCUS_REACH) found = section.dataset.makerGroup;
    return found;
  }

  function refocus(edge) {
    const next = focused(edge);
    if (next === focus) return;
    focus = next;
    onFocus?.(focus);
  }

  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-maker-rename]")) return onChange({ name: jockeyName(roll()) });
    if (e.target.closest("[data-maker-random]")) {
      const seed = roll();
      onChange({ look: createRiderLook(seed), silks: createSilks(seed) });
    }
  });

  el.addEventListener("change", (e) => {
    if (e.target.matches("[data-maker-name]")) {
      onChange({ name: e.target.value });
      e.target.value = rider().name;
      return;
    }
    const look = lookFromChange(e.target);
    if (look) return onChange({ look });
    const silks = silksFromChange(rider().silks, e.target);
    if (silks) onChange({ silks });
  });

  return {
    el,
    render,
    /** The group scrolled into view now. */
    focus: () => focus,
    /** Whether `focus` frames the face. */
    closeUp: () => faceGroups.has(focus),
    /** The rider as the preview shows them: bareheaded while the face or hair is in view. */
    shown: () => (faceGroups.has(focus) ? { ...rider(), look: { ...rider().look, hat: "none" } } : rider()),
    /**
     * Follows the scrolling of `scroller`, `edge()` being the client y where the visible list starts.
     * @param {HTMLElement} scroller
     * @param {() => number} edge
     */
    follow(scroller, edge) {
      scroller.addEventListener("scroll", () => refocus(edge()), { passive: true });
    },
    /** Back to the first group. */
    reset() {
      focus = makerGroups[0];
    },
  };
}
