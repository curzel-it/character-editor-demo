import { makeRng } from "../rng.js";
import { normalize } from "../vec3.js";
import { raceGeometry } from "./raceGeometry.js";
import { deriveStats } from "./deriveStats.js";
import { raceForm, applyForm } from "./racerTraits.js";
import { buildOf } from "../dragonBuild.js";
import { genes as dragonGenes } from "../genome/dragon.js";
import { decide } from "./pilot.js";
import {
  gravity,
  minSpeed,
  speedChange,
  verticalRange,
  flapRate,
  flapClimb,
  lateralSpeed,
  lateralAccel,
  wingEffort,
} from "./flightModel.js";
import { froude } from "./froude.js";
import { grownWingspan, ageOf } from "../dragonAge.js";
import { planLanding, stepLanding, landingSettle, ground, rootHeight } from "./landing.js";
import { planTakeoff, stepTakeoff } from "./takeoff.js";
import { createBreathAttacks } from "./breathAttacks.js";
import { createBreathHits } from "./breathHits.js";
import { activeEffects, effectModifiers } from "./breathEffects.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const effectsFrame = (r, t) => {
  const effects = activeEffects(r, t);
  return effects.length ? { effects: effects.map(({ id, until }) => ({ id, until: round(until) })) } : {};
};
const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

export const simulationHz = 60;
export const recordingHz = 20;
const { length: L, speed: V, time: T, rate: R } = froude;
/** Seconds after missing a gate that a racer aims `missSlow` below its top speed. */
export const missPenalty = 2.5 * T;
const missSlow = 0.25;
/** Deceleration (m/s²) when pulling the full handling stat. */
const turnDrag = 1.5;
/** How far a roaming rider may stray: a multiple of the corridor's half width, and short of where a bend folds the lanes. */
const roam = { width: 3, bend: 0.6 };
/**
 * Slipstream raises the speed a chaser aims for by up to `gain`, and what it gained lingers for
 * `sling` s after it pulls out, the slingshot past. A clean pass through a gate's centre (within
 * `centre` of its radius) gives a `burst` the same way.
 */
const slipstream = { gain: 0.05, near: 2 * L, far: 25 * L, width: 5 * L, height: 4 * L, sling: 2 * T };
const gateBurst = { centre: 0.4, burst: 0.03 };
const clearance = { side: 3 * L, body: 3 * L };
const separation = { distance: 4.5 * L, rate: 12 * R, axis: 0.3 * L };
/** Speed (m/s) a bump costs, split between the two so the lighter one loses more, all of it to one being shoved by a breath; `rest` s before the same pair bumps again. */
const bump = { loss: 3.5 * V, rest: 1.5 * T };
const tune = {
  bankTime: 0.35 * T,
  overtime: 20 * T,
  cooldown: 2 * T,
  tie: 0.5 * L,
};

function thermalLift(thermals, point) {
  let lift = 0,
    inside = null;
  for (const thermal of thermals) {
    const d = Math.hypot(point[0] - thermal.position[0], point[2] - thermal.position[2]);
    if (d < thermal.radius) {
      lift += thermal.lift * (1 - (d / thermal.radius) ** 2);
      inside ??= thermal;
    }
  }
  return { lift, inside };
}

function advanceFlap(r, dt) {
  const rate = flapRate(r.effort, r.wingspan);
  if (r.effort >= 0.3) r.flap = (r.flap + rate * dt) % 1;
  else if (r.flap !== 0 && r.flap !== 0.5)
    r.flap = Math.min(r.flap < 0.5 ? 0.5 : 1, r.flap + rate * dt) % 1;
}

/**
 * The race simulation, advanced one fixed step (1/`simulationHz` s) at a time by `step()`. The
 * recording grows as it goes, one frame every 1/`hz` s, and is complete once `done`. `pilots` maps
 * racer ids to a function that replaces the racer AI's `decide(racer, ctx)` for that racer; its
 * decision may add `agility` (default 1), how much sharper than the AI it manoeuvres: faster
 * lateral and vertical changes, steeper dives and zooms; and `roam`, leaving the corridor's width
 * for the open terrain around it.
 * A racer flies at its top speed unless something slows it: a missed gate, a breath hit, a bump, a
 * turn tighter than its handling, the takeoff; its acceleration brings it back. A roster entry's
 * `strength` (stars) sets its stats with its build, and its form is rolled from the seed unless the entry
 * sets `form`.
 */
