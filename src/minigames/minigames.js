import { createClean } from "./clean.js";
import { createExercise } from "./exercise.js";
import { createFetch, fetchFinale } from "./fetch.js";
import { createWarm } from "./warm.js";
import { cleanBeats } from "../scene/care/cleanBeats.js";
import { exerciseLanding } from "../scene/care/exercise.js";
import { createGroom } from "./groom.js";
import { groom } from "../scene/care/groom.js";
import { createFeed } from "./feed.js";
import { feed } from "../scene/care/feed.js";
import { cheer } from "../scene/care/cheer.js";
import { createVolleyball } from "./volleyball.js";

/**
 * The minigames of each care action (`careActions` ids): `create({ anatomy, dragon, seed })` makes one
 * for `dragon` drawn as `anatomy`, `finale` is how many seconds into the action's care reaction the yard
 * picks up once it ends, and `icon` heads its top bar. An egg's Warm (for `nudge`) has no need to
 * fill: `meter` is the icon and colour of what it shows in its place.
 */
export const minigames = {
  feed: [{ id: "feed", icon: "meat", finale: feed.length - cheer.length, create: ({ dragon, seed }) => createFeed({ age: dragon.age, seed }) }],
  play: [
    { id: "volleyball", icon: "ball", finale: 2.8, create: ({ anatomy, dragon, seed }) => createVolleyball({ anatomy, age: dragon.age, seed }) },
    { id: "fetch", icon: "ball", finale: fetchFinale, create: ({ anatomy, seed }) => createFetch({ anatomy, seed }) },
  ],
  clean: [{ id: "clean", icon: "brush", finale: cleanBeats.shake[0], create: ({ anatomy, dragon, seed }) => createClean({ anatomy, dirt: 1 - dragon.care.cleanliness / 100, seed }) }],
  exercise: [{ id: "exercise", icon: "stamina", finale: exerciseLanding - 0.1, create: ({ anatomy, seed }) => createExercise({ anatomy, seed }) }],
  groom: [{ id: "groom", icon: "heart", finale: groom.length - 0.3, create: ({ anatomy, seed }) => createGroom({ anatomy, seed }) }],
  nudge: [{ id: "warm", icon: "sparkle", meter: { icon: "flame", color: "var(--dz-warning)" }, create: ({ anatomy, seed }) => createWarm({ anatomy, seed }) }],
};

/** One of care action `action`'s minigames, picked by `random`, or null when it has none. */
export function minigameFor(action, random = Math.random) {
  const list = minigames[action];
  return list?.length ? list[Math.floor(random() * list.length)] : null;
}
