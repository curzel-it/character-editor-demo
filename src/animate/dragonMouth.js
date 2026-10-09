import { creatureScale } from "../worldScale.js";
import { envelope } from "./mouthEvents.js";
import { ageOf } from "../dragonAge.js";

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Mouth character per head variant (genome `head` index). Angles are radians of jaw opening from
 * the closed jaw; `closed` is the pose jaw pitch where the lips meet, `limit` the widest gape,
 * `ajar` how far the mouth hangs open at rest.
 */
export const mouthProfiles = [
  { id: "toothed", closed: 0.3, limit: 0.82, rest: 0.07, pant: 0.26, gape: 0.5, roar: 0.78, snap: 0.72, flutter: 0, thrust: 0, flick: 0.28, drop: 0.03 },
  { id: "beaked", closed: 0.3, limit: 0.72, rest: 0.015, pant: 0.18, gape: 0.42, roar: 0.72, snap: 0.58, flutter: 1, thrust: 0, flick: 0.3, drop: 0.03 },
  { id: "blunt", closed: 0.17, limit: 0.66, rest: 0.05, pant: 0.22, gape: 0.4, roar: 0.64, snap: 0.5, flutter: 0, thrust: 0.05, flick: 0.16, drop: 0.07 },
  { id: "needle", closed: 0.3, limit: 0.86, rest: 0.05, pant: 0.22, gape: 0.48, roar: 0.8, snap: 0.8, flutter: 0, thrust: 0, flick: 0.22, drop: 0.02 },
  { id: "viper", closed: 0.28, limit: 0.9, rest: 0.03, pant: 0.2, gape: 0.46, roar: 0.86, snap: 0.76, flutter: 0, thrust: 0, flick: 0.4, drop: 0.03 },
];

const hatchlingMouth = { id: "hatchling", closed: 0.43, ajar: 0.14, limit: 0.6, rest: 0.02, pant: 0.14, gape: 0.35, roar: 0.55, snap: 0.4, flutter: 0, thrust: 0, flick: 0, drop: 0 };

export const mouthProfile = (anatomy) =>
  ageOf(anatomy.age).roundHead
    ? hatchlingMouth
    : mouthProfiles[clamp(Math.floor(anatomy.genome?.head) || 0, 0, mouthProfiles.length - 1)];

const boneSets = new WeakMap();
const bonesOf = (anatomy) => {
  if (!boneSets.has(anatomy)) boneSets.set(anatomy, new Set(anatomy.bones.map((bone) => bone.id)));
  return boneSets.get(anatomy);
};

const add = (bones, id, rotation = [0, 0, 0], position) => {
  const bone = (bones[id] ||= {});
  const r = bone.rotation || [0, 0, 0];
  bone.rotation = r.map((v, i) => v + rotation[i]);
  if (position) bone.position = (bone.position || [0, 0, 0]).map((v, i) => v + position[i]);
};

/** Opening of the jaw in radians from closed; exported for tests. */
export function jawOpening(profile, s) {
  const { theta, effort, sprint, flap, glide, dive, fatigue, time, slow, roar, snap, gasp, breath = 0 } = s;
  const sealed = 1 - 0.9 * Math.max(glide, dive);
  // One breath per wingbeat, drawn in on the upstroke.
  const inhale = 0.5 + 0.5 * Math.sin(theta - 0.8);
  const breathing =
    profile.rest * (0.6 + 0.8 * effort) * sealed +
    profile.pant * (0.12 + 0.88 * sprint) * flap * inhale ** 1.5 * sealed +
    profile.flutter * 0.05 * Math.max(sprint, fatigue) * (0.5 + 0.5 * Math.sin(3 * theta));
  const ragged = time === null ? 0.5 + 0.3 * Math.sin(2 * theta + 0.7) : 0.5 + 0.35 * slow(1.7, 13);
  const gulp =
    time === null
      ? Math.max(0, Math.sin(theta - 2)) ** 3
      : Math.max(0, slow(0.9, 17)) ** 2;
  const exhausted = fatigue * profile.gape * (0.45 * ragged + 0.35 * inhale + 0.3 * gulp);
  const gasping = gasp * profile.gape * (0.3 + 0.7 * inhale ** 0.7);
  const tremble = time === null ? Math.sin(9 * theta) : Math.sin(TAU * 8.3 * time);
  const chew =
    time === null ? 0 : 0.035 * (1 - sprint) * sealed * Math.max(0, slow(0.55, 21)) ** 2;
  const raw =
    breathing + exhausted + gasping + chew +
    roar * profile.roar * (1 + 0.04 * tremble) + snap * profile.snap +
    breath * profile.roar * (0.95 + 0.05 * tremble);
  const knee = 0.75 * profile.limit,
    room = profile.limit - knee;
  return raw < knee ? raw : knee + room * Math.tanh((raw - knee) / room);
}

