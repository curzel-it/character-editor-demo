import { fields, normalizeSpec, defaultSpec, NAME_LENGTH } from "./characterSpec.js";

const PREFIX = "CE1-";
const CUSTOM = 255;

const swatchesOf = (field) => field.swatches.flat().map((s) => s.hex);

const toBase64Url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (text) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/**
 * A short, copyable code for a character: every field packed into a byte or so (sliders to 1/255,
 * choices and swatches by index, a custom colour as its three bytes) and the name, base64url encoded.
 * @param {import("./characterSpec.js").CharacterSpec} spec
 */
export function encodeCharacter(spec) {
  const bytes = [];
  for (const field of fields) {
    const value = spec[field.key];
    if (field.kind === "slider") bytes.push(Math.round(Math.max(0, Math.min(1, Number(value))) * 254));
    else if (field.kind === "choice") bytes.push(Math.max(0, field.options.findIndex((o) => o.id === value)));
    else {
      const index = swatchesOf(field).indexOf(String(value).toLowerCase());
      if (index >= 0 && index < CUSTOM) bytes.push(index);
      else {
        const hex = /^#([0-9a-f]{6})$/i.exec(String(value))?.[1] ?? "808080";
        bytes.push(CUSTOM, ...[0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16)));
      }
    }
  }
  const name = new TextEncoder().encode(String(spec.name ?? "").slice(0, NAME_LENGTH)).slice(0, 72);
  bytes.push(name.length, ...name);
  return PREFIX + toBase64Url(bytes);
}

/**
 * The character a code describes, or null when it is not a code; fields it does not cover keep their defaults.
 * @param {string} code
 */
export function decodeCharacter(code) {
  const text = String(code ?? "").trim();
  if (!text.startsWith(PREFIX)) return null;
  let bytes;
  try {
    bytes = fromBase64Url(text.slice(PREFIX.length));
  } catch {
    return null;
  }
  const spec = {};
  let at = 0;
  const read = () => (at < bytes.length ? bytes[at++] : undefined);
  for (const field of fields) {
    const byte = read();
    if (byte === undefined) return null;
    if (field.kind === "slider") spec[field.key] = Math.min(1, byte / 254);
    else if (field.kind === "choice") spec[field.key] = field.options[byte]?.id;
    else if (byte === CUSTOM) spec[field.key] = `#${[read(), read(), read()].map((v) => (v ?? 128).toString(16).padStart(2, "0")).join("")}`;
    else spec[field.key] = swatchesOf(field)[byte];
  }
  const length = read() ?? 0;
  spec.name = new TextDecoder().decode(bytes.slice(at, at + length));
  return normalizeSpec(spec, defaultSpec());
}
