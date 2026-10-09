import { palette } from "../palette.js";
import { tube } from "./riderMesh.js";
import { bodyTracer } from "./bodyTracer.js";
import { leather, tack } from "./tackColors.js";
import { riderPose } from "./riderParts.js";

const add = (a, b) => a.map((v, i) => v + b[i]);
const mirror = (p, side) => [p[0], p[1], p[2] * side];
const plain = (rgb) => () => rgb;

/**
 * The racing saddle: a cloth wrapped to mid-flank (the silks body colour with an accent border and a
 * third-colour stripe, so a rider's colours read from the side as well as from above), a girth, flaps
 * under the knees, a low seat with pommel and cantle, and stirrups at the rider's tuck.
 */
export function saddleParts(frame, { trim }) {
  const { saddle, rigid, shape } = frame;
  const { strap, panel } = bodyTracer(frame);
  const x = saddle[0];
  const parts = [];
  const keep = (part) => part && parts.push(part);

  keep(panel("saddle-cloth", [x - 0.6, x + 0.42], [-1.2, 1.2], [8, 14], 0.03, (i, j, cols, rows) => {
    const edge = i === 0 || i === cols - 1 || j === 0 || j === rows - 1;
    const stripe = !edge && (j === 1 || j === rows - 2);
    return edge ? trim.accent : stripe ? trim.third : trim.body;
  }));
  for (const side of [-1, 1])
    keep(panel(`saddle-flap-${side}`, [x - 0.08, x + 0.22], side < 0 ? [-0.88, -0.5] : [0.5, 0.88], [2, 2], 0.05, () => leather));
  const girth = Array.from({ length: 20 }, (_, i) => [x - 0.05, (i / 20) * Math.PI * 2]);
  keep(strap("saddle-girth", girth, { width: 0.06, thick: 0.02, lift: 0.045, rgb: tack, closed: true, steps: 1 }));

  parts.push(
    shape("saddle-seat", "ellipsoid", [-0.04, 0.03, 0], [0.34, 0.07, 0.19], leather),
    shape("saddle-pommel", "ellipsoid", [0.26, 0.07, 0], [0.07, 0.07, 0.12], tack),
    shape("saddle-cantle", "ellipsoid", [-0.34, 0.07, 0], [0.05, 0.08, 0.15], tack),
  );
  const { ankle } = riderPose(frame);
  for (const side of [-1, 1]) {
    const iron = mirror(add(ankle, [0.07, -0.05, 0.005]), side);
    parts.push(
      rigid(`saddle-leather-${side}`, tube([{ p: mirror([0.02, 0.05, 0.16], side), r: 0.014 }, { p: iron, r: 0.014 }], { segments: 4, color: plain(tack) })),
      shape(`saddle-iron-${side}`, "box", iron, [0.07, 0.012, 0.05], palette.steel),
    );
  }
  return parts;
}
