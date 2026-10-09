/** Game clock speeds; anything above 1 is a dev tool for trying the timings quickly. */
export const clockSpeeds = [1, 10, 60, 600];

export const createClock = (realNow) => ({ game: 0, real: realNow, speed: 1 });

/** Advances the clock to `realNow` and returns the game milliseconds that passed; time away counts too. */
export function tickClock(clock, realNow) {
  const dt = Math.max(0, realNow - clock.real) * clock.speed;
  clock.real = realNow;
  clock.game += dt;
  return dt;
}

/** The game's calendar day of `now`; a new one starts at midnight. */
export const dayOf = (now) => Math.floor(now / 86_400_000);
