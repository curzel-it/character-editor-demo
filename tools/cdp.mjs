// A minimal Chrome DevTools Protocol client, with the websocket hand-rolled out of
// node:net because there are no dependencies here.

import { createHash, randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { connect } from "node:net";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { sleptFor, calledCdp } from "./timing.mjs";

// A leaked headless browser is invisible and keeps holding its audio context, so every exit
// path has to kill one. close() is the polite path; the reaper below catches a throw, a ctrl-C
// or a process.exit, and the orphan sweep catches what a SIGKILL to the parent left behind.

const alive = new Set();
let reaperInstalled = false;

// Sync only - an `exit` handler is not allowed to await.
function reap() {
  for (const entry of alive) {
    try {
      entry.chrome.kill("SIGKILL");
    } catch {
      /* already gone */
    }
    try {
      rmSync(entry.profile, { recursive: true, force: true });
    } catch {
      /* already gone */
    }
  }
  alive.clear();
}

// A wedged Chrome ignores SIGTERM and `chrome.kill()` returning is not evidence it died, so:
// ask, wait a second, then SIGKILL.
async function kill(entry) {
  alive.delete(entry);
  const dead = () =>
    entry.chrome.exitCode !== null || entry.chrome.signalCode !== null;
  try {
    entry.chrome.kill();
  } catch {
    /* already gone */
  }
  for (let i = 0; i < 10 && !dead(); i++) await sleep(100);
  if (!dead()) {
    try {
      entry.chrome.kill("SIGKILL");
    } catch {
      /* already gone */
    }
    await sleep(100);
  }
  try {
    rmSync(entry.profile, { recursive: true, force: true });
  } catch {
    /* already gone */
  }
}

function installReaper() {
  if (reaperInstalled) return;
  reaperInstalled = true;
  process.on("exit", reap);
  // Signals do not run `exit` unless somebody handles them.
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, () => {
      reap();
      process.exit(sig === "SIGINT" ? 130 : 143);
    });
  }
}

// SIGKILL to the parent runs no handler, so the browser is reparented to init and keeps going.
// PPID 1 is the whole test: one of ours whose parent is gone has no check left to belong to,
// while a concurrent run's browser still has its own node as a parent. Unix only, `ps` is not
// Windows.
function sweepOrphans() {
  if (process.platform === "win32") return;
  let out = "";
  try {
    out = execFileSync("ps", ["-A", "-o", "pid=,ppid=,command="], {
      encoding: "utf8",
      maxBuffer: 8 << 20,
    });
  } catch {
    return;
  }
  for (const line of out.split("\n")) {
    if (!line.includes("mining-cdp-")) continue;
    const m = line.match(/^\s*(\d+)\s+(\d+)\s/);
    if (!m || m[2] !== "1") continue;
    try {
      process.kill(Number(m[1]), "SIGKILL");
    } catch {
      /* gone between ps and here */
    }
    // Its profile goes with it rather than waiting out the six hours below.
    const dir = line.match(/--user-data-dir=(\S+)/);
    if (dir) {
      try {
        rmSync(dir[1], { recursive: true, force: true });
      } catch {
        /* still unlinking */
      }
    }
  }
}

// Six hours: no check here runs longer than minutes, so an older profile belongs to a process
// that is not coming back for it.
const STALE_PROFILE_MS = 6 * 60 * 60 * 1000;

function sweepStaleProfiles() {
  const dir = tmpdir();
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  const now = Date.now();
  for (const name of names) {
    if (!name.startsWith("mining-cdp-")) continue;
    const path = join(dir, name);
    try {
      if (now - statSync(path).mtimeMs < STALE_PROFILE_MS) continue;
      rmSync(path, { recursive: true, force: true });
    } catch {
      /* in use, or gone already */
    }
  }
}

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

export function findChrome() {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p;
  throw new Error("no chrome found - set CHROME_PATH");
}

// Timed so a poll loop that runs its budget out shows up in the per-section sleep count.
export const sleep = async (ms) => {
  const at = performance.now();
  await new Promise((r) => setTimeout(r, ms));
  sleptFor(performance.now() - at);
};

