import { makeRng } from "../rng.js";

const given = [
  "Aryn", "Bexa", "Calder", "Dov", "Elowen", "Fenn", "Ilka", "Jory", "Kael", "Lio", "Mirren", "Nyx",
  "Orin", "Pip", "Quill", "Rook", "Sable", "Tamsin", "Ulla", "Vesper", "Wynn", "Yarrow", "Zephyr", "Briar",
];
const first = ["Storm", "Ember", "Ash", "Cloud", "Thorn", "Frost", "Sky", "Sun", "Moss", "Flint", "Rain", "Wild", "Star", "Gale", "Cinder", "Hollow"];
const second = ["wing", "rider", "feather", "scale", "claw", "crest", "spark", "tail", "fall", "glide", "whistle", "spur"];

/** A seeded dragon rider's name, a given name and a sky-born surname, shown as "Initial. Surname" on tight labels. */
export function jockeyName(seed) {
  const random = makeRng(`jockey-name:${seed}`);
  const pick = (list) => list[Math.floor(random() * list.length)];
  return `${pick(given)} ${pick(first)}${pick(second)}`;
}

export const shortJockeyName = (name) => {
  const [first, ...rest] = String(name).trim().split(/\s+/);
  return rest.length ? `${first[0]}. ${rest.join(" ")}` : first;
};
