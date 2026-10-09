/** Calls `onFrame(dt, now)` on every animation frame between `start()` and `stop()`; `dt` is capped at 0.1 s. */
export function createFrameLoop(onFrame) {
  let running = false,
    previous = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.1, (now - previous) / 1000);
    previous = now;
    try {
      onFrame(dt, now);
    } catch (error) {
      running = false;
      throw error;
    }
    if (running) requestAnimationFrame(frame);
  }
  return {
    get running() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      previous = performance.now();
      requestAnimationFrame(frame);
    },
    stop() {
      running = false;
    },
  };
}
