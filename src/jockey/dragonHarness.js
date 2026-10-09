import { palette } from "../palette.js";
import { inverseRigid, point } from "../math3d.js";
import { bodyTracer } from "./bodyTracer.js";
import { tack } from "./tackColors.js";

/**
 * The flying harness: a padded breast collar round the base of the neck, straps from it up to the
 * front of the seat, and crupper straps from the back of the seat over the loins to a strap across
 * the hips. With `saddled` the straps anchor on the saddle; without it a padded roller takes the
 * saddle's place. Skinned between the seat's bone and the neck or root bones.
 */
export function harnessParts(frame, { trim, saddled }) {
  const { anatomy, bind, index, mount, saddle } = frame;
  const { surface, blend, strap, panel } = bodyTracer(frame);
  const neckBone = ["neck-0", "neck-1"].find((id) => index.has(id));
  const rootBone = anatomy.bones.find((b) => !b.parent)?.id ?? mount.bone;
  const origin = (id) => point(bind[index.get(id)], [0, 0, 0]);
  const x = saddle[0];
  const parts = [];
  const keep = (part) => part && parts.push(part);

  if (!saddled) keep(panel("harness-roller-pad", [x - 0.2, x + 0.2], [-0.7, 0.7], [3, 6], 0.03, () => trim.accent));
  const front = saddled ? x + 0.26 : x + 0.12;
  const rear = saddled ? x - 0.45 : x - 0.2;

  if (neckBone) {
    // Breast collar, leaning so its lower edge sits on the chest ahead of the wing roots.
    const neckX = origin(neckBone)[0];
    const cx = x + (neckX - x) * 0.75;
    const lean = 0.35;
    const weigh = blend(neckBone, x + 0.1, neckX);
    const collar = Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * Math.PI * 2;
      return [cx + lean * (1 - Math.cos(a)) * 0.5, a];
    });
    keep(strap("harness-breast-collar", collar, { width: 0.09, thick: 0.03, lift: 0.05, rgb: trim.accent, weigh, closed: true, steps: 1 }));
    for (const side of [-1, 1]) {
      keep(strap(`harness-breast-strap-${side}`, [[front, side * 0.55], [cx + 0.1, side * 1.2]], { rgb: tack, weigh, steps: 6 }));
      const b = surface(cx + 0.1, side * 1.2, 0.08);
      if (b)
        parts.push({ id: `harness-buckle-${side}`, bone: mount.bone, shape: "box", position: point(inverseRigid(bind[index.get(mount.bone)]), b), rotation: [0, 0, 0], scale: [0.05, 0.05, 0.03], color: palette.steel });
    }
  }

  if (rootBone !== mount.bone) {
    // Crupper straps either side of the spine, down over the loins to a strap across the hips.
    const rootX = origin(rootBone)[0];
    const weigh = blend(rootBone, rear, rootX);
    const back = Math.min(rootX - 0.2, rear - 0.4);
    for (const side of [-1, 1])
      keep(strap(`harness-crupper-${side}`, [[rear, side * 0.25], [(rear + back) / 2, side * 0.4], [back, side * 0.55], [back - 0.05, side * 1.35]], { rgb: tack, weigh }));
    keep(strap("harness-loin-strap", [[back + 0.05, -1.3], [back + 0.2, -0.6], [back + 0.2, 0.6], [back + 0.05, 1.3]], { rgb: trim.accent, weigh, width: 0.055, steps: 4 }));
  }
  return parts;
}
