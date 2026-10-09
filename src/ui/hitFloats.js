import { hitFromEvents, hitAfter } from "../animate/breathEvents.js";
import { breathLook } from "./breathLook.js";
import { t as text } from "../i18n.js";

const RISE = 26,
  ABOVE = 24;

/**
 * Breath hits called over each racer on race time so pause, speed and seeking apply: "Super
 * effective!" big for a ×2 hit, "Resisted" small for a ×0.5 one and "Hit!" otherwise, drifting
 * up and fading.
 * `update(recording, racers, t, at, shown)` places each hit racer's number just above `at(racer)`, its name
 * tag's projected `{ x, y, visible }` point, or hides it, and hides it too when `shown(racer, hit)` is false.
 */
export function createHitFloats(host) {
  const floats = new Map();
  return {
    reset(ids) {
      for (const el of floats.values()) el.remove();
      floats.clear();
      for (const id of ids) {
        const el = document.createElement("div");
        el.className = "hit-float";
        el.hidden = true;
        host.append(el);
        floats.set(id, el);
      }
    },
    update(recording, racers, t, at, shown = () => true) {
      for (const r of racers) {
        const el = floats.get(r.id);
        if (!el) continue;
        const hit = hitFromEvents(recording, r.id, t);
        const point = hit && shown(r, hit) && at(r);
        el.hidden = !point?.visible;
        if (el.hidden) continue;
        const kind = hit.matchup > 1 ? "super" : hit.matchup < 1 ? "resisted" : "hit";
        const label = text(`hitFloats.${kind}`);
        if (el.textContent !== label) el.textContent = label;
        el.dataset.kind = kind;
        const after = Math.max(0, t - hit.until) / hitAfter;
        el.style.setProperty("--c", breathLook[hit.element]?.color ?? "var(--dz-danger)");
        el.style.opacity = String(1 - after * after);
        el.style.transform = `translate(${point.x}px, ${point.y - ABOVE - RISE * after}px) translate(-50%, -100%)`;
      }
    },
  };
}
