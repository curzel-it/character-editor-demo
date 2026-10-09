import { dot, sub } from "../vec3.js";
import { eyeFrame } from "./dragonEyes.js";

/** How far, in radians round the eye, a glancing pupil keeps from the iris's ink ring. */
const margin = 0.04;

/**
 * Hangs each slit pupil on its own `gaze-<side>` bone at the centre of its eye's ellipsoid, so a
 * glance can slide it over the iris (see `src/animate/dragonGaze.js`). The pupil part carries
 * `gaze`, the most it may turn forwards, back and up or down, in radians round the eye, before its
 * tips would touch the ring; a pupil set forwards of the middle has more room behind.
 */
export function rigPupils({ rig, parts }) {
  for (const s of [-1, 1]) {
    const eye = parts.find(({ id }) => id === `eye-${s}`),
      pupil = parts.find(({ id }) => id === `pupil-${s}`);
    if (eye?.shape !== "dome" || pupil?.shape !== "dome") continue;
    const { core, along, up, radii } = eyeFrame(eye, s);
    const offset = sub(pupil.position, core),
      shift = Math.asin(Math.max(-1, Math.min(1, dot(offset, along) / radii[0]))),
      lift = Math.asin(Math.min(1, Math.abs(dot(offset, up)) / radii[1])),
      width = Math.asin(Math.min(1, (pupil.scale[0] * Math.sin(pupil.cap)) / radii[0])),
      height = pupil.cap;
    rig(`gaze-${s}`, "head", core);
    pupil.bone = `gaze-${s}`;
    pupil.position = offset;
    const room = (across) => Math.acos(Math.min(1, Math.cos(eye.cap - margin) / Math.cos(across)));
    pupil.gaze = [Math.max(0, room(height) - width - shift), Math.max(0, room(height) - width + shift), Math.max(0, room(width) - height - lift)];
  }
}
