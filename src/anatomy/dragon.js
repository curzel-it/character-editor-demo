import { palette, pigment, tint, dragonColors } from "../palette.js";
import { bone } from "./parts.js";
import { add, mix, surface, sweep, blade } from "./dragonShape.js";
import { dragonHeads } from "./dragonHeads.js";
import { dragonHeadgear } from "./dragonHeadgear.js";
import { buildLegs } from "./dragonLegs.js";
import { dragonLegShapes } from "./dragonLegVariants.js";
import { dragonWingFingers } from "./dragonWingFingers.js";
import { dragonFeet } from "./dragonFeet.js";
import { dragonCheeks } from "./dragonCheeks.js";
import { dragonHatchlingMouths } from "./dragonHatchlingMouths.js";
import { hatchlingHead } from "./dragonHatchlingHead.js";
import { dragonTailTips } from "./dragonTailTips.js";
import { rigHindWings, dragonHindWings } from "./dragonHindWings.js";
import { scaleAnatomy } from "./scaleAnatomy.js";
import { addEyelids } from "./dragonEyelids.js";
import { rigPupils } from "./dragonPupils.js";
import { eyeExtent, eyeSink, seatEyes } from "./dragonEyes.js";
import { seatBrows } from "./dragonBrows.js";
import { wearsMane } from "./dragonManes.js";
import { markParts, markingsOf } from "./dragonMarkings.js";
import { point, transform } from "../math3d.js";
import { creatureScale } from "../worldScale.js";
import { ageOf, grownGenome } from "../dragonAge.js";

const choose = (variants, value) =>
  variants[Math.max(0, Math.min(variants.length - 1, Math.floor(value) || 0))];

const metric = ["body", "wingspan", "neck", "tail", "spines", "legs", "thighs"];

/** `age` (see `src/dragonAge.js`) sets size and proportions; the default is an adult. */
export function createAnatomy(genome, { age } = {}) {
  const stage = ageOf(age);
  const reference = grownGenome(genome, stage.id);
  for (const name of metric) reference[name] /= creatureScale;
  const scale = creatureScale * stage.size;
  return {
    ...scaleAnatomy({ ...referenceAnatomy(reference, stage), genome }, scale),
    age: stage.id,
    scale,
  };
}

/**
 * Scales each eye, its rim, socket and pupil by `k` about the eye's centre; bigger eyes are rounder, bulge out a
 * little and lean in.
 */
function growEyes(parts, k) {
  for (const s of [-1, 1]) {
    const eye = parts.find(({ id }) => id === `eye-${s}`);
    if (!eye) continue;
    // Grown eyes sit a little lower, where the skull is wider, so the far eye never shows over it.
    const round = 1 + 0.1 * (k - 1),
      centre = eye.position;
    const dome = eye.shape === "dome",
      grow = ([x, y, z]) => [x * k, y * k * round, z * (dome ? k * round : 1 + 0.8 * (k - 1))];
    let out = [0, -0.45 * eye.scale[1] * (k * round - 1), s * 0.012 * (k - 1)];
    // Their tops lean in to follow the skull, so a big eye doesn't stick out past it.
    const tilt = -s * Math.min(0.6, 0.2 * (k - 1)),
      lean = ([x, y, z]) => [x + tilt, y, z];
    // Brows ride up with the eye's top so a grown eye still shows under them.
    const lift = out[1] + eye.scale[1] * (k * round - 1);
    for (const brow of parts.filter(({ id }) => id.endsWith(`brow-${s}`)))
      for (let i = 1; i < brow.vertices.length; i += 3) brow.vertices[i] += lift;
    // A dome keeps the same share of its crown sunk into the skull as it grows.
    if (dome) {
      const crown = eyeExtent(eye)[2] * (k * round - 1);
      out = add(out, point(transform([0, 0, 0], eye.rotation), [0, 0, -s * eyeSink * crown]));
    }
    for (const p of parts.filter(({ id }) => [`eye-${s}`, `eye-rim-${s}`, `eye-socket-${s}`, `pupil-${s}`].includes(id))) {
      p.position = add(add(centre, out), p.position.map((v, i) => (v - centre[i]) * k));
      p.scale = grow(p.scale);
      p.rotation = lean(p.rotation);
    }
  }
}

