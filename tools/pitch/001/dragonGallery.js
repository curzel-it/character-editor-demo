import { createRenderer } from "/src/render.js";
import { loadSubject, makeGenome } from "/src/subjects.js";
import { boneMatrices, point } from "/src/math3d.js";
import { withTack } from "/src/jockey/withTack.js";
import { restingMotion } from "/src/dragonThumbnails.js";

const module = await loadSubject("dragon");
const SIZE = 720;
const canvas = Object.assign(document.createElement("canvas"), { width: SIZE, height: SIZE });
const renderer = createRenderer(canvas, { transparent: true });

/** The gene `name`'s variant index for `id`. */
export const variant = (name, id) => module.genes.find((gene) => gene.name === name).ids.indexOf(id);

/** The gene `name` itself, with its labels and ids. */
export const gene = (name) => module.genes.find((g) => g.name === name);

/** A seeded genome with `overrides` laid over it, free of the rare traits unless asked for. */
export function genomeOf(seed, overrides = {}) {
  return { ...makeGenome(module.genes, seed), metal: 0, mane: 0, ...overrides };
}

/**
 * Draws a dragon into `target` on a transparent ground. `view` takes `age`, `yaw`, `pitch`, `zoom`,
 * `focus` (a bone to centre on), `radius`, `motion` (a still face: moods, lids, gaze, mouth, no blinking), `standing` (on the ground rather than in flight) and `tack`.
 * @param {HTMLCanvasElement} target
 */
export function drawDragon(target, genome, view = {}) {
  const bare = module.createAnatomy(genome, { age: view.age ?? "adult" });
  const anatomy = view.tack ? withTack(bare, { harness: true }) : bare;
  const time = view.time ?? 0.7;
  const motion = view.motion ? { ...restingMotion, ...view.motion } : { ...restingMotion, time };
  const pose = module.pose(anatomy, time, view.standing === false ? undefined : motion);
  if (view.focus) {
    const index = anatomy.bones.findIndex((bone) => bone.id === view.focus);
    const at = point(boneMatrices(anatomy, pose)[index], [0, 0, 0]);
    anatomy.bounds = { center: at, radius: view.radius ?? anatomy.bounds.radius * 0.35 };
  }
  const w = Math.round(target.clientWidth * 2) || SIZE,
    h = Math.round(target.clientHeight * 2) || SIZE;
  canvas.width = SIZE;
  canvas.height = Math.round((SIZE * h) / w);
  renderer.render(anatomy, pose, { style: "cozy", yaw: view.yaw ?? -0.55, pitch: view.pitch ?? 0.16, zoom: view.zoom ?? 1 });
  target.width = w;
  target.height = h;
  const ctx = target.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(canvas, 0, 0, w, h);
}

/** The bone ids of an adult, for picking a `focus`. */
export const boneIds = () => module.createAnatomy(genomeOf("bones"), { age: "adult" }).bones.map((bone) => bone.id);
