import { evaluate } from "../../cdp.mjs";

const OVERLAY = `(() => {
  if (document.getElementById("trailer-fingers")) return 0;
  const root = Object.assign(document.createElement("div"), { id: "trailer-fingers" });
  root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:99999";
  for (let i = 0; i < 2; i++) {
    const dot = document.createElement("div");
    dot.style.cssText = "position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,0.55);border:3px solid rgba(255,255,255,0.95);box-shadow:0 4px 14px rgba(0,0,0,0.35);opacity:0;transform:scale(1.3)";
    root.append(dot);
  }
  document.body.append(root);
  return 0;
})()`;

/**
 * Pointer events for `points`, dispatched straight to whatever lies under each finger. Chrome's
 * emulated touches arrive at mixed scales on a scaled phone, so the trailer makes its own.
 */
async function pointers(session, type, points) {
  return evaluate(
    session,
    `(() => {
      for (const [id, x, y] of ${JSON.stringify(points)}) {
        const target = window.__trailerCaptured?.[id] ?? document.elementFromPoint(x, y);
        if (!target) continue;
        if ("${type}" === "pointerdown") (window.__trailerCaptured ??= {})[id] = target;
        if ("${type}" === "pointerup") delete window.__trailerCaptured[id];
        target.dispatchEvent(new PointerEvent("${type}", { pointerId: id, pointerType: "touch", isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true, composed: true, buttons: "${type}" === "pointerup" ? 0 : 1 }));
        if ("${type}" === "pointerup") target.dispatchEvent(new MouseEvent("click", { clientX: x, clientY: y, bubbles: true }));
      }
      return 0;
    })()`,
  );
}

const NO_CAPTURE = `(() => { Element.prototype.setPointerCapture = () => {}; Element.prototype.releasePointerCapture = () => {}; return 0; })()`;

/**
 * Fingers on the phone's glass that the footage shows: each `move` sends the pointers to the page
 * and draws a soft white dot under every finger down, pressed a little smaller.
 */
export function createFingers(session) {
  /** @type {([number, number] | null)[]} */
  let down = [null, null];

  async function show() {
    await evaluate(session, OVERLAY);
    await evaluate(
      session,
      `(() => { const dots = document.getElementById("trailer-fingers").children; ${JSON.stringify(down)}.forEach((p, i) => { const s = dots[i].style; if (p) { s.left = p[0] + "px"; s.top = p[1] + "px"; } s.opacity = p ? 1 : 0; s.transform = p ? "scale(1)" : "scale(1.3)"; }); return 0; })()`,
    );
  }

  return {
    /** Puts the fingers at `points` (one or two `[x, y]`, CSS pixels); an empty list lifts them all. */
    async move(points) {
      await evaluate(session, NO_CAPTURE);
      const next = [points[0] ?? null, points[1] ?? null];
      const lifted = [],
        moved = [],
        pressed = [];
      for (let i = 0; i < 2; i++) {
        const id = i + 1;
        if (down[i] && !next[i]) lifted.push([id, ...down[i]]);
        else if (!down[i] && next[i]) pressed.push([id, ...next[i]]);
        else if (next[i]) moved.push([id, ...next[i]]);
      }
      if (moved.length) await pointers(session, "pointermove", moved);
      if (pressed.length) await pointers(session, "pointerdown", pressed);
      if (lifted.length) await pointers(session, "pointerup", lifted);
      down = next;
      await show();
    },
  };
}

const ease = (t) => t * t * (3 - 2 * t);

/** `path(u)` (0..1, eased) as points, one step per frame of `clip` over `seconds`. */
export async function gesture(clip, fingers, seconds, path, scale = 1) {
  const n = Math.max(1, Math.round(seconds * 30));
  for (let i = 0; i <= n; i++) {
    await fingers.move(path(ease(i / n)));
    await clip.frame(scale);
  }
}

/** A tap at `point`: down for a few frames, then lifted. */
export async function tapAt(clip, fingers, point) {
  await fingers.move([point]);
  await clip.play(0.12);
  await fingers.move([]);
}
