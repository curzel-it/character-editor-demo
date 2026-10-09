import { decide } from "./pilot.js";
import { minSpeed, verticalRange } from "./flightModel.js";
import { breathe, breathTarget } from "./breathAttacks.js";
import { canBreathe } from "../dragonAge.js";

const tune = { curve: 2 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const reach = Math.asin(0.5);
const bend = (stick) => Math.abs(stick) ** tune.curve;

/**
 * @typedef {{ type: "stick", x: number, y: number } | { type: "breath" }} RiderCommand
 * `stick` turns (`x`, positive towards the corridor's +u, which is the rider's right) and climbs or dives
 * (`y`), each -1..1; `breath` breathes the dragon's element at a rival in reach, or straight ahead,
 * once its breath has recharged; a kid never breathes.
 */

/**
 * A pilot for `createRaceSim` that the owner flies directly. Left alone the dragon flies the racer
 * AI's line (`decide`); the stick bends that line at once, free of the corridor's width, a full
 * stick turning as hard across the course or climbing or diving as steeply as the dragon can, and
 * the dragon is back on the line once the stick is let go. The dragon always flies at the pace its
 * stats allow; its stats cap every move and thermals still lift. A daze leaves it flying on its own
 * until it clears. Commands given with `give` are stamped with the race time and logged, so passing
 * a `script` (a previous `log`) replays a flight exactly. `from` is the race time of the step before
 * the first one it flies, for a rider taking over mid-race.
 * @param {{ script?: (RiderCommand & { t: number })[], from?: number }} options
 */
export function createRiderPilot({ script = null, from = 0 } = {}) {
  const queue = [],
    /** @type {(RiderCommand & { t: number })[]} */
    log = [];
  const state = { x: 0, y: 0, breathReady: from };
  let played = 0;

  function receive(entry, racer, ctx, events) {
    const last = log.at(-1);
    if (entry.type === "stick" && last?.type === "stick" && last.t === entry.t) log[log.length - 1] = entry;
    else log.push(entry);
    if (entry.type === "stick") {
      state.x = clamp(entry.x, -1, 1);
      state.y = clamp(entry.y, -1, 1);
    } else if (ctx.t >= (racer.breathReady ?? 0) && canBreathe(racer.age)) events.push(breathe(racer, breathTarget(racer, ctx.racers), ctx.t));
  }

  /** @type {(racer: object, ctx: object) => object} */
  const pilot = (racer, ctx) => {
    const line = decide(racer, ctx);
    if (racer.finished) return line;
    const { t } = ctx;
    const events = [...line.events];
    if (script) while (played < script.length && script[played].t <= t + 1e-9) receive(script[played++], racer, ctx, events);
    else for (const command of queue.splice(0)) receive({ t, ...command }, racer, ctx, events);
    state.breathReady = racer.breathReady ?? 0;

    const dazed = (racer.effects?.daze ?? 0) > t;
    const x = dazed ? 0 : state.x,
      y = dazed ? 0 : state.y;
    const v = Math.max(racer.v, minSpeed);
    const [dive, climb] = verticalRange(racer.stats, v);
    const [lowest, highest] = [dive, climb].map((w) => Math.asin(clamp(w / v, -1, 1)));
    const lineHeading = Math.asin(clamp(line.uWish / v, -0.5, 0.5));
    const heading = lineHeading + (Math.sign(x) * reach - lineHeading) * bend(x);
    const linePitch = Math.asin(clamp((line.yWish - racer.lift) / v, -1, 1));
    const pitch = linePitch + ((y > 0 ? Math.max(linePitch, highest) : Math.min(linePitch, lowest)) - linePitch) * bend(y);
    return {
      roam: true,
      uWish: Math.sin(heading) * v,
      yWish: racer.lift + Math.sin(pitch) * v,
      events,
    };
  };

  return {
    pilot,
    /** Hands the dragon a command; it is taken up at the next simulation step. Ignored when replaying. */
    give(/** @type {RiderCommand} */ command) {
      if (!script) queue.push(command);
    },
    /** The stick as the dragon follows it and when the next breath is ready. */
    state,
    log,
  };
}
