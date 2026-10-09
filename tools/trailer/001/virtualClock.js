/**
 * Runs in the page before its own scripts: performance.now, Date.now, requestAnimationFrame, the
 * timers and the CSS animations all follow one virtual clock, and Math.random is seeded. It runs at
 * real speed until `__clock.hold(at)`, which moves it on to `at` and from then on moves it only on
 * `__clock.step(ms)`, so every frame is drawn whatever a screenshot costs and a run repeats exactly.
 */
export function installVirtualClock() {
  const realNow = performance.now.bind(performance),
    realDate = Date.now,
    realRaf = requestAnimationFrame.bind(window);
  const dateOrigin = realDate() - realNow();
  let now = realNow(),
    held = false,
    lastReal = realNow(),
    nextId = 1;
  /** @type {Map<number, FrameRequestCallback>} */
  let frames = new Map();
  /** @type {Map<number, { at: number, fn: Function, args: any[], every: number | null }>} */
  const timers = new Map();
  /** @type {WeakMap<Animation, number>} */
  const started = new WeakMap();

  let seed = 0x9e3779b9;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  performance.now = () => now;
  Date.now = () => Math.round(dateOrigin + now);
  window.requestAnimationFrame = (fn) => {
    const id = nextId++;
    frames.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => frames.delete(id);
  const schedule = (every) => (fn, ms = 0, ...args) => {
    const id = nextId++;
    const wait = Math.max(0, Number(ms) || 0);
    timers.set(id, { at: now + wait, fn, args, every: every ? Math.max(1, wait) : null });
    return id;
  };
  window.setTimeout = schedule(false);
  window.setInterval = schedule(true);
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);

  function runTimers() {
    for (let guard = 0; guard < 10000; guard++) {
      let due = null;
      for (const [id, timer] of timers) if (timer.at <= now && (!due || timer.at < due[1].at)) due = [id, timer];
      if (!due) return;
      const [id, timer] = due;
      if (timer.every) timer.at += timer.every;
      else timers.delete(id);
      try {
        typeof timer.fn === "function" ? timer.fn(...timer.args) : (0, eval)(timer.fn);
      } catch (error) {
        console.error(error);
      }
    }
  }

  function runFrames() {
    const due = frames;
    frames = new Map();
    for (const fn of due.values())
      try {
        fn(now);
      } catch (error) {
        console.error(error);
      }
  }

  function syncAnimations() {
    for (const animation of document.getAnimations()) {
      if (!started.has(animation)) {
        if (animation.playState === "paused" || animation.playState === "finished") continue;
        started.set(animation, now - (Number(animation.currentTime) || 0) / (animation.playbackRate || 1));
        animation.pause();
      }
      const at = (now - started.get(animation)) * (animation.playbackRate || 1);
      const end = animation.effect?.getComputedTiming().endTime ?? Infinity;
      if (at >= end && Number.isFinite(end)) animation.finish();
      else animation.currentTime = at;
    }
  }

  function tick() {
    now = realNow() - lastReal + now;
    lastReal = realNow();
    runTimers();
    runFrames();
    if (!held) realRaf(tick);
  }
  realRaf(tick);

  window.__clock = {
    get now() {
      return now;
    },
    /** Stops following real time, moving the clock on to `at` ms if it is not there yet; from now on only `step` moves it. */
    hold(at = 0) {
      held = true;
      if (now < at) {
        now = at;
        runTimers();
      }
    },
    /** Moves the clock `ms` on, in frames no longer than `frame` ms, and draws the last one. */
    step(ms, frame = ms) {
      for (let left = ms; left > 1e-6; ) {
        const dt = Math.min(frame, left);
        now += dt;
        left -= dt;
        runTimers();
        runFrames();
      }
      syncAnimations();
    },
    /** Moves the clock `ms` on without drawing a frame, firing only the timers. */
    skip(ms) {
      now += ms;
      runTimers();
    },
  };
}
