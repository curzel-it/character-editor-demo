import { createCanyonCourse } from "./canyonCourse.js";
import { createValleyCourse } from "./valleyCourse.js";

export const courseTypes = [
  { id: "valley", label: "Valley" },
  { id: "canyon", label: "Canyon" },
];
const builders = { valley: createValleyCourse, canyon: createCanyonCourse };

export const courseType = (type) => (builders[type] ? type : courseTypes[0].id);

/** Seeded course of `options.type` (valley by default), in world metres. See docs/racing.md. */
export function createCourse(seed, options = {}) {
  return builders[courseType(options.type)](seed, options);
}
