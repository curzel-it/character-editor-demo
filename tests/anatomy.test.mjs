import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { subjects, loadSubject, makeGenome } from "../src/subjects.js";
import {
  anatomyIssues,
  poseIssues,
  maximumPoseDifference,
} from "../tools/checks/structure.mjs";

for (const subject of subjects) {
  test(`${subject.id}: seeded anatomy, hierarchy, bounds and looping pose`, async (context) => {
    if (
      !["genome", "anatomy", "animate"].every((directory) =>
        existsSync(
          new URL(`../src/${directory}/${subject.id}.js`, import.meta.url),
        ),
      )
    ) {
      context.skip("Subject has not been implemented yet");
      return;
    }
    const module = await loadSubject(subject.id);
    assert.ok(
      module.genes.length >= 3,
      "At least three genes are needed for readability review",
    );
    assert.equal(
      new Set(module.genes.map((gene) => gene.name)).size,
      module.genes.length,
    );
    for (const gene of module.genes) {
      assert.ok([gene.min, gene.max, gene.default].every(Number.isFinite));
      assert.ok(
        gene.min < gene.max &&
          gene.default >= gene.min &&
          gene.default <= gene.max,
      );
    }
    const distinct = new Set();
    for (let seed = 1; seed <= 64; seed++) {
      const genome = makeGenome(module.genes, seed);
      const anatomy = module.createAnatomy(genome);
      assert.deepEqual(
        anatomy,
        module.createAnatomy(makeGenome(module.genes, seed)),
        `Seed ${seed} is deterministic`,
      );
      assert.deepEqual(
        anatomyIssues(anatomy),
        [],
        `Seed ${seed} has valid connected hierarchy`,
      );
      assert.equal(anatomy.subject, subject.id);
      distinct.add(JSON.stringify(anatomy));
      for (let frame = 0; frame <= 12; frame++) {
        const pose = module.pose(anatomy, frame / 12);
        assert.deepEqual(
          poseIssues(anatomy, pose),
          [],
          `Seed ${seed}, frame ${frame}`,
        );
        assert.deepEqual(
          pose,
          module.pose(anatomy, frame / 12),
          "Pose is deterministic",
        );
      }
      assert.ok(
        maximumPoseDifference(
          module.pose(anatomy, 0),
          module.pose(anatomy, 1),
        ) < 1e-6,
        "Cycle loops without a discontinuity",
      );
    }
    assert.equal(distinct.size, 64, "All seed anatomies differ");
    const defaults = Object.fromEntries(
      module.genes.map((gene) => [gene.name, gene.default]),
    );
    for (const gene of module.genes) {
      for (const value of [gene.min, gene.max]) {
        const anatomy = module.createAnatomy({
          ...defaults,
          [gene.name]: value,
        });
        assert.deepEqual(
          anatomyIssues(anatomy),
          [],
          `${gene.name} endpoint ${value} remains valid`,
        );
      }
    }
  });
}

test("Structure check rejects a broken hierarchy and a nonfinite pose", () => {
  const anatomy = {
    bones: [
      {
        id: "root",
        parent: "missing",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
      },
    ],
    parts: [{ id: "body", bone: "root", shape: "box", color: [1, 1, 1] }],
    bounds: { radius: 1, center: [0, 0, 0] },
  };
  assert.ok(anatomyIssues(anatomy).some((issue) => issue.includes("parent")));
  assert.ok(
    poseIssues(anatomy, { bones: { root: { rotation: [NaN, 0, 0] } } }).length,
  );
});

function skinnedAnatomy() {
  return {
    bones: [
      { id: "root", parent: null, position: [0, 0, 0], rotation: [0, 0, 0] },
      { id: "tip", parent: "root", position: [1, 0, 0], rotation: [0, 0, 0] },
    ],
    parts: [
      {
        id: "skin",
        bone: "root",
        shape: "mesh",
        color: [0.2, 0.4, 0.6],
        vertices: [0, 0, 0, 1, 0, 0, 1, 1, 0],
        indices: [0, 1, 2],
        skin: {
          joints: [
            ["root", "tip"],
            ["root", "tip"],
            ["root", "tip"],
          ],
          weights: [1, 0.5, 0],
        },
      },
    ],
    bounds: { radius: 2, center: [0, 0, 0] },
  };
}

test("Skin contract accepts a full blend and rejects malformed vertex influences", () => {
  assert.deepEqual(anatomyIssues(skinnedAnatomy()), []);
  const colored = skinnedAnatomy();
  colored.parts[0].colors = [0, 0.5, 1, 1, 0.5, 0, 0.5, 1, 0];
  assert.deepEqual(anatomyIssues(colored), []);
  const cases = [
    [
      "non-mesh skin",
      (part) => {
        part.shape = "box";
      },
      /must be a mesh/,
    ],
    [
      "missing skin object",
      (part) => {
        part.skin = null;
      },
      /joint pairs/,
    ],
    [
      "missing joint pair",
      (part) => {
        part.skin.joints.pop();
      },
      /joint pairs/,
    ],
    [
      "invalid joint count",
      (part) => {
        part.skin.joints[0] = ["root"];
      },
      /joint pairs/,
    ],
    [
      "unknown joint",
      (part) => {
        part.skin.joints[0][1] = "missing";
      },
      /joint pairs/,
    ],
    [
      "missing weight",
      (part) => {
        part.skin.weights.pop();
      },
      /weights/,
    ],
    [
      "nonfinite weight",
      (part) => {
        part.skin.weights[0] = NaN;
      },
      /weights/,
    ],
    [
      "negative weight",
      (part) => {
        part.skin.weights[0] = -0.1;
      },
      /weights/,
    ],
    [
      "excessive weight",
      (part) => {
        part.skin.weights[0] = 1.1;
      },
      /weights/,
    ],
    [
      "rest translation",
      (part) => {
        part.position = [0, 1, 0];
      },
      /identity rest transform/,
    ],
    [
      "rest rotation",
      (part) => {
        part.rotation = [0, 0, 1];
      },
      /identity rest transform/,
    ],
    [
      "rest scale",
      (part) => {
        part.scale = [1, 2, 1];
      },
      /identity rest transform/,
    ],
    [
      "missing vertex colour",
      (part) => {
        part.colors = [0, 0, 0];
      },
      /vertex colours/,
    ],
    [
      "nonfinite vertex colour",
      (part) => {
        part.colors = new Array(9).fill(NaN);
      },
      /vertex colours/,
    ],
    [
      "out of range vertex colour",
      (part) => {
        part.colors = new Array(9).fill(2);
      },
      /vertex colours/,
    ],
  ];
  for (const [name, change, expected] of cases) {
    const anatomy = skinnedAnatomy();
    change(anatomy.parts[0]);
    assert.ok(
      anatomyIssues(anatomy).some((issue) => expected.test(issue)),
      name,
    );
  }
});
