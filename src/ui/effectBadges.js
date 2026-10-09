import { icon } from "./icons.js";
import { effectLook } from "./effectLook.js";

const GAP = 4;

/** A racer's live statuses at race time `t`, with the share of each still to run. */
export function liveEffects(racer, t) {
  return (racer.effects ?? [])
    .filter((e) => e.until > t && effectLook[e.id])
    .map((e) => ({ id: e.id, left: Math.min(1, (e.until - t) / effectLook[e.id].duration) }));
}

/**
 * Status badges beside each racer's name tag: one icon per status, ringed by the time it has left.
 * `update(racers, t, tagOf, shown)` sets them beside `tagOf(id)`, the racer's placed tag element, or hides them,
 * as it does for a racer `shown(racer)` turns down.
 */
export function createEffectBadges(host) {
  const badges = new Map();
  return {
    reset(ids) {
      for (const el of badges.values()) el.remove();
      badges.clear();
      for (const id of ids) {
        const el = document.createElement("div");
        el.className = "effect-badges";
        el.hidden = true;
        host.append(el);
        badges.set(id, el);
      }
    },
    update(racers, t, tagOf, shown = () => true) {
      for (const r of racers) {
        const el = badges.get(r.id);
        if (!el) continue;
        const tag = tagOf(r.id);
        const live = tag && !tag.hidden && shown(r) ? liveEffects(r, t) : [];
        el.hidden = !live.length;
        if (el.hidden) continue;
        const key = live.map((e) => e.id).join();
        if (el.dataset.key !== key) {
          el.dataset.key = key;
          el.innerHTML = live
            .map((e) => `<span class="effect-badge" data-effect="${e.id}" style="--c:${effectLook[e.id].color}" aria-label="${effectLook[e.id].label}">${icon(effectLook[e.id].icon)}</span>`)
            .join("");
        }
        for (const e of live) el.querySelector(`[data-effect="${e.id}"]`)?.style.setProperty("--left", e.left.toFixed(3));
        el.style.transform = `${tag.style.transform} translate(${tag.offsetWidth / 2 + GAP}px, 0) translate(50%, 0)`;
      }
    },
  };
}
