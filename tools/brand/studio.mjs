import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate, launch, waitFor, watchErrors } from "../cdp.mjs";
import { encodePng } from "./pngEncode.mjs";
import { serveFolder } from "./staticServer.mjs";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const VIEWPORT = { width: 2048, height: 2800 };

/**
 * A headless Chrome with the repo served to it, drawing the brand pieces of `art.html` and
 * handing back PNGs. Close it when done.
 */
export async function openStudio() {
  const server = await serveFolder(ROOT);
  const session = await launch({ url: "about:blank", ...VIEWPORT });
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });
  await session.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });

  return {
    /**
     * Draws a piece at its natural size and returns it as a PNG (base64, with alpha where the piece has any).
     * @param {string} piece
     * @param {Record<string, string | number>} [options]
     */
    async shoot(piece, options = {}) {
      const query = new URLSearchParams({ piece, ...options });
      await session.send("Page.navigate", { url: `${server.origin}/tools/brand/art.html?${query}` });
      const ready = await waitFor(session, "window.__brand?.ready === true", 60000);
      if (!ready || errors.length) throw new Error(`${piece} did not render: ${errors.join("\n")}`);
      const { width, height } = await evaluate(session, "window.__brand.size");
      const { data } = await session.send("Page.captureScreenshot", {
        format: "png",
        clip: { x: 0, y: 0, width, height, scale: 1 },
        captureBeyondViewport: true,
      });
      return data;
    },

    /** Stacks PNG layers at `size` in `shape` and returns the PNG file. @param {string[]} layers @param {{size: number, shape?: string, alpha?: boolean}} options */
    async stack(layers, { size, shape = "square", alpha = true }) {
      const pixels = await evaluate(session, `window.__brand.composite(${JSON.stringify(layers)}, ${JSON.stringify({ size, shape })})`);
      return encodePng({ ...pixels, rgba: Buffer.from(pixels.rgba, "base64"), alpha });
    },

    /** Resizes a PNG to `width` by `height` and returns the PNG file. */
    async resize(base64, width, height, { alpha = true } = {}) {
      const pixels = await evaluate(session, `window.__brand.resize(${JSON.stringify(base64)}, ${width}, ${height})`);
      return encodePng({ ...pixels, rgba: Buffer.from(pixels.rgba, "base64"), alpha });
    },

    async close() {
      await session.close();
      server.close();
    },
  };
}
