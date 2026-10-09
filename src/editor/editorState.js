import { normalizeSpec } from "../character/characterSpec.js";

const LIMIT = 120;

/**
 * The character being edited with its history: `set(spec, { commit })` replaces it, a live change
 * (a slider being dragged) passing `commit: false` and the release committing it, so one drag is one
 * undo step. `subscribe(listener)` hears every change with the reason (`edit`, `undo`, `redo`, `load`).
 * @param {object} initial
 */
export function createEditorState(initial) {
  let spec = normalizeSpec(initial);
  let committed = spec;
  const past = [],
    future = [];
  const listeners = new Set();
  const locks = new Set();
  const emit = (reason, detail) => {
    for (const listener of listeners) listener(spec, reason, detail);
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  return {
    get spec() {
      return spec;
    },
    /**
     * @param {object} next
     * @param {{ commit?: boolean, reason?: string, detail?: unknown }} [options]
     */
    set(next, { commit = true, reason = "edit", detail } = {}) {
      const normalized = normalizeSpec(next, spec);
      if (same(normalized, spec) && (!commit || same(normalized, committed))) return;
      spec = normalized;
      this.dragging = !commit;
      if (commit && !same(spec, committed)) {
        past.push(committed);
        if (past.length > LIMIT) past.shift();
        future.length = 0;
        committed = spec;
      }
      emit(reason, detail);
    },
    /** Merges `changes` into the character. */
    update(changes, options) {
      this.set({ ...spec, ...changes }, options);
    },
    undo() {
      if (!same(spec, committed)) spec = committed;
      const previous = past.pop();
      if (!previous) return emit("undo");
      future.push(committed);
      spec = committed = previous;
      emit("undo");
    },
    redo() {
      const next = future.pop();
      if (!next) return;
      past.push(committed);
      spec = committed = next;
      emit("redo");
    },
    canUndo: () => past.length > 0 || !same(spec, committed),
    canRedo: () => future.length > 0,
    /** Replaces the character as one undoable step, e.g. from the wardrobe or a code. */
    load(next, reason = "load") {
      this.set(next, { reason });
    },
    locks,
    toggleLock(group) {
      if (locks.has(group)) locks.delete(group);
      else locks.add(group);
      emit("lock", group);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
