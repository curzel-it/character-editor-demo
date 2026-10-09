import { makeRng } from "../rng.js";

/** Race-day shapes: the chance of each and what it does to Top speed and Acceleration. */
export const forms = [
  { id: "perfect", chance: 0.1, boost: 0.005 },
  { id: "usual", chance: 0.8, boost: 0 },
  { id: "off", chance: 0.1, boost: -0.005 },
];

/** The shape a racer is in for the race of `seed`, the same for owners' dragons and rivals. */
export function raceForm(seed, id) {
  let roll = makeRng(`form:${seed}:${id}`)();
  for (const form of forms) if ((roll -= form.chance) < 0) return form.id;
  return "usual";
}

/** Stats actually flown on the day: form lifts or trims Top speed and Acceleration. */
export function applyForm(stats, form) {
  const boost = forms.find((f) => f.id === form)?.boost ?? 0;
  return { ...stats, topSpeed: stats.topSpeed * (1 + boost), acceleration: stats.acceleration * (1 + boost) };
}
