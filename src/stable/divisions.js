/**
 * A league's divisions, weakest first. The owner races one division of each league at a time and
 * the division picks how strong the season's rivals are; the champion of the top division is the
 * league champion.
 * @typedef {"bronze" | "silver" | "gold"} DivisionId
 * @typedef {"promote" | "relegate" | null} Zone
 */
export const divisions = [
  { id: "bronze" },
  { id: "silver" },
  { id: "gold" },
];
export const firstDivision = "bronze";
export const promotionPlaces = 2;
export const relegationPlaces = 2;

/** @param {string} id */
export const divisionOf = (id) => divisions.find((d) => d.id === id) ?? divisions[0];
/** @param {string} id */
export const divisionRank = (id) => divisions.indexOf(divisionOf(id));
/** @param {string} id */
export const topDivision = (id) => divisionRank(id) === divisions.length - 1;

/**
 * The zone of final place `rank` (1-based) in a points table of `size` rows: the top places
 * promote (but out of the top division), the bottom places relegate (but out of the bottom one).
 * @param {string} id @param {number} rank @param {number} size @returns {Zone}
 */
export function zoneOf(id, rank, size) {
  const at = divisionRank(id);
  if (rank <= promotionPlaces && at < divisions.length - 1) return "promote";
  if (rank > size - relegationPlaces && rank > promotionPlaces && at > 0) return "relegate";
  return null;
}

/** The division a zone leads to next season. @param {string} id @param {Zone} zone @returns {DivisionId} */
export function divisionAfter(id, zone) {
  const at = divisionRank(id) + (zone === "promote" ? 1 : zone === "relegate" ? -1 : 0);
  return /** @type {DivisionId} */ (divisions[Math.max(0, Math.min(divisions.length - 1, at))].id);
}
