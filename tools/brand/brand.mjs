#!/usr/bin/env node

import { buildAppIcon } from "./appIcon.mjs";
import { buildLogo } from "./logo.mjs";
import { buildSplash } from "./splash.mjs";
import { openStudio } from "./studio.mjs";

const BUILDS = { appicon: buildAppIcon, logo: buildLogo, splash: buildSplash };

const args = process.argv.slice(2);
const font = args.find((arg) => arg.startsWith("--font="))?.slice(7);
const names = args.filter((arg) => !arg.startsWith("--"));
const wanted = names.length === 0 || names.includes("all") ? Object.keys(BUILDS) : names;
const unknown = wanted.filter((name) => !BUILDS[name]);
if (unknown.length) {
  console.error(`unknown piece ${unknown.join(", ")}; choose from ${Object.keys(BUILDS).join(", ")}, all`);
  process.exit(1);
}

const studio = await openStudio();
try {
  for (const name of wanted) await BUILDS[name](studio, { font });
} finally {
  await studio.close();
}
