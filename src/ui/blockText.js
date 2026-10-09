import { t } from "../i18n.js";

/**
 * A rule's block for the player to read: a code such as `tired` or `wild.onTheWay`, or
 * `{ code, ...vars }` whose `reason` is itself a block.
 * @param {string | { code: string, reason?: unknown } | null} block
 * @returns {string}
 */
export function blockText(block) {
  if (!block) return "";
  const { code, ...vars } = typeof block === "string" ? { code: block } : block;
  if (vars.reason) vars.reason = blockText(/** @type {string} */ (vars.reason));
  return t(`blockText.${code}`, vars);
}

/** An injury's name, such as `Sore leg`. @param {{ id: string }} injury */
export const injuryName = (injury) => t(`blockText.injury.${injury.id}`);
