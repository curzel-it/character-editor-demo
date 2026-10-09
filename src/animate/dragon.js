import { creatureScale } from "../worldScale.js";
import { resolveMotion, smoothstep } from "./flightMotion.js";
import { drift, individualSeed } from "./flightNoise.js";
import { legPose } from "./dragonLegs.js";
import { mouthPose } from "./dragonMouth.js";
import { hindWingPose } from "./dragonHindWings.js";
import { landingPose } from "./dragonLanding.js";
import { leapPose, wingsOf } from "./dragonLeap.js";
import { groundBreathPose } from "./dragonGroundBreath.js";
import { sleepOf, sleepShut, slumberPose } from "./dragonSlumber.js";
import { drillPose, drillRest } from "./dragonDrill.js";
import { lidPose } from "./dragonLids.js";
import { blinkOf } from "./dragonBlink.js";
import { expressionOf } from "./dragonExpression.js";
import { gazePose, glanceOf } from "./dragonGaze.js";
import { thumpPose } from "./dragonThump.js";
import { lookPose } from "./dragonLook.js";
import { wagPose } from "./dragonWag.js";
import { curiousGaze, tiltOf, tiltPose } from "./dragonTilt.js";
import { festePose } from "./dragonFeste.js";
import { yawnOf, yawnPose } from "./dragonYawn.js";

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const neckIds = ["neck-1", "neck-2", "head"];
// The trailing membrane hinges on `wing-anchor-*`, so elevation only softly saturates near a full stroke.
const reachLimit = 1.05;
const soft = (v, limit) => limit * Math.tanh(v / limit);

function neckReach(anatomy) {
  let length = 0;
  for (const bone of anatomy.bones)
    if (neckIds.includes(bone.id)) length += Math.hypot(...bone.position);
  return length || 3 * creatureScale;
}

/**
 * Flight pose. `t` is the wingbeat phase (1 s loop); `motion` is optional flight state data
 * (see `FlightMotion` in flightMotion.js). Without `motion.time` the pose loops exactly in `t`.
 * @param {object} anatomy
 * @param {number} t
 * @param {import("./flightMotion.js").FlightMotion} [motion]
 */
