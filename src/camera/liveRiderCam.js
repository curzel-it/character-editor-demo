import { normalize } from "../vec3.js";
import { orientation, point } from "../math3d.js";
import { froude } from "../race/froude.js";
import { applyCameraFx } from "./cameraFx.js";
import { clamp } from "./courseGeometry.js";

const TOP = 35 * froude.speed;
const FOLLOW = { forward: 0.12, bank: 0.18 };
const FOV = 1.1,
  SPAN = Math.tan(0.75),
  NEAR = 0.3,
  LOOK_DOWN = 0.12,
  HEAD_UP = [-0.15, 0.55, 0],
  ROLL_SHARE = 0.2;
const smoothstep = (a, b, x) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
const ease = (dt, tau) => 1 - Math.exp(-dt / tau);

/**
 * The jockey's own view for a racer flown live: the lens sits at the rider's eyes (`eye`, from
 * `riderEye`) with the head raised out of the tuck to see over the dragon's, and rides with the body, while the gaze follows the heading and the horizon the bank
 * with a short lag, looking a little down along the dragon's neck. The lens keeps a wide view
 * across on narrow screens, and its near plane sits just ahead of the goggles.
 */
export function createLiveRiderCam({ eye }) {
  let forward = null,
    bank = 0,
    previous = null;
  return {
    /**
     * The shot for sampled racer `r` at race time `t`, `dt` seconds after the last one, and the
     * shot before it for motion blur.
     */
    shot(r, t, dt, { motion = 1 } = {}) {
      forward = forward ? normalize(forward.map((v, i) => v + (r.forward[i] - v) * ease(dt, FOLLOW.forward))) : r.forward;
      bank += (r.bank - bank) * ease(dt, FOLLOW.bank);
      const at = point(orientation(r.position, r.forward, r.bank), eye.map((v, i) => v + HEAD_UP[i]));
      const gaze = normalize([forward[0], forward[1] - LOOK_DOWN, forward[2]]);
      const energy = clamp(0.75 * smoothstep(0.62 * TOP, 1.02 * TOP, r.speed) + 0.35 * smoothstep(0.7, 0.95, r.effort), 0, 1);
      const shot = applyCameraFx(
        {
          eye: at,
          target: at.map((v, i) => v + gaze[i] * 50),
          up: [0, 1, 0],
          fov: FOV,
          span: SPAN,
          near: NEAR,
          roll: bank * ROLL_SHARE,
          speed: r.speed,
          energy,
          shake: 0.05,
          shot: "rider",
          subject: r.id,
        },
        t,
        { motion },
      );
      const before = previous;
      previous = shot;
      return { shot, previous: before };
    },
  };
}
