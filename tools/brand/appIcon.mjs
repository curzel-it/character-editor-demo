import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT } from "./studio.mjs";

const IOS_ICON = "ios/Dragonz/Assets.xcassets/AppIcon.appiconset/icon.png";
const ANDROID_RES = "android/app/src/main/res";
/** Android's adaptive icon keeps its subject inside the middle 66 of 108 dp. */
const ADAPTIVE_INSET = 0.62;
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const write = (path, bytes) => {
  mkdirSync(dirname(join(ROOT, path)), { recursive: true });
  writeFileSync(join(ROOT, path), bytes);
  console.log(`wrote ${path}`);
};

/** The iOS store icon (opaque, no alpha), the page's touch icon, the favicon (the head as a transparent sticker), and the Android launcher set: adaptive layers, legacy square and round. @param {Awaited<ReturnType<typeof import("./studio.mjs").openStudio>>} studio */
export async function buildAppIcon(studio) {
  const full = await studio.shoot("icon", { layer: "all" });
  write(IOS_ICON, await studio.stack([full], { size: 1024, alpha: false }));
  write("styles/ui/img/apple-touch-icon.png", await studio.stack([full], { size: 180, alpha: false }));
  write("styles/ui/img/favicon.png", await studio.stack([await studio.shoot("favicon")], { size: 64 }));

  const background = await studio.shoot("icon", { layer: "background" });
  const foreground = await studio.shoot("icon", { layer: "foreground", inset: ADAPTIVE_INSET });
  const legacy = await studio.shoot("icon", { layer: "foreground", inset: 0.9 });
  for (const [density, scale] of Object.entries(DENSITIES)) {
    const folder = `${ANDROID_RES}/mipmap-${density}`;
    write(`${folder}/ic_launcher_background.png`, await studio.stack([background], { size: 108 * scale, alpha: false }));
    write(`${folder}/ic_launcher_foreground.png`, await studio.stack([foreground], { size: 108 * scale }));
    write(`${folder}/ic_launcher.png`, await studio.stack([background, legacy], { size: 48 * scale, shape: "rounded" }));
    write(`${folder}/ic_launcher_round.png`, await studio.stack([background, legacy], { size: 48 * scale, shape: "circle" }));
  }
}
