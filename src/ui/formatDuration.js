import { t } from "../i18n.js";

const units = [
  ["d", 86_400_000],
  ["h", 3_600_000],
  ["m", 60_000],
  ["s", 1000],
];

/** A game duration as its two largest units, such as `2h 13m`. */
export function formatDuration(ms) {
  const parts = [];
  let rest = Math.max(0, Math.ceil(ms / 1000) * 1000);
  for (const [unit, size] of units) {
    const count = Math.floor(rest / size);
    rest -= count * size;
    if (count || parts.length) parts.push(t(`formatDuration.${unit}`, { count }));
    if (parts.length === 2) break;
  }
  return parts.join(" ") || t("formatDuration.s", { count: 0 });
}
