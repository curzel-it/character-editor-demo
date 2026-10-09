// The native apps keep a copy of the save in the player's cloud: the iCloud key-value store on iOS,
// a file Android backs up to the player's Google account. On the web there is none.

/** Where the app keeps the cloud copy, `icloud` or `google`, or null on the web. */
export function cloudName() {
  if (globalThis.webkit?.messageHandlers?.cloudSave) return "icloud";
  return globalThis.DragonzCloud ? "google" : null;
}

/** The raw save the app found in the cloud, or null. */
export function cloudCopy() {
  try {
    return globalThis.DragonzCloud?.load?.() ?? globalThis.dragonzCloudStable ?? null;
  } catch {
    return null;
  }
}

/** Hands a raw save to the app for the cloud. */
export function pushToCloud(raw) {
  try {
    globalThis.webkit?.messageHandlers?.cloudSave?.postMessage(raw);
    globalThis.DragonzCloud?.save?.(raw);
  } catch {
    // The local save still stands.
  }
}

/** Calls `changed` with the raw save whenever the cloud copy changes under the game (iOS only). */
export function onCloudChange(changed) {
  addEventListener("dragonz-cloud", () => changed(cloudCopy()));
  try {
    globalThis.webkit?.messageHandlers?.cloudSave?.postMessage(null);
  } catch {
    // No cloud to follow.
  }
}
