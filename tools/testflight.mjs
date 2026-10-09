#!/usr/bin/env node

import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { bumpBuildNumber, currentBuildNumber } from "./buildNumber.mjs";
import { WRAPPERS, syncMobile } from "./mobile.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env");
const TESTFLIGHT_KEYS = [
  "ASC_KEY_ID",
  "ASC_ISSUER_ID",
  "ASC_KEY_PATH",
  "APPLE_TEAM_ID",
  "BUNDLE_ID",
  "ASC_APP_ID",
  "MARKETING_VERSION",
  "XCODE_PROJECT",
  "XCODE_SCHEME",
  "XCODE_ARCHIVES",
  "EXPORT_OPTIONS",
  "BETA_GROUP_TUTTI",
  "BETA_GROUP_PUBLIC_LINK",
];
const REQUIRED_KEYS = TESTFLIGHT_KEYS.filter((key) => !key.startsWith("BETA_GROUP_"));
/** What the shared credential file supplies: the account, not any one app. */
const SHARED_KEYS = ["ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_KEY_PATH", "APPLE_TEAM_ID", "XCODE_ARCHIVES", "EXPORT_OPTIONS"];
/** This app's own settings; the shared file describes another app, so they never come from it. */
const APP_SETTINGS = {
  BUNDLE_ID: "it.curzel.dragonz",
  MARKETING_VERSION: "1.0",
  XCODE_PROJECT: "ios/Dragonz.xcodeproj",
  XCODE_SCHEME: "Dragonz",
};
const FAILED_STATES = new Set(["FAILED", "INVALID"]);

