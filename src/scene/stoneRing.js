import { makeRng } from "../rng.js";

const TAU = Math.PI * 2;

/** Radius of the circle the trilithons stand on, in metres. */
export const RING_RADIUS = 6;
/** Radius the parents stand on, facing the centre, clear of the stones with head and tail. */
export const FORMATION_RADIUS = 14;
/** The ring's open side, the entrance trilithon and the heel stone beyond it: +Z, towards the default camera. */
export const ENTRANCE_ANGLE = Math.PI / 2;

const HEEL_DISTANCE = 26,
  MIN_TRILITHONS = 3,
  MAX_TRILITHONS = 6,
  PASSAGE = 1;

/**
 * @typedef {{ offset: number, width: number, depth: number, height: number, lean: [number, number], broken?: boolean }} Upright
 * @typedef {{ width: number, depth: number, length: number, sag: number }} Lintel
 * @typedef {{ kind: "trilithon", angle: number, position: [number, number, number], yaw: number, seed: string,
 *   uprights: Upright[], lintel: Lintel | null, ruined: boolean, entrance: boolean }} Trilithon
 * @typedef {{ kind: "standing", angle: number, position: [number, number, number], yaw: number, seed: string,
 *   width: number, depth: number, height: number, lean: [number, number], broken: boolean, heel?: boolean }} StandingStone
 * @typedef {{ kind: "fallen", position: [number, number, number], yaw: number, seed: string,
 *   width: number, depth: number, length: number, tilt: number, sink: number }} FallenStone
 * @typedef {Trilithon | StandingStone | FallenStone} RingStone
 * @typedef {{ seed: string, centre: [number, number, number], radius: number, innerRadius: number,
 *   outerRadius: number, entrance: number, stones: RingStone[] }} StoneRing
 */

const around = (centre, angle, radius) => [centre[0] + Math.cos(angle) * radius, centre[1], centre[2] + Math.sin(angle) * radius];

/** A trilithon on the circle at `angle`, its opening facing the centre; `ruined` drops the lintel and one upright. */
function trilithon(random, centre, angle, seed, { entrance, ruined }) {
  const height = entrance ? 5.4 : 4.4 + random() * 1;
  const gap = 1.2 + random() * 0.3;
  const uprights = [-1, 1].map((side) => {
    const width = 1.25 + random() * 0.3;
    return {
      offset: side * (gap / 2 + width / 2),
      width,
      depth: 0.85 + random() * 0.3,
      height: height * (0.97 + random() * 0.05),
      lean: [(random() - 0.5) * 0.05, (random() - 0.5) * 0.06],
    };
  });
  const span = uprights[1].offset - uprights[0].offset + (uprights[0].width + uprights[1].width) / 2;
  const lintel = { width: 0.85 + random() * 0.2, depth: 0.9 + random() * 0.25, length: span + 0.2 + random() * 0.3, sag: random() * 0.06 };
  const stone = /** @type {Trilithon} */ ({
    kind: "trilithon",
    angle,
    position: around(centre, angle, RING_RADIUS),
    yaw: angle + Math.PI / 2,
    seed,
    uprights,
    lintel,
    ruined,
    entrance,
  });
  if (!ruined) return { stone, fallen: [] };
  const standing = random() < 0.5 ? 0 : 1;
  const leaning = uprights[standing];
  leaning.lean = [(standing ? -1 : 1) * (0.12 + random() * 0.1), 0.05 + random() * 0.08];
  const toppled = uprights[1 - standing];
  toppled.height *= 0.35 + random() * 0.15;
  toppled.broken = true;
  stone.lintel = null;
  const fallen = [
    {
      kind: "fallen",
      position: around(around(centre, angle, RING_RADIUS + 1.7 + random() * 0.4), angle + Math.PI / 2, toppled.offset * 1.2),
      yaw: angle + Math.PI / 2 + (random() - 0.5) * 0.7,
      seed: `${seed}:upright`,
      width: toppled.width,
      depth: toppled.depth,
      length: height * 0.6,
      tilt: (random() - 0.5) * 0.2,
      sink: 0.25,
    },
    {
      kind: "fallen",
      position: around(centre, angle + Math.sign(toppled.offset) * 0.1, RING_RADIUS - 1.6),
      yaw: angle + Math.PI / 2 + (random() - 0.5) * 0.5,
      seed: `${seed}:lintel`,
      width: lintel.width,
      depth: lintel.depth,
      length: lintel.length,
      tilt: 0.1 + random() * 0.15,
      sink: 0.2,
    },
  ];
  return { stone, fallen };
}

