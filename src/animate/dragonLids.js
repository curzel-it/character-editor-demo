import { euler, rotationAbout, times } from "../mat3.js";
import { smoothstep } from "./flightMotion.js";

const lids = new WeakMap();
/** Radians a full `tilt` rolls the upper lids. */
const TILT = 0.6;

/**
 * Lowers the upper lids and raises the lower ones by shares of their travel: `upper` and `lower`
 * run from 0, open and tucked out of sight, to 1, where the two meet over the eye. Each
 * `lid-<upper|lower>-<side>` bone grows its lid back from its `tuck` as it starts to close and
 * turns its edge by its `shut` angle about its `axis`, while the `lid-<upper|lower>-back-<side>`
 * bone turns its far side by the `trail` share of that (see `src/anatomy/dragonEyelids.js`). `tilt`
 * (-1..1) rolls the lowered upper lids about the eye: above 0 their back corners droop for a sad look,
 * below 0 their front corners do for a cross one; it fades as the lids shut.
 * @param {Record<string, { rotation?: number[], scale?: number }>} bones
 * @param {{ parts: object[], bones: { id: string }[] }} anatomy
 * @param {{ upper?: number, lower?: number, tilt?: number }} lids
 */
export function lidPose(bones, anatomy, { upper = 0, lower = 0, tilt = 0 }) {
  for (const lid of lidsOf(anatomy)) {
    const k = Math.max(0, Math.min(1, lid.upper ? upper : lower));
    if (k <= 0) continue;
    const roll = lid.upper ? rotationAbout(lid.roll, TILT * Math.max(-1, Math.min(1, tilt)) * (1 - smoothstep(0.7, 1, k))) : null,
      turn = (angle) => euler(roll ? times(roll, rotationAbout(lid.axis, angle)) : rotationAbout(lid.axis, angle)),
      scale = (lid.tuck + (1 - lid.tuck) * smoothstep(0, 0.25, k)) / lid.tuck;
    bones[lid.bone] = { rotation: turn(k * lid.shut), scale };
    bones[lid.back] = { rotation: turn(k * lid.trail * lid.shut), scale };
  }
}

function lidsOf(anatomy) {
  if (!lids.has(anatomy))
    lids.set(
      anatomy,
      anatomy.parts
        .filter(({ id }) => /^lid-(upper|lower)-/.test(id))
        .map(({ id, bone, axis, shut, tuck, trail, roll, skin }) => ({ bone, back: skin.joints[0][1], axis, shut, tuck, trail, roll, upper: id.startsWith("lid-upper") })),
    );
  return lids.get(anatomy);
}
