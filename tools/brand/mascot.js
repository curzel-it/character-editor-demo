import { createRenderer } from "/src/render.js";
import { loadSubject, makeGenome } from "/src/subjects.js";
import { applyPalette, colourIndex } from "/src/palette.js";
import { boneMatrices, point } from "/src/math3d.js";

const SEED = 537;
const COLORS = {
  scales: colourIndex("rose"),
  wings: colourIndex("lavender"),
  underside: colourIndex("ivory"),
  eyes: 0,
  markings: 0,
};

/**
 * The brand dragon: a fixed genome, drawn by the game's own renderer on a transparent canvas.
 * `focus` names a bone to centre on (the whole dragon by default), `offset` nudges that centre in
 * world units and `radius` sets how much of the dragon around it stays in frame; `age` picks kid, teen or adult (adult by default).
 * @param {HTMLCanvasElement} canvas
 * @param {{age?: string, motion?: object, time?: number, yaw?: number, pitch?: number, focus?: string, radius?: number, zoom?: number, offset?: number[], genes?: object}} view
 */
export async function drawMascot(canvas, view = {}) {
  applyPalette();
  const module = await loadSubject("dragon");
  const genome = { ...makeGenome(module.genes, SEED), ...COLORS, ...view.genes };
  const anatomy = module.createAnatomy(genome, { age: view.age ?? "adult" });
  const time = view.time ?? 0.7;
  const pose = module.pose(anatomy, time, view.motion ?? { stand: 1, time });
  if (view.focus || view.offset) {
    const index = anatomy.bones.findIndex((bone) => bone.id === view.focus);
    const at = index >= 0 ? point(boneMatrices(anatomy, pose)[index], [0, 0, 0]) : anatomy.bounds.center;
    const [dx = 0, dy = 0, dz = 0] = view.offset ?? [];
    anatomy.bounds = { center: [at[0] + dx, at[1] + dy, at[2] + dz], radius: view.radius ?? anatomy.bounds.radius };
  }
  const renderer = createRenderer(canvas, { transparent: true });
  try {
    renderer.render(anatomy, pose, {
      style: "cozy",
      yaw: view.yaw ?? -0.6,
      pitch: view.pitch ?? 0.2,
      zoom: view.zoom ?? 1,
    });
  } finally {
    renderer.dispose();
  }
}