// RFC 6455, client side, only as much as CDP needs: text frames out (masked, as a client
// must), text frames in (never masked), and continuation frames, because Chrome fragments a
// screenshot's few hundred KB of base64.
function openSocket(url) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const sock = connect(Number(u.port), u.hostname, () => {
      const key = randomBytes(16).toString("base64");
      const accept = createHash("sha1")
        .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
        .digest("base64");

      sock.write(
        `GET ${u.pathname}${u.search} HTTP/1.1\r\n` +
          `Host: ${u.host}\r\n` +
          "Upgrade: websocket\r\nConnection: Upgrade\r\n" +
          `Sec-WebSocket-Key: ${key}\r\n` +
          "Sec-WebSocket-Version: 13\r\n\r\n",
      );

      let handshake = Buffer.alloc(0);
      const onHandshake = (chunk) => {
        handshake = Buffer.concat([handshake, chunk]);
        const end = handshake.indexOf("\r\n\r\n");
        if (end === -1) return;
        const head = handshake.subarray(0, end).toString("latin1");
        if (!head.includes(accept)) {
          sock.removeListener("data", onHandshake);
          reject(new Error("websocket handshake rejected"));
          return;
        }
        sock.removeListener("data", onHandshake);
        resolve({ sock, rest: handshake.subarray(end + 4) });
      };
      sock.on("data", onHandshake);
    });
    sock.on("error", reject);
  });
}

function buildFrame(text) {
  const payload = Buffer.from(text, "utf8");
  const mask = randomBytes(4);
  const len = payload.length;

  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = 0x80 | len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 0x80 | 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }
  header[0] = 0x81; // FIN + text

  const masked = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3];
  return Buffer.concat([header, mask, masked]);
}

// Pull as many whole frames as `buf` holds; returns the leftover.
function drainFrames(buf, onMessage, state) {
  for (;;) {
    if (buf.length < 2) return buf;
    const fin = (buf[0] & 0x80) !== 0;
    const opcode = buf[0] & 0x0f;
    let len = buf[1] & 0x7f;
    let offset = 2;

    if (len === 126) {
      if (buf.length < 4) return buf;
      len = buf.readUInt16BE(2);
      offset = 4;
    } else if (len === 127) {
      if (buf.length < 10) return buf;
      // Node cannot index past 2^53 anyway; the high word is always 0 here.
      len = buf.readUInt32BE(2) * 2 ** 32 + buf.readUInt32BE(6);
      offset = 10;
    }
    if (buf.length < offset + len) return buf;

    const payload = buf.subarray(offset, offset + len);
    buf = buf.subarray(offset + len);

    if (opcode === 0x8) return null; // close
    if (opcode === 0x9 || opcode === 0xa) continue; // ping/pong, ignored
    state.parts.push(payload);
    if (fin) {
      onMessage(Buffer.concat(state.parts).toString("utf8"));
      state.parts = [];
    }
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

// Port 0 isolates simultaneous browser runs; Chrome records the chosen port in DevToolsActivePort.
export async function launch({
  url,
  port = 0,
  width = 960,
  height = 600,
  bin = null,
  argv = null,
  flags = [],
  gpu = true,
}) {
  installReaper();
  sweepOrphans();
  sweepStaleProfiles();

  const profile = mkdtempSync(join(tmpdir(), "mining-cdp-"));
  const exe = bin || findChrome();
  const chrome = spawn(
    exe,
    argv
      ? argv({ port, profile, width, height, url })
      : [
          "--headless=new",
          ...(gpu ? [] : ["--disable-gpu"]),
          `--remote-debugging-port=${port}`,
          `--user-data-dir=${profile}`,
          `--window-size=${width},${height}`,
          "--no-first-run",
          "--no-default-browser-check",
          "--hide-scrollbars",
          // Headless Chrome still opens the default output device, so without this a run plays
          // the soundtrack out of the machine. The graph is still built and scheduled, so the
          // page under test stays the page that ships.
          "--mute-audio",
          // A fresh --user-data-dir is not a fresh browser: policy-installed extensions land in
          // every profile Chrome makes, and one that opens a welcome page on install takes the
          // foreground. The game's page is then hidden, gets no requestAnimationFrame, and the
          // frame loop stops while Runtime.evaluate keeps answering - so nothing times out and
          // nothing throws.
          "--disable-extensions",
          "--disable-component-extensions-with-background-pages",
          ...flags,
          url,
        ],
    { stdio: "ignore" },
  );

  const entry = { chrome, profile };
  alive.add(entry);

  // The profile is fresh, so whatever answers on the port it names is the browser just spawned.
  let target = null;
  let actual = port;
  for (let i = 0; i < 100 && target === null; i++) {
    await sleep(100);
    if (!actual) {
      try {
        actual = Number(
          readFileSync(join(profile, "DevToolsActivePort"), "utf8").split(
            "\n",
          )[0],
        );
      } catch {
        continue; // not written yet
      }
      if (!Number.isInteger(actual) || actual <= 0) {
        actual = 0;
        continue;
      }
    }
    try {
      const list = await fetchJson(`http://127.0.0.1:${actual}/json/list`);
      target =
        list.find((t) => t.type === "page" && t.webSocketDebuggerUrl) || null;
    } catch {
      // not listening yet
    }
  }
  if (!target) {
    await kill(entry);
    throw new Error(`${basename(exe)} never exposed a page target`);
  }

  const { sock, rest } = await openSocket(target.webSocketDebuggerUrl);

  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  const state = { parts: [] };
  let buf = rest;

  sock.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const left = drainFrames(
      buf,
      (text) => {
        const msg = JSON.parse(text);
        if (msg.id === undefined) {
          // An event. Errors arrive this way and only this way.
          for (const fn of listeners.get(msg.method) || []) fn(msg.params);
          return;
        }
        const waiter = pending.get(msg.id);
        if (!waiter) return;
        pending.delete(msg.id);
        if (msg.error) waiter.reject(new Error(msg.error.message));
        else waiter.resolve(msg.result);
      },
      state,
    );
    if (left === null) return;
    buf = left;
  });

  function on(method, fn) {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(fn);
  }

  function send(method, params = {}) {
    const id = nextId++;
    const at = performance.now();
    sock.write(buildFrame(JSON.stringify({ id, method, params })));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (pending.delete(id)) reject(new Error(`${method} timed out`));
      }, 20000);
    }).finally(() => calledCdp(performance.now() - at));
  }

  async function close() {
    try {
      sock.destroy();
    } catch {
      /* already gone */
    }
    await kill(entry);
  }

  return { send, on, close };
}