/** Scales everything carried by the head bone, and the bones hanging from it, by `k`. */
function growHead(bones, parts, k) {
  const carried = new Set(["head"]);
  for (const b of bones)
    if (carried.has(b.parent)) {
      carried.add(b.id);
      b.position = b.position.map((v) => v * k);
    }
  for (const p of parts.filter(({ bone }) => carried.has(bone))) {
    if (p.vertices) p.vertices = p.vertices.map((v) => v * k);
    if (p.position) p.position = p.position.map((v) => v * k);
    if (p.scale && !p.vertices) p.scale = p.scale.map((v) => v * k);
  }
}

/** `normal` tipped `angle` radians towards `back`, both unit vectors at right angles. */
const sweptBack = (normal, back, angle) => normal.map((v, k) => v * Math.cos(angle) + back[k] * Math.sin(angle));

/** The top of the hide at `x` along the torso, from the rings in bind pose. */
function hideTop(rings, x) {
  const i = rings.findIndex(({ p }, k) => k && p[0] >= x),
    a = rings[Math.max(0, i - 1)],
    b = rings[Math.max(0, i)],
    t = b === a ? 0 : (x - a.p[0]) / (b.p[0] - a.p[0]);
  return a.p[1] + a.ry + (b.p[1] + b.ry - a.p[1] - a.ry) * t;
}

