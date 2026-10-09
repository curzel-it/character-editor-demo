import { countdownAt } from "../race/countdown.js";
import { t as text } from "../i18n.js";

const PAD = 6;

/**
 * The starting countdown over a race view: the grid call, then 3, 2, 1 and Go, driven by broadcast
 * time so it pauses, speeds up and scrubs with the race. `place` positions a racer's name tag at
 * `x`, over `above`, and keeps it off the countdown: under `below` instead, or hidden.
 * @returns {{ el: HTMLElement, update(t: number): void, place(tag: HTMLElement, x: number, above: number, below: number): void }}
 */
export function createCountdown() {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.createElement("div");
  el.className = "dz-countdown";
  el.hidden = true;
  el.innerHTML = `<span class="dz-countdown__label"></span><span class="dz-countdown__call" aria-live="assertive"></span>`;
  const label = el.querySelector(".dz-countdown__label"),
    call = el.querySelector(".dz-countdown__call");
  let shown = null;
  const zones = () =>
    (shown === "go" ? [call] : [label, call]).map((z) => z.getBoundingClientRect()).filter((r) => r.width && r.height);
  const hits = (tag, blocked) => {
    const r = tag.getBoundingClientRect();
    return blocked.some((z) => r.left < z.right + PAD && r.right > z.left - PAD && r.top < z.bottom + PAD && r.bottom > z.top - PAD);
  };
  return {
    el,
    place(tag, x, above, below) {
      tag.style.visibility = "";
      tag.style.transform = `translate(${x}px, ${above}px) translate(-50%, -100%)`;
      if (el.hidden) return;
      const blocked = zones();
      if (!hits(tag, blocked)) return;
      tag.style.transform = `translate(${x}px, ${below}px) translate(-50%, 0)`;
      if (hits(tag, blocked)) tag.style.visibility = "hidden";
    },
    update(t) {
      const step = countdownAt(t);
      el.hidden = !step;
      if (!step) return (shown = null);
      if (step.id !== shown) {
        shown = step.id;
        el.dataset.step = step.id;
        label.textContent = text("countdownOverlay.grid");
        call.textContent = step.id === "ready" ? "" : step.id === "go" ? text("countdownOverlay.go") : step.label;
      }
      const k = step.progress;
      const pop = still ? 1 : 1 + 0.6 * (1 - Math.min(1, k / 0.18)) ** 2;
      call.style.transform = `scale(${pop.toFixed(3)})`;
      call.style.opacity = String(Math.min(1, k / 0.08, step.id === "go" ? (1 - k) / 0.35 : 1));
    },
  };
}