// The packaged desktop game, driven the same way as the page. No URL: the shell decides what it
// loads, and that decision is part of what is being checked. No --headless either - Electron's
// is not Chromium's, and the checks want the mode players run.
export function launchElectron({ bin, port = 0, width = 1280, height = 720 }) {
  return launch({
    url: "",
    port,
    width,
    height,
    bin,
    argv: ({ port: p, profile }) => [
      `--remote-debugging-port=${p}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      // A window the compositor calls hidden gets no requestAnimationFrame, so a window that
      // opens behind another reports a black canvas. Raising it is not enough on Windows, where
      // occlusion is recalculated continuously; these three take the compositor out of it.
      "--disable-features=CalculateNativeWinOcclusion",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });
}

// Every way the current and future documents have of complaining, funnelled into one array.
// Callers that need to observe boot install this before reloading or navigating.
export async function watchErrors(session) {
  const errors = [];
  await session.send("Runtime.enable");
  await session.send("Log.enable");

  session.on("Runtime.exceptionThrown", (p) => {
    errors.push(
      p.exceptionDetails?.exception?.description ||
        p.exceptionDetails?.text ||
        "exception",
    );
  });
  session.on("Log.entryAdded", (p) => {
    if (p.entry?.level === "error") errors.push(p.entry.text);
  });
  session.on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error") {
      errors.push(
        (p.args || []).map((a) => a.value ?? a.description ?? "").join(" "),
      );
    }
  });

  return errors;
}

// Listeners are never removed - fine for a short-lived check script, not for a long loop.
export function waitForEvent(session, method, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${method} never fired`)),
      timeoutMs,
    );
    session.on(method, (params) => {
      clearTimeout(timer);
      resolve(params);
    });
  });
}

// Poll an expression on the page until it is truthy. Boot stacks several waits of no fixed
// length, so guessing a duration instead fails on a slow second rather than on a broken build.
export async function waitFor(session, expr, timeoutMs = 5000, everyMs = 25) {
  const until = Date.now() + timeoutMs;
  do {
    if (await evaluate(session, `!!(${expr})`).catch(() => false)) return true;
    await sleep(everyMs);
  } while (Date.now() < until);
  return false;
}

// Requires Page.enable. Not Page.reload: that returns immediately, the outgoing document keeps
// answering Runtime evaluations, and in a long session it sometimes fires no load event at all.
// Navigating to a distinct same-origin URL is unambiguous and keeps localStorage.
export async function navigate(session, url) {
  const loaded = waitForEvent(session, "Page.loadEventFired");
  await session.send("Page.navigate", { url });
  await loaded;
}

// A URL that is definitely different from the current one, so the navigation cannot be
// collapsed into a no-op.
export function bustCache(url, tag) {
  const u = new URL(url);
  u.searchParams.set("_r", String(tag));
  return u.toString();
}

export async function evaluate(session, expression) {
  const res = await session.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error(
      res.exceptionDetails.exception?.description || "evaluate threw",
    );
  }
  return res.result.value;
}