function referenceAnatomy(
  genome,
  {
    head: H = 1, snout = 1, eyes: E = 1, maturity = 1, proportions = {}, girth: G = 1, chord: C = 1, rise = 1, pear = 0, seat = 0.45, roundHead = false,
  } = {},
) {
  const g = genome,
    N = 1 + (H - 1) * 0.5,
    nape = roundHead ? 1.35 : 1,
    fat = (share) => 1 + (G - 1) * share,
    hips = 1 + 0.3 * pear,
    shoulders = 1 - 0.18 * pear,
    bones = [],
    parts = [],
    bind = new Map();
  const { skin, under, membrane, eye } = dragonColors(g);
  const ridge = tint(skin, 1.2),
    horn = tint(palette.ivory, 0.79);
  const mouth = pigment(0.99, 0.34, 0.18),
    tongue = pigment(0.99, 0.42, 0.3);
  const l = g.body / 2,
    rootHeight = 3.4;
  const rig = (id, parent, position, rotation = [0, 0, 0]) => {
    bone(bones, id, parent, position, rotation);
    bind.set(id, add(parent ? bind.get(parent) : [0, 0, 0], position));
    return id;
  };
  const world = (id, p = [0, 0, 0]) => add(bind.get(id), p);
  const ring = (id, offset, ry, rz, other = id, weight = 1) => ({
    p: world(id, offset),
    ry,
    rz,
    joints: [id, other],
    weight,
  });
  const root = rig("root", null, [0, rootHeight, 0]);
  for (let i = 0; i < 7; i++)
    rig(
      `tail-${i}`,
      i ? `tail-${i - 1}` : root,
      i
        ? [-g.tail / 7, -0.025 - Math.sin((i / 6) * Math.PI) * 0.045, 0.018]
        : [-l * 0.78, -0.02, 0],
    );
  const chestAt = [l * 0.18, 0.04, 0];
  const chest = rig("chest", root, chestAt);
  const fromChest = ([x, y, z]) => [x - chestAt[0], y - chestAt[1], z - chestAt[2]];
  rig("neck-0", chest, fromChest([l * 0.67, 0.21, 0]));
  rig("neck-1", "neck-0", [g.neck * 0.29, g.neck * 0.2 * rise, 0]);
  rig("neck-2", "neck-1", [g.neck * 0.34, g.neck * 0.075 * rise, 0]);
  rig("head", "neck-2", [g.neck * 0.33, -g.neck * 0.14, 0]);
  rig("jaw", "head", [0.035, -0.19, 0], [0, 0, -0.43]);
  const bodyRings = [ring("tail-6", [-g.tail / 7, 0.025, 0], 0.008, 0.007)];
  for (let i = 6; i >= 0; i--) {
    const radius = (0.34 * Math.pow(1 - i / 7, 1.22) + 0.018) * fat(Math.max(0, 1 - i / (3 + 4 * pear)));
    bodyRings.push(
      ring(
        `tail-${i}`,
        [-g.tail / 14, -0.024, 0],
        radius * 0.79,
        radius * 0.74,
        `tail-${Math.min(6, i + 1)}`,
        0.48,
      ),
    );
    bodyRings.push(
      ring(
        `tail-${i}`,
        [0, 0, 0],
        radius,
        radius * 0.91,
        i ? `tail-${i - 1}` : root,
        0.7,
      ),
    );
  }
  bodyRings.push(
    ring(root, [-l * 0.67, -0.02, 0], 0.45 * G * hips, 0.37 * G * hips, "tail-0", 0.86),
    ring(root, [-l * 0.36, -0.01, 0], 0.42 * G * hips, 0.39 * G * hips),
    ring(root, [0.02, 0.035, 0], 0.53 * G, 0.5 * G, chest, 0.75),
    ring(chest, fromChest([l * 0.39, 0.085, 0]), 0.62 * G * shoulders, 0.55 * G * shoulders, root, 0.8),
    ring(chest, fromChest([l * 0.61, 0.16, 0]), 0.5 * fat(0.8) * shoulders, 0.4 * fat(0.8) * shoulders, "neck-0", 0.65),
    ring("neck-0", [0.13, 0.06, 0], 0.41 * fat(0.5), 0.31 * fat(0.5), chest, 0.72),
    ring(
      "neck-1",
      [-g.neck * 0.12, -g.neck * 0.08, 0],
      0.34,
      0.275,
      "neck-0",
      0.52,
    ),
    ring("neck-1", [0.02, 0.018, 0], 0.3 * nape, 0.255 * nape, "neck-0", 0.85),
    ring(
      "neck-2",
      [-g.neck * 0.14, -g.neck * 0.015, 0],
      0.265 * N * nape,
      0.235 * N * nape,
      "neck-1",
      0.5,
    ),
    ring("neck-2", [0.005, 0.005, 0], 0.26 * N * nape, 0.225 * N * nape, "neck-1", 0.85),
  );
  if (!roundHead)
    bodyRings.push(
      ring("head", [-0.3 * H, 0.065 * H, 0], 0.265 * H, 0.24 * H, "neck-2", 0.45),
      ring("head", [-0.095 * H, 0.025 * H, 0], 0.27 * H, 0.3 * H, "neck-2", 0.85),
    );
  sweep(parts, "continuous-hide", root, bodyRings, skin, {
    segments: 12,
    under,
    crisp: true,
    skinned: true,
  });
  const mane = wearsMane(g, maturity) ? [] : null,
    tailMane = [],
    flame = 0.7 * ((0.5 + 0.5 * maturity) / (proportions.spines ?? 1)) * (0.5 + (0.5 * 0.41 * (proportions.spines ?? 1)) / g.spines);
  for (let i = 0; i < 7; i++) {
    const h = g.spines * (0.43 + Math.sin(((i + 1) / 8) * Math.PI) * 0.52);
    const x = -l * 0.68 + i * l * 0.24,
      base = [x, hideTop(bodyRings, x) - rootHeight - 0.015, 0];
    const front = base[0] > l * 0.1;
    if (mane) {
      const bone = front ? chest : root;
      const lean = 0.85 - 0.4 * (i / 6);
      mane.push({ p: world(bone, front ? fromChest(base) : base), up: [-Math.sin(lean), Math.cos(lean), 0], height: h * 0.58 * flame, joints: [bone, bone], weight: 1 });
      continue;
    }
    blade(
      parts,
      `dorsal-crest-${i}`,
      front ? chest : root,
      front ? fromChest(base) : base,
      h * 0.77,
      h,
      0.043,
      horn,
    );
  }
  const neckFoot = bodyRings[bodyRings.length - 7].p[0] - 0.2;
  for (let i = 0; i < 6; i++) {
    const index = bodyRings.length - 7 + i;
    const baseRing = bodyRings[index],
      before = bodyRings[index - 1],
      after = bodyRings[index + 1];
    const dx = after.p[0] - before.p[0],
      dy = after.p[1] - before.p[1],
      length = Math.hypot(dx, dy);
    const base = add(baseRing.p, [
      (-dy / length) * baseRing.ry,
      (dx / length) * baseRing.ry - 0.018,
      0,
    ]);
    const h = g.spines * (0.8 + Math.sin((i / 5) * Math.PI) * 0.15);
    if (mane) {
      const nape = Math.max(0, Math.min(1, (i - 1) / 3));
      mane.push({ p: base, up: sweptBack([-dy / length, dx / length, 0], [-dx / length, -dy / length, 0], 0.35), height: h * 0.65 * (1 - 0.3 * nape) * flame, width: 1 - 0.4 * nape, joints: [...baseRing.joints], weight: baseRing.weight });
      continue;
    }
    blade(parts, `neck-crest-${i}`, root, base, h * 0.76, h, 0.049, horn);
    const crest = parts[parts.length - 1];
    crest.skin = {
      joints: Array.from({ length: crest.vertices.length / 3 }, () => [
        ...baseRing.joints,
      ]),
      weights: Array(crest.vertices.length / 3).fill(baseRing.weight),
    };
  }
  for (let i = 0; i < 7; i++) {
    const r = 0.34 * Math.pow(1 - i / 7, 1.22) + 0.018;
    if (mane) {
      const lean = 0.95 + 0.06 * i;
      const anchor = (p, height) => ({ p: world(`tail-${i}`, p), up: [-Math.sin(lean), Math.cos(lean), 0], height: height * flame, joints: [`tail-${i}`, `tail-${i}`], weight: 1 });
      tailMane.unshift(anchor([-g.tail * 0.035, r * 0.79, 0], g.spines * (1.05 - i * 0.08)));
      if (i === 6) tailMane.unshift({ ...anchor([-g.tail / 7, 0.025, 0], g.spines * 1.7), up: [-Math.sin(1.25), Math.cos(1.25), 0] });
      continue;
    }
    blade(
      parts,
      `tail-crest-${i}`,
      `tail-${i}`,
      [-g.tail * 0.035, r * 0.79, 0],
      g.spines * (0.8 - i * 0.08),
      g.spines * (0.7 - i * 0.072),
      0.031 - i * 0.003,
      i < 3 ? horn : ridge,
    );
  }
  const muzzle = roundHead ? snout : 0.83 * snout;
  const crests = mane ? [] : null;
  const context = { parts, g, skin, under, ridge, horn, mouth, tongue, membrane, eye, rig, world, maturity, muzzle, crests };
  const head = roundHead ? hatchlingHead({ ...context, cheeks: choose(dragonCheeks, g.head), teeth: choose(dragonHatchlingMouths, g.head) }) : choose(dragonHeads, g.head).build(context);
  choose(dragonHeadgear, g.headgear).build(context, head);
  for (const headPart of parts.filter(
    ({ bone }) => bone === "head" || bone === "jaw",
  )) {
    if (headPart.vertices) {
      for (let i = 0; i < headPart.vertices.length; i += 3)
        if (headPart.vertices[i] > 0) headPart.vertices[i] *= muzzle;
    } else if (headPart.position[0] > 0) headPart.position[0] *= muzzle;
  }
  if (crests?.length) mane.splice(0, mane.length, ...mane.filter((a) => a.joints[0] !== "head"));
  if (crests)
    crests.forEach(({ p: [x, y], height }, i) =>
      mane.push({ p: world("head", [(x > 0 ? x * muzzle : x) * H, y * H, 0]), up: [-Math.sin(0.5), Math.cos(0.5), 0], height: height * 1.1 * H * flame, width: 0.55 - (0.35 * i) / Math.max(1, crests.length - 1), joints: ["head", "head"], weight: 1 }),
    );
  if (E !== 1) growEyes(parts, E);
  if (H !== 1) growHead(bones, parts, H);
  seatEyes(parts);
  seatBrows(parts);
  rigPupils(context);
  addEyelids(context);
  const foot = choose(dragonFeet, g.feet),
    legShape = choose(dragonLegShapes, g.legShape);
  buildLegs({ parts, rig, ring, g, l, girth: G, skin, under, ridge, horn, membrane }, legShape, foot);
  const wingFingers = choose(dragonWingFingers, g.wingFingers);
  for (const s of [-1, 1]) {
    const span = g.wingspan / 2 - 0.46;
    const shoulder = rig(`wing-${s}`, chest, fromChest([l * 0.22, 0.35 * G, s * 0.45 * G]));
    const elbow = rig(`wing-elbow-${s}`, shoulder, [-0.13, 0.25, s * span * 0.31]);
    const wrist = rig(`wing-wrist-${s}`, elbow, [0.52, 0.13, s * span * 0.28]);
    const tips = [
      [-0.4 * C, -0.11 * C, s * span * 0.41],
      [-2.2 * C, -0.45 * C, s * span * 0.12],
      [-2.53 * C, -0.61 * C, -s * span * 0.37],
    ];
    for (let n = 0; n < 3; n++) rig(`spar-${s}-${n}`, wrist, [0, 0, 0]);
    sweep(
      parts,
      `wing-arm-hide-${s}`,
      root,
      [
        ring(shoulder, [-0.1, -0.03, -s * 0.2], 0.32, 0.29, chest, 0.25),
        ring(shoulder, [-0.06, 0.06, s * span * 0.13], 0.2, 0.2),
        ring(elbow, [0, 0, -s * 0.12], 0.115, 0.125, shoulder, 0.62),
        ring(elbow, [0.08, 0.055, s * 0.16], 0.12, 0.11),
        ring(wrist, [-0.11, -0.02, -s * 0.21], 0.075, 0.081, elbow, 0.5),
        ring(wrist, [0, 0, 0], 0.115, 0.105, elbow, 0.8),
      ],
      ridge,
      { segments: 8, skinned: true },
    );
    wingFingers.build({ parts, s, hand: rig(`wing-hand-${s}`, wrist, [0, 0, 0]), skin, ridge, horn });
    for (let n = 0; n < 3; n++) {
      const tip = tips[n],
        mid = mix([0, 0, 0], tip, 0.56);
      mid[1] += 0.06;
      sweep(
        parts,
        `wing-spar-${s}-${n}`,
        `spar-${s}-${n}`,
        [
          { p: [0, 0, 0], ry: 0.063 - n * 0.006, rz: 0.06 - n * 0.006 },
          { p: mid, ry: 0.032, rz: 0.03 },
          { p: tip, ry: 0.009, rz: 0.008 },
        ],
        ridge,
        { segments: 6 },
      );
    }
    const vertices = [],
      indices = [],
      colors = [],
      joints = [],
      weights = [];
    const vertex = (p, pair, weight, color) => {
      const i = vertices.length / 3;
      vertices.push(...p);
      joints.push(pair);
      weights.push(weight);
      colors.push(...color);
      return i;
    };
    const triangle = (a, b, c) => {
      if (a === b || b === c || c === a) return;
      if (s > 0) indices.push(a, b, c);
      else indices.push(a, c, b);
    };
    const anchor = rig(`wing-anchor-${s}`, root, [-l * 0.46, 0.38, s * 0.33 * G]);
    const wp = world(wrist),
      rootRear = world(anchor);
    const endPoints = tips.map((p, n) => ({
      p: world(wrist, p),
      bone: `spar-${s}-${n}`,
    }));
    endPoints.push({ p: rootRear, bone: anchor });
    const steps = 6,
      bands = 4;
    const wristIndex = vertex(wp, [wrist, wrist], 1, tint(membrane, 0.88));
    const seams = endPoints.map((endpoint, endpointIndex) => {
      const seam = [wristIndex];
      for (let r = 1; r <= bands; r++) {
        const radial = r / bands;
        seam.push(
          vertex(
            mix(wp, endpoint.p, radial),
            endpointIndex === 3
              ? [wrist, anchor]
              : [endpoint.bone, endpoint.bone],
            endpointIndex === 3 ? 1 - radial : 1,
            tint(membrane, 0.79 + (1 - radial) * 0.09),
          ),
        );
      }
      return seam;
    });
    for (let panel = 0; panel < 3; panel++) {
      const a = endPoints[panel],
        b = endPoints[panel + 1];
      const grid = [Array(steps + 1).fill(wristIndex)];
      for (let r = 1; r <= bands; r++) {
        const radial = r / bands,
          row = [seams[panel][r]];
        for (let j = 1; j < steps; j++) {
          const t = j / steps;
          const scallop =
            1 - Math.sin(t * Math.PI) * (panel === 2 ? 0.13 : 0.2);
          const boundary = mix(a.p, b.p, t);
          const p = mix(wp, boundary, radial * scallop);
          p[1] -=
            Math.sin(radial * Math.PI) *
            Math.sin(t * Math.PI) *
            (0.22 + panel * 0.045) * C;
          const color = tint(
            membrane,
            0.79 + Math.sin(t * Math.PI) * 0.22 + (1 - radial) * 0.09,
          );
          row.push(
            vertex(
              p,
              [a.bone, b.bone],
              panel === 2 ? 1 - radial * t : 1 - t,
              color,
            ),
          );
        }
        row.push(seams[panel + 1][r]);
        grid.push(row);
      }
      for (let r = 0; r < bands; r++)
        for (let j = 0; j < steps; j++) {
          const a = grid[r][j],
            b = grid[r][j + 1],
            c = grid[r + 1][j],
            d = grid[r + 1][j + 1];
          triangle(a, b, c);
          triangle(b, d, c);
        }
    }
    const elbowIndex = vertex(world(elbow), [elbow, elbow], 1, membrane);
    const shoulderIndex = vertex(
      world(shoulder),
      [shoulder, shoulder],
      1,
      tint(membrane, 0.78),
    );
    const bodyIndex = seams[3][bands];
    const edge = (start, end, firstBone, secondBone) => {
      const chain = [start];
      const a = vertices.slice(start * 3, start * 3 + 3);
      const b = vertices.slice(end * 3, end * 3 + 3);
      for (let r = 1; r < bands; r++) {
        const fraction = r / bands;
        chain.push(
          vertex(
            mix(a, b, fraction),
            [firstBone, secondBone],
            1 - fraction,
            tint(membrane, 0.88),
          ),
        );
      }
      chain.push(end);
      return chain;
    };
    const wristElbow = edge(wristIndex, elbowIndex, wrist, elbow);
    const elbowBody = edge(elbowIndex, bodyIndex, elbow, anchor);
    const elbowShoulder = edge(elbowIndex, shoulderIndex, elbow, shoulder);
    const shoulderBody = edge(shoulderIndex, bodyIndex, chest, anchor);
    const rootPanel = (ab, ac, bc, boneIds) => {
      const anchors = [ab[0], ab[bands], ac[bands]].map((index) =>
        vertices.slice(index * 3, index * 3 + 3),
      );
      const grid = [];
      for (let r = 0; r <= bands; r++) {
        const row = [];
        for (let j = 0; j <= bands - r; j++) {
          if (j === 0) row.push(ac[r]);
          else if (r === 0) row.push(ab[j]);
          else if (j + r === bands) row.push(bc[r]);
          else {
            const influence = [1 - (j + r) / bands, j / bands, r / bands];
            const p = anchors[0].map((_, axis) =>
              anchors.reduce(
                (sum, anchor, index) => sum + anchor[axis] * influence[index],
                0,
              ),
            );
            p[1] -=
              influence.reduce((product, weight) => product * weight, 1) * 1.2 * C;
            const dominant = influence
              .map((weight, index) => ({ weight, bone: boneIds[index] }))
              .sort((a, b) => b.weight - a.weight)
              .slice(0, 2);
            row.push(
              vertex(
                p,
                dominant.map(({ bone }) => bone),
                dominant[0].weight / (dominant[0].weight + dominant[1].weight),
                tint(membrane, 0.94),
              ),
            );
          }
        }
        grid.push(row);
      }
      for (let r = 0; r < bands; r++) {
        for (let j = 0; j < bands - r; j++) {
          triangle(grid[r][j], grid[r][j + 1], grid[r + 1][j]);
          if (j < bands - r - 1)
            triangle(grid[r][j + 1], grid[r + 1][j + 1], grid[r + 1][j]);
        }
      }
    };
    rootPanel(wristElbow, seams[3], elbowBody, [wrist, elbow, anchor]);
    rootPanel(elbowShoulder, elbowBody, shoulderBody, [elbow, shoulder, anchor]);
    surface(parts, `wing-membrane-${s}`, root, vertices, indices, membrane, {
      colors,
      skin: { joints, weights },
    });
  }
  const tailTip = mane ? dragonTailTips.find(({ id }) => id === "plain") : choose(dragonTailTips, g.tailTip);
  const { reach } = tailTip.build({ parts, e: g.tail / 7, membrane, ridge, horn });
  const hindWings = choose(dragonHindWings, g.hindWings);
  const hindFrames = rigHindWings({ rig, world, g });
  const hindEdges = hindFrames.map((frame) =>
    hindWings.build({ parts, ring, world, skin, ridge, horn, membrane }, frame),
  );
  const addons = [
    {
      slot: "tailTip",
      id: tailTip.id,
      bones: ["tail-6"],
      keepClear: reach ? [{ center: world("tail-6", [-g.tail / 7, 0.025, 0]), radius: reach + 0.2 }] : [],
    },
    {
      slot: "hindWings",
      id: hindWings.id,
      bones: hindFrames.flatMap(({ root, elbow, tip }) => [root, elbow, tip]),
      keepClear: hindEdges.flatMap((edge) => (edge ? [{ center: edge[0], radius: 0.45 }] : [])),
    },
  ];
  const saddleX = l * seat;
  const minX = -l * 0.78 - g.tail - reach,
    maxX = l * 0.67 + g.neck * 0.96 + 1.3 * H;
  markParts(parts, skin);
  return {
    subject: "dragon",
    genome,
    markings: markingsOf(genome, skin),
    feet: foot.id,
    legs: legShape.id,
    ...(mane ? { mane: { breath: g.breath, anchors: [...tailMane, ...mane.filter((a) => a.joints[0] !== chest || a.p[0] < neckFoot)] } } : {}),
    bones,
    parts,
    sockets: [
      saddleX < chestAt[0]
        ? { id: "saddle", bone: root, position: [saddleX, 0.7 * G, 0] }
        : { id: "saddle", bone: chest, position: fromChest([saddleX, 0.7 * G, 0]) },
      { id: "saddle-rear", bone: root, position: [saddleX - 1.5 / creatureScale, 0.44 * G, 0] },
    ],
    addons,
    bounds: {
      radius: Math.max((maxX - minX) / 2 + 0.45, g.wingspan / 2 + 0.7),
      center: [(minX + maxX) / 2, rootHeight + 0.03, 0],
    },
  };
}
