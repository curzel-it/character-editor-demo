import { lateralSpeed, lateralAccel } from "./flightModel.js";
import { froude } from "./froude.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const { length: L, speed: V, time: T } = froude;
/** Reference-scale tuning, converted by dimension. */
const tune = {
  minSpeed: 10 * V,
  lookahead: 2.5 * T,
  wallMargin: 4 * L,
  bendLength: 70 * L,
  rivalAhead: [1 * L, 30 * L],
  rivalAbreast: 10 * L,
  passSpeed: 0.6 * V,
  passOffset: [5 * L, 9 * L],
  thermalDetour: 14 * L,
  thermalRange: 200 * L,
  gateSettle: 1 * T,
  gateBlend: 2 * T,
  gateReach: [0.6 * T, 0.4 * T],
  cruiseTime: 2 * T,
  climbTime: [1 * T, 0.6 * T],
  thermalLift: 0.5 * V,
  thermalStay: 2.5 * T,
  drift: 3 * T,
};

/**
 * Racer AI: steers the line from the racer's build and the seeded lane it was given, the next
 * gate, rivals ahead (slipstream or pass) and thermals worth a detour; it always flies flat out.
 * High handling cuts tighter inside lines, high top speed takes the wide, smooth line; heavy dragons
 * hold their line through contact and light ones go round it. Mutates only `racer.seeking`.
 */
export function decide(racer, ctx) {
  const { stats, build } = racer,
    { corridor, gates, thermals } = ctx;
  if (racer.finished) return { uWish: -racer.u / tune.drift, yWish: 0, events: [] };
  const inside = clamp(0.5 + (build?.handling ?? 1) - (build?.topSpeed ?? 1), 0, 1);
  const heavy = clamp(((build?.weight ?? 1) - 0.7) / 0.6, 0, 1);

  const gate = gates[racer.gate];
  const speed = Math.max(racer.v, tune.minSpeed);
  const tau = gate ? (gate.s - racer.s) / speed : Infinity;
  const frame = corridor.at(racer.s);
  const ahead = corridor.at(racer.s + speed * tune.lookahead);
  const turn = ahead.kappa;
  const width = frame.halfWidth - tune.wallMargin;
  let lineU =
    Math.sign(turn) *
    Math.min(1, Math.abs(turn) * tune.bendLength) *
    width *
    (0.15 + 0.7 * inside);

  let rival = null;
  for (const other of ctx.racers) {
    if (other === racer || other.finished) continue;
    const ds = other.s - racer.s;
    if (
      ds > tune.rivalAhead[0] &&
      ds < tune.rivalAhead[1] &&
      Math.abs(other.u - racer.u) < tune.rivalAbreast &&
      (!rival || ds < rival.s - racer.s)
    )
      rival = other;
  }
  if (rival) {
    if (racer.v > rival.v + tune.passSpeed) {
      const offset = tune.passOffset[1] + (tune.passOffset[0] - tune.passOffset[1]) * heavy;
      const side = racer.u >= rival.u ? 1 : -1;
      const room = side * (rival.u + side * offset) < width ? side : -side;
      lineU = rival.u + room * offset;
    } else lineU = rival.u;
  }

  racer.seeking = null;
  for (const thermal of thermals) {
    const ds = thermal.s - racer.s;
    const detour = Math.abs(thermal.u - racer.u) - thermal.radius * 0.5;
    if (ds > -thermal.radius * 0.5 && ds < tune.thermalRange && detour < tune.thermalDetour && !racer.used.has(thermal.index)) {
      racer.seeking = thermal;
      lineU = clamp(thermal.u, -width, width);
      break;
    }
  }

  const accel = lateralAccel(stats);
  const gateU = gate ? gate.u + racer.lane * gate.radius * 0.3 : 0;
  const needU = gate
    ? 2 * Math.sqrt(Math.abs(gateU - racer.u) / accel) + tune.gateSettle
    : 0;
  const blend = gate ? clamp((tau - needU) / tune.gateBlend, 0, 1) : 1;
  const targetU = clamp(gateU * (1 - blend) + lineU * blend, -width, width);
  const du = targetU - racer.u;
  const uWish =
    Math.sign(du) *
    Math.min(
      Math.abs(du) /
        (blend < 1 ? Math.max(tau - tune.gateReach[0], tune.gateReach[1]) : tune.cruiseTime),
      Math.sqrt(1.2 * accel * Math.abs(du)),
      lateralSpeed(speed),
    );

  const targetY = gate ? gate.y + racer.laneY * gate.radius * 0.25 : racer.y;
  let yWish = (targetY - racer.y) / Math.max(tau - tune.climbTime[0], tune.climbTime[1]);
  const inThermal = racer.lift > tune.thermalLift;
  if (inThermal && tau > tune.thermalStay) yWish = Math.max(yWish, racer.lift * 0.8);
  return { uWish, yWish, events: [] };
}
