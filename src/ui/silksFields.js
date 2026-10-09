import { withSilkColor } from "../fieldEdits.js";
import { silkColors, silkPatterns, silksSwatch } from "../jockey/jockeySilks.js";
import { pickerHtml, swatchesHtml } from "./pickerFields.js";
import { t } from "../i18n.js";

const roles = ["body", "accent", "trim"];
const css = (rgb) => `rgb(${rgb.map((v) => Math.round(v * 255)).join(" ")})`;

/**
 * The silks controls: the pattern beside a swatch of the whole silks, then a colour row each for
 * the body, the accent and the optional trim.
 * @param {import("../jockey/jockeySilks.js").Silks} silks
 * @param {string} id unique prefix for the radio groups
 */
export function silksFieldsHtml(silks, id) {
  const colors = silkColors.map((c) => ({ id: c.id, name: t(`silksFields.colors.${c.id}`), css: css(c.rgb) }));
  const pattern = pickerHtml({
    label: t("silksFields.pattern"),
    data: { silkPattern: "" },
    options: silkPatterns.map((p) => ({ id: p.id, name: t(`silksFields.patterns.${p.id}`) })),
    value: silks.pattern,
  });
  return `<div class="maker-fields">
    <div class="silks-fields__pattern"><i class="silks-fields__swatch" style="background:${silksSwatch(silks)}"></i>${pattern}</div>
    ${roles
      .map((role, slot) =>
        swatchesHtml({
          label: t(`silksFields.roles.${role}`),
          name: `${id}-${role}`,
          data: { silk: String(slot) },
          options: slot === 2 ? [{ id: "", name: t("silksFields.none") }, ...colors] : colors,
          value: silks.colors[slot] ?? "",
        }),
      )
      .join("")}
  </div>`;
}

/**
 * The silks after a `change` from the silks controls at `target`, or null when it came from elsewhere.
 * @param {import("../jockey/jockeySilks.js").Silks} silks
 * @param {HTMLInputElement | HTMLSelectElement} target
 */
export function silksFromChange(silks, target) {
  if (target.dataset.silkPattern !== undefined) return { ...silks, pattern: target.value };
  if (target.dataset.silk !== undefined) return withSilkColor(silks, Number(target.dataset.silk), target.value);
  return null;
}