/** Tongue flick in the studio or while calm: a short out-and-back every few seconds. */
function flickAt(time, seed) {
  if (time === null) return { out: 0, age: 0 };
  const period = 5.3 + 1.1 * ((seed * 0.37) % 1);
  const age = (((time + seed) % period) + period) % period;
  return { out: envelope(age, 0.14, 0.18, 0.2), age };
}

/**
 * Layers jaw, tongue, nostril, head and neck expression onto a flight pose in place.
 * `s` carries the flight state from `pose` plus the mouth cues `roar`, `snap`, `snapSide`, `gasp`.
 */
export function mouthPose(bones, anatomy, s) {
  const profile = mouthProfile(anatomy);
  const { theta, sprint, glide, dive, fatigue, time, roar, snap, snapSide, gasp, seed, breath = 0, breathYaw = 0, breathPitch = 0 } = s;
  const has = bonesOf(anatomy);
  const calm = (1 - sprint) * (1 - Math.max(glide, dive)) * (1 - roar) * (1 - snap) * (1 - fatigue) * (1 - breath);
  const flick = flickAt(time, seed);
  const flickOut = flick.out * calm;
  const ajar = profile.ajar ?? 0;
  let open = jawOpening(profile, s);
  open = Math.min(profile.limit, ajar + (1 - ajar / profile.limit) * open + 0.2 * flickOut);
  const inhale = 0.5 + 0.5 * Math.sin(theta - 0.8);
  const k = anatomy.scale ?? creatureScale;
  const thrust = profile.thrust * (roar + snap) * k;
  bones.jaw = {
    rotation: [0, -0.05 * snapSide * snap, profile.closed - open],
    ...(thrust ? { position: [thrust, 0, 0] } : {}),
  };

  // Roar throws the head forward and up on a tensed neck; a snap lunges sideways at the rival.
  const shake = time === null ? Math.sin(7 * theta) : Math.sin(TAU * 6.1 * time);
  const tension = 0.012 * roar * shake;
  add(bones, "neck-0", [0, 0, 0.16 * roar + tension]);
  add(bones, "neck-1", [0, -0.1 * snapSide * snap, 0.03 * roar - 0.05 * snap - tension]);
  add(bones, "neck-2", [0, -0.14 * snapSide * snap, -0.14 * roar - 0.07 * snap + tension]);
  add(bones, "head", [
    0.08 * snapSide * snap,
    -0.2 * snapSide * snap,
    0.42 * roar + 0.1 * snap + 0.07 * (gasp + 0.5 * fatigue) * inhale,
  ]);

  // Breath stretches the neck out and levels the head so the plume goes ahead, shuddering with the push.
  const push = 0.015 * breath * shake;
  add(bones, "neck-0", [0, 0, 0.1 * breath + push]);
  add(bones, "neck-1", [0, 0, -0.04 * breath]);
  add(bones, "neck-2", [0, 0, -0.06 * breath - push]);
  add(bones, "head", [0, 0, 0.2 * breath]);

  // Aiming a breath turns the neck along its length, the head taking the largest share.
  add(bones, "neck-0", [0, -0.2 * breathYaw, 0.4 * breathPitch]);
  add(bones, "neck-1", [0, -0.25 * breathYaw, 0]);
  add(bones, "neck-2", [0, -0.25 * breathYaw, 0]);
  add(bones, "head", [0, -0.3 * breathYaw, 0.6 * breathPitch]);

  if (has.has("tongue")) {
    const curl = Math.min(Math.max(roar, breath), open / profile.roar);
    add(bones, "tongue", [0, 0, 0.28 * curl + 0.06 * gasp * inhale], [
      -0.1 * k * curl + profile.flick * k * flickOut,
      0.03 * k * curl - profile.drop * k * flickOut,
      0,
    ]);
  }
  if (has.has("tongue-tip")) {
    const curl = Math.min(roar, open / profile.roar);
    const wag = flickOut * 0.25 * Math.sin(TAU * 3 * flick.age);
    add(bones, "tongue-tip", [0, 0.1 * snapSide * snap, 0.4 * curl + 0.12 * gasp * inhale + wag]);
  }
  const flare = clamp(0.35 * sprint + roar + breath + 0.6 * snap + 0.7 * Math.max(gasp, fatigue) * inhale, 0, 1.2);
  for (const side of [-1, 1])
    if (has.has(`nostril-${side}`))
      add(bones, `nostril-${side}`, [side * 0.3 * flare, 0, 0.1 * flare], [0, 0, side * 0.012 * k * flare]);
}
