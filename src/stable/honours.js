/**
 * @typedef {{ league: string, season: number, division: string, id: string, name: string, at: number }} Trophy
 * @typedef {Trophy & { place: number, medal: MedalId }} Medal
 * @typedef {"gold" | "silver" | "bronze"} MedalId
 */

/** The medal of each podium place. */
export const medals = [
  { place: 1, id: "gold" },
  { place: 2, id: "silver" },
  { place: 3, id: "bronze" },
];

/** @param {number} place */
export const medalOf = (place) => medals.find((m) => m.place === place) ?? null;

/**
 * Every medal the owner's dragons have won, newest first: one for each finished season the owner's
 * stable ended on the podium, of any division, kept by its lead dragon. `id` narrows them to one dragon.
 * @returns {Medal[]}
 */
export function medalsOf(stable, id = null) {
  return stable.seasons.flatMap((end) =>
    end.podium
      .filter((row) => row.owned && (id === null || row.lead.id === id))
      .map((row) => ({ league: end.league, season: end.season, division: end.division, id: row.lead.id, name: row.lead.name, at: end.at, place: row.rank, medal: medalOf(row.rank).id })),
  );
}

/** The league trophies, newest first; `id` narrows them to one dragon. @returns {Trophy[]} */
export const trophiesOf = (stable, id = null) => stable.trophies.filter((t) => id === null || t.id === id).sort((a, b) => b.at - a.at);

/** A dragon's trophies and medals, and its best honour for a badge: a trophy, else its best medal, else null. */
export function honoursOf(stable, id) {
  const trophies = trophiesOf(stable, id),
    won = medalsOf(stable, id);
  const best = trophies.length ? "trophy" : won.length ? medalOf(Math.min(...won.map((m) => m.place))).id : null;
  return { trophies, medals: won, best, count: trophies.length + won.length };
}
