/**
 * Age ranges. Age is not inherited: the same genome grows from kid to teen to adult.
 * `size` scales the whole body; `proportions` multiply shape genes on top of it; `head` scales the
 * head and jaw; `snout` scales the face ahead of the head bone; `eyes` scales the eyes on top of
 * the head and rounds them; `roundHead` swaps the head the genes choose for the round young head;
 * `rise` lifts the neck so the head sits above the body; `seat` places the saddle along the back
 * as a share of the half body length (0.45 by default), further back behind a big head;
 * `pear` (0 to 1) widens the hips, narrows the shoulders and fills out the throat;
 * `maturity` (0 to 1) sets how far headgear has grown in shape: nubs and few spikes at 0, full
 * curls, tines and spike rows at 1; `girth` thickens the torso; `chord` scales the wing's depth
 * from leading to trailing edge; `stats` multiply the racing stats (the speed classes); `heft` is how hard it lands and takes off, for the animation; `breathes` is false for an age
 * too young to breathe its element.
 * Kids hatch from the egg with the round head on an upright neck, with the horns, legs, feet and
 * tail tip their genes choose, half-grown wings and a spiky back; teens are gangly, on their own
 * gene heads with big eyes and half-grown headgear: a lean body on long legs, a raised neck and
 * long narrow wings. Adults are the reference: every factor is 1 but the eyes, grown past the heads' own.
 */
export const ages = [
  {
    id: "kid",
    label: "Kid",
    breathes: false,
    size: 0.5,
    head: 2.1,
    snout: 1.15,
    eyes: 0.95,
    roundHead: true,
    maturity: 0,
    girth: 1.35,
    chord: 0.75,
    pear: 0.5,
    rise: 1.3,
    seat: -0.25,
    proportions: { wingspan: 0.7, neck: 0.62, tail: 0.6, legs: 0.62, thighs: 1.25, horns: 0.5, spines: 0.6 },
    stats: { topSpeed: 0.82, acceleration: 0.82 },
    heft: 0.45,
  },
  {
    id: "teen",
    label: "Teen",
    size: 0.75,
    head: 1.3,
    snout: 0.8,
    eyes: 2.6,
    maturity: 0.5,
    girth: 0.92,
    chord: 0.72,
    rise: 1.4,
    proportions: { wingspan: 0.92, neck: 0.9, tail: 0.88, legs: 1.02, thighs: 0.9, horns: 0.72, spines: 0.45 },
    stats: { topSpeed: 0.9, acceleration: 0.9 },
    heft: 0.75,
  },
  { id: "adult", label: "Adult", size: 1, head: 1, snout: 1, eyes: 2.1, maturity: 1, girth: 1, chord: 1, proportions: {}, stats: {}, heft: 1 },
];

export const defaultAge = "adult";

/** The age range for `id`; anything unknown is an adult. */
export const ageOf = (id) =>
  ages.find((age) => age.id === id) ?? ages.find((age) => age.id === defaultAge);

/** Shape genes as this age grows them; the genome itself never changes. */
export function grownGenome(genome, id) {
  const { proportions } = ageOf(id);
  const grown = { ...genome };
  for (const [name, k] of Object.entries(proportions))
    if (Number.isFinite(grown[name])) grown[name] *= k;
  return grown;
}

/** Wingspan in metres at this age, for flap rates. */
export const grownWingspan = (genome, id) =>
  Number.isFinite(genome?.wingspan) ? grownGenome(genome, id).wingspan * ageOf(id).size : undefined;

/** Whether a dragon of this age breathes its element, in races and the yard. */
export const canBreathe = (id) => ageOf(id).breathes !== false;

/** Racing stats at this age. */
export function ageStats(stats, id) {
  const scaled = { ...stats };
  for (const [key, k] of Object.entries(ageOf(id).stats)) scaled[key] = Math.round(scaled[key] * k * 1000) / 1000;
  return scaled;
}