export async function screenshot(session, path) {
  const { data } = await session.send("Page.captureScreenshot", {
    format: "png",
  });
  const { writeFileSync } = await import("node:fs");
  writeFileSync(path, Buffer.from(data, "base64"));
  return path;
}

// Chrome wants a virtual key code alongside the code, or the page sees a key with no identity.
// Windows codes, and they go in the windows field only. Only the keys this game binds.
const VK = {
  KeyW: 87,
  KeyA: 65,
  KeyS: 83,
  KeyD: 68,
  KeyQ: 81,
  KeyE: 69,
  KeyX: 88,
  KeyF: 70,
  Space: 32,
  ShiftLeft: 16,
  Escape: 27,
  Enter: 13,
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
};

const KEY_NAME = {
  KeyW: "w",
  KeyA: "a",
  KeyS: "s",
  KeyD: "d",
  KeyQ: "q",
  KeyE: "e",
  KeyX: "x",
  KeyF: "f",
  Space: " ",
  ShiftLeft: "Shift",
  Escape: "Escape",
  Enter: "Enter",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
};

// `nativeVirtualKeyCode` is platform-specific; Chrome derives input from code and windowsVirtualKeyCode.
export function key(session, code, down, repeat = false) {
  return session.send("Input.dispatchKeyEvent", {
    type: down ? "keyDown" : "keyUp",
    code,
    key: KEY_NAME[code] || code,
    windowsVirtualKeyCode: VK[code] || 0,
    ...(down && (code === "Enter" || code === "Space")
      ? { text: code === "Enter" ? "\r" : " " }
      : {}),
    autoRepeat: repeat,
  });
}

// A single keystroke, for menus. Long enough to be a real press, short enough not to auto
// repeat.
export async function tap(session, code) {
  await key(session, code, true);
  await sleep(40);
  await key(session, code, false);
  await sleep(90);
}

// `dispatchKeyEvent` produces a keydown and a keyup and nothing else - no character reaches an
// <input>. insertText puts the text in and fires the `input` event the page listens for.
export function type(session, text) {
  return session.send("Input.insertText", { text });
}

export async function hold(session, codes, ms) {
  for (const c of codes) await key(session, c, true);
  await sleep(ms);
  for (const c of codes) await key(session, c, false);
}

export function click(session, x, y) {
  const base = { x, y, button: "left", clickCount: 1 };
  return session
    .send("Input.dispatchMouseEvent", { type: "mousePressed", ...base })
    .then(() =>
      session.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        ...base,
      }),
    );
}

// In steps, because a handler working off the delta between one move and the last learns
// nothing from a single jump to the end.
export async function drag(session, x0, y0, x1, y1, { steps = 8 } = {}) {
  const at = (type, x, y) =>
    session.send("Input.dispatchMouseEvent", {
      type,
      x: Math.round(x),
      y: Math.round(y),
      button: "left",
      buttons: 1,
    });
  await at("mousePressed", x0, y0);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await at("mouseMoved", x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    await sleep(8);
  }
  await at("mouseReleased", x1, y1);
}

// Put the page in a phone: a viewport in CSS pixels at a device ratio, with touch events. The
// `mobile: true` matters as much as the size - it is what makes `(pointer: coarse)` match, which
// is how the game decides to show its touch controls. Calling it again with the two numbers
// swapped rotates the phone, and `screen.orientation` is set explicitly so it agrees with the
// shape. The override outlives a navigation, so anything wanting a desktop back must clear it.
export async function emulateDevice(
  session,
  { width, height, dpr = 3, maxTouchPoints = 5 },
) {
  const upright = height >= width;
  await session.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: dpr,
    mobile: true,
    screenOrientation: {
      type: upright ? "portraitPrimary" : "landscapePrimary",
      angle: upright ? 0 : 90,
    },
  });
  await session.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints,
  });
}

export async function clearDevice(session) {
  await session.send("Emulation.clearDeviceMetricsOverride");
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: false });
}

// Fingers on the glass, in CSS pixels. Every point goes in every time: a touch event carries the
// complete current set, so dropping one is how a finger is lifted while others stay down.
export function touchAt(session, type, points) {
  return session.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map(([x, y], i) => ({
      x,
      y,
      id: i + 1,
      radiusX: 12,
      radiusY: 12,
      force: 1,
    })),
  });
}

// In steps, because a stick that only sees its final position never learns what a real thumb
// does on the way there.
export async function dragTouch(
  session,
  from,
  to,
  { steps = 6, ms = 120 } = {},
) {
  await touchAt(session, "touchStart", [from]);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await touchAt(session, "touchMove", [
      [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t],
    ]);
    await sleep(ms / steps);
  }
}
