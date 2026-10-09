import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./studio.mjs";

/** The portrait loading screen, 1290 by 2796 (a 6.7 inch iPhone at 3x). @param {Awaited<ReturnType<typeof import("./studio.mjs").openStudio>>} studio */
export async function buildSplash(studio) {
  mkdirSync(join(ROOT, "brand"), { recursive: true });
  writeFileSync(join(ROOT, "brand/splash.png"), Buffer.from(await studio.shoot("splash"), "base64"));
  console.log("wrote brand/splash.png");
}
