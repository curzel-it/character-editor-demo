import { makeGenome, restoreGenome } from "./subjects.js";
import { racerName } from "./racerName.js";
import { creatureScale } from "./worldScale.js";
import { createJockey, restoreJockey } from "./jockey/createJockey.js";
import { courseType } from "./course/createCourse.js";
import { ageOf, defaultAge } from "./dragonAge.js";

const storageKey = "dragonz-race-field";
const version = 3;
const metric = ["body", "wingspan", "neck", "tail", "spines"];

function migrate(genome, from) {
  if (from >= 2 || !genome) return genome;
  const scaled = { ...genome };
  for (const name of metric)
    if (Number.isFinite(scaled[name])) scaled[name] *= creatureScale;
  return scaled;
}
export const fieldLimits = { min: 2, max: 12 };

export function createParticipant(module, seed, taken = []) {
  let id = `w-${seed}`;
  for (let n = 2; taken.includes(id); n++) id = `w-${seed}-${n}`;
  return {
    id,
    name: racerName(seed),
    seed: String(seed),
    genome: makeGenome(module.genes, seed),
    jockey: createJockey(seed),
    harness: true,
    age: defaultAge,
  };
}

export function defaultField(module, raceSeed = "1", count = 8) {
  const participants = [];
  for (let i = 0; i < count; i++)
    participants.push(
      createParticipant(
        module,
        `${raceSeed}:${i}`,
        participants.map((p) => p.id),
      ),
    );
  return { courseSeed: "2407", courseType: courseType(), raceSeed: String(raceSeed), participants };
}

export function loadField(module) {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(storageKey) || "null");
  } catch {
    saved = null;
  }
  if (!Array.isArray(saved?.participants) || saved.participants.length < fieldLimits.min)
    return defaultField(module);
  const ids = new Set();
  const participants = saved.participants
    .slice(0, fieldLimits.max)
    .filter((p) => typeof p?.id === "string" && !ids.has(p.id) && ids.add(p.id))
    .map((p) => ({
      id: p.id,
      name: String(p.name || racerName(p.seed || p.id)).slice(0, 24),
      seed: String(p.seed ?? p.id),
      genome: restoreGenome(
        module.genes,
        String(p.seed ?? p.id),
        migrate(p.genome, saved.version ?? 1),
      ),
      strength: Number.isFinite(p.strength) ? Math.max(1, Math.min(5, p.strength)) : 3,
      jockey: restoreJockey(p.jockey, String(p.seed ?? p.id)),
      harness: p.harness !== false,
      age: ageOf(p.age).id,
    }));
  if (participants.length < fieldLimits.min) return defaultField(module);
  return {
    courseSeed: String(saved.courseSeed || "2407"),
    courseType: courseType(saved.courseType),
    raceSeed: String(saved.raceSeed || "1"),
    participants,
  };
}

export function saveField(field) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...field, version }));
  } catch {
    /* Storage is a convenience; the field still works for this visit. */
  }
}

/**
 * Race entries. Riders and `harness` (whether the dragon races in its harness) change the look, not the race.
 * `age` changes both (see `src/dragonAge.js`); adults leave it out, so their recordings are unchanged.
 * `strength` (stars) sets its stats with its build; the tool pages' fields race at 3 stars. `form`, when set,
 * replaces the shape rolled from the race seed.
 */
export const raceRoster = (field) =>
  field.participants.map(({ id, name, genome, harness, age, strength, form }) => ({
    id,
    name,
    subject: "dragon",
    genome,
    harness: harness !== false,
    strength: strength ?? 3,
    ...(ageOf(age).id !== defaultAge ? { age: ageOf(age).id } : {}),
    ...(form ? { form } : {}),
  }));
