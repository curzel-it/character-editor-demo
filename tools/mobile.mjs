#!/usr/bin/env node

import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildPage, writeBuild } from "./build.mjs";
import { bumpBuildNumber } from "./buildNumber.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Web folders the iOS and Android wrappers bundle; both are gitignored. */
export const WRAPPERS = ["ios/web", "android/app/src/main/assets/web"];

/** Replaces each wrapper's web folder with the built page; the wrappers load it from disk, uncompressed. */
export function syncMobile(root = ROOT) {
  const page = buildPage(root);
  let files = [];
  for (const wrapper of WRAPPERS) files = writeBuild(root, join(root, wrapper), { precompress: false, page });
  return files;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const files = syncMobile();
  console.log(`copied ${files.length} files into ${WRAPPERS.join(" and ")}`);
  console.log(`build number ${bumpBuildNumber(ROOT)}`);
}
