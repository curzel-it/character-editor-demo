import { palette } from "../../palette.js";
import { tube } from "../../jockey/riderMesh.js";
import { ACROSS, GRIP, piece } from "./itemPiece.js";

const SLANT = 0.85,
  HOSE_BEND = 0.06,
  HOSE_TRAIL = 0.34,
  HOSE_DROP = [1, 0, 0];

const unit = (v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};
const AXIS = [Math.sin(SLANT), 0, -Math.cos(SLANT)];
const along = (from, ...steps) => steps.reduce((p, [d, k]) => p.map((v, i) => v + d[i] * k), from);

/**
 * Where the hose's water leaves its nozzle on the keeper's hand bone, and the way it points there: out
 * past the thumb, slanting forward through the fist towards the knuckles.
 */
export const NOZZLE = { tip: along([GRIP[0], GRIP[1], 0], [AXIS, 0.2]), axis: AXIS };

/** A grooming brush: a round handle through the fist, out past the thumb to a wooden back with its bristles to the palm's side. */
function brush() {
  const c = palette.careTools.clean;
  const [x, y] = GRIP;
  return [
    piece("brush-handle", "cylinder", [x, y, -0.045], [0.014, 0.085, 0.014], c.wood, ACROSS),
    piece("brush-back", "ellipsoid", [x, y - 0.002, -0.17], [0.034, 0.014, 0.062], c.woodDark),
    ...Array.from({ length: 12 }, (_, i) =>
      piece(`brush-tuft-${i}`, "cylinder", [x + ((i % 3) - 1) * 0.019, y - 0.028, -0.212 + Math.floor(i / 3) * 0.028], [0.0085, 0.02, 0.0085], c.bristle),
    ),
  ];
}

/** A bath sponge under the palm, the fingers half round it, its green scouring side out. */
function sponge() {
  const c = palette.careTools.clean;
  return [
    piece("sponge", "box", [0.075, -0.05, 0], [0.058, 0.03, 0.07], c.sponge),
    piece("sponge-scrub", "box", [0.075, -0.087, 0], [0.056, 0.008, 0.068], c.spongeScrub),
  ];
}

/**
 * A hose nozzle slanting through the fist, its barrel out past the thumb and the hose leaving under
 * the little finger, bending round in a smooth quarter turn to hang down below the fist.
 */
function hose() {
  const c = palette.careTools.clean;
  const centre = [GRIP[0], GRIP[1], 0];
  const back = AXIS.map((v) => -v);
  const drop = unit(HOSE_DROP.map((v, i) => v - back[i] * HOSE_DROP.reduce((sum, d, k) => sum + d * back[k], 0)));
  const start = along(centre, [back, 0.045]);
  const bend = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 6) * (Math.PI / 2);
    return { p: along(start, [back, HOSE_BEND * Math.sin(a)], [drop, HOSE_BEND * (1 - Math.cos(a))]), r: 0.015 };
  });
  const end = bend[6].p;
  const trail = [0.5, 1].map((f) => ({ p: along(end, [drop, HOSE_TRAIL * f]), r: 0.015 }));
  const mesh = (id, rings, color) => ({ id: `keeper-${id}`, bone: "hand", shape: "mesh", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color, ...tube(rings, { segments: 10, color: () => color }) });
  const at = (k, r) => ({ p: along(centre, [AXIS, k]), r });
  return [
    mesh("nozzle", [at(-0.045, 0.017), at(0.15, 0.017), at(0.155, 0.024), at(0.185, 0.02), at(0.2, 0.012)], c.nozzle),
    mesh("hose", [{ p: along(centre, [back, 0.02]), r: 0.015 }, ...bend, ...trail], c.hose),
  ];
}

/** What the keeper holds to clean a dragon. */
export const cleanItems = { brush, sponge, hose };
