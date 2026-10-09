import { makeRng } from "../rng.js";
import { divisionRank } from "./divisions.js";

/**
 * The rival stables. Each league seats its own seeded draw of them across its divisions, so a stable
 * races in one division of a league at most but can turn up in every league.
 * @typedef {{ id: string, name: string }} Team
 */
export const teams = [
  "Ashcombe Aerie", "Blackfen Roost", "Brightwater Wings", "Cinderholt", "Coldharbour Flight",
  "Duskmoor Stables", "Embervale", "Falconridge", "Greyspire Lofts", "Hollowmere",
  "Ironcliff Riders", "Kestrel Hall", "Larkspur Flyers", "Mistral House", "Nightjar Roost",
  "Oakenshaw", "Pinecrest Aerie", "Quillon Wings", "Redcap Stables", "Saltmarsh Flight",
  "Stormhollow", "Thornbury Lofts", "Umberfell", "Windrush Hall",
].map((name) => ({ id: name.toLowerCase().replace(/\s+/g, "-"), name }));

/** The owner's own stable in the standings. */
export const ownTeam = "own";

/** The `count` rival stables of `division` in `leagueId`, the same every season of a stable. @returns {Team[]} */
export function divisionTeams(stableSeed, leagueId, division, count) {
  const random = makeRng(`${stableSeed}:teams:${leagueId}`);
  const drawn = teams.map((team) => [random(), team]).sort((x, y) => x[0] - y[0]).map(([, team]) => team);
  const from = divisionRank(division) * count;
  return drawn.slice(from, from + count);
}
