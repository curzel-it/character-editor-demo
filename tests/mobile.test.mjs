import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { currentBuildNumber } from "../tools/buildNumber.mjs";
import { mergeTestflightEnv, parseEnv } from "../tools/testflight.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));

test("the iOS and Android projects share one build number", () => {
  assert.ok(Number.isInteger(currentBuildNumber(root)));
});

test("the TestFlight import takes the account but not another app's settings", () => {
  const shared = "ASC_KEY_ID=K\nASC_ISSUER_ID=I\nASC_KEY_PATH=/k.p8\nAPPLE_TEAM_ID=T\nXCODE_ARCHIVES=/a\nEXPORT_OPTIONS=/e.plist\nBUNDLE_ID=other.app\nASC_APP_ID=999\n";
  const merged = parseEnv(mergeTestflightEnv("KEEP=1\nASC_APP_ID=42\n", shared));
  assert.equal(merged.KEEP, "1");
  assert.equal(merged.ASC_KEY_ID, "K");
  assert.equal(merged.BUNDLE_ID, "it.curzel.dragonz");
  assert.equal(merged.XCODE_SCHEME, "Dragonz");
  assert.equal(merged.ASC_APP_ID, "42");
  assert.throws(() => mergeTestflightEnv("", "BUNDLE_ID=x\n"), /missing/);
});
