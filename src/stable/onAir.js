/** The id of the league whose race on air is flying dragon `id`, or null. */
export const onAirLeague = (stable, id) => Object.keys(stable.leagues ?? {}).find((leagueId) => stable.leagues[leagueId]?.live?.dragon === id) ?? null;

/** `onAir` while dragon `id` flies a league race that has not finished, else null: it cannot race again, grow, leave or slumber until then. */
export const onAirBlock = (stable, id) => (onAirLeague(stable, id) ? "onAir" : null);
