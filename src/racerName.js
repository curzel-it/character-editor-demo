import { makeRng } from "./rng.js";

const syllables = ["ka", "ze", "vor", "ith", "sa", "rok", "mi", "tal", "ur", "qen", "dra", "sel", "ny", "bas", "or", "vex", "li", "thu"];

export function racerName(seed) {
  const random = makeRng(`name:${seed}`);
  const count = 2 + Math.floor(random() * 2);
  const word = Array.from({ length: count }, () => syllables[Math.floor(random() * syllables.length)]).join("");
  return word[0].toUpperCase() + word.slice(1);
}