/** @param {string} text @returns {Record<string, string>} */
export function parseEnv(text) {
  const env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals === -1) continue;
    let value = line.slice(equals + 1).trim();
    const quoted = value.match(/^(["'])(.*?)\1\s*(?:#.*)?$/);
    value = quoted ? quoted[2] : value.replace(/\s+#.*$/, "");
    env[line.slice(0, equals).trim()] = value;
  }
  return env;
}

/** Takes the account from the shared file and keeps every other local setting, adding this app's own. */
export function mergeTestflightEnv(targetText, sourceText) {
  const source = Object.fromEntries(Object.entries(parseEnv(sourceText)).map(([key, value]) => [key, value.replace(/^\$\{?HOME\}?(?=\/|$)/, homedir())]));
  const missing = SHARED_KEYS.filter((key) => !source[key]);
  if (missing.length) throw new Error(`source credentials are missing ${missing.join(", ")}`);
  const current = parseEnv(targetText);
  const keyPattern = new RegExp(`^(?:${TESTFLIGHT_KEYS.join("|")})=`);
  const kept = targetText.split(/\r?\n/).filter((line) => !keyPattern.test(line.trim()));
  while (!kept.at(-1)?.trim()) kept.pop();
  const values = TESTFLIGHT_KEYS.map((key) => [key, SHARED_KEYS.includes(key) ? source[key] : (APP_SETTINGS[key] ?? current[key])])
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${envValue(value)}`);
  return `${kept.join("\n")}\n\n# TestFlight — imported by npm run testflight:setup; set ASC_APP_ID (and the BETA_GROUP_* ids) once the app exists in App Store Connect\n${values.join("\n")}\n`;
}

function envValue(value) {
  return /^[A-Za-z0-9_./:@+-]+$/.test(value) ? value : JSON.stringify(value);
}

/** @param {string} path */
export function localPath(path) {
  const expanded = path === "~" || path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
  return isAbsolute(expanded) ? expanded : resolve(ROOT, expanded);
}

/** @param {string} sourcePath */
function importEnv(sourcePath) {
  const source = localPath(sourcePath);
  if (!existsSync(source)) throw new Error(`missing credential file ${source}`);
  const current = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  writeFileSync(ENV_PATH, mergeTestflightEnv(current, readFileSync(source, "utf8")));
  chmodSync(ENV_PATH, 0o600);
  console.log(`copied TestFlight credentials into ${ENV_PATH}`);
}

/** @param {string} command @param {string[]} args @param {{capture?: boolean}} [options] */
function run(command, args, { capture = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}${capture && stderr.trim() ? `: ${stderr.trim()}` : ""}`));
    });
  });
}

/** @param {Record<string, string>} env */
export function archiveArguments(env, build) {
  const archive = join(localPath(env.XCODE_ARCHIVES), `${env.XCODE_SCHEME}-${build}.xcarchive`);
  return {
    archive,
    args: [
      "archive", "-project", localPath(env.XCODE_PROJECT), "-scheme", env.XCODE_SCHEME,
      "-configuration", "Release", "-destination", "generic/platform=iOS", "-archivePath", archive,
      "-allowProvisioningUpdates", "-authenticationKeyPath", localPath(env.ASC_KEY_PATH),
      "-authenticationKeyID", env.ASC_KEY_ID, "-authenticationKeyIssuerID", env.ASC_ISSUER_ID,
    ],
  };
}

/** @param {Record<string, string>} env */
export async function token(env) {
  const { stdout, stderr } = await run("xcrun", ["altool", "--generate-jwt", "--apiKey", env.ASC_KEY_ID, "--apiIssuer", env.ASC_ISSUER_ID], { capture: true });
  // Xcode 26's altool prints the token on stderr, earlier ones on stdout.
  const found = `${stdout}\n${stderr}`.match(/eyJ[A-Za-z0-9._-]+/);
  if (!found) throw new Error("App Store Connect did not issue an API token");
  return found[0];
}

/** @param {string} url @param {string} jwt @param {RequestInit} [options] */
export async function appStore(url, jwt, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", ...options.headers } });
  if (response.ok) return response.status === 204 ? null : response.json();
  const body = await response.text();
  throw new Error(`App Store Connect returned ${response.status}${body ? `: ${body}` : ""}`);
}

/** @param {Record<string, string>} env @param {number} build */
async function waitForBuild(env, build) {
  const deadline = Date.now() + 15 * 60 * 1000;
  const url = new URL("https://api.appstoreconnect.apple.com/v1/builds");
  url.searchParams.set("filter[app]", env.ASC_APP_ID);
  url.searchParams.set("filter[version]", String(build));
  url.searchParams.set("limit", "5");
  while (Date.now() < deadline) {
    const response = await appStore(url.href, await token(env));
    const candidate = response.data?.find((item) => item.attributes?.version === String(build));
    const state = candidate?.attributes?.processingState;
    if (state === "VALID") return candidate;
    if (FAILED_STATES.has(state)) throw new Error(`TestFlight processing ended in ${state}`);
    console.log(`  build ${build}: ${state || "waiting for Apple"}`);
    await new Promise((resolvePromise) => {
      setTimeout(resolvePromise, 15000);
    });
  }
  throw new Error(`build ${build} did not finish processing within 15 minutes`);
}

/**
 * @param {string} group @param {string} build @param {string} jwt
 * @returns {Promise<boolean>} whether the group is external, so its testers wait for beta review
 */
async function addToGroup(group, build, jwt) {
  const { data } = await appStore(`https://api.appstoreconnect.apple.com/v1/betaGroups/${group}`, jwt);
  const internal = data?.attributes?.isInternalGroup === true;
  // App Store Connect refuses to assign a build to an internal group that already receives every build.
  if (internal && data.attributes.hasAccessToAllBuilds) return false;
  const url = `https://api.appstoreconnect.apple.com/v1/betaGroups/${group}/builds?limit=200`;
  const current = await appStore(url, jwt);
  if (!current.data?.some((item) => item.id === build)) {
    await appStore(`https://api.appstoreconnect.apple.com/v1/betaGroups/${group}/relationships/builds`, jwt, {
      method: "POST",
      body: JSON.stringify({ data: [{ type: "builds", id: build }] }),
    });
  }
  return !internal;
}

/** Sends a build to beta review unless it has already gone. @param {string} build @param {string} jwt */
async function submitForBetaReview(build, jwt) {
  const detail = await appStore(`https://api.appstoreconnect.apple.com/v1/builds/${build}/buildBetaDetail`, jwt);
  const state = detail.data?.attributes?.externalBuildState;
  if (state === "READY_FOR_BETA_SUBMISSION") {
    await appStore("https://api.appstoreconnect.apple.com/v1/betaAppReviewSubmissions", jwt, {
      method: "POST",
      body: JSON.stringify({ data: { type: "betaAppReviewSubmissions", relationships: { build: { data: { type: "builds", id: build } } } } }),
    });
    return "WAITING_FOR_BETA_REVIEW";
  }
  return state;
}

function loadReleaseEnv() {
  if (!existsSync(ENV_PATH)) throw new Error(`missing ${ENV_PATH}; run npm run testflight:setup`);
  const env = parseEnv(readFileSync(ENV_PATH, "utf8"));
  const missing = REQUIRED_KEYS.filter((key) => !env[key]);
  if (missing.length) throw new Error(`missing ${missing.join(", ")} in ${ENV_PATH}`);
  for (const key of ["ASC_KEY_PATH", "XCODE_PROJECT", "XCODE_ARCHIVES", "EXPORT_OPTIONS"]) {
    if (!existsSync(localPath(env[key]))) throw new Error(`${key} does not exist: ${localPath(env[key])}`);
  }
  return env;
}

async function release() {
  const env = loadReleaseEnv();
  await run("xcodebuild", ["-version"]);

  const files = syncMobile(ROOT);
  const build = process.argv.includes("--keep-build") ? currentBuildNumber(ROOT) : bumpBuildNumber(ROOT);
  console.log(`copied ${files.length} files into ${WRAPPERS.join(" and ")}`);
  console.log(`build number ${build}`);

  const { archive, args } = archiveArguments(env, build);
  if (existsSync(archive)) throw new Error(`archive already exists: ${archive}`);
  console.log(`[1/4] archive ${basename(archive)}`);
  await run("xcodebuild", args);

  const exported = mkdtempSync(join(tmpdir(), "dragonz-testflight-"));
  try {
    console.log("[2/4] export and upload");
    await run("xcodebuild", [
      "-exportArchive", "-archivePath", archive, "-exportOptionsPlist", localPath(env.EXPORT_OPTIONS),
      "-exportPath", exported, "-allowProvisioningUpdates", "-authenticationKeyPath", localPath(env.ASC_KEY_PATH),
      "-authenticationKeyID", env.ASC_KEY_ID, "-authenticationKeyIssuerID", env.ASC_ISSUER_ID,
    ]);
  } finally {
    rmSync(exported, { recursive: true, force: true });
  }

  await distribute(env, build);
  console.log(`archive: ${archive}`);
  console.log("commit the mobile build-number changes before the next release");
}

/** Waits for an uploaded build to process and hands it to the beta groups. @param {Record<string, string>} env @param {number} build */
async function distribute(env, build) {
  console.log("[3/4] wait for TestFlight processing");
  const accepted = await waitForBuild(env, build);
  const jwt = await token(env);
  const groups = [env.BETA_GROUP_TUTTI, env.BETA_GROUP_PUBLIC_LINK].filter(Boolean);
  console.log(`[4/4] distribute to ${groups.length} configured group${groups.length === 1 ? "" : "s"}`);
  let external = false;
  for (const group of groups) external = (await addToGroup(group, accepted.id, jwt)) || external;
  const review = external ? await submitForBetaReview(accepted.id, jwt) : null;
  console.log(`done -> TestFlight ${env.MARKETING_VERSION} (${build}) is VALID${review ? `, external testing ${review}` : ""}`);
}

async function main() {
  const distributeIndex = process.argv.indexOf("--distribute");
  if (distributeIndex !== -1) {
    const build = Number(process.argv[distributeIndex + 1]);
    if (!Number.isInteger(build) || build <= 0) throw new Error("--distribute needs an uploaded build number");
    await distribute(loadReleaseEnv(), build);
    return;
  }
  const importIndex = process.argv.indexOf("--import-env");
  if (importIndex !== -1) {
    const source = process.argv[importIndex + 1];
    if (!source) throw new Error("--import-env needs a source file");
    importEnv(source);
    return;
  }
  await release();
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(`testflight: ${error.message}`);
    process.exitCode = 1;
  });
}
