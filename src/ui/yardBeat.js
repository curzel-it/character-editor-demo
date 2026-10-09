const JUDGED = ["good", "late", "early", "miss"];

/**
 * The beat marker of a rhythm minigame: a ring closing onto a target as the next beat nears, the
 * count-in written in it and the target flashing the last tap's judgement. `update(beat)` follows the
 * game's `beat` (`{ until, period, count, judged }`), hiding the marker on null.
 */
export function createBeatMarker() {
  const el = document.createElement("div");
  el.className = "play-beat";
  el.innerHTML = `<span class="play-beat__ring"></span><span class="play-beat__dot"><span data-beat-count></span></span>`;
  const count = el.querySelector("[data-beat-count]");
  let flashed = null;

  return {
    el,
    /** @param {{ until: number, period: number, count: number, judged: { kind: string, at: number } | null } | null} beat */
    update(beat) {
      el.classList.toggle("is-off", !beat);
      if (!beat) return;
      el.style.setProperty("--close", String(Math.max(0, Math.min(1, beat.until / beat.period))));
      count.textContent = beat.count > 0 ? String(beat.count) : "";
      if (beat.judged && beat.judged !== flashed) {
        flashed = beat.judged;
        el.classList.remove(...JUDGED.map((k) => `is-${k}`));
        void el.offsetWidth;
        el.classList.add(`is-${beat.judged.kind}`);
      }
    },
  };
}
