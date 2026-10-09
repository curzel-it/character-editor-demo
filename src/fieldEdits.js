import { createParticipant, fieldLimits } from "./raceField.js";
import { makeRng } from "./rng.js";
import { racerName } from "./racerName.js";
import { makeGenome } from "./subjects.js";
import { ageOf } from "./dragonAge.js";

/** The age every participant of the exhibition field shares, or null for a mixed field. */
export function fieldAge(field) {
  const [first, ...rest] = field.participants.map((p) => ageOf(p.age).id);
  return rest.every((age) => age === first) ? first : null;
}

/** Makes every participant `age`. */
export function setFieldAge(field, age) {
  for (const p of field.participants) p.age = ageOf(age).id;
}

/** Moves the participant at grid slot `from` to `to`. */
export function moveParticipant(field, from, to) {
  const { participants } = field;
  if (from === to || from < 0 || to < 0 || from >= participants.length || to >= participants.length) return false;
  const [p] = participants.splice(from, 1);
  participants.splice(to, 0, p);
  return true;
}

/** Adds a seeded dragon at the field's shared age; null when the field is full. */
export function addParticipant(module, field) {
  if (field.participants.length >= fieldLimits.max) return null;
  const ids = field.participants.map((p) => p.id);
  let n = field.participants.length;
  while (ids.includes(`w-${field.raceSeed}:${n}`)) n++;
  const participant = createParticipant(module, `${field.raceSeed}:${n}`, ids);
  participant.age = fieldAge(field) ?? participant.age;
  field.participants.push(participant);
  return participant;
}

/** Removes the participant at `index` unless the field would drop below its minimum. */
export function removeParticipant(field, index) {
  if (field.participants.length <= fieldLimits.min || !field.participants[index]) return false;
  field.participants.splice(index, 1);
  return true;
}

/** Shuffles the grid; `salt` makes each shuffle differ. */
export function shuffleGrid(field, salt) {
  const { participants } = field;
  const random = makeRng(`shuffle:${participants.map((p) => p.id).join()}:${salt}`);
  for (let i = participants.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [participants[i], participants[j]] = [participants[j], participants[i]];
  }
}

/** Regrows the participant's genes from `seed`; a name still derived from the old seed follows it. */
export function reseedParticipant(module, participant, seed) {
  if (participant.name === racerName(participant.seed)) participant.name = racerName(seed);
  participant.seed = String(seed);
  participant.genome = makeGenome(module.genes, seed);
}

/** Silks with colour `slot` set to `color`; an empty `color` drops that slot and those after it. */
export function withSilkColor(silks, slot, color) {
  const colors = [...silks.colors];
  if (color) colors[slot] = color;
  else colors.length = Math.min(colors.length, slot);
  return { ...silks, colors: colors.filter(Boolean) };
}
