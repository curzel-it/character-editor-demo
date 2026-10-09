import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);

/** The repo root. */
export const root = fileURLToPath(new URL("../../../../", import.meta.url));

/** The running game to capture (`--url`). */
export const base = option("url", "http://127.0.0.1:8094");

/** Where the deck's media go (`--out`, by default the deck's `media/` folder); shots land in its `shots/`. */
export const media = resolve(option("out", fileURLToPath(new URL("../media", import.meta.url))));

/** Scratch space for raw frames and intermediate clips (`--tmp`, by default `tmp/` in the media folder). */
export const tmp = resolve(option("tmp", resolve(media, "tmp")));

/** The folder for one group of shots, e.g. `shots/race`. */
export const shotsDir = (group = "") => resolve(media, "shots", group);
