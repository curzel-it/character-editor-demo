import { terrainHeight } from "../course/terrainHeight.js";
import { lengthScale } from "../worldScale.js";

const m = (v) => v * lengthScale;
const sampleAt = (course, s) => {
  const spacing = course.path[1].s - course.path[0].s;
  return course.path[Math.max(0, Math.min(course.path.length - 1, Math.round(s / spacing)))];
};
const leftOf = (f) => {
  const l = Math.hypot(f[0], f[2]) || 1;
  return [-f[2] / l, 0, f[0] / l];
};
const offset = (p, along, left, up) => {
  const l = leftOf(p.forward);
  return [
    p.position[0] + p.forward[0] * along + l[0] * left,
    p.position[1] + up,
    p.position[2] + p.forward[2] * along + l[2] * left,
  ];
};

/** Establishing angles over a course, for evidence and the free camera's starting view. */
export function overviewShots(course) {
  const clear = (eye, margin) => [
    eye[0],
    Math.max(eye[1], terrainHeight(course.terrain, eye[0], eye[2]) + margin),
    eye[2],
  ];
  const start = sampleAt(course, 0),
    third = sampleAt(course, course.length * 0.3),
    middle = sampleAt(course, course.length * 0.5),
    finish = course.gates.at(-1);
  const labels = { slot: "Slot canyon", arch: "Stone arch", spires: "Spire field" };
  const featureShots = (course.features || []).map((feature) => {
    const s = feature.s ?? feature.s0 + m(feature.type === "slot" ? 40 : 0);
    const before = sampleAt(course, s - m(feature.type === "slot" ? 150 : 240));
    const focus = feature.position ?? sampleAt(course, s + m(120)).position;
    return {
      shot: `feature-${feature.type}`,
      reason: `Signature: ${labels[feature.type] ?? feature.type}`,
      eye: offset(before, 0, before.halfWidth * 0.3, m(18)),
      target: [focus[0], focus[1] - m(20), focus[2]],
      up: [0, 1, 0],
      fov: 0.9,
    };
  });
  const approach = sampleAt(course, course.length - m(150));
  return [
    {
      shot: "establishing",
      reason: "Over the start grid, looking down the canyon",
      eye: clear(offset(start, m(-240), m(-170), m(300)), m(80)),
      target: [third.position[0], third.position[1] - m(40), third.position[2]],
      up: [0, 1, 0],
      fov: 0.85,
    },
    {
      shot: "aerial",
      reason: "The whole course from above",
      eye: [middle.position[0] - m(150), middle.position[1] + m(2600), middle.position[2] - m(1700)],
      target: [middle.position[0] + m(60), middle.position[1], middle.position[2]],
      up: [0, 1, 0],
      fov: 0.95,
    },
    ...featureShots,
    {
      shot: "finish",
      reason: "Finish gate",
      eye: offset(approach, 0, approach.halfWidth * 0.45, m(22)),
      target: finish.position,
      up: [0, 1, 0],
      fov: 0.8,
    },
  ];
}
