import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { boneMatrices, inverseRigid, multiply, point } from "../src/math3d.js";

const positions = (part) =>
  Array.from({ length: part.vertices.length / 3 }, (_, index) =>
    part.vertices.slice(index * 3, index * 3 + 3),
  );
const key = (point) => point.map((value) => Math.round(value * 1e6)).join(",");
const edgeKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);

function topology(part) {
  const vertices = positions(part);
  const groups = new Map();
  for (const [index, position] of vertices.entries()) {
    const id = key(position);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(index);
  }
  const representative = new Map();
  for (const group of groups.values())
    for (const index of group) representative.set(index, group[0]);
  const edges = new Map(),
    used = new Set(),
    faces = [];
  for (let index = 0; index < part.indices.length; index += 3) {
    const face = part.indices
      .slice(index, index + 3)
      .map((vertex) => representative.get(vertex));
    if (new Set(face).size !== 3) continue;
    const id = faces.length;
    faces.push(face);
    for (let corner = 0; corner < 3; corner++) {
      used.add(face[corner]);
      const a = face[corner],
        b = face[(corner + 1) % 3],
        name = edgeKey(a, b);
      if (!edges.has(name)) edges.set(name, { vertices: [a, b], faces: [] });
      edges.get(name).faces.push(id);
    }
  }
  const boundary = new Map(),
    neighbours = faces.map(() => new Set());
  for (const edge of edges.values()) {
    assert.ok(
      edge.faces.length <= 2,
      `${part.id}: an edge has ${edge.faces.length} incident triangles`,
    );
    if (edge.faces.length === 2) {
      neighbours[edge.faces[0]].add(edge.faces[1]);
      neighbours[edge.faces[1]].add(edge.faces[0]);
    } else {
      const [a, b] = edge.vertices;
      if (!boundary.has(a)) boundary.set(a, new Set());
      if (!boundary.has(b)) boundary.set(b, new Set());
      boundary.get(a).add(b);
      boundary.get(b).add(a);
    }
  }
  const visit = (first, adjacent) => {
    const seen = new Set(),
      queue = [first];
    while (queue.length) {
      const current = queue.pop();
      if (seen.has(current)) continue;
      seen.add(current);
      queue.push(...adjacent(current));
    }
    return seen;
  };
  assert.ok(
    faces.length && boundary.size,
    `${part.id}: a membrane needs faces and an outer border`,
  );
  assert.equal(
    visit(0, (face) => neighbours[face]).size,
    faces.length,
    `${part.id}: all triangles must share edges with the same membrane`,
  );
  assert.equal(
    used.size - edges.size + faces.length,
    1,
    `${part.id}: the membrane must be a disk without interior holes`,
  );
  for (const [vertex, adjacent] of boundary)
    assert.equal(
      adjacent.size,
      2,
      `${part.id}: border branches at vertex ${vertex}`,
    );
  assert.equal(
    visit(boundary.keys().next().value, (vertex) => boundary.get(vertex)).size,
    boundary.size,
    `${part.id}: only the intended outer border may remain open`,
  );
  return { vertices, groups, faces };
}

function deform(part, points, matrices, ids) {
  return points.map((position, vertex) => {
    const pair = part.skin.joints[vertex],
      weight = part.skin.weights[vertex];
    const a = point(matrices[ids.get(pair[0])], position);
    const b = point(matrices[ids.get(pair[1])], position);
    return a.map((value, axis) => value * weight + b[axis] * (1 - weight));
  });
}

function assertPosedContinuity(part, mesh, points, context) {
  for (const group of mesh.groups.values()) {
    const first = points[group[0]];
    for (const index of group) {
      const gap = Math.hypot(
        ...first.map((value, axis) => value - points[index][axis]),
      );
      assert.ok(
        gap < 1e-4,
        `${context}, ${part.id}: an interior seam opened by ${gap} metres`,
      );
    }
  }
  for (const [a, b, c] of mesh.faces) {
    const u = points[b].map((value, axis) => value - points[a][axis]);
    const v = points[c].map((value, axis) => value - points[a][axis]);
    const area = Math.hypot(
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    );
    assert.ok(
      Number.isFinite(area) && area > 1e-8,
      `${context}, ${part.id}: a membrane triangle collapsed`,
    );
  }
}

test("Dragon wing membranes remain single disks with closed interior seams throughout flight", async () => {
  const module = await loadSubject("dragon");
  const defaults = Object.fromEntries(
    module.genes.map((gene) => [gene.name, gene.default]),
  );
  const cases = [
    ...[1, 7, 42, 64, 2407].map((seed) => [
      `seed ${seed}`,
      makeGenome(module.genes, seed),
    ]),
    [
      "all minima",
      Object.fromEntries(module.genes.map((gene) => [gene.name, gene.min])),
    ],
    [
      "all maxima",
      Object.fromEntries(module.genes.map((gene) => [gene.name, gene.max])),
    ],
    ...module.genes.flatMap((gene) =>
      [gene.min, gene.max].map((value) => [
        `${gene.name}=${value}`,
        { ...defaults, [gene.name]: value },
      ]),
    ),
  ];
  for (const [name, genome] of cases) {
    const anatomy = module.createAnatomy(genome);
    const inverseBind = boneMatrices(anatomy).map(inverseRigid);
    const ids = new Map(anatomy.bones.map((bone, index) => [bone.id, index]));
    const wings = [-1, 1].map((side) => {
      const part = anatomy.parts.find(
        (part) => part.id === `wing-membrane-${side}`,
      );
      assert.ok(
        part?.skin,
        `${name}: wing ${side} must have a skinned membrane`,
      );
      return { part, mesh: topology(part) };
    });
    for (let frame = 0; frame < 24; frame++) {
      const matrices = boneMatrices(
        anatomy,
        module.pose(anatomy, frame / 24),
      ).map((matrix, index) => multiply(matrix, inverseBind[index]));
      for (const { part, mesh } of wings)
        assertPosedContinuity(
          part,
          mesh,
          deform(part, mesh.vertices, matrices, ids),
          `${name}, frame ${frame}`,
        );
    }
  }
});

test("Wing continuity regression detects coincident vertices that separate under skinning", async () => {
  const module = await loadSubject("dragon");
  const anatomy = module.createAnatomy(makeGenome(module.genes, 2407));
  const part = anatomy.parts.find((part) => part.id === "wing-membrane--1");
  const bind = boneMatrices(anatomy);
  const ids = new Map(anatomy.bones.map((bone, index) => [bone.id, index]));
  const wrist = point(bind[ids.get("wing-wrist--1")], [0, 0, 0]);
  const vertex = positions(part).findIndex(
    (position) =>
      Math.hypot(...position.map((value, axis) => value - wrist[axis])) < 1e-5,
  );
  assert.ok(vertex >= 0, "Membrane has a wrist anchor");
  const duplicate = part.vertices.length / 3;
  part.vertices.push(...part.vertices.slice(vertex * 3, vertex * 3 + 3));
  part.skin.joints.push(["root", "root"]);
  part.skin.weights.push(1);
  part.indices[part.indices.indexOf(vertex)] = duplicate;
  const mesh = topology(part);
  const matrices = boneMatrices(anatomy, module.pose(anatomy, 0.75)).map(
    (matrix, index) => multiply(matrix, inverseRigid(bind[index])),
  );
  assert.throws(
    () =>
      assertPosedContinuity(
        part,
        mesh,
        deform(part, mesh.vertices, matrices, ids),
        "Deliberately split wrist anchor",
      ),
    /seam opened/,
  );
});
