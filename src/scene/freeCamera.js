import { creatureScale, lengthScale, speedScale } from "../worldScale.js";

/** Orbit-and-fly camera state. Follows a point until the user moves the pivot. */
export function createFreeCamera() {
  const state = {
    yaw: 2.6,
    pitch: 0.32,
    distance: 90 * creatureScale,
    pivot: [0, 60 * lengthScale, 0],
    follow: true,
    fov: 0.9,
  };
  return {
    state,
    orbit(dx, dy) {
      state.yaw -= dx * 0.006;
      state.pitch = Math.max(-0.6, Math.min(1.45, state.pitch + dy * 0.005));
    },
    zoom(factor) {
      state.distance = Math.max(12 * creatureScale, Math.min(4000 * lengthScale, state.distance * factor));
    },
    move(forward, right, up, dt) {
      if (!forward && !right && !up) return;
      state.follow = false;
      const speed = Math.max(40 * speedScale, state.distance * 1.2) * dt;
      const fx = -Math.cos(state.yaw),
        fz = -Math.sin(state.yaw);
      state.pivot[0] += (fx * forward + fz * right) * speed;
      state.pivot[2] += (fz * forward - fx * right) * speed;
      state.pivot[1] += up * speed;
    },
    refollow() {
      state.follow = true;
    },
    shot(followPoint) {
      if (state.follow && followPoint) state.pivot = [...followPoint];
      const c = Math.cos(state.pitch);
      const eye = [
        state.pivot[0] + Math.cos(state.yaw) * c * state.distance,
        state.pivot[1] + Math.sin(state.pitch) * state.distance,
        state.pivot[2] + Math.sin(state.yaw) * c * state.distance,
      ];
      return {
        eye,
        target: [...state.pivot],
        up: [0, 1, 0],
        fov: state.fov,
        shot: "free",
        subject: null,
        reason: state.follow ? "Free camera · following" : "Free camera · WASD to fly, F to follow",
      };
    },
  };
}