export function createRaceSim({ seed, course, roster, hz = recordingHz, pilots = {} }) {
  const { corridor, gates, thermals, finishS } = raceGeometry(course);
  const dt = 1 / simulationHz,
    every = simulationHz / hz;
  const entries = roster.map((entry) => ({
    ...entry,
    stats: deriveStats(entry.subject, entry.genome, entry.age, entry.strength),
    form: entry.form ?? raceForm(seed, entry.id),
  }));
  const groundContext = { corridor, course };
  const racers = entries.map((entry, i) => {
    const slot = course.start.grid[i % course.start.grid.length];
    const adjusted = { ...entry.stats };
    for (const [key, delta] of Object.entries(roster[i].adjust || {})) adjusted[key] += delta;
    const stats = applyForm(adjusted, entry.form);
    const start = planTakeoff(entry, slot, stats, seed, groundContext);
    const random = makeRng(`race:${seed}:${entry.id}`);
    return {
      id: entry.id,
      index: i,
      stats,
      build: buildOf(dragonGenes, entry.genome),
      wingspan: grownWingspan(entry.genome, entry.age),
      genome: entry.genome,
      age: entry.age,
      random,
      s: start.s,
      u: start.u,
      y: start.y,
      v: 0,
      vy: 0,
      vu: 0,
      lift: 0,
      effort: 0,
      penalty: 0,
      draft: 0,
      boost: 0,
      bank: 0,
      flap: 0,
      forward: [1, 0, 0],
      gate: 0,
      finished: false,
      time: null,
      lane: clamp(((i % 6) - 2.5) / 2.5 + (random() - 0.5) * 0.4, -1, 1),
      laneY: (i % 2 ? 0.6 : -0.6) + (random() - 0.5) * 0.3,
      used: new Set(),
      seeking: null,
      reported: false,
      landing: null,
      takeoff: start.takeoff,
      climbOut: start.climbOut,
      retired: false,
    };
  });
  const frames = [],
    events = [];
  const hits = createBreathHits(racers);
  const emit = (t, type, racer, extra = {}) => {
    const event = { t: round(t), type, racer: racer.id, ...extra };
    events.push(event);
    if (type === "breath") hits.watch(t, event);
  };
  let order = [...racers].sort((a, b) => b.s - a.s);
  const ahead = (a, b) =>
    a.finished !== b.finished
      ? a.finished
      : a.finished
        ? a.time < b.time
        : a.s > b.s + tune.tie;
  const typical = Math.min(...racers.map((r) => r.stats.topSpeed));
  const maxTime = (finishS - corridor.start) / (typical * 0.45) + tune.overtime;
  let allDone = null,
    closing = false,
    airborne = 0;
  const taken = new Set();
  const landingContext = { corridor, course, taken };

  const breaths = createBreathAttacks(seed, racers, pilots);

  const recording = { seed: String(seed), hz, duration: 0, roster: entries, frames, events, results: [] };
  const record = (t) => {
    recording.duration = round(t);
    frames.push({
      t: round(t),
      racers: racers.map((r) => {
        const frame = corridor.at(r.s);
        return {
          id: r.id,
          position: corridor.world(r.s, r.u, r.y, frame).map((v) => round(v)),
          forward: r.forward.map((v) => round(v, 4)),
          bank: round(r.bank, 4),
          flap: round(r.flap, 4) % 1,
          speed: round(r.v),
          progress: round(r.s),
          gate: r.gate,
          place: order.indexOf(r) + 1,
          finished: r.finished,
          effort: round(r.effort, 3),
          landing: round(r.landing?.progress ?? 0, 3),
          grounded: !!(r.landing?.grounded || r.takeoff?.grounded),
          takeoff: !!r.takeoff,
          ...effectsFrame(r, t),
        };
      }),
    });
  };

  record(0);
  let step = 0,
    done = false;
  const bumped = new Map();
  function advance() {
    if (done) return;
    step++;
    const t = step * dt;
    for (const r of racers) {
      r.draft = 0;
      for (const o of racers) {
        if (o === r || o.landing) continue;
        const ds = o.s - r.s,
          du = Math.abs(o.u - r.u),
          dy = Math.abs(o.y - r.y);
        if (ds > slipstream.near && ds < slipstream.far && du < slipstream.width && dy < slipstream.height)
          r.draft = Math.max(
            r.draft,
            slipstream.gain *
              (1 - (ds - slipstream.near) / (slipstream.far - slipstream.near)) *
              (1 - du / slipstream.width),
          );
      }
    }
    const context = { t, corridor, gates, thermals, finishS, racers };
    const decisions = racers.map((r) => (pilots[r.id] ?? decide)(r, context));
    racers.forEach((r, i) => {
      if (r.landing) {
        const touchdown = stepLanding(r, t, dt, landingContext);
        if (touchdown)
          emit(t, "land", r, {
            ...touchdown,
            position: touchdown.position.map((v) => round(v)),
            forward: touchdown.forward.map((v) => round(v, 4)),
            speed: round(touchdown.speed),
            heft: ageOf(r.age).heft,
          });
        advanceFlap(r, dt);
        return;
      }
      const decision = decisions[i];
      for (const { type, ...extra } of decision.events) emit(t, type, r, extra);
      if (r.takeoff) {
        const launch = stepTakeoff(r, t, dt, decision, groundContext);
        if (launch)
          emit(t, "launch", r, {
            ...launch,
            position: launch.position.map((v) => round(v)),
            forward: launch.forward.map((v) => round(v, 4)),
            speed: round(launch.speed),
            heft: ageOf(r.age).heft,
          });
        if (!r.takeoff) emit(t, "airborne", r, airborne++ ? {} : { first: true });
        advanceFlap(r, dt);
        return;
      }
      const S = r.stats;
      const mods = effectModifiers(r, t);
      if (r.y >= r.climbOut) r.climbOut = -Infinity;
      const frame = corridor.at(r.s);
      const point = corridor.world(r.s, r.u, r.y, frame);
      const air = thermalLift(thermals, point);
      r.lift = air.lift;
      if (air.inside && !r.used.has(air.inside.index) && !r.finished) {
        r.used.add(air.inside.index);
        emit(t, "thermal", r, { detail: `thermal +${round(air.inside.lift, 1)} m/s` });
      }
      const [vyLo, vyHi] = verticalRange(S, r.v);
      const agility = decision.agility ?? 1;
      const yWish = mods.dazed ? r.lift - mods.sink : decision.yWish;
      const vyTarget = clamp(yWish - r.lift, vyLo * agility, vyHi * agility);
      r.vy += clamp(vyTarget - r.vy, -7 * agility * dt, 7 * agility * dt);
      const latMax = lateralSpeed(r.v),
        latCap = lateralAccel(S) * agility * dt;
      const uWish = mods.dazed ? (Math.sin(t * 23 + r.index) >= 0 ? 1 : -1) * mods.jolt * latMax : decision.uWish;
      const vuTarget = clamp(uWish, -latMax, latMax);
      const latAccel = clamp(vuTarget - r.vu, -latCap, latCap) / dt;
      r.vu += latAccel * dt;

      const bend = clamp(frame.kappa * r.u, -0.8, 0.8);
      const curve = frame.kappa / (1 - bend);
      const aLat = Math.abs(r.v * r.v * curve + latAccel);
      const turnLoss = turnDrag * (aLat / S.handling) ** 2 + 0.8 * Math.max(0, aLat - S.handling);
      r.boost = Math.max(r.draft, r.boost - (slipstream.gain / slipstream.sling) * dt);
      const target = S.topSpeed * mods.speed * (1 + r.boost) * (r.penalty > 0 ? 1 - missSlow : 1);
      const wingClimb = Math.min(Math.max(0, r.vy), flapClimb(S));
      const paid = r.vy - wingClimb;
      const accel = speedChange(S, r.v, target) - (gravity * paid) / Math.max(r.v, minSpeed) - turnLoss;
      r.v = Math.max(minSpeed, r.v + accel * dt);
      r.effort += (wingEffort(r.v, target, r.vy, S.climb) - r.effort) * Math.min(1, dt / tune.bankTime);
      r.vy = clamp(r.vy, -r.v * 0.7, r.v * 0.7);
      const vh = Math.sqrt(Math.max(0, r.v * r.v - r.vy * r.vy - r.vu * r.vu));
      const prev = { s: r.s, u: r.u, y: r.y };
      r.s += ((vh * frame.ratio) / (1 - bend)) * dt;
      r.u += r.vu * dt;
      r.y += (r.vy + r.lift) * dt;
      if (r.shove && t < r.shove.until) {
        r.s += r.shove.vs * dt;
        r.u += r.shove.vu * dt;
      } else r.shove = null;
      r.penalty = Math.max(0, r.penalty - dt);

      const gate = gates[r.gate];
      if (gate && !r.finished && !r.retired && prev.s < gate.s && r.s >= gate.s) {
        const k = (gate.s - prev.s) / (r.s - prev.s);
        const u = prev.u + (r.u - prev.u) * k,
          y = prev.y + (r.y - prev.y) * k;
        const off = Math.hypot(u - gate.u, y - gate.y);
        const miss = off > gate.radius;
        const last = r.gate === gates.length - 1;
        r.gate++;
        if (last) {
          r.finished = true;
          r.time = t - dt + dt * k;
          r.landing = planLanding(r, t, landingContext);
        } else if (miss) {
          r.penalty = missPenalty;
          emit(t, "miss", r, {
            gate: gate.index,
            by: round(off - gate.radius, 2),
            detail: `missed gate ${gate.index + 1} by ${(off - gate.radius).toFixed(1)} m`,
          });
        } else {
          if (off < gate.radius * gateBurst.centre) r.boost = Math.max(r.boost, gateBurst.burst);
          emit(t, "gate", r, { gate: gate.index, detail: `gate ${gate.index + 1}` });
        }
      }

      r.forward = normalize([
        frame.forward[0] * vh + frame.left[0] * r.vu,
        r.vy + r.lift,
        frame.forward[2] * vh + frame.left[2] * r.vu,
      ]);
      const bankTarget = clamp(Math.atan((r.v * r.v * curve + latAccel) / gravity), -1.1, 1.1);
      r.bank += (bankTarget - r.bank) * Math.min(1, dt / tune.bankTime);
      advanceFlap(r, dt);
    });

    for (let i = 0; i < racers.length; i++)
      for (let j = i + 1; j < racers.length; j++) {
        const a = racers[i],
          b = racers[j];
        if (a.landing || b.landing) continue;
        const ds = a.s - b.s,
          du = a.u - b.u,
          dy = a.y - b.y;
        const d = Math.hypot(ds, du, dy);
        if (d < separation.distance) {
          const key = `${a.index}:${b.index}`;
          if (!(bumped.get(key) > t) && !a.finished && !b.finished && !a.takeoff && !b.takeoff) {
            const shoved = (r) => (r.shove && r.shove.until > t ? 1 : 0);
            const total = a.stats.weight ** 2 + b.stats.weight ** 2;
            const share = shoved(a) !== shoved(b) ? shoved(a) : b.stats.weight ** 2 / total;
            a.v = Math.max(minSpeed, a.v - bump.loss * share);
            b.v = Math.max(minSpeed, b.v - bump.loss * (1 - share));
            emit(t, "bump", a, { other: b.id });
          }
          bumped.set(key, t + bump.rest);
          const push = ((separation.distance - d) / 2) * Math.min(1, separation.rate * dt);
          const lateral = Math.hypot(du, dy);
          const ku = lateral > separation.axis ? du / lateral : a.index < b.index ? 1 : -1;
          const ny = lateral > separation.axis ? dy / lateral : 0;
          a.u += ku * push;
          b.u -= ku * push;
          a.y += ny * push;
          b.y -= ny * push;
        }
      }

    for (const [i, r] of racers.entries()) {
      if (r.landing) continue;
      const frame = corridor.at(r.s);
      const room = decisions[i].roam ? Math.max(frame.halfWidth, Math.min(roam.width * frame.halfWidth, roam.bend / Math.max(Math.abs(frame.kappa), 1e-6))) : frame.halfWidth;
      const width = room - clearance.side;
      if (Math.abs(r.u) > width) {
        r.u = clamp(r.u, -width, width);
        r.vu = 0;
      }
      if (r.takeoff) {
        r.y = Math.max(r.y, rootHeight(ground(corridor, course, r.s, r.u), r.takeoff.stand));
        continue;
      }
      const { lo, hi } = corridor.band(r.s, r.u, frame, clearance.body);
      if (r.y < lo) {
        r.y = lo;
        r.vy = Math.max(r.vy, 0);
      } else if (r.y > hi) {
        r.y = hi;
        r.vy = Math.min(r.vy, 0);
      }
    }

    breaths.step(t, dt, emit);
    hits.step(t, dt, emit);

    let swapped = true;
    while (swapped) {
      swapped = false;
      for (let i = 1; i < order.length; i++)
        if (ahead(order[i], order[i - 1])) {
          const passer = order[i],
            passed = order[i - 1];
          order[i - 1] = passer;
          order[i] = passed;
          swapped = true;
          if (!passer.finished || !passed.finished) {
            if (!passer.finished)
              emit(t, "overtake", passer, { other: passed.id, place: i });
          }
        }
    }
    for (const r of racers)
      if (r.finished && !r.reported) {
        r.reported = true;
        emit(r.time, "finish", r, {
          place: order.indexOf(r) + 1,
          detail: `${round(r.time, 2).toFixed(2)} s`,
        });
      }

    if (step % every === 0) record(t);
    if (allDone === null && racers.every((r) => r.finished)) allDone = t;
    const overtime = t >= maxTime;
    if (!closing && ((allDone !== null && t >= allDone + tune.cooldown) || overtime) && step % every === 0) {
      closing = true;
      for (const r of racers)
        if (!r.finished) {
          r.retired = true;
          emit(t, "dnf", r, { detail: "did not finish" });
        }
    }
    const settled = racers.every((r) => !r.landing || (r.landing.grounded && t >= r.landing.landedAt + landingSettle));
    if (closing && settled && step % every === 0) close();
  }

  function close() {
    done = true;
    events.sort((a, b) => a.t - b.t);
    recording.results = order.map((r, i) => ({
      id: r.id,
      place: i + 1,
      time: r.finished ? round(r.time, 4) : null,
    }));
  }

  return {
    recording,
    /** Advances the race by one simulation step; does nothing once the race is done. */
    step: advance,
    get t() {
      return step * dt;
    },
    get done() {
      return done;
    },
  };
}
