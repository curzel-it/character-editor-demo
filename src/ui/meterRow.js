import { escapeHtml } from "../escapeHtml.js";
import { icon } from "./icons.js";
import { infoTipHtml } from "./infoTip.js";

/**
 * @typedef {object} MeterRow
 * @property {string} id
 * @property {string} label plain text
 * @property {string} [icon]
 * @property {string} [info] what an ⓘ beside the label explains
 * @property {string} [value] trusted markup on the right
 * @property {number} progress 0..100
 * @property {number} [top] 0..100, a fainter fill the bar can still grow to
 * @property {string} [caption] plain text under the bar
 * @property {boolean} [off] greyed out
 */

/** A label and its value over a thin bar, with an optional caption: the one meter of the profile and the details page. */
export const meterRowHtml = (row) => `<div class="meter-row" data-meter="${row.id}" ${row.off ? "data-off" : ""}>
    <span class="meter-row__label">${row.icon ? icon(row.icon) : ""}<span>${escapeHtml(row.label)}</span>${row.info ? infoTipHtml(row.info, row.label) : ""}</span>
    <span class="meter-row__value">${row.value ?? ""}</span>
    <div class="meter-row__bar" style="--value:${row.progress.toFixed(1)}${row.top === undefined ? "" : `;--top:${row.top.toFixed(1)}`}"></div>
    ${row.caption ? `<small class="meter-row__caption">${escapeHtml(row.caption)}</small>` : ""}
  </div>`;

/** Refreshes a row built by `meterRowHtml` inside `root`, if it is there. */
export function updateMeterRow(root, row) {
  const node = root.querySelector(`[data-meter="${row.id}"]`);
  if (!node) return;
  node.querySelector(".meter-row__label > span").textContent = row.label;
  const value = node.querySelector(".meter-row__value");
  if (value.innerHTML !== (row.value ?? "")) value.innerHTML = row.value ?? "";
  node.querySelector(".meter-row__bar").style.setProperty("--value", row.progress.toFixed(1));
}
