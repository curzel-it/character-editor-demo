/** Real time away below which a return is just a glance: its events are announced as toasts. */
export const minAway = 5 * 60_000;

/**
 * @typedef {{ events: { type: string, id: string, age?: string }[], realAway: number, gameAway: number, sheet: boolean }} Visit
 */

/**
 * Collects the stable's events while the owner is away (the game closed or hidden) and hands them
 * back on return, with how long the absence lasted and whether it earns the While you were away sheet.
 */
export function createAwayLog(threshold = minAway) {
  /** @type {{ real: number, game: number, events: Visit["events"] } | null} */
  let away = null;
  return {
    get away() {
      return away !== null;
    },
    /** Starts an absence at wall-clock `real` and game time `game`; an absence already running keeps its start. */
    leave(real, game) {
      away ??= { real, game, events: [] };
    },
    add(events) {
      away?.events.push(...events);
    },
    /** Ends the absence; null when there was none. @returns {Visit | null} */
    back(real, game) {
      if (!away) return null;
      const visit = { events: away.events, realAway: Math.max(0, real - away.real), gameAway: Math.max(0, game - away.game) };
      away = null;
      return { ...visit, sheet: visit.realAway >= threshold };
    },
  };
}
