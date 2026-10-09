import { froude } from "./froude.js";

/** A public handicap for a racer's stats, higher is better: roughly what each stat is worth in a race, for picking the favourite. */
export const handicap = (stats) => stats.topSpeed / froude.speed + stats.acceleration + 0.3 * stats.handling + 0.5 * stats.weight + 0.5 * stats.breath;
