import { createCourse } from "./course/createCourse.js";
import { leagueForAge } from "./stable/leagues.js";
import { ageOf } from "./dragonAge.js";

/** Share of the full course length a field races: its league's when every racer is one age, the full length when ages mix. */
export function courseShare(participants) {
  const [age, ...others] = new Set(participants.map((p) => ageOf(p.age).id));
  return others.length ? 1 : (leagueForAge(age)?.courseShare ?? 1);
}

/** The seeded course a race field flies, as long as its league's races. */
export const fieldCourse = (field) => createCourse(field.courseSeed, { type: field.courseType, share: courseShare(field.participants) });
