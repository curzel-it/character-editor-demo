import { escapeHtml } from "../escapeHtml.js";
import { icon } from "./icons.js";
import { t } from "../i18n.js";

const letters = "ABCDEFGH";

/** The letter keying parent `i` of a ritual, A for the first. */
export const parentKey = (i) => letters[i] ?? String(i + 1);

/** A round tag in the colour of parent `side`, or a sparkle for a mutation (`side` null). */
export const parentTagHtml = (side) =>
  side === null || side === undefined
    ? `<span class="lineage-side lineage-side--new" aria-label="${t("parentKeys.mutation")}">${icon("sparkle")}</span>`
    : `<span class="lineage-side" data-side="${side}" aria-hidden="true">${parentKey(side)}</span>`;

/** Where a trait came from: the parent's tag and name, or a mutation. */
export const parentSourceHtml = (side, parents) =>
  side === null || side === undefined
    ? `<span class="lineage-source">${parentTagHtml(null)}<span>${t("parentKeys.mutation")}</span></span>`
    : `<span class="lineage-source">${parentTagHtml(side)}<span>${escapeHtml(parents[side]?.name ?? t("parentKeys.aParent"))}</span></span>`;
