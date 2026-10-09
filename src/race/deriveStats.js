import { genes as dragonGenes } from "../genome/dragon.js";
import { statLevels } from "../dragonBuild.js";
import { froude } from "./froude.js";
import { ageStats } from "../dragonAge.js";

const geneTables = { dragon: dragonGenes };
const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * Racing stats from the dragon's build and strength (`statLevels`), in flight units:
 * topSpeed: level airspeed (m/s) on a clear stretch. acceleration: m/s² back up to top speed, less
 * for heavier dragons. climb: climb rate (m/s) the wings sustain, from the same big wings.
 * handling: lateral acceleration (m/s²); turns tighter than it bleed speed. weight: relative bulk,
 * which wins bumps, shrugs off breath and holds speed in dives. breath: the power of its breath, and
 * `recharge`, the seconds until it can breathe again.
 * Speeds are tuned at the reference scale and Froude-scaled; `age` scales the result.
 */
export function deriveStats(subject, genome, age, strength) {
  const id = typeof subject === "string" ? subject : subject?.id;
  const table = subject?.genes ?? geneTables[id];
  if (!table) throw new Error(`No racing stats for subject: ${id}`);
  return ageStats(flightStats(statLevels(table, genome, strength)), age);
}

/** Flight stats from the five stat levels (`statLevels`). */
export function flightStats(level) {
  const weight = 0.75 + 0.12 * level.weight;
  const breath = (0.4 + 0.2 * level.breath) ** 1.5;
  return {
    topSpeed: round((34 + 0.5 * level.topSpeed) * froude.speed),
    acceleration: round((2 + 0.18 * level.acceleration) / weight ** 0.15),
    climb: round((5.7 + 0.45 * level.acceleration) * froude.speed),
    handling: round(5.6 + 1.5 * level.handling),
    weight: round(weight),
    breath: round(breath),
    recharge: round((9 * froude.time) / breath),
  };
}
