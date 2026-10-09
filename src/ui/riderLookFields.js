import { riderLookFields } from "../jockey/riderLook.js";
import { pickerHtml, swatchesHtml } from "./pickerFields.js";
import { t } from "../i18n.js";

const css = (rgb) => `rgb(${rgb.map((v) => Math.round(v * 255)).join(" ")})`;

/**
 * The rider's look controls in one of the maker's groups: pickers two abreast, then the colour rows.
 * @param {import("../jockey/riderLook.js").RiderLook} look
 * @param {string} group
 * @param {string} id unique prefix for the radio groups
 */
export function riderLookFieldsHtml(look, group, id) {
  const fields = riderLookFields.filter((f) => f.group === group);
  const named = (key, options) => options.map((o) => ({ id: o.id, name: t(`riderLookFields.options.${key}.${o.id}`), css: o.rgb && css(o.rgb) }));
  const pickers = fields
    .filter((f) => !f.swatch)
    .map(({ key, options }) => pickerHtml({ label: t(`riderLookFields.fields.${key}`), data: { look: key }, options: named(key, options), value: look[key] }));
  const swatches = fields
    .filter((f) => f.swatch)
    .map(({ key, options }) => swatchesHtml({ label: t(`riderLookFields.fields.${key}`), name: `${id}-${key}`, data: { look: key }, options: named(key, options), value: look[key] }));
  return `<div class="maker-fields">${pickers.length ? `<div class="maker-fields__pickers">${pickers.join("")}</div>` : ""}${swatches.join("")}</div>`;
}

/**
 * The look change asked for by a `change` from the look controls at `target`, or null when it came from elsewhere.
 * @param {Element} target
 */
export function lookFromChange(target) {
  const key = target.dataset?.look;
  return key ? { [key]: target.value } : null;
}
