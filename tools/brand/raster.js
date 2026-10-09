const decode = (base64) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = `data:image/png;base64,${base64}`;
  });

const toBase64 = (data) => {
  let text = "";
  for (let i = 0; i < data.length; i += 0x8000) text += String.fromCharCode(...data.subarray(i, i + 0x8000));
  return btoa(text);
};

/** Halves until close, so a large master shrinks without aliasing. */
function shrink(image, width, height) {
  let source = image;
  let w = image.width;
  let h = image.height;
  while (w / 2 >= width) {
    w = Math.max(width, Math.round(w / 2));
    h = Math.max(height, Math.round(h / 2));
    const step = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const context = step.getContext("2d");
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, w, h);
    source = step;
  }
  return source;
}

const shapePath = (context, size, shape) => {
  context.beginPath();
  if (shape === "circle") context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  else if (shape === "rounded") context.roundRect(0, 0, size, size, size * 0.22);
  else context.rect(0, 0, size, size);
  context.clip();
};

/**
 * Stacks square PNG layers at `size` inside `shape` and returns the RGBA pixels as base64.
 * @param {string[]} layers base64 PNGs, bottom first
 * @param {{size: number, shape?: "square" | "circle" | "rounded"}} options
 */
export async function composite(layers, { size, shape = "square" }) {
  const canvas = Object.assign(document.createElement("canvas"), { width: size, height: size });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingQuality = "high";
  shapePath(context, size, shape);
  for (const layer of layers) {
    context.drawImage(shrink(await decode(layer), size, size), 0, 0, size, size);
  }
  return { width: size, height: size, rgba: toBase64(context.getImageData(0, 0, size, size).data) };
}

/** Resizes one PNG to `width` by `height` and returns the RGBA pixels as base64. */
export async function resize(base64, width, height) {
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingQuality = "high";
  context.drawImage(shrink(await decode(base64), width, height), 0, 0, width, height);
  return { width, height, rgba: toBase64(context.getImageData(0, 0, width, height).data) };
}
