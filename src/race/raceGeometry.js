import { createCorridor } from "./corridor.js";

/** Shared race geometry: gates and thermals projected into path coordinates. */
export function raceGeometry(course) {
  const corridor = createCorridor(course);
  const gates = course.gates.map((gate) => {
    const f = corridor.at(gate.s);
    const u =
      (gate.position[0] - f.position[0]) * f.left[0] +
      (gate.position[2] - f.position[2]) * f.left[2];
    return { ...gate, u, y: gate.position[1] };
  });
  for (let i = gates.length - 1, sum = 0; i >= 0; i--) {
    gates[i].climbAhead = sum;
    if (i > 0) sum += Math.max(0, gates[i].y - gates[i - 1].y);
  }
  const thermals = (course.thermals || [])
    .map((thermal, index) => ({ ...thermal, index, ...corridor.project(thermal.position) }))
    .sort((a, b) => a.s - b.s);
  return { corridor, gates, thermals, finishS: gates.at(-1).s };
}
