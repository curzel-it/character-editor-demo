import { applyCameraFx } from "./cameraFx.js";

const FRAME = 1 / 60;

/**
 * The broadcast camera for `race` at time `t` and the same camera a frame earlier (for motion blur
 * and streaks, null across a cut or when the camera is not a pure function of time).
 * `camera` is "director", "rider" (onboard `rider`, a racer id) or "free" (the `free` camera
 * following `follow`); `fixed` overrides all of them. `motion` scales the handheld effects and
 * `aspect` (canvas width over height) and `focus` (racer ids, the owner's) shape the director's grid shot.
 * @returns {{ shot: object, previous: object | null }}
 */
export function raceShot(race, t, { camera = "director", rider = null, free = null, follow = null, fixed = null, motion = 1, aspect, focus }) {
  if (fixed) return { shot: fixed, previous: null };
  if (camera === "free" && free) return { shot: free.shot(follow), previous: null };
  const frame = (at) => (camera === "rider" && rider ? race.director.riderShotAt(rider, at) : race.director.shotAt(at, { aspect, focus }));
  const shot = applyCameraFx(frame(t), t, { motion });
  if (t <= 0) return { shot, previous: null };
  const before = Math.max(0, t - FRAME);
  const raw = frame(before);
  return { shot, previous: raw.cut === shot.cut ? applyCameraFx(raw, before, { motion }) : null };
}
