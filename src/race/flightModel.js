import { froude } from "./froude.js";
import { creatureScale } from "../worldScale.js";

export const gravity = 9.81;
export const minSpeed = 12 * froude.speed;
export const diveRate = 18 * froude.speed;
/** Wing effort while gliding: below it the wings stop beating. */
export const glideEffort = 0.3;
/** Wing effort on a steady stretch at top speed; it rises to 1 while accelerating or climbing. */
export const cruiseEffort = 0.55;

const zoomSpeed = 18 * froude.speed;
const zoom = (speed) => Math.max(0, speed - zoomSpeed) * 0.4;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Share of top speed below which the full acceleration applies; closer to it, it eases off. */
const easeBand = 0.12;
/** How fast speed above the target bleeds away (1/s), for a dragon of weight 1. */
const overspeedBleed = 0.35 * froude.rate;

/**
 * Change of airspeed (m/s²) towards `target`: up at the dragon's acceleration, easing off near the
 * target, and speed over it (a dive, a slingshot) bleeding away slower for heavier dragons.
 */
export function speedChange(stats, v, target) {
  if (v < target) return stats.acceleration * clamp((target - v) / (easeBand * target), 0, 1);
  return (-(v - target) * overspeedBleed) / stats.weight;
}

/** Climb rate the wings sustain; anything faster is a zoom paid for with airspeed. */
export const flapClimb = (stats) => stats.climb;

/** Line changes are heading changes: up to half the airspeed sideways, steered with handling. */
export const lateralSpeed = (speed) => speed * 0.5;
export const lateralAccel = (stats) => stats.handling * 1.1;

/** Air-relative vertical speed range: flapping climbs, speed above `zoomSpeed` can zoom higher. */
export const verticalRange = (stats, speed = 0) => [-diveRate, flapClimb(stats) + zoom(speed)];

/** The wing effort that shows how hard it works: gliding in a dive, beating hard while accelerating or climbing. */
export function wingEffort(v, target, vy, climb) {
  if (vy < -0.25 * diveRate) return glideEffort * 0.5;
  const accelerating = clamp((target - v) / (easeBand * target), 0, 1);
  const climbing = clamp(vy / Math.max(climb, 1e-6), 0, 1);
  return clamp(cruiseEffort + (1 - cruiseEffort) * Math.max(accelerating, climbing), 0, 1);
}

/**
 * Wingbeat frequency in Hz: faster when working hard, and like a pendulum √(g / span) slower for
 * long wings. Tuned at a 12.4 m reference span; wingspan genes are real metres (16 m on average).
 */
const referenceSpan = 12.4;
export const flapRate = (effort, wingspan = referenceSpan * creatureScale) =>
  (0.68 + 1.42 * effort) * Math.sqrt(referenceSpan / wingspan);
