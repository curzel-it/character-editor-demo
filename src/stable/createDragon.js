import { racerName } from "../racerName.js";
import { freshCare } from "./care.js";
import { hatchBond } from "./bond.js";

/** An owned dragon: the race participant fields (the owner rides it) plus growth, care, bond (0..1), strength (stars, 1 to 5), condition, lineage and record. */
export function createDragon({ seed, genome, age = "kid", now = 0, parents = null, from = null, generation = 0, bond = hatchBond, strength = 1, id = `s-${seed}` }) {
  return {
    id,
    name: racerName(seed),
    seed: String(seed),
    genome,
    harness: true,
    age,
    growth: 0,
    hatchedAt: now,
    care: freshCare(),
    bond,
    strength,
    starsCelebrated: Math.floor(strength),
    fatigue: 0,
    injury: null,
    parents,
    from,
    generation,
    record: { starts: 0, wins: 0, podiums: 0 },
    history: [],
  };
}
