import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const encodings = [
  { name: "br", suffix: ".br" },
  { name: "gzip", suffix: ".gz" },
  { name: "identity", suffix: "" },
];

/**
 * The page `npm run build` wrote, in the best encoding the browser accepts.
 * @param {string} dist the build folder
 * @param {string} [accept] the Accept-Encoding header
 * @returns {Promise<{data: Buffer, encoding: string} | null>}
 */
export async function readBuiltPage(dist, accept = "") {
  const accepted = accept.split(",").map((part) => part.split(";")[0].trim());
  for (const { name, suffix } of encodings) {
    if (name !== "identity" && !accepted.includes(name)) continue;
    try {
      return { data: await readFile(resolve(dist, `index.html${suffix}`)), encoding: name };
    } catch {
      /* Not built in this encoding. */
    }
  }
  return null;
}