function standing(random, centre, angle, seed, { broken = false } = {}) {
  const height = broken ? 0.9 + random() * 0.8 : 2.3 + random() * 1;
  return /** @type {StandingStone} */ ({
    kind: "standing",
    angle,
    position: around(centre, angle, RING_RADIUS + (random() - 0.5) * 0.4),
    yaw: angle + Math.PI / 2 + (random() - 0.5) * 0.3,
    seed,
    width: 0.8 + random() * 0.25,
    depth: 0.65 + random() * 0.25,
    height,
    lean: [(random() - 0.5) * 0.14, (random() - 0.5) * 0.14],
    broken,
  });
}

/**
 * The Soul Altar's ring: `trilithons` weathered arches on a circle of `RING_RADIUS` around `centre`
 * (flat ground at its y), their openings facing the centre, with lone standing stones, stumps and
 * fallen stones in the gaps between them and a heel stone outside the entrance. One trilithon faces
 * `ENTRANCE_ANGLE` whole; with four or more, one of the others has collapsed. Deterministic from `seed`.
 * @param {string} [seed]
 * @param {{ trilithons?: number, centre?: [number, number, number] }} [options]
 * @returns {StoneRing}
 */
export function stoneRingLayout(seed = "soul-altar", { trilithons = 5, centre = [0, 0, 0] } = {}) {
  const count = Math.max(MIN_TRILITHONS, Math.min(MAX_TRILITHONS, Math.round(trilithons)));
  const random = makeRng(`stone-ring:${seed}`);
  const step = TAU / count;
  const ruinedIndex = count >= 4 ? 1 + Math.floor(random() * (count - 1)) : -1;
  /** @type {RingStone[]} */
  const stones = [];
  for (let i = 0; i < count; i++) {
    const angle = ENTRANCE_ANGLE + i * step + (i ? (random() - 0.5) * step * 0.08 : 0);
    const { stone, fallen } = trilithon(random, centre, angle, `${seed}:trilithon:${i}`, { entrance: i === 0, ruined: i === ruinedIndex });
    stones.push(stone, ...fallen);
  }
  const arches = /** @type {Trilithon[]} */ (stones.filter((s) => s.kind === "trilithon"));
  const edge = (t, side) => t.angle + (t.uprights[side].offset + (side ? 1 : -1) * (t.uprights[side].width / 2)) / RING_RADIUS;
  let fallenCount = stones.length - arches.length;
  for (let i = 0; i < count; i++) {
    const from = edge(arches[i], 1),
      to = edge(arches[(i + 1) % count], 0) + (i === count - 1 ? TAU : 0);
    const angle = (from + to) / 2;
    const room = (to - from) * RING_RADIUS - 2 * PASSAGE;
    const roll = random();
    const gapSeed = `${seed}:gap:${i}`;
    const lastChance = i === count - 2 && !fallenCount;
    if (room < 1.1 || lastChance || (i > 0 && i < count - 1 && roll > 0.7)) {
      fallenCount++;
      stones.push({
        kind: "fallen",
        position: around(centre, angle + (random() - 0.5) * 0.1, RING_RADIUS + 1.2 + random() * 0.9),
        yaw: angle + (random() - 0.5) * 1.2,
        seed: gapSeed,
        width: 1 + random() * 0.3,
        depth: 0.7 + random() * 0.2,
        length: 2.3 + random() * 0.8,
        tilt: (random() - 0.5) * 0.3,
        sink: 0.2,
      });
    } else stones.push(standing(random, centre, angle, gapSeed, { broken: i > 0 && i < count - 1 && roll > 0.45 }));
  }
  const heel = standing(random, centre, ENTRANCE_ANGLE + (random() - 0.5) * 0.1, `${seed}:heel`);
  heel.position = around(centre, heel.angle, HEEL_DISTANCE);
  Object.assign(heel, { height: 3.6 + random() * 0.6, width: 1.9, depth: 1.4, heel: true, lean: [0.03, -0.1] });
  stones.push(heel);
  const reach = Math.max(...stones.filter((s) => s.kind !== "standing" || !s.heel).map((s) => Math.hypot(s.position[0] - centre[0], s.position[2] - centre[2])));
  return { seed, centre, radius: RING_RADIUS, innerRadius: RING_RADIUS - 0.6, outerRadius: reach + 1.2, entrance: ENTRANCE_ANGLE, stones };
}

/**
 * Where `count` (2 to 6) parents stand around the ring, on `FORMATION_RADIUS` facing its centre,
 * spread evenly and leaving the entrance free between two of them.
 * @param {number} count
 * @param {StoneRing} [ring]
 * @returns {{ position: [number, number, number], forward: [number, number, number], angle: number }[]}
 */
export function altarFormation(count, ring = stoneRingLayout()) {
  const n = Math.max(2, Math.min(6, Math.round(count)));
  const { centre, entrance } = ring;
  return Array.from({ length: n }, (_, i) => {
    const angle = entrance + ((i + 0.5) / n) * TAU;
    return {
      position: around(centre, angle, FORMATION_RADIUS),
      forward: [-Math.cos(angle), 0, -Math.sin(angle)],
      angle,
    };
  });
}
