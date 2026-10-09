// Low lenses sit a metre off the grass, inside the scene's default near plane.
const NEAR = 0.6;
// Lenses for the head close-up, best first, as [ahead of the head, off to the side, up] at the start
// of its drift; it closes in to `CLOSING` of that and sinks by `SINK`.
const HEAD_LENSES = [
  [3, 4.2, 0.9],
  [2, 4.8, 1.1],
  [1.2, 5.4, 1.4],
];
const CLOSING = 0.88,
  SINK = 0.5;
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const ease = (k) => k * k * (3 - 2 * k);
const add = (...vs) => vs.reduce((s, v) => s.map((x, i) => x + v[i]));
const scale = (v, k) => v.map((x) => x * k);

/** Distance in the ground plane from `p` to the segment `a`..`b`. */
function reach(p, a, b) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2];
  const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - a[0] - dx * k, p[2] - a[2] - dz * k);
}

/** The head close-up's lens at the start and end of its drift. */
function headEyes(p, sign, [ahead, off, up]) {
  const side = [-p.forward[2] * sign, 0, p.forward[0] * sign];
  return [1, CLOSING].map((k) => add(p.head, scale(p.forward, ahead * k), scale(side, off * k), [0, up - SINK * (1 - k) / (1 - CLOSING), 0]));
}

/** How far the lenses `eyes` see `target` clear of every blocker (negative when one is in the way). */
const clearance = (eyes, target, blockers) => Math.min(...eyes.flatMap((eye) => blockers.map((o) => reach(o.at, eye, target) - o.radius)));

/** What stands in the way of a lens: the stones, the custodian and the parents. */
function blockersOf(stage) {
  const stones = stage.ring.stones.map((s) => ({ at: s.position, radius: s.kind === "trilithon" ? 2.6 : s.kind === "fallen" ? 1.9 : s.heel ? 1.6 : 1.2 }));
  return [...stones, { at: stage.custodian.position, radius: 0.8 }, ...stage.parents.map((p) => ({ at: p.root, radius: 3.5, parent: p }))];
}

/**
 * The parent whose breathing head the close-up shows, from which side and through which lens: the
 * best lens that sees a head past everything else in the place, or the least blocked one.
 */
function headShot(parents, blockers) {
  let best = { margin: -Infinity };
  for (const lens of HEAD_LENSES)
    for (const hero of parents)
      for (const sign of [1, -1]) {
        const margin = clearance(headEyes(hero, sign, lens), hero.head, blockers.filter((o) => o.parent !== hero));
        if (margin > 0) return { hero, sign, lens };
        if (margin > best.margin) best = { hero, sign, lens, margin };
      }
  return best;
}

/** The landing shot's lens at the start and end of its drift, low and off to one side of the parent. */
function landingEyes(hero, side, distance) {
  const low = [0, 1.3 - hero.root[1], 0];
  return [
    add(hero.root, scale(side, distance), scale(hero.outward, 6), low),
    add(hero.root, scale(side, distance - 2), scale(hero.outward, 4), low),
  ];
}

/** Which side of the landing parent the low lens watches from, the first with a clear view. */
function landingShot(hero, blockers) {
  const across = [-hero.outward[2], 0, hero.outward[0]];
  const others = blockers.filter((o) => o.parent !== hero);
  let best = { margin: -Infinity };
  for (const distance of [17, 13])
    for (const sign of [1, -1]) {
      const eyes = landingEyes(hero, scale(across, sign), distance);
      const margin = clearance(eyes, hero.root, others);
      if (margin > 0) return eyes;
      if (margin > best.margin) best = { eyes, margin };
    }
  return best.eyes;
}

/**
 * The ritual show's planned cuts: each `{ id, from, to, at(k) }` holds for `from`..`to` show seconds
 * and `at(k)` gives its camera `{ eye, target, fov, span }` `k` (0..1) of the way through, drifting slowly.
 * `stage` holds the place (`ring`, `altar`, `custodian`, the custodian's `welcoming` way), the
 * parents (`root`, `head`, `forward`, `outward`) and the fireworks' height `burst`.
 */
