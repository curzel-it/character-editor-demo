function canvasPixels(canvas) {
  const source =
    canvas.id === "view" && globalThis.__mining?.capture
      ? globalThis.__mining.capture()
      : canvas;
  const copy = globalThis.document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  const ctx = copy.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  return ctx.getImageData(0, 0, copy.width, copy.height);
}

export const pixelsOf = (canvas) => `(${canvasPixels.toString()})(${canvas})`;
