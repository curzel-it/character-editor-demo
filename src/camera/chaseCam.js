import { add, dot, normalize, scale, sub } from "../vec3.js";
import { froude } from "../race/froude.js";
import { applyCameraFx } from "./cameraFx.js";
import { clamp } from "./courseGeometry.js";

const TOP = 35 * froude.speed;
const BACK = 1.05,
  UP = 0.27,
  AHEAD = 1.1,
  LIFT = 0.05;
const FOLLOW = { heading: 0.35, side: 0.45, height: 0.12, pitch: 0.3 };
const PITCH_SHARE = 0.7;
const FOV = 0.95,
  SPAN = Math.tan(0.8),
  ROLL_SHARE = 0.15;
const ease = (dt, tau) => 1 - Math.exp(-dt / tau);
const smoothstep = (a, b, x) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

/**
 * A chase camera for a racer flown live: behind and above by multiples of its wingspan `span` (m),
 * so a lane either side and the height bands read. The heading follows with a lag, and the lens
 * trails sideways moves, so a lane change shows as the dragon crossing the frame, and it pitches
 * with climbs and dives to look down the line; the horizon takes only a little of the bank.
 */
export function createChaseCam({ span }) {
  let heading = null,
    center = null,
    bank = 0,
    previous = null,
    pitch = 0;
  return {
    /**
     * The shot for sampled racer `r` at race time `t`, `dt` seconds after the last one, and the
     * shot before it for motion blur.
     */
    shot(r, t, dt, { motion = 1 } = {}) {
      const flat = normalize([r.forward[0], 0, r.forward[2]]);
      heading = heading ? normalize(heading.map((v, i) => v + (flat[i] - v) * ease(dt, FOLLOW.heading))) : flat;
      if (!center) center = r.position;
      else {
        const side = [-heading[2], 0, heading[0]];
        const gap = sub(r.position, center);
        const along = dot(gap, heading),
          across = dot(gap, side);
        center = add(
          center,
          add(add(scale(heading, along), scale(side, across * ease(dt, FOLLOW.side))), [0, gap[1] * ease(dt, FOLLOW.height), 0]),
        );
      }
      bank += (r.bank - bank) * ease(dt, FOLLOW.heading);
      pitch += (Math.asin(clamp(r.forward[1], -1, 1)) * PITCH_SHARE - pitch) * ease(dt, FOLLOW.pitch);
      const look = add(scale(heading, Math.cos(pitch)), [0, Math.sin(pitch), 0]);
      const eye = add(center, add(scale(look, -BACK * span), [0, UP * span, 0]));
      const target = add(center, add(scale(look, AHEAD * span), [0, LIFT * span, 0]));
      const energy = clamp(0.75 * smoothstep(0.62 * TOP, 1.02 * TOP, r.speed) + 0.35 * smoothstep(0.7, 0.95, r.effort), 0, 1);
      const shot = applyCameraFx(
        { eye, target, up: [0, 1, 0], fov: FOV, span: SPAN, roll: bank * ROLL_SHARE, speed: r.speed, energy, shake: 0.12, shot: "chase", subject: r.id },
        t,
        { motion },
      );
      const before = previous;
      previous = shot;
      return { shot, previous: before };
    },
  };
}
