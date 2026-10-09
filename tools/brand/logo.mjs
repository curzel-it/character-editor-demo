import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./studio.mjs";

const PARTS = { "brand/logo.png": "word", "brand/logo-peaks.png": "peaks", "brand/logo-full.png": "full" };
/** The game's own copies, at twice the size they are shown: [path, width, height]. */
const UI_COPIES = { word: ["styles/ui/img/logo.png", 480, 127], peaks: ["styles/ui/img/logo-peaks.png", 960, 356] };

/**
 * The title alone, the lockup without the dragon and the full lockup (mountains, dragon, badge, tagline), all
 * transparent and 2048 px wide, plus the game's smaller copies of the first two.
 * @param {Awaited<ReturnType<typeof import("./studio.mjs").openStudio>>} studio
 * @param {{font?: string}} [options]
 */
export async function buildLogo(studio, { font } = {}) {
  mkdirSync(join(ROOT, "brand"), { recursive: true });
  for (const [file, part] of Object.entries(PARTS)) {
    const shot = await studio.shoot("logo", { part, ...(font && { font }) });
    writeFileSync(join(ROOT, file), Buffer.from(shot, "base64"));
    console.log(`wrote ${file}`);
    if (!UI_COPIES[part]) continue;
    const [copy, width, height] = UI_COPIES[part];
    writeFileSync(join(ROOT, copy), await studio.resize(shot, width, height));
    console.log(`wrote ${copy}`);
  }
}
