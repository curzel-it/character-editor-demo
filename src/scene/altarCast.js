import { boneMatrices, multiply, orientation, point, transform } from "../math3d.js";
import { createCustodian } from "../custodian/createCustodian.js";
import { custodianPose } from "../custodian/custodianPose.js";
import { groundBreathCue, modelTarget } from "../animate/dragonGroundBreath.js";
import { smoothstep } from "../animate/flightMotion.js";
import { mouthPoint } from "../breath/mouthPoint.js";
import { flapRate } from "../race/flightModel.js";
import { grownWingspan } from "../dragonAge.js";
import { restingMotion } from "../dragonThumbnails.js";
import { lowestPoint } from "./groundContact.js";
import { altarFormation } from "./stoneRing.js";

const SOLE = 0.02,
  APPROACH = 70,
  HEIGHT = 30,
  HELD = 3.4;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const turn = (a, b, k) => {
  const x = a[0] + (b[0] - a[0]) * k,
    z = a[2] + (b[2] - a[2]) * k,
    l = Math.hypot(x, z) || 1;
  return [x / l, 0, z / l];
};

/** The root height that stands `anatomy` in `pose` on flat ground at `spot` facing `forward`. */
const standingY = (anatomy, pose, spot, forward) => SOLE - lowestPoint(anatomy, pose, [spot[0], 0, spot[2]], forward);

/**
 * The Soul Altar's figures in a `createAltarPlace` place: the custodian and any parents standing in
 * formation round the ring. `custodian(time, options)` gives a scene racer; `parents(dragons)`
 * prepares a circle of `{ genome }` for `parent(...)` frames.
 */
export function createAltarCast(module, place) {
  const figure = createCustodian();
  const altarTop = place.altar.eggPoint;
  const toAltar = (() => {
    const c = place.custodian.position,
      l = Math.hypot(c[0], c[2]);
    return [-c[0] / l, 0, -c[2] / l];
  })();
  const welcoming = [0.35, 0, 0.94];

  return {
    welcoming,
    /**
     * The custodian at `time`: `pose` eased `blend` of the way to `toward`, turned `facing` (0 towards
     * the visitor at the entrance, 1 towards the altar).
     */
    custodian(time, { pose = "idle", toward, blend = 0, facing = 0 } = {}) {
      return {
        anatomy: figure,
        pose: custodianPose(time, { pose, toward, blend }),
        position: place.custodian.position,
        forward: turn(welcoming, toAltar, smoothstep(0, 1, facing)),
      };
    },
    /**
     * A circle of parents (`{ genome }` adults) in formation round the ring, facing the altar: per
     * parent its anatomy, spot, standing root height, and the mouth it breathes from at the altar.
     */
    parents(dragons) {
      const spots = altarFormation(dragons.length, place.ring);
      return dragons.map((w, i) => {
        const anatomy = module.createAnatomy(w.genome, { age: "adult" });
        const { position, forward, angle } = spots[i];
        const standing = module.pose(anatomy, 0, { ...restingMotion, time: 0 });
        const y = standingY(anatomy, standing, position, forward);
        const root = [position[0], y, position[2]];
        const breathTarget = modelTarget(anatomy, root, forward, altarTop);
        const held = module.pose(anatomy, 0, { ...restingMotion, ...groundBreathCue(HELD), breathTarget, time: HELD });
        const model = multiply(orientation(root, forward, 0), transform(anatomy.bones[0].position.map((v) => -v)));
        const matrices = boneMatrices(anatomy, held);
        const jaw = anatomy.bones.findIndex((b) => b.id === "jaw");
        const head = anatomy.bones.findIndex((b) => b.id === "head");
        return {
          dragon: w,
          anatomy,
          root,
          forward,
          outward: [Math.cos(angle), 0, Math.sin(angle)],
          breathTarget,
          mouth: point(multiply(model, matrices[jaw]), mouthPoint(anatomy)),
          head: point(multiply(model, matrices[head]), [0, 0, 0]),
          rate: flapRate(0.55, grownWingspan(w.genome, "adult")),
          seed: i * 0.37,
        };
      });
    },
    /** A parent standing at rest in its spot. */
    resting(parent, time) {
      const pose = module.pose(parent.anatomy, (time * 0.5 + parent.seed) % 1, { ...restingMotion, time: time + parent.seed });
      return { anatomy: parent.anatomy, pose, position: parent.root, forward: parent.forward };
    },
    /**
     * A parent `time` seconds into the show: gliding in from `start` to land at `land` (show seconds),
     * then from `cueStart` crouching and breathing at the altar. Null before it comes into view.
     */
    arriving(parent, time, { start, land, cueStart }) {
      if (time < start) return null;
      const span = land - start;
      const u = clamp01((time - start) / span);
      const away = (1 - u) ** 2;
      const lift = HEIGHT * (1 - u) ** 2.4;
      const landed = time - land;
      const stand = landed >= 0 ? smoothstep(0, 1.3, landed) : 0;
      const impact = landed < 0 ? 0 : landed < 0.08 ? landed / 0.08 : Math.exp(-(landed - 0.08) / 0.28);
      const flare = smoothstep(0.72, 0.97, u) * (1 - stand);
      const glide = smoothstep(0.3, 0.55, u);
      const cue = groundBreathCue(time - cueStart);
      const motion = {
        effort: 0.6 * (1 - glide),
        glide,
        climb: -0.35 * (1 - smoothstep(0.7, 1, u)),
        flare,
        stand,
        impact,
        crouch: time >= cueStart ? cue.crouch * stand : 0,
        breath: time >= cueStart ? cue.breath * stand : 0,
        breathTarget: parent.breathTarget,
        time: time + parent.seed,
      };
      const phase = stand > 0.5 ? (time * 0.5 + parent.seed) % 1 : ((time - start) * parent.rate + parent.seed) % 1;
      const r = parent.root,
        o = parent.outward;
      return {
        anatomy: parent.anatomy,
        pose: module.pose(parent.anatomy, phase, motion),
        position: [r[0] + o[0] * APPROACH * away, r[1] + lift, r[2] + o[2] * APPROACH * away],
        forward: parent.forward,
      };
    },
  };
}
