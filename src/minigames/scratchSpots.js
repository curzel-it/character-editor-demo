import { makeSkinMesh } from "../skinMesh.js";
import { makeRng } from "../rng.js";
import { point } from "../math3d.js";

const STRIDE = 12,
  SAMPLES = 420;

/**
 * Where a dragon may itch, from its crown down to the base of its neck, each a test on a skin vertex's
 * bone id, its normal `n` (`side` its flank's sign) and how far along its bone's skin it lies, `u` (0 at
 * the back, 1 at the front). Every region faces the flank, so a finger reaches it.
 */
const REGIONS = [
  { id: "crown", test: (bone, n, side, u) => bone === "head" && n[1] > 0.4 && n[2] * side > 0.2 && u < 0.45 },
  { id: "cheek", test: (bone, n, side, u) => bone === "head" && n[2] * side > 0.6 && u < 0.5 },
  { id: "chin", test: (bone, n, side, u) => bone === "jaw" && n[1] < 0 && n[2] * side > 0.4 && u < 0.55 },
  { id: "nape", test: (bone, n, side) => bone === "neck-2" && n[1] > 0.2 && n[2] * side > 0.4 },
  { id: "neck", test: (bone, n, side) => bone === "neck-1" && n[2] * side > 0.6 },
  { id: "throat", test: (bone, n, side) => bone === "neck-0" && n[1] < 0.1 && n[2] * side > 0.5 },
];
/** How far, in head lengths, a spot keeps from the eye and nose, and from the spot before it. */
const CLEAR = 0.22,
  APART = 0.7;
/** The share of a region's skin, nearest its middle, a spot is picked from. */
const CORE = 0.4;
const STROKABLE = /^(head|jaw|neck-\d|chest)$/;
/** Hard parts the hand reaches past rather than strokes. */
const HARD = /horn|antler|tusk|tooth|fang|spike|crest|eye|pupil|brow|spur/;

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const centroid = (points) => [0, 1, 2].map((k) => points.reduce((sum, p) => sum + p[k], 0) / points.length);

/** The middle of the dragon's eye on its `side` in the rest pose, or null when it has none. */
function eyeOf(anatomy, side) {
  const { vertices } = makeSkinMesh({ ...anatomy, parts: anatomy.parts.filter((p) => p.id === `eye-${side}`) });
  const points = [];
  for (let i = 0; i < vertices.length; i += STRIDE) points.push([vertices[i], vertices[i + 1], vertices[i + 2]]);
  return points.length ? centroid(points) : null;
}

/**
 * The places a dragon `anatomy` can be scratched on its `side` (1 its left, -1 its right), seeded by
 * `seed`: `spots`, one itchy spot per region in the order it will itch, each well apart from the one before, each `{ region, at, bone, local }`
 * with `at` a point of its skin in the rest pose; `nose`, its snout tip, which it hates being touched;
 * `skin`, points spread over the hide of its head, neck and chest, horns and teeth left out; `itchy`, points
 * spread over every region a spot may be in, its search area; and `size`, its head's length.
 * @returns {{ spots: { region: string, at: number[], bone: number, local: number[] }[], nose: { at: number[], bone: number, local: number[] }, skin: { at: number[], bone: number, local: number[] }[], itchy: { at: number[], bone: number, local: number[] }[], size: number }}
 */
export function scratchSpots(anatomy, { side, seed }) {
  const { vertices, inverseBind } = makeSkinMesh({ ...anatomy, parts: anatomy.parts.filter((p) => !HARD.test(p.id)) });
  const id = (i) => anatomy.bones[vertices[i + (vertices[i + 11] >= 0.5 ? 9 : 10)]].id;
  const extent = {};
  for (let i = 0; i < vertices.length; i += STRIDE) {
    const range = (extent[id(i)] ??= [Infinity, -Infinity]);
    range[0] = Math.min(range[0], vertices[i]);
    range[1] = Math.max(range[1], vertices[i]);
  }
  const head = anatomy.bones.findIndex((b) => b.id === "head");
  const on = (bone, at) => ({ at, bone, local: point(inverseBind[bone], at) });
  const regions = REGIONS.map(() => []);
  const skin = [];
  for (let i = 0; i < vertices.length; i += STRIDE) {
    const bone = id(i);
    if (!STROKABLE.test(bone)) continue;
    const at = [vertices[i], vertices[i + 1], vertices[i + 2]],
      n = [vertices[i + 3], vertices[i + 4], vertices[i + 5]];
    const [lo, hi] = extent[bone];
    const u = (at[0] - lo) / Math.max(1e-6, hi - lo);
    const index = vertices[i + (vertices[i + 11] >= 0.5 ? 9 : 10)];
    REGIONS.forEach((r, k) => r.test(bone, n, side, u) && at[2] * side > -0.05 && regions[k].push(on(index, at)));
    skin.push(on(index, at));
  }
  const nostrils = [];
  for (let i = 0; i < vertices.length; i += STRIDE) if (/^nostril-/.test(id(i))) nostrils.push([vertices[i], vertices[i + 1], vertices[i + 2]]);
  const [lo, hi] = extent.head ?? [0, 1];
  const size = hi - lo;
  const tip = nostrils.length ? centroid(nostrils) : [hi, 0, 0];
  const eye = eyeOf(anatomy, side) ?? tip;
  const random = makeRng(seed);
  const picks = regions
    .map((found, k) => {
      const clear = found.filter((p) => distance(p.at, eye) > CLEAR * size && distance(p.at, tip) > CLEAR * size);
      if (!clear.length) return null;
      const middle = centroid(clear.map((p) => p.at));
      const core = clear.sort((a, b) => distance(a.at, middle) - distance(b.at, middle)).slice(0, Math.max(1, Math.ceil(CORE * clear.length)));
      return { region: REGIONS[k].id, ...core[Math.floor(random() * core.length)] };
    })
    .filter(Boolean);
  const spots = [];
  while (picks.length) {
    const last = spots.at(-1);
    const far = last ? picks.filter((p) => distance(p.at, last.at) > APART * size) : picks;
    const from = far.length ? far : picks;
    const next = from[Math.floor(random() * from.length)];
    spots.push(next);
    picks.splice(picks.indexOf(next), 1);
  }
  const sample = (points) => points.filter((_, i) => i % Math.max(1, Math.floor(points.length / SAMPLES)) === 0);
  return { spots, nose: on(head, tip), skin: sample(skin), itchy: sample(regions.flat()), size };
}
