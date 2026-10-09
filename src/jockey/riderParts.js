import { inverseRigid, point } from "../math3d.js";
import { silksRgb } from "./jockeySilks.js";
import { tube } from "./riderMesh.js";
import { riderBody } from "./riderBody.js";
import { hits, hideTop, hideCentre, hideOut } from "./hideProbe.js";
import { tack } from "./tackColors.js";

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, k) => a.map((v) => v * k);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const unit = (a) => scale(a, 1 / (Math.hypot(...a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * The rider's racing tuck in metres, in the saddle frame (+X forward, +Y up, origin on the saddle):
 * seated low, torso lying along the back, legs wrapped down the flanks with the feet tucked back in the irons,
 * hands forward on the reins and head up behind the dragon's neck, streamlined for 200 km/h.
 */
const tuck = {
  hip: [-0.18, 0.2, 0.12],
  knee: [0.12, -0.02, 0.42],
  ankle: [-0.26, -0.1, 0.44],
  toe: [-0.41, -0.12, 0.42],
  shoulder: [0.36, 0.42, 0.17],
  elbow: [0.44, 0.24, 0.26],
  wrist: [0.66, 0.3, 0.12],
  head: [0.55, 0.55, 0],
};
/** How far each joint's centre stays above the hide, and out from the flanks for the legs (clear of the flaps). */
const clearance = { elbow: 0.06, wrist: 0.05, shoulder: 0.16, head: 0.14 };
const flankClearance = { knee: 0.13, ankle: 0.11, toe: 0.1 };
const mirror = (p, side) => [p[0], p[1], p[2] * side];

/** The tuck on this dragon: joints lifted where a broad back or a rising neck would swallow them. */
export function riderPose({ triangles, toWorld, fromWorld }) {
  const pose = Object.fromEntries(Object.entries(tuck).map(([k, p]) => [k, [...p]]));
  for (const [joint, gap] of Object.entries(flankClearance)) {
    const world = toWorld(pose[joint]);
    const centre = hideCentre(triangles, world[0]);
    if (!centre) continue;
    const out = unit(sub(world, centre).map((v, i) => (i === 0 ? 0 : v)));
    const surface = hideOut(triangles, centre, out);
    if (!surface) continue;
    const reach = Math.hypot(...sub(surface, centre)) + gap;
    if (Math.hypot(...sub(world, centre)) < reach) pose[joint] = fromWorld(add(centre, scale(out, reach)).map((v, i) => (i === 0 ? world[0] : v)));
  }
  for (const [joint, gap] of Object.entries(clearance)) {
    const world = toWorld(pose[joint]);
    const top = hideTop(triangles, world[0], world[2]);
    if (top !== null && world[1] < top + gap) pose[joint][1] += top + gap - world[1];
  }
  pose.head[1] = Math.max(pose.head[1], pose.shoulder[1] + 0.12);
  return pose;
}

/**
 * A jockey in a racing tuck: rigid parts on the seat's bone, plus a collar on the neck and reins
 * skinned from the seat's bone to the neck, so the reins follow the head. The rider is about 1.75 m
 * tall at real scale: a size reference beside a 16 m dragon.
 */
export function riderParts(frame, jockey) {
  const { anatomy, bind, index, triangles, mount, toWorld } = frame;
  const colors = silksRgb(jockey.silks);
  const parts = [];
  const rigid = (id, mesh) => parts.push(frame.rigid(`jockey-${id}`, mesh));
  const shape = (id, ...args) => parts.push(frame.shape(`jockey-${id}`, ...args));
  const plain = (rgb) => () => rgb;
  const crouch = riderPose(frame);
  const pose = {
    ...crouch,
    pelvis: [crouch.hip[0] - 0.12, crouch.hip[1], 0],
    nape: [crouch.shoulder[0] + 0.07, crouch.shoulder[1] + 0.02, 0],
    tilt: 0.45,
    trail: [-1, -0.12, 0],
  };
  riderBody(pose, jockey, { rigid, shape });

  // Collar on the neck and reins from the hands, skinned so they follow the neck as it moves.
  const reinBone = ["neck-1", "neck-0"].find((id) => index.has(id));
  if (reinBone) {
    const neckWorld = point(bind[index.get(reinBone)], [0, 0, 0]);
    const nextId = anatomy.bones.find((b) => b.parent === reinBone)?.id;
    const next = nextId ? point(bind[index.get(nextId)], [0, 0, 0]) : add(neckWorld, [1, 0, 0]);
    const axis = unit(sub(next, neckWorld));
    const side = unit(cross(axis, [0, 1, 0]));
    const over = cross(side, axis);
    const ringCentre = add(neckWorld, scale(sub(next, neckWorld), 0.3));
    const around = (angle) => add(scale(over, Math.cos(angle)), scale(side, Math.sin(angle)));
    const reachAt = (angle) => {
      const out = hits(triangles, ringCentre, around(angle)).filter((t) => t > 0);
      return out.length ? Math.max(...out) + 0.025 : 0.35;
    };
    const ring = Array.from({ length: 16 }, (_, i) => add(ringCentre, scale(around((i / 16) * Math.PI * 2), reachAt((i / 16) * Math.PI * 2))));
    const toNeck = inverseRigid(bind[index.get(reinBone)]);
    const collar = ring.map((p) => ({ p: point(toNeck, p), r: [0.035, 0.018] }));
    parts.push({ id: "jockey-collar", bone: reinBone, shape: "mesh", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: colors.accent, ...tube(collar, { segments: 4, closed: true, color: plain(colors.accent), up: axis }) });
    for (const s of [-1, 1]) {
      const hand = toWorld(mirror(add(crouch.wrist, [0.06, 0, 0]), s));
      const bit = add(ringCentre, scale(around(s * 0.7), reachAt(s * 0.7)));
      const count = 7;
      const reinRings = Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1);
        const p = lerp(hand, bit, t);
        const top = t > 0 && t < 1 ? hideTop(triangles, p[0], p[2]) : null;
        return { p: top === null ? p : [p[0], Math.max(p[1], top + 0.05), p[2]], r: 0.014, t };
      });
      const rein = tube(reinRings, {
        segments: 4,
        color: plain(tack),
        skin: (ring) => ({ joints: [mount.bone, reinBone], weight: 1 - reinRings[ring].t }),
      });
      parts.push({ id: `jockey-rein-${s}`, bone: mount.bone, shape: "mesh", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: tack, ...rein });
    }
  }

  return parts;
}
