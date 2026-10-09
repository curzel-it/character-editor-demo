import { froude } from "./froude.js";
import { breathElements, breathOf, matchup } from "../breath/breathElements.js";
import { breathCue, breathLength } from "../breath/breathCue.js";
import { afflict, hitEffects } from "./breathEffects.js";

const { length: L } = froude;
/** Where a plume reaches from the racer breathing it: a cone ahead, or a band out to one side. */
const plume = {
  ahead: { far: 16 * L, width: 5 * L },
  beside: { along: 3.5 * L, near: 2 * L, far: 10 * L },
  height: 4 * L,
};
/** The handling a daze is measured against: nimbler dragons shake it off sooner. */
const steadyHandling = 8;
const round = (v) => Math.round(v * 1000) / 1000;

const inPlume = (from, to, aim) => {
  const ds = to.s - from.s,
    du = to.u - from.u;
  if (Math.abs(to.y - from.y) > plume.height) return false;
  if (aim === "ahead") return ds > 0 && ds < plume.ahead.far && Math.abs(du) < plume.ahead.width;
  const side = aim === "left" ? du : -du;
  return Math.abs(ds) < plume.beside.along && side > plume.beside.near && side < plume.beside.far;
};

/**
 * Lands a hit of `element` breathed by `from` on `r` at `t`, scaled by the breather's Breath and the
 * matchup, and returns what it did: `slow` (share of speed cut), `knock` (metres pushed back) and
 * `daze` (seconds out of control).
 */
export function landHit(from, r, element, t) {
  const power = from.stats.breath * matchup(element.id, breathOf(r.genome).id);
  const linger = { slow: 1, knock: 1, ...element.linger };
  const { slow, knock, daze } = hitEffects;
  const cut = (slow.cut * power * element.lean.slow) / linger.slow;
  if ((r.effects?.slow ?? 0) <= t || cut > (r.slowCut ?? 0)) r.slowCut = cut;
  afflict(r, "slow", t + slow.duration * linger.slow);
  const span = knock.duration * linger.knock;
  const back = (knock.back * power * element.lean.knock) / linger.knock / r.stats.weight ** 2;
  const side = r.u >= from.u ? 1 : -1;
  r.shove = { vs: -back / span, vu: (side * back * (knock.aside / knock.back)) / span, until: t + span };
  const dazed = daze.duration * Math.min(1, 0.6 * power * element.lean.daze * (steadyHandling / r.stats.handling));
  afflict(r, "daze", t + dazed);
  return { slow: cut, knock: back, daze: dazed };
}

/**
 * Hits from breath plumes. `watch` takes every `breath` event as it is emitted, from the racer AI or
 * a rider; while its plume pours, the first time it touches a rival it lands a hit on it
 * (`landHit`). When the breath is spent, each rival it hit gets a `hit` event (`other` the breather,
 * `element`, `matchup`, what it did and `amount`, how hard it was overall, 0..1), stamped at the hit.
 */
export function createBreathHits(racers) {
  const byId = new Map(racers.map((r) => [r.id, r]));
  const live = [];
  return {
    watch(t, event) {
      const element = breathElements.find((e) => e.id === event.element);
      const from = byId.get(event.racer);
      if (!element || !from) return;
      live.push({ t, from, aim: event.aim, element, touched: new Map() });
    },
    step(t, dt, emit) {
      for (let i = live.length - 1; i >= 0; i--) {
        const b = live[i];
        const age = t - b.t;
        if (breathCue(age).breath > 0 && !b.from.landing && !b.from.retired)
          for (const r of racers) {
            if (r === b.from || b.touched.has(r) || r.finished || r.landing || r.retired || !inPlume(b.from, r, b.aim)) continue;
            b.touched.set(r, { t, ...landHit(b.from, r, b.element, t) });
            r.hitAt = t;
          }
        if (age < breathLength) continue;
        live.splice(i, 1);
        for (const [r, hit] of b.touched) {
          const m = matchup(b.element.id, breathOf(r.genome).id);
          emit(hit.t, "hit", r, {
            other: b.from.id,
            element: b.element.id,
            matchup: m,
            slow: round(hit.slow),
            knock: round(hit.knock),
            daze: round(hit.daze),
            until: round(hit.t + hitEffects.slow.duration),
            amount: round(Math.min(1, (b.from.stats.breath * m) / 3)),
            detail: `${b.element.label.toLowerCase()} hit${m > 1 ? ", super effective" : m < 1 ? ", resisted" : ""}`,
          });
        }
      }
    },
  };
}
