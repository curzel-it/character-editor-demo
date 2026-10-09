import { composite, resize } from "./raster.js";
import { FAVICON_SIZE, renderFavicon } from "./faviconArt.js";
import { ICON_SIZE, renderIcon } from "./iconArt.js";
import { LOGO_SIZES, renderLogo } from "./logoArt.js";
import { DEFAULT_LOGO_FONT, LOGO_FONTS } from "./logoFonts.js";
import { SPLASH_SIZE, renderSplash } from "./splashArt.js";

const params = new URLSearchParams(location.search);
const root = document.getElementById("piece");

const logoPart = params.get("part") ?? "full";
const logoFont = params.get("font") ?? DEFAULT_LOGO_FONT;

const pieces = {
  icon: () => renderIcon(root, { layer: params.get("layer") ?? "all", inset: Number(params.get("inset") ?? 1) }),
  logo: () => renderLogo(root, { part: logoPart, font: logoFont }),
  splash: () => renderSplash(root),
  favicon: () => renderFavicon(root),
};
const sizes = { icon: { width: ICON_SIZE, height: ICON_SIZE }, logo: LOGO_SIZES[logoPart], splash: SPLASH_SIZE, favicon: { width: FAVICON_SIZE, height: FAVICON_SIZE } };

const name = params.get("piece");
const render = pieces[name];
if (!render) throw new Error(`Unknown piece "${name}"`);

window.__brand = { composite, resize, size: sizes[name], ready: false };
const [titleFamily, titleWeight] = LOGO_FONTS[logoFont] ?? [];
await Promise.all(
  ["400 100px 'Lilita One'", "600 40px 'Fredoka'", `${titleWeight} 100px '${titleFamily}'`].map((font) => document.fonts.load(font)),
);
await render();
await document.fonts.ready;
window.__brand.ready = true;
