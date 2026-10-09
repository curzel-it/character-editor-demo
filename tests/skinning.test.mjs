import test from "node:test";
import assert from "node:assert/strict";
import {
  transform,
  multiply,
  inverseRigid,
  point,
  boneMatrices,
} from "../src/math3d.js";
import { makeSkinMesh } from "../src/skinMesh.js";

const near = (a, b) =>
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-5, `${v} != ${b[i]}`));

test("A rotated hierarchy returns to its bind pose without a position jump", () => {
  const rest = multiply(
    transform([2, 3, 1], [0.2, 0.4, 0.6]),
    transform([1, -0.3, 0.7], [-0.1, 0.2, 0.5]),
  );
  near(point(multiply(rest, inverseRigid(rest)), [3, 6, 8]), [3, 6, 8]);
});

test("Rigid parts and weighted meshes use the same world bind coordinates", () => {
  const anatomy = {
    bones: [
      { id: "root", parent: null, position: [0, 2, 0], rotation: [0, 0, 0] },
      { id: "joint", parent: "root", position: [1, 0, 0], rotation: [0, 0, 0] },
    ],
    parts: [
      {
        id: "triangle",
        bone: "joint",
        shape: "mesh",
        vertices: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
        color: [1, 1, 1],
      },
    ],
  };
  const rigid = makeSkinMesh(anatomy);
  near([...rigid.vertices.slice(0, 3)], [1, 2, 0]);
  const posed = boneMatrices(anatomy, {
    bones: { joint: { rotation: [0, 0, Math.PI / 2] } },
  });
  near(point(multiply(posed[1], rigid.inverseBind[1]), [2, 2, 0]), [1, 3, 0]);
  anatomy.parts = [
    {
      ...anatomy.parts[0],
      bone: "root",
      vertices: [1, 2, 0, 2, 2, 0, 1, 3, 0],
      skin: {
        joints: [
          ["root", "joint"],
          ["root", "joint"],
          ["root", "joint"],
        ],
        weights: [0.5, 0.5, 0.5],
      },
    },
  ];
  const weighted = makeSkinMesh(anatomy);
  near([...weighted.vertices.slice(0, 3)], [1, 2, 0]);
  near([...weighted.vertices.slice(9, 12)], [0, 1, 0.5]);
});
