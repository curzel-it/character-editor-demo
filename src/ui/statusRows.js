import { escapeHtml } from "../escapeHtml.js";

/** A labelled status row with an optional detail, tone and progress bar. */
export const statusRowHtml = (row) => `<div class="status__row" data-row="${row.id}" ${row.tone ? `data-tone="${row.tone}"` : ""}>
    <span class="status__label">${escapeHtml(row.label)}</span><span class="status__value">${escapeHtml(row.value ?? "")}</span>
    ${row.progress !== undefined ? `<div class="dz-progress dz-progress--light" style="--value:${row.progress}"></div>` : ""}
  </div>`;

/** Refreshes a row built by `statusRowHtml` inside `root`, if it is there. */
export function updateStatusRow(root, row) {
  const node = root.querySelector(`[data-row="${row.id}"]`);
  if (!node) return;
  node.querySelector(".status__label").textContent = row.label;
  node.querySelector(".status__value").textContent = row.value ?? "";
  if (row.tone) node.dataset.tone = row.tone;
  node.querySelector(".dz-progress")?.style.setProperty("--value", row.progress);
}
