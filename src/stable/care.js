import { addBond, careBond, raceBond } from "./bond.js";

const hour = 3_600_000;
const ages = ["kid", "teen", "adult"];

/**
 * Every need, 0..100, how much it drops per game hour and the first age that has it; each age keeps
 * the needs of the ages before it.
 */
export const careNeeds = [
  { id: "fullness", decay: 12, from: "kid" },
  { id: "happiness", decay: 10, from: "kid" },
  { id: "cleanliness", decay: 8, from: "kid" },
  { id: "exercise", decay: 9, from: "teen" },
  { id: "affection", decay: 5, from: "adult" },
];

/**
 * Care actions, each tending one need; effects are in need points. A minigame's amount refills that
 * share of the need's scale.
 */
export const careActions = [
  { id: "feed", need: "fullness", effect: { fullness: 40 } },
  { id: "play", need: "happiness", effect: { happiness: 35, fullness: -5, cleanliness: -5 } },
  { id: "clean", need: "cleanliness", effect: { cleanliness: 60 } },
  { id: "exercise", need: "exercise", effect: { exercise: 45, fullness: -10, cleanliness: -10 } },
  { id: "groom", need: "affection", effect: { affection: 60, happiness: 10, bond: 4 } },
];

/** What a race does to the needs: a good workout that leaves the dragon hungry and dirty. */
const raceEffect = { exercise: 50, fullness: -15, cleanliness: -25 };

/** The needs of a dragon at `age`. */
export const needsOf = (age) => careNeeds.filter((need) => ages.indexOf(need.from) <= Math.max(0, ages.indexOf(age)));

/** A need's value for `dragon`, 0..100. */
export const needValue = (dragon, id) => dragon.care[id];

/** The lowest need of the dragon's age. */
export const neediest = (dragon) => needsOf(dragon.age).reduce((a, b) => (needValue(dragon, b.id) < needValue(dragon, a.id) ? b : a));

/** The care action tending the neediest need. */
export const careActionFor = (dragon) => careActions.find((a) => a.need === neediest(dragon).id);

const clamp = (v) => Math.max(0, Math.min(100, v));

export const freshCare = () => Object.fromEntries(careNeeds.map((need) => [need.id, 100]));

function shift(dragon, effect) {
  for (const [id, delta] of Object.entries(effect))
    if (id === "bond") addBond(dragon, delta);
    else dragon.care[id] = clamp(dragon.care[id] + delta);
}

/** Drops every need of the dragon's age over `dt` game ms. */
export function decayCare(dragon, dt) {
  const hours = dt / hour;
  shift(dragon, Object.fromEntries(needsOf(dragon.age).map((need) => [need.id, -need.decay * hours])));
}

/**
 * Tends a need of the dragon's age with action `actionId`; every action adds a little bond. A minigame
 * gives the `amount` (0..1) of the need's scale it refills, its side effects scaled to match.
 */
export function applyCare(dragon, actionId, amount) {
  const action = careActions.find((a) => a.id === actionId);
  if (!action || !needsOf(dragon.age).some((need) => need.id === action.need)) return false;
  const scale = amount === undefined ? 1 : (100 * amount) / action.effect[action.need];
  shift(dragon, Object.fromEntries(Object.entries(action.effect).map(([id, delta]) => [id, delta * scale])));
  addBond(dragon, careBond);
  return true;
}

/** After a race: exercise, hunger, dirt and a little more bond. */
export function afterRaceCare(dragon) {
  const effect = Object.fromEntries(Object.entries(raceEffect).filter(([id]) => id in dragon.care));
  shift(dragon, effect);
  addBond(dragon, raceBond);
}

/** How well the dragon is looked after, 0..1: the average need of its age, dragged down by the neediest. */
export function careLevel(dragon) {
  const values = needsOf(dragon.age).map((need) => needValue(dragon, need.id) / 100);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  return (mean + Math.min(...values)) / 2;
}
