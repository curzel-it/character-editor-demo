import { froude } from "./froude.js";

const { time: T, length: L, speed: V } = froude;

/**
 * What a breath hit does, before the element's lean and the matchup. `slow` cuts the share of top
 * speed it aims for over `duration` s; `knock` shoves it back (`back` m) and off its line (`aside` m)
 * over `duration` s, less for heavier targets; `daze` takes the stick and the line away for up to
 * `duration` s, less for nimbler targets, while it twitches at `jolt` of its lateral speed and sinks at `sink` m/s.
 */
export const hitEffects = {
  slow: { cut: 0.25, duration: 1.8 * T },
  knock: { back: 4 * L, aside: 5 * L, duration: 0.5 * T },
  daze: { duration: 0.45 * T, jolt: 0.4, sink: 2 * V },
};

/** Statuses a racer can carry, keyed by id, with how long one lasts at most for the badges. */
export const breathStatuses = {
  slow: { id: "slow", duration: 2 * hitEffects.slow.duration },
  daze: { id: "daze", duration: hitEffects.daze.duration },
};

/** Puts status `id` on `racer` until `until`, extending one it already has. */
export function afflict(racer, id, until) {
  racer.effects ??= {};
  racer.effects[id] = Math.max(racer.effects[id] ?? 0, until);
}

/** The statuses on `racer` at race time `t`, as `[{ id, until }]`; spent ones are dropped. */
export function activeEffects(racer, t) {
  if (!racer.effects) return [];
  const list = [];
  for (const [id, until] of Object.entries(racer.effects)) {
    if (until > t) list.push({ id, until });
    else delete racer.effects[id];
  }
  return list;
}

/** How the hits on `racer` at `t` change its flight: `speed` scales the speed it aims for, `dazed` takes control away. */
export function effectModifiers(racer, t) {
  const dazed = (racer.effects?.daze ?? 0) > t;
  return {
    speed: (racer.effects?.slow ?? 0) > t ? 1 - (racer.slowCut ?? 0) : 1,
    dazed,
    jolt: dazed ? hitEffects.daze.jolt : 0,
    sink: dazed ? hitEffects.daze.sink : 0,
  };
}
