import { multiply, orientation, point, transform } from "../../math3d.js";
import { add, dot, lerp, normalize, scale, sub } from "../../vec3.js";
import { MEAT_AT } from "../../keeper/items/feed.js";

const HAND_DEPTH = 0.75;

/**
 * Where the keeper's hand posed as `pose` (a care reaction's `hand`, fully raised) holds the meat
 * in the world, as the yard places the hand in `view` (`careView`): its `centre` and the `forward`
 * and `bank` a thrown racer takes to keep the hand's turn.
 */
export function heldMeat(view, pose) {
  const { ahead, right, up } = view;
  const forward = normalize(add(add(scale(ahead, 0.55), scale(up, 0.75)), scale(right, -0.3)));
  const wrist = view.place(pose.at, HAND_DEPTH / Math.min(1, view.aspect / 0.75));
  const hand = multiply(orientation(wrist, forward, pose.roll ?? 0), transform([0, 0, 0], [pose.twist ?? 0, 0, pose.wrist ?? 0]));
  return { centre: point(hand, MEAT_AT), forward, bank: pose.roll ?? 0 };
}

/** The dragon's open mouth in `view`, just ahead of its jaw hinge. */
export function mouthOf(view) {
  const { bone, size, forward } = view.dragon;
  return add(bone("jaw"), scale(forward, 0.3 * size));
}

/**
 * A throw `u` (0..1) of the way from `from` to `to`, paced to cross the screen evenly from the `eye`
 * looking `ahead` though it heads away, and rising over the straight line by up to `height` of its
 * distance from the eye: its `position` and `t`, how far along the line it is.
 */
export function arc(from, to, u, height, { eye, ahead }) {
  const near = dot(sub(from, eye), ahead),
    far = dot(sub(to, eye), ahead);
  const t = (u * near) / ((1 - u) * far + u * near);
  const lift = 4 * u * (1 - u) * height * (near + t * (far - near));
  return { position: add(lerp(from, to, t), [0, lift, 0]), t };
}
