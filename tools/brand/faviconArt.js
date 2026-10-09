import { drawMascot } from "./mascot.js";

export const FAVICON_SIZE = 512;

const INK = "#5A3922";
const RENDER = 1024;

/** A 2D copy of `source`, cut to a round bust when `round` so a cropped neck ends in an arc instead of a straight edge. */
function cutOut(source, round) {
  const canvas = Object.assign(document.createElement("canvas"), { width: source.width, height: source.height });
  const context = canvas.getContext("2d");
  if (round) {
    context.beginPath();
    context.arc(source.width * 0.45, source.height * 0.28, source.width * 0.62, 0, Math.PI * 2);
    context.clip();
  }
  context.drawImage(source, 0, 0);
  return canvas;
}

/** The bounding box of the opaque pixels, and a one-colour mask of them. */
function silhouette(source) {
  const canvas = cutOut(source, false);
  const context = canvas.getContext("2d");
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  let [x0, y0, x1, y1] = [canvas.width, canvas.height, 0, 0];
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      const at = (y * canvas.width + x) * 4;
      const a = image.data[at + 3] > 40 ? 255 : 0;
      image.data.set([0, 0, 0, a], at);
      if (a) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }
  context.putImageData(image, 0, 0);
  return { mask: canvas, box: { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 } };
}

/** The mask filled with `color`. */
function tinted(mask, color) {
  const canvas = cutOut(mask, false);
  const context = canvas.getContext("2d");
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * The favicon: the brand dragon's head as a sticker, cut out round at the neck with a thick brown outline on
 * transparency, so the face and eye still read at 16 px on light and dark tabs.
 * @param {HTMLElement} root
 */
export async function renderFavicon(root) {
  root.style.cssText = `width:${FAVICON_SIZE}px;height:${FAVICON_SIZE}px`;
  const render = Object.assign(document.createElement("canvas"), { width: RENDER, height: RENDER });
  await drawMascot(render, {
    age: "kid",
    focus: "head",
    radius: 0.75,
    offset: [-0.05, -0.05, 0],
    yaw: -0.6,
    pitch: 0.1,
    genes: { head: 0, headgear: 0 },
    motion: { stand: 1, time: 0.7 },
  });
  const art = cutOut(render, true);
  const { mask, box } = silhouette(art);

  const out = Object.assign(document.createElement("canvas"), { width: FAVICON_SIZE, height: FAVICON_SIZE });
  const context = out.getContext("2d");
  const ink = FAVICON_SIZE * 0.04;
  const scale = (FAVICON_SIZE - ink * 2 - 4) / Math.max(box.width, box.height);
  const [width, height] = [box.width * scale, box.height * scale];
  const [x, y] = [(FAVICON_SIZE - width) / 2, (FAVICON_SIZE - height) / 2];
  const outline = tinted(mask, INK);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    context.drawImage(outline, box.x, box.y, box.width, box.height, x + Math.cos(a) * ink, y + Math.sin(a) * ink, width, height);
  }
  context.drawImage(art, box.x, box.y, box.width, box.height, x, y, width, height);
  root.append(out);
}
