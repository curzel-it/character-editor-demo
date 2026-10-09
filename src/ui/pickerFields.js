import { escapeHtml } from "../escapeHtml.js";
import { icon } from "./icons.js";
import { t } from "../i18n.js";

/** @typedef {{ id: string, name: string, css?: string }} PickOption */

const attributes = (data) =>
  Object.entries(data)
    .map(([key, value]) => `data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${escapeHtml(value)}"`)
    .join(" ");

/**
 * A labelled picker: the chosen option's name between previous and next arrows, the name itself a
 * native list of every option. Its select carries `data` as data attributes and fires `change`.
 * @param {{ label: string, data: Record<string, string>, options: PickOption[], value: string }} field
 */
export function pickerHtml({ label, data, options, value }) {
  const step = (by, key, glyph) =>
    `<button type="button" class="picker__step" data-picker-step="${by}" aria-label="${escapeHtml(t(`pickerFields.${key}`, { field: label }))}">${icon(glyph)}</button>`;
  return `<div class="picker">
    <span class="picker__label">${escapeHtml(label)}</span>
    <div class="picker__control">${step(-1, "previous", "chevronLeft")}<select class="picker__select" ${attributes(data)} aria-label="${escapeHtml(label)}">${options
      .map((o) => `<option value="${escapeHtml(o.id)}"${o.id === value ? " selected" : ""}>${escapeHtml(o.name)}</option>`)
      .join("")}</select>${step(1, "next", "chevronRight")}</div>
  </div>`;
}

/**
 * A labelled row of colour swatches as radio buttons, scrolling sideways when they overflow; an
 * option without `css` is drawn as "none". Each input carries `data` and fires `change`.
 * @param {{ label: string, name: string, data: Record<string, string>, options: PickOption[], value: string }} field
 */
export function swatchesHtml({ label, name, data, options, value }) {
  const chosen = options.find((o) => o.id === value);
  return `<div class="swatches">
    <span class="swatches__label">${escapeHtml(label)}<b>${escapeHtml(chosen?.name ?? "")}</b></span>
    <div class="swatches__row" role="radiogroup" aria-label="${escapeHtml(label)}">${options
      .map(
        (o) =>
          `<label class="swatch${o.css ? "" : " swatch--none"}" title="${escapeHtml(o.name)}"${o.css ? ` style="--swatch:${o.css}"` : ""}><input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(o.id)}" ${attributes(data)}${o.id === value ? " checked" : ""} aria-label="${escapeHtml(o.name)}" /></label>`,
      )
      .join("")}</div>
  </div>`;
}

/** Makes the pickers' arrows inside `root` step their list round, firing its `change`. */
export function bindPickers(root) {
  root.addEventListener("click", (e) => {
    const button = e.target.closest?.("[data-picker-step]");
    const select = button?.parentElement.querySelector("select");
    if (!select) return;
    const count = select.options.length;
    select.selectedIndex = (select.selectedIndex + Number(button.dataset.pickerStep) + count) % count;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** Scrolls each swatch row in `root` so its checked swatch shows. */
export function revealSwatches(root) {
  for (const row of root.querySelectorAll(".swatches__row")) {
    const on = row.querySelector("input:checked")?.parentElement;
    if (on) row.scrollLeft = Math.max(0, on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2);
  }
}
