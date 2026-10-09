import { createCharacter } from "./characterAnatomy.js";
import { makeSkinMesh, roundKey } from "../skinMesh.js";

/**
 * The anatomy without its parts, carrying the skin mesh built at `round` instead: all a renderer
 * needs, and cheap to hand between threads.
 * @param {import("./characterAnatomy.js").CharacterAnatomy} anatomy
 */
export function lightCharacter(anatomy, round) {
  const { parts, ...rest } = anatomy;
  return { ...rest, parts: [], prebuilt: { key: roundKey(round), data: makeSkinMesh(anatomy, { round }) } };
}

/**
 * Builds characters in a pool of module workers, falling back to the main thread where workers
 * cannot run. `build(spec, round)` resolves to a light anatomy; a `lane` keeps only its latest
 * request, so a slider drag never queues up stale builds.
 * @param {{ size?: number }} [options]
 */
export function createCharacterBuilder({ size = 2 } = {}) {
  const workers = [];
  const waiting = new Map();
  const queue = [];
  const lanes = new Map();
  let next = 1;
  try {
    for (let k = 0; k < size; k++) {
      const worker = new Worker(new URL("./characterWorker.js", import.meta.url), { type: "module" });
      worker.busy = false;
      worker.onmessage = (event) => finish(worker, event.data);
      worker.onerror = (event) => {
        event.preventDefault();
        const job = worker.job;
        worker.busy = false;
        if (job) runHere(job);
        pump();
      };
      workers.push(worker);
    }
  } catch {
    workers.length = 0;
  }

  function finish(worker, { id, anatomy, error }) {
    worker.busy = false;
    worker.job = null;
    const job = waiting.get(id);
    waiting.delete(id);
    if (job) error ? job.reject(new Error(error)) : job.resolve(anatomy);
    pump();
  }

  function runHere(job) {
    try {
      job.resolve(lightCharacter(createCharacter(job.spec), job.round));
    } catch (error) {
      job.reject(error);
    }
  }

  function pump() {
    while (queue.length) {
      const worker = workers.find((w) => !w.busy);
      if (!worker) return;
      const job = queue.shift();
      if (job.cancelled) continue;
      worker.busy = true;
      worker.job = job;
      waiting.set(job.id, job);
      worker.postMessage({ id: job.id, spec: job.spec, round: job.round });
    }
  }

  return {
    /**
     * @param {object} spec
     * @param {unknown} round the style's rounding
     * @param {{ lane?: string, urgent?: boolean }} [options]
     * @returns {Promise<object | null>} null when a newer request in the same lane replaced it
     */
    build(spec, round, { lane, urgent = false } = {}) {
      return new Promise((resolve, reject) => {
        const job = { id: next++, spec, round, resolve, reject, cancelled: false };
        if (lane) {
          const previous = lanes.get(lane);
          if (previous && !waiting.has(previous.id)) {
            previous.cancelled = true;
            previous.resolve(null);
          }
          lanes.set(lane, job);
        }
        if (!workers.length) {
          queueMicrotask(() => (job.cancelled ? null : runHere(job)));
          return;
        }
        if (urgent) queue.unshift(job);
        else queue.push(job);
        pump();
      });
    },
    /** Drops every queued request that has not started. */
    clear() {
      for (const job of queue.splice(0)) {
        job.cancelled = true;
        job.resolve(null);
      }
    },
    dispose() {
      for (const worker of workers) worker.terminate();
      workers.length = 0;
    },
  };
}
