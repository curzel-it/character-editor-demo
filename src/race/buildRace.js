import { fieldCourse } from "../fieldCourse.js";
import { simulateRace } from "./simulateRace.js";
import { createDirector } from "../camera/createDirector.js";
import { overviewShots } from "../scene/overviewShot.js";
import { landingsOf } from "../animate/landingEvents.js";
import { launchesOf } from "../animate/launchEvents.js";
import { raceRoster } from "../raceField.js";
import { racerColors } from "../racerColors.js";
import { withTack } from "../jockey/withTack.js";

/**
 * @typedef {object} BuiltRace
 * @property {object} course
 * @property {object} recording
 * @property {ReturnType<typeof createDirector>} director
 * @property {Map<string, object>} entries racers by id, with their tacked anatomy and colours
 * @property {object[]} overviews
 * @property {object[]} landings touchdowns and launches, for the debris they throw up
 */

/** The race inputs; a field with the same key, and the same `ride`, replays the same race. */
export const raceKey = (field, ride = null) => JSON.stringify([field.courseSeed, field.courseType, field.raceSeed, raceRoster(field), ride]);

/** The racers of `field` by id, `roster` entries (the recording's) with their tacked anatomy and colours. */
export function raceEntries(module, field, roster) {
  const riders = new Map(field.participants.map((p) => [p.id, p.jockey]));
  return new Map(
    roster.map((entry) => {
      const dragon = module.createAnatomy(entry.genome, { age: entry.age });
      const anatomy = withTack(dragon, { harness: entry.harness, jockey: riders.get(entry.id) });
      return [entry.id, { ...entry, anatomy, ...racerColors(entry.genome) }];
    }),
  );
}

/** The touchdowns and launches of a recording so far, for the debris they throw up. */
export const debrisOf = (recording) => [...launchesOf(recording).values(), ...landingsOf(recording).values()];

/**
 * Builds the course, simulates `field` (with the owner's `ride` when there was one) and prepares
 * everything a broadcast needs to replay it.
 * @returns {BuiltRace}
 */
export function buildRace(module, field, ride = null) {
  const course = fieldCourse(field);
  const recording = simulateRace({ seed: field.raceSeed, course, roster: raceRoster(field), ride });
  const director = createDirector(recording, course);
  return { course, recording, director, entries: raceEntries(module, field, recording.roster), overviews: overviewShots(course), landings: debrisOf(recording) };
}
