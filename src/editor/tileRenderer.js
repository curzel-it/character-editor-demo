import { createRenderer } from "../render.js";
import { characterPose } from "../character/characterPose.js";

const FRONT = -Math.PI / 2;

/**
 * How each field's option tiles are framed: the character's focus, the yaw (0 a side view, -π/2 the
 * front) and a zoom on that framing.
 */
export const tileViews = {
  default: { focus: "full", yaw: FRONT + 0.45, zoom: 1.39 },
  hair: { focus: "head", yaw: FRONT + 0.75, zoom: 1.19 },
  hairTips: { focus: "head", yaw: FRONT + 2.2, zoom: 1.21 },
  hat: { focus: "head", yaw: FRONT + 0.55, zoom: 1.03 },
  ears: { focus: "head", yaw: FRONT + 1.15, zoom: 1.39 },
  earrings: { focus: "head", yaw: FRONT + 1.2, zoom: 1.39 },
  eyes: { focus: "eyes", yaw: FRONT + 0.15, zoom: 1.58 },
  lashes: { focus: "eyes", yaw: FRONT + 0.5, zoom: 1.65 },
  brows: { focus: "eyes", yaw: FRONT + 0.2, zoom: 1.45 },
  nose: { focus: "face", yaw: FRONT + 0.95, zoom: 1.65 },
  mouth: { focus: "face", yaw: FRONT + 0.2, zoom: 1.78 },
  cheekMarks: { focus: "face", yaw: FRONT + 0.3, zoom: 1.39 },
  marking: { focus: "face", yaw: FRONT + 0.3, zoom: 1.32 },
  facialHair: { focus: "face", yaw: FRONT + 0.6, zoom: 1.25 },
  glasses: { focus: "face", yaw: FRONT + 0.45, zoom: 1.32 },
  top: { focus: "upper", yaw: FRONT + 0.45, zoom: 1.25 },
  pattern: { focus: "upper", yaw: FRONT + 0.3, zoom: 1.39 },
  bottom: { focus: "lower", yaw: FRONT + 0.45, zoom: 1.25 },
  shoes: { focus: "feet", yaw: FRONT + 0.7, zoom: 1.0, pitch: 0.35 },
  gloves: { focus: "upper", yaw: FRONT + 0.45, zoom: 1.12 },
  neck: { focus: "upper", yaw: FRONT + 0.45, zoom: 1.52 },
  back: { focus: "full", yaw: 1.2, zoom: 1.39 },
};

/**
 * Renders option thumbnails off screen: `request(key, spec, view, draw)` builds the character in the
 * builder's tile lane, renders it framed by `view`, and hands `draw(source)` a canvas to copy
 * from. Requests run one after another, newest priority first; a key already drawn for the same spec
 * is served from the cache.
 * @param {ReturnType<import("../character/characterBuild.js").createCharacterBuilder>} builder
 * @param {() => unknown} round the style's rounding
 */
export function createTileRenderer(builder, round, size = 192) {
  const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
  const renderer = createRenderer(canvas, { transparent: true });
  const cache = new Map();
  /** @type {Map<string, { spec: object, view: object, draw: (source: CanvasImageSource) => void, hash: string, priority: number }>} */
  const pending = new Map();
  let active = 0,
    generation = 0;

  async function pump() {
    if (active >= 2 || !pending.size) return;
    active++;
    const [key, job] = [...pending.entries()].sort((a, b) => b[1].priority - a[1].priority)[0];
    pending.delete(key);
    const mine = generation;
    pump();
    try {
      const anatomy = await builder.build(job.spec, round(), {});
      if (anatomy && mine === generation) {
        const frame = anatomy.rig.focus[job.view.focus] ?? anatomy.rig.focus.full;
        renderer.render({ ...anatomy, bounds: { center: frame.center, radius: frame.radius } }, characterPose(anatomy, 0, { still: true }), {
          yaw: job.view.yaw,
          pitch: job.view.pitch ?? 0.06,
          zoom: job.view.zoom ?? 1,
        });
        const bitmap = await createImageBitmap(canvas);
        cache.set(key, { hash: job.hash, bitmap });
        if (cache.size > 400) cache.delete(cache.keys().next().value);
        job.draw(bitmap);
      }
    } catch (error) {
      console.warn("Tile failed", key, error);
    }
    active--;
    pump();
  }

  return {
    size,
    /**
     * @param {string} key a stable id for the tile, e.g. `hair:bob`
     * @param {object} spec the character to draw
     * @param {{ focus: string, yaw: number, zoom?: number, pitch?: number }} view
     * @param {(source: CanvasImageSource) => void} draw
     * @param {number} [priority] higher runs first
     */
    request(key, spec, view, draw, priority = 0) {
      const { name: _name, ...look } = spec;
      const hash = JSON.stringify(look);
      const cached = cache.get(key);
      if (cached) {
        draw(cached.bitmap);
        if (cached.hash === hash) return;
      }
      pending.set(key, { spec, view, draw, hash, priority });
      pump();
    },
    /** Drops tiles not yet drawn (another tab opened). */
    cancel() {
      pending.clear();
    },
    /** Forgets requests in flight so their results are not drawn. */
    reset() {
      generation++;
      pending.clear();
    },
  };
}