export function ritualShots(timeline, stage) {
  const { breath, fireworks: F, card, success } = timeline;
  const egg = add(stage.altar.eggPoint, [0, 0.45, 0]);
  const c = stage.custodian.position;
  const toward = stage.welcoming;
  const across = [-toward[2], 0, toward[0]];
  const blockers = blockersOf(stage);
  const { hero, sign, lens } = headShot(stage.parents, blockers);
  const high = stage.burst;
  const face = (eye0, eye1, target0, target1, fov, span) => (k) => ({ eye: mix(eye0, eye1, ease(k)), target: mix(target0, target1, ease(k)), fov, span });
  const custodianAt = (distance, height, lean) => {
    const chest = add(c, [0, 1.2, 0]);
    const eye = (d) => add(chest, scale(toward, d), scale(across, d * lean), [0, height, 0]);
    return face(eye(distance), eye(distance * 0.88), add(chest, [0, 0.25, 0], scale(toward, -2)), add(chest, [0, 0.1, 0], scale(toward, -2)), 0.62, 0.34);
  };
  const reveal = breath + F.reveal;
  const heroAt = hero.root;
  const shots = [
    { id: "establish", to: 2.8, at: face([-5, 8, 41], [-4, 6.8, 34], [7, 3.5, 4], [7, 3, 4], 0.72, 0.62) },
    { id: "custodian", to: 5.4, at: custodianAt(6.2, 0.2, 0.3) },
    {
      id: "landing",
      hero: stage.parents.indexOf(hero),
      to: breath - 1.9,
      at: face(
        ...landingShot(hero, blockers),
        add(heroAt, scale(hero.outward, 6), [0, 4, 0]),
        add(heroAt, scale(hero.forward, 4), [0, 1.5, 0]),
        0.9,
        0.5,
      ),
    },
    {
      id: "head",
      hero: stage.parents.indexOf(hero),
      to: breath + 1.7,
      at: face(
        ...headEyes(hero, sign, lens),
        add(hero.head, scale(hero.forward, 0.6), [0, 0.3, 0]),
        add(hero.head, scale(hero.forward, 1), [0, -0.3, 0]),
        0.66,
        0.36,
      ),
    },
    { id: "converge", to: breath + F.merge + 1.2, at: face([1.2, 1.5, 12.5], [0.9, 1.7, 11], [0, 3.2, 0], [0, 6.5, 0], 0.95, 0.7) },
    { id: "burst", to: breath + F.settle + 0.2, at: face([9, 2.5, 25], [7, 3, 23], [0, high * 1.45, 0], [0, high * 1.6, 0], 1.1, 0.9) },
    { id: "settle", to: reveal - 0.2, at: face([9, 12, 21], [5, 5, 13.5], [0, 3, 0], [0, 1.6, 0], 0.8, 0.55) },
  ];
  if (success) shots.push({ id: "reveal", to: card + 2, at: face(add(egg, [3.2, 1.6, 5.6]), add(egg, [1.6, 0.6, 2.8]), egg, egg, 0.62, 0.35) });
  else
    shots.push(
      { id: "reveal", to: reveal + 2.2, at: face(add(egg, [3, 1.8, 5.2]), add(egg, [2.4, 1.4, 4.2]), egg, add(egg, [0, -0.2, 0]), 0.66, 0.4) },
      { id: "console", to: card + 2, at: custodianAt(5.2, 0.1, -0.35) },
    );
  let from = -Infinity;
  return shots.map((shot) => {
    const out = { ...shot, from };
    from = shot.to;
    return out;
  });
}

/** The camera `t` seconds into the show and the id of the shot it belongs to. */
export function shotAt(shots, t) {
  const shot = shots.find((s) => t < s.to) ?? shots[shots.length - 1];
  const start = Number.isFinite(shot.from) ? shot.from : 0;
  const k = Math.max(0, Math.min(1, (t - start) / (shot.to - start)));
  return { id: shot.id, camera: { ...shot.at(k), up: [0, 1, 0], near: NEAR } };
}