export function pose(anatomy, t, motion) {
  const { effort, glide, fatigue, bank, climb, time, roar, snap, snapSide, gasp, breath, breathYaw, breathPitch, flare, stand, impact, wings, spring } =
    resolveMotion(motion);
  const flap = 1 - glide;
  const sprint = smoothstep(0.55, 0.95, effort);
  const up = smoothstep(0, 0.45, climb);
  const dive = smoothstep(0, 0.6, -climb);
  const turn = clamp(bank / 0.9, -1, 1);
  const seed = individualSeed(anatomy.genome);
  const slow = (rate, offset = 0) =>
    time === null ? 0 : drift(time * rate, seed + offset);
  const theta = TAU * (t - Math.floor(t));
  const beat =
    theta - (0.22 + 0.2 * sprint) * Math.sin(theta) +
    fatigue * 0.3 * Math.sin(2 * theta + 0.4);
  const reach = 0.28 + 0.5 * effort + 0.08 * up;
  const amplitude = flap * reach * (1 - 0.6 * dive);
  const power = flap * (0.4 + 0.6 * sprint) * (1 - 0.5 * fatigue);
  const drive = -Math.cos(beat - 0.2);
  const bones = {};

  const heave =
    (anatomy.scale ?? creatureScale) *
    (flap * (0.06 + 0.24 * amplitude) * (1 + 0.4 * fatigue) * Math.sin(beat - 0.9) +
      glide * 0.025 * slow(0.4, 1));
  const rootPitch =
    -0.06 * amplitude * Math.cos(beat - 0.5) + 0.012 * glide * slow(0.3, 2) + 0.06 * fatigue;
  const wobble =
    fatigue * 0.05 * (time === null ? Math.sin(2 * theta + 1) : slow(1.3, 3));
  const undulate = flap * (0.025 + 0.02 * fatigue) * Math.sin(theta - 0.2) * (1 - 0.6 * sprint);
  bones.root = {
    position: [0, heave, 0],
    rotation: [wobble, -0.6 * undulate, rootPitch],
  };
  const crunch = power * 0.13 * drive;
  const chestPitch = -crunch + 0.04 * amplitude * Math.sin(beat - 1.6) - 0.05 * dive + 0.04 * up;
  bones.chest = {
    rotation: [
      0.08 * turn * (1 - 0.4 * fatigue) + 0.3 * wobble,
      undulate - 0.05 * turn,
      chestPitch,
    ],
  };

  const psiOf = (side) =>
    beat -
    fatigue * 0.24 * side * (0.6 + 0.4 * (time === null ? 0 : slow(0.8, side)));
  for (const side of [-1, 1]) {
    const inside = side * turn;
    const ragged =
      time === null ? 0.5 * Math.sin(2 * theta + side) : slow(1.9, side * 3.1);
    const psi = psiOf(side);
    const a =
      amplitude * (1 - fatigue * (0.18 + 0.16 * ragged) - 0.16 * inside);
    const bias =
      0.05 + 0.03 * sprint - 0.08 * glide - 0.12 * dive + 0.1 * fatigue * flap +
      0.05 * inside;
    const depth = (soft(a, 0.7) / 0.5) * 0.6;
    const tuck =
      0.75 * dive + 0.45 * Math.max(0, inside) * (1 - dive) + 0.12 * fatigue;
    const elbowFold = 0.5 * (1 - Math.cos(psi - 0.1));
    const wristFold = 0.5 * (1 - Math.cos(psi + 0.35));
    const trim = glide * 0.05 * slow(0.55, side * 5);
    const stroke = a * Math.sin(psi) - 0.1 * power * a * Math.sin(2 * psi);
    const elevation = soft(bias + stroke + trim, reachLimit);
    const sweep =
      0.02 * glide - 0.04 * sprint - 0.42 * dive -
      0.1 * Math.max(0, inside) +
      (0.22 + 0.1 * power) * a * Math.sin(psi - 0.35) -
      0.12 * elbowFold * depth;
    const pitch = -0.24 * a * Math.cos(psi) + 0.06 * up - 0.04 * dive + trim;
    bones[`wing-${side}`] = {
      rotation: [side * elevation, side * sweep, pitch],
    };
    bones[`wing-anchor-${side}`] = {
      rotation: [side * 0.8 * elevation, side * 0.45 * sweep, 0.4 * pitch],
    };
    bones[`wing-elbow-${side}`] = {
      rotation: [
        side * a * 0.42 * Math.sin(psi - 0.6),
        side * 0.45 * (elbowFold * depth + tuck),
        0,
      ],
    };
    bones[`wing-wrist-${side}`] = {
      rotation: [
        side * (a * (0.38 + 0.1 * power) * Math.sin(psi - 1.1) + trim * 0.6),
        -side * 0.6 * (wristFold * depth + tuck),
        -0.12 * a * Math.cos(psi - 0.4),
      ],
    };
    const splay =
      flap * 0.5 * (1 + Math.cos(psi - 0.25)) * (0.5 + 0.5 * effort) -
      1.2 * (wristFold * depth + tuck);
    // The trailing spar shares the body-side membrane with the wrist, so it barely flexes.
    const flex = [1, 1.6, 0.3];
    for (let n = 0; n < 3; n++)
      bones[`spar-${side}-${n}`] = {
        rotation: [
          side *
            (a * (0.16 + 0.04 * power) * flex[n] * Math.sin(psi - 1.4 - 0.3 * n) +
              glide * 0.02 * slow(0.7, n + side)),
          side * [1.5, 0, -0.4][n] * 0.07 * splay,
          0,
        ],
      };
  }
  hindWingPose(bones, { psi: psiOf, amplitude, power, glide, dive, fatigue, turn });
  legPose(bones, {
    theta, psi: psiOf, flap, effort, sprint, glide, dive, up, fatigue, turn, slow,
    // Shape genes only, so colour presets never change the animation.
    quirk: Math.sin(7.1 * (anatomy.genome?.legs || 0) + 3.3 * (anatomy.genome?.body || 0)),
  });

  const steady = 0.8 * (1 - 0.5 * fatigue);
  const counter = (-steady * heave) / neckReach(anatomy);
  const share = [0.45, 0.35, 0.2];
  const posture = [
    -0.16 * sprint - 0.3 * dive + 0.12 * up - 0.14 * fatigue,
    -0.06 * sprint - 0.14 * dive + 0.04 * up - 0.12 * fatigue,
    0.02 * sprint - 0.06 * dive - 0.1 * fatigue,
  ];
  const whip = flap * (0.03 + 0.03 * power) * (1 + 0.5 * fatigue);
  let neckPitch = 0;
  for (let i = 0; i < 3; i++) {
    const pitch =
      counter * share[i] + posture[i] - (i === 0 ? (rootPitch + chestPitch) * steady : 0) +
      whip * Math.sin(beat - 1.2 - i * 0.7);
    neckPitch += pitch;
    bones[`neck-${i}`] = {
      rotation: [
        0.05 * turn * (i === 0 ? 1 : 0.5),
        -0.09 * turn - undulate * (1.2 - 0.4 * i) +
          0.02 * flap * Math.sin(theta - i * 0.5) * (1 - 0.5 * sprint),
        pitch,
      ],
    };
  }
  const glance = 0.12 * slow(0.21, 7) * (1 - sprint) * (1 - dive);
  const nod =
    fatigue * 0.07 * Math.sin(theta - 1.2) + 0.015 * flap * Math.sin(theta - 1.6);
  bones.head = {
    rotation: [
      -0.45 * bank * (1 - 0.5 * fatigue),
      -0.22 * turn + glance + 0.7 * undulate,
      -(neckPitch - posture.reduce((s, v) => s + v, 0)) -
        (rootPitch + chestPitch) * steady +
        0.18 * sprint + 0.2 * dive - 0.1 * up - 0.12 * fatigue + nod,
    ],
  };
  mouthPose(bones, anatomy, {
    theta, effort, sprint, flap, glide, dive, fatigue, time, slow, seed, roar, snap, snapSide, gasp, breath, breathYaw, breathPitch,
  });

  const sway = flap * 0.05 * (1 - 0.7 * sprint) * (1 + 0.6 * fatigue) + 0.014;
  const lift = flap * (0.03 + 0.1 * amplitude) * (1 - 0.3 * sprint);
  const rudder = 0.05 * slow(0.33, 11) * (glide + 0.5 * dive);
  const droop = 0.035 * up - 0.015 * sprint - 0.02 * dive + 0.05 * fatigue;
  for (let i = 0; i < 7; i++) {
    const loose = (i + 1) / 7;
    bones[`tail-${i}`] = {
      rotation: [
        -0.04 * turn * loose,
        sway * (0.35 + 0.65 * loose) * Math.sin(theta - 0.9 - i * 0.6) -
          0.05 * turn * (1 - 0.3 * loose) +
          rudder * (0.4 + loose) + (i === 0 ? 0.6 * undulate : 0),
        lift * (0.3 + 0.7 * loose) * Math.sin(beat - 1.7 - i * 0.55) +
          (i < 2 ? 0.5 * crunch : 0) + droop,
      ],
    };
  }
  const hindWings = anatomy.bones.some((bone) => bone.id === "hindwing-1");
  const flight = (wings > 0 || motion?.flop > 0) && wingsOf(bones);
  if (flare > 0 || stand > 0 || impact > 0)
    landingPose(bones, anatomy, { flare, stand, impact, theta, slow, hindWings, rest: drillRest(anatomy, motion) });
  if (flight || spring) leapPose(bones, flight, { wings, spring });
  if (motion?.crouch > 0) groundBreathPose(bones, anatomy, motion, { time, theta });
  if (sleepOf(motion) > 0) slumberPose(bones, anatomy, motion, { theta, time, seed });
  drillPose(bones, anatomy, motion, flight);
  if (motion?.thump > 0) thumpPose(bones, motion, time);
  if (motion?.idle > 0 && time !== null) wagPose(bones, anatomy, { time, seed, weight: Math.min(1, motion.idle) * stand * (1 - sleepOf(motion)) });
  if (motion) festePose(bones, motion);
  const yawn = yawnOf(anatomy, motion, time, seed);
  if (yawn) yawnPose(bones, anatomy, yawn);
  const shut = Math.max(motion?.lids > 0 ? Math.min(1, motion.lids) : 0, sleepShut(motion), time === null ? 0 : blinkOf(time, seed), yawn?.squeeze ?? 0),
    face = expressionOf(motion);
  if (shut > 0 || face.upper > 0 || face.lower > 0) lidPose(bones, anatomy, { upper: Math.max(shut, face.upper), lower: Math.max(shut, face.lower), tilt: face.tilt });
  const tilt = tiltOf(anatomy, yawn ? { ...motion, idle: motion.idle * (1 - yawn.on) } : motion, time, seed),
    looking = curiousGaze(motion?.gaze ?? (time === null ? null : glanceOf(time, seed)), tilt),
    gaze = face.down > 0 ? [(looking?.[0] ?? 0) * (1 - face.down), Math.max(-1, (looking?.[1] ?? 0) * (1 - face.down) - face.down)] : looking;
  if (gaze && shut < 1) gazePose(bones, anatomy, gaze);
  if (motion) lookPose(bones, motion);
  if (tilt) tiltPose(bones, tilt);
  return { bones };
}
