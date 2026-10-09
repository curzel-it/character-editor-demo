/** Curated colour rows for the editor, as `{ id, hex }`: natural tones first, then the fanciful ones. */

const row = (entries) => entries.map(([id, hex]) => ({ id, hex }));

export const skinTones = row([
  ["porcelain", "#f7dccb"],
  ["ivory", "#f2d2b6"],
  ["rosy", "#efc2ae"],
  ["sand", "#e6b98f"],
  ["honey", "#d9a172"],
  ["golden", "#c98f5c"],
  ["olive", "#b5885a"],
  ["caramel", "#a86f45"],
  ["bronze", "#8f5a36"],
  ["umber", "#6f4128"],
  ["cocoa", "#57321f"],
  ["ebony", "#3e2418"],
]);

export const fancySkinTones = row([
  ["frost", "#cfe3ef"],
  ["moss", "#a9c79a"],
  ["lilac", "#c9b5e2"],
  ["coral", "#f1a493"],
  ["slate", "#8e9bb0"],
]);

export const hairColors = row([
  ["jet", "#1d1716"],
  ["espresso", "#3a2518"],
  ["chestnut", "#5e3a22"],
  ["auburn", "#8a3b22"],
  ["copper", "#b9562a"],
  ["ginger", "#d9793a"],
  ["caramel", "#a8723f"],
  ["honey", "#cf9d55"],
  ["blond", "#e6c47d"],
  ["platinum", "#efe3c4"],
  ["silver", "#c4c4c8"],
  ["snow", "#f4f1ea"],
]);

export const fancyHairColors = row([
  ["rose", "#ef8fb1"],
  ["berry", "#a3366b"],
  ["violet", "#7d5bc7"],
  ["sky", "#79b8ef"],
  ["teal", "#2fa39b"],
  ["mint", "#8fdcb5"],
  ["lime", "#a7d14b"],
  ["sunset", "#f2a33a"],
]);

export const eyeColors = row([
  ["umber", "#4a2c1a"],
  ["hazel", "#7a5a2a"],
  ["amber", "#c88a2a"],
  ["olive", "#6d7a34"],
  ["green", "#3f8a4a"],
  ["teal", "#2f8a8a"],
  ["blue", "#3d74c4"],
  ["sky", "#7fb2e0"],
  ["grey", "#7f8a94"],
  ["violet", "#7a55b8"],
  ["ruby", "#b0303c"],
  ["gold", "#e0b030"],
]);

export const fabricColors = row([
  ["snow", "#f6f2e9"],
  ["cream", "#eadcbf"],
  ["sand", "#d6bf94"],
  ["tan", "#b08a5c"],
  ["brown", "#6e4a2f"],
  ["charcoal", "#36383d"],
  ["ink", "#1f2433"],
  ["slate", "#69778a"],
  ["navy", "#25386b"],
  ["royal", "#3359c4"],
  ["sky", "#7fb6e6"],
  ["teal", "#21858a"],
  ["mint", "#9fd9bd"],
  ["sage", "#8ea57a"],
  ["forest", "#2f5d3a"],
  ["olive", "#6f7339"],
  ["mustard", "#d6a531"],
  ["sun", "#f2cf4a"],
  ["tangerine", "#ec8a35"],
  ["rust", "#a8482a"],
  ["scarlet", "#cf3236"],
  ["berry", "#8f2a52"],
  ["rose", "#ea8fab"],
  ["blush", "#f3c3c4"],
  ["lilac", "#b9a2dc"],
  ["plum", "#5b3a78"],
]);

export const metalColors = row([
  ["gold", "#e8b54a"],
  ["silver", "#c9ced6"],
  ["bronze", "#b97a45"],
  ["iron", "#5d636d"],
  ["rose", "#e2a08a"],
  ["black", "#26272b"],
]);

export const lensColors = row([
  ["clear", "#d9eef2"],
  ["smoke", "#3a4650"],
  ["amber", "#e3a33c"],
  ["rose", "#e88fa6"],
  ["sky", "#8cc4ea"],
  ["emerald", "#4fae7c"],
]);

/** `#rrggbb` as linear-ish renderer rgb in 0..1. */
export function rgbOf(hex) {
  const value = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ""))?.[1] ?? "808080";
  return [0, 2, 4].map((k) => parseInt(value.slice(k, k + 2), 16) / 255);
}

/** Renderer rgb in 0..1 as `#rrggbb`. */
export function hexOf(rgb) {
  return `#${rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** `rgb` scaled towards black (factor < 1) or white (factor > 1). */
export function shade(rgb, factor) {
  return factor <= 1 ? rgb.map((v) => v * factor) : rgb.map((v) => v + (1 - v) * (factor - 1));
}

export const mixRgb = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);

export const luminance = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;

/** Whether `hex` is a well formed `#rrggbb`. */
export const isHex = (hex) => /^#[0-9a-f]{6}$/i.test(String(hex));
