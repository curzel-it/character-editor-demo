import { tint } from "../palette.js";
import { add, mix, normalize, spike, surface, sweep } from "./dragonShape.js";

// An optional second, smaller wing pair on the tail, clear of the saddle and harness. The bones
// `hindwing-±1` (root, on `tail-1`), `hindwing-elbow-±1` and `hindwing-tip-±1` exist on every dragon
// so the skeleton and poses never depend on the choice; only the dressing is optional.

/** Rigs the hind-wing bones and returns their frames for the variant builders. */
export function rigHindWings({ rig, world, g }) {
  const span = g.wingspan * 0.26;
  return [-1, 1].map((s) => {
    const root = rig(`hindwing-${s}`, "tail-1", [-g.tail * 0.01, 0.1, s * 0.2]);
    const elbow = rig(`hindwing-elbow-${s}`, root, [-0.35, 0.1, s * span * 0.45]);
    const tip = rig(`hindwing-tip-${s}`, elbow, [-0.5, -0.08, s * span * 0.55]);
    const trailing = add(world("tail-3"), [-g.tail * 0.02, 0.02, s * 0.1]);
    return { s, span, root, elbow, tip, trailing };
  });
}

/** Skinned leading-edge arm from the tail root to the tip. */
function arm({ parts, ring, ridge }, { s, root, elbow, tip }) {
  sweep(
    parts,
    `hindwing-arm-${s}`,
    "root",
    [
      ring(root, [0.04, -0.03, -s * 0.08], 0.14, 0.13, "tail-1", 0.4),
      ring(root, [0, 0, 0], 0.11, 0.1, "tail-1", 0.8),
      ring(elbow, [0, 0, -s * 0.06], 0.07, 0.07, root, 0.6),
      ring(elbow, [0, 0, 0], 0.075, 0.07),
      ring(tip, [0, 0, -s * 0.05], 0.045, 0.045, elbow, 0.6),
      ring(tip, [-0.08, -0.02, s * 0.12], 0.012, 0.012),
    ],
    ridge,
    { segments: 6, skinned: true },
  );
}

function none() {
  return null;
}

/** A small bat-like membrane stretched from the arm back to the tail. */
function membrane(context, wing) {
  const { parts, world, horn } = context;
  const { s, root, elbow, tip, trailing } = wing;
  arm(context, wing);
  const colour = context.membrane;
  const lead = [world(root), world(elbow), world(tip, [-0.08, -0.02, s * 0.12])];
  const columns = 6,
    bands = 3;
  const leading = (j) => (j <= 3 ? mix(lead[0], lead[1], j / 3) : mix(lead[1], lead[2], (j - 3) / 3));
  const leadJoints = (j) => (j <= 3 ? { [root]: 1 - j / 3, [elbow]: j / 3 } : { [elbow]: 1 - (j - 3) / 3, [tip]: (j - 3) / 3 });
  const vertices = [],
    indices = [],
    colors = [],
    joints = [],
    weights = [];
  const grid = [];
  for (let j = 0; j <= columns; j++) {
    const t = j / columns,
      edge = add(mix(trailing, lead[2], t), [-0.35 * Math.sin(t * Math.PI), 0, 0]);
    const back = mix(edge, leading(j), 0.12 * Math.sin(t * 2 * Math.PI) ** 2);
    const column = [];
    for (let r = 0; r <= bands; r++) {
      if (j === columns && r > 0) {
        column.push(column[0]);
        continue;
      }
      const f = r / bands,
        p = mix(leading(j), back, f);
      p[1] -= Math.sin(f * Math.PI) * Math.sin(t * Math.PI) * 0.1;
      const influence = {};
      for (const [id, w] of Object.entries(leadJoints(j))) influence[id] = (influence[id] || 0) + w * (1 - f);
      const trail = t < 0.5 ? { "tail-3": 1 - 2 * t, [elbow]: 2 * t } : { [elbow]: 2 - 2 * t, [tip]: 2 * t - 1 };
      for (const [id, w] of Object.entries(trail)) influence[id] = (influence[id] || 0) + w * f;
      const [a, b = a] = Object.entries(influence)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 2);
      const weight = b === a ? 1 : a[1] / (a[1] + b[1] || 1);
      column.push(vertices.length / 3);
      vertices.push(...p);
      joints.push([a[0], b[0]]);
      weights.push(weight);
      colors.push(...tint(colour, 0.8 + Math.sin(t * Math.PI) * 0.15 + (1 - f) * 0.08));
    }
    grid.push(column);
  }
  for (let j = 0; j < columns; j++)
    for (let r = 0; r < bands; r++) {
      const a = grid[j][r],
        b = grid[j + 1][r],
        c = grid[j][r + 1],
        d = grid[j + 1][r + 1];
      const tri = (x, y, z) => {
        if (x === y || y === z || z === x) return;
        if (s > 0) indices.push(x, y, z);
        else indices.push(x, z, y);
      };
      tri(a, c, b);
      tri(b, c, d);
    }
  surface(parts, `hindwing-membrane-${s}`, "root", vertices, indices, colour, { colors, skin: { joints, weights } });
  spike(parts, `hindwing-claw-${s}`, elbow, [0.02, 0.03, 0], [0.2, 0.12, -s * 0.05], 0.04, horn, { steps: 3, segments: 5 });
  return lead;
}

/** Layered flight feathers on the arm, like a four-winged microraptor. */
function feathered(context, wing) {
  const { parts, world, skin, membrane: colour } = context;
  const { s, span, root, elbow, tip } = wing;
  arm(context, wing);
  const vane = tint(mix(skin, colour, 0.5), 1.15),
    covert = tint(skin, 1.05);
  const feather = (id, bone, at, length, angle, color, width = 0.028) => {
    const direction = normalize([-Math.cos(angle), -0.08, s * Math.sin(angle)]);
    spike(parts, id, bone, at, add(at, direction.map((v) => v * length)), width, color, {
      flat: 3.6,
      blunt: 0.35,
      steps: 3,
      segments: 5,
    });
  };
  const elbowReach = [-0.5, -0.08, s * span * 0.55];
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    feather(`hindwing-feather-${s}-${i}`, elbow, mix([0, -0.02, 0], elbowReach, t * 0.9), 0.7 + 0.35 * t, 0.15 + 0.3 * t, vane);
  }
  for (let i = 0; i < 3; i++)
    feather(`hindwing-primary-${s}-${i}`, tip, [-0.04 * i, -0.02, s * 0.05 * i], 1.1 - 0.1 * i, 0.5 + 0.28 * i, vane, 0.03);
  for (let i = 0; i < 3; i++)
    feather(`hindwing-covert-${s}-${i}`, root, [-0.05, 0.02, s * (0.05 + 0.1 * i)], 0.45, 0.1 + 0.12 * i, covert, 0.035);
  return [world(root), world(elbow), world(tip)];
}

export const dragonHindWings = [
  // Seeded dragons grow hind wings about one time in five.
  { id: "none", label: "None", build: none, weight: 8 },
  { id: "membrane", label: "Hind wings", build: membrane, weight: 1 },
  { id: "feathered", label: "Feathered hind wings", build: feathered, weight: 1 },
];
