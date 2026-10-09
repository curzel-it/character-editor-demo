import { createRenderer } from "./render.js";
import { withTack } from "./jockey/withTack.js";
import { boneMatrices, point } from "./math3d.js";

/** Standing on the ground. */
export const restingMotion = { effort: 0, glide: 1, stand: 1 };

/**
 * Cached dragon thumbnails drawn by one shared renderer. `get(dragon, style)` returns a canvas to
 * copy from; it is redrawn only when the dragon's look or the style changes. `resting` poses the
 * dragon on the ground instead of in flight; `background` is the RGB behind it; `focus` names the bone
 * the camera centres on instead of the whole dragon.
 */
export function createThumbnails(module, { width = 288, height = 180, resting = false, zoom = 1.9, background, focus } = {}) {
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const renderer = createRenderer(canvas);
  const cache = new Map();
  return {
    width,
    height,
    get(dragon, style) {
      const key = `${style}:${JSON.stringify(dragon.genome)}:${JSON.stringify(dragon.jockey)}:${dragon.harness !== false}:${dragon.age}`;
      if (cache.get(dragon.id)?.key !== key) {
        const bare = module.createAnatomy(dragon.genome, { age: dragon.age });
        const anatomy = withTack(bare, { harness: dragon.harness !== false, jockey: resting ? null : dragon.jockey });
        const pose = resting ? module.pose(anatomy, 0, restingMotion) : module.pose(anatomy, 0.3);
        const center = focus && point(boneMatrices(anatomy, pose)[anatomy.bones.findIndex((b) => b.id === focus)], [0, 0, 0]);
        renderer.render(anatomy, pose, { style, yaw: -0.5, pitch: 0.12, zoom, background, center });
        const image = Object.assign(document.createElement("canvas"), { width, height });
        image.getContext("2d").drawImage(canvas, 0, 0);
        cache.set(dragon.id, { key, image });
      }
      return cache.get(dragon.id).image;
    },
    /** Copies the thumbnail into `target`, a canvas of the same size. */
    draw(target, dragon, style) {
      target.getContext("2d").drawImage(this.get(dragon, style), 0, 0);
    },
  };
}
