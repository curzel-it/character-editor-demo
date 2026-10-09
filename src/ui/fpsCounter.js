const WINDOW = 500;

/**
 * A frames-per-second readout for a render loop; call `tick(now)` once per drawn frame.
 * @returns {{ el: HTMLElement, tick(now: number): void }}
 */
export function createFpsCounter() {
  const el = document.createElement("span");
  el.className = "dz-fps";
  el.setAttribute("aria-hidden", "true");
  el.textContent = "– fps";
  let frames = 0,
    since = 0,
    last = 0;
  return {
    el,
    tick(now) {
      const stalled = now - last > WINDOW;
      last = now;
      if (stalled) {
        frames = 0;
        since = now;
        return;
      }
      frames++;
      if (now - since < WINDOW) return;
      el.textContent = `${Math.round((frames * 1000) / (now - since))} fps`;
      frames = 0;
      since = now;
    },
  };
}
