import { escapeHtml } from "../escapeHtml.js";
import { findWild } from "../stable/wild.js";
import { parentKey, parentTagHtml } from "./parentKeys.js";
import { t } from "../i18n.js";

const profileHash = (id) => `#/stable/${encodeURIComponent(id)}/profile`;

/** A parent's name as it is now, renamed or not. */
export const liveName = (stable, p) => (stable.dragons.find((w) => w.id === p.id) ?? findWild(stable, p.id))?.name ?? p.name;

function chipHtml(stable, p, i) {
  const home = stable.dragons.find((w) => w.id === p.id);
  const wild = !home && findWild(stable, p.id);
  const where = home ? t("profileSheet.parent", { key: parentKey(i) }) : wild ? t("profileSheet.inTheWild") : t("profileSheet.goneParent");
  const body = `${parentTagHtml(i)}<span><b>${escapeHtml(liveName(stable, p))}</b><small>${where}</small></span>`;
  return home || wild ? `<a class="parent-chip" href="${profileHash(p.id)}">${body}</a>` : `<span class="parent-chip">${body}</span>`;
}

/** Every parent of a ritual as a lettered chip, tappable while still owned; two side by side, more in a grid. */
export function parentChipsHtml(stable, parents) {
  const many = parents.length > 2;
  return `<div class="parents ${many ? "parents--many" : ""}">${parents.map((p, i) => chipHtml(stable, p, i)).join(many ? "" : `<span class="parents__x" aria-hidden="true">×</span>`)}</div>
    ${many ? `<p class="dz-caption">${t("profileSheet.manyParents", { count: parents.length })}</p>` : ""}`;
}
