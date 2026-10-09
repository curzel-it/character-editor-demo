const WINDOW = 30,
  SLOW = 1000 / 30,
  CALM = 1000 / 57,
  GAP = 100,
  STEP = 0.85,
  MIN = 0.6,
  FIRST_RETRY = 8000;

/**
 * A render-resolution scale that steps down while frames arrive slower than 30 fps and steps back
 * up after a calm spell, waiting twice as long after each retry. Gaps over 100 ms (a pause, a hidden
 * tab, a tool driving single frames) are not counted.
 * @returns {{ readonly value: number, frame(now: number): void }}
 */
export function createRenderScale() {
  let value = 1,
    last = 0,
    sum = 0,
    count = 0,
    calm = 0,
    retry = FIRST_RETRY;
  return {
    get value() {
      return value;
    },
    frame(now) {
      const interval = now - last;
      last = now;
      if (interval <= 0 || interval > GAP) return;
      sum += interval;
      if (++count < WINDOW) return;
      const mean = sum / count;
      if (mean > SLOW) {
        value = Math.max(MIN, value * STEP);
        calm = 0;
      } else if (mean < CALM && value < 1) {
        calm += sum;
        if (calm > retry) {
          value = Math.min(1, value / STEP);
          retry *= 2;
          calm = 0;
        }
      }
      sum = 0;
      count = 0;
    },
  };
}
