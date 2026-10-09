/**
 * Page code defining the trailer's race cameras on `window.__trailerCameras`, each
 * `(id, …) => (race, t) => shot` for the broadcast's `script`: `grid` stands low behind and beside
 * racer `id` on the grid and tilts up after it as it jumps off; `nose` flies just ahead of it,
 * looking back into its face; `fire` flies ahead of it on the side away from rival `other`, its
 * head in the foreground and the rival it breathes on beyond.
 */
export const raceCameras = `(async () => {
  const { sampleRace } = await import("/src/race/sampleRace.js");
  const add = (a, ...terms) => terms.reduce((p, [v, k]) => p.map((x, i) => x + v[i] * k), a);
  const unit = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const UP = [0, 1, 0];
  const racerAt = (race, t, id) => sampleRace(race.recording, t).racers.find((r) => r.id === id);
  const frame = (racer) => {
    const forward = unit([racer.forward[0], 0, racer.forward[2]]);
    return { forward, right: unit(cross(forward, UP)) };
  };
  const shot = (eye, target, fov) => ({ eye, target, up: UP, fov, shot: "trailer", subject: null, reason: "Trailer" });
  window.__trailerCameras = {
    nose: (id, { ahead = 1.3, side = 0.45, lift = 0.25, fov = 0.8 } = {}) => (race, t) => {
      const racer = racerAt(race, t, id);
      const r = race.entries.get(id).anatomy.bounds.radius;
      const { forward, right } = frame(racer);
      const head = add(racer.position, [forward, 0.55 * r], [UP, 0.3 * r]);
      return shot(add(head, [forward, ahead * r], [right, side * r], [UP, lift * r]), add(head, [forward, -0.25 * r]), fov);
    },
    grid: (id, { back = 2.4, side = 1.3, lift = 0.15, fov = 0.85 } = {}) => {
      let eye = null;
      return (race, t) => {
        const racer = racerAt(race, t, id);
        const r = race.entries.get(id).anatomy.bounds.radius;
        if (!eye) {
          const start = racerAt(race, -1, id);
          const { forward, right } = frame(start);
          eye = add(start.position, [forward, -back * r], [right, side * r], [UP, lift * r]);
        }
        return shot(eye, add(racer.position, [UP, 0.3 * r]), fov);
      };
    },
    fire: (id, other, { ahead = 1.1, side = 0.95, lift = 0.3, toward = 0.25, fov = 0.9 } = {}) => (race, t) => {
      const racer = racerAt(race, t, id);
      const rival = racerAt(race, t, other);
      const r = race.entries.get(id).anatomy.bounds.radius;
      const { forward, right } = frame(racer);
      const head = add(racer.position, [forward, 0.55 * r], [UP, 0.3 * r]);
      const away = (rival.position[0] - racer.position[0]) * right[0] + (rival.position[2] - racer.position[2]) * right[2] > 0 ? -1 : 1;
      const target = head.map((v, i) => v + (rival.position[i] - v) * toward);
      return shot(add(head, [forward, ahead * r], [right, away * side * r], [UP, lift * r]), target, fov);
    },
  };
  return 0;
})()`;
