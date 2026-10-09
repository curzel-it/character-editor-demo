import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { slumberLoop } from "../src/animate/dragonSlumber.js";
import { poseIssues, maximumPoseDifference } from "../tools/checks/structure.mjs";
import { boneMatrices, multiply, point } from "../src/math3d.js";
import { makeSkinMesh } from "../src/skinMesh.js";

const module = await loadSubject("dragon");
const ages = ["kid", "teen", "adult"];
const seeds = [2406, 11, 306];
const resting = { effort: 0, glide: 1, stand: 1 };
const each = (run) => {
  for (const age of ages) for (const seed of seeds) run(module.createAnatomy(makeGenome(module.genes, seed), { age }), `${age} ${seed}`);
};

test("The slumber pose is finite through lying down, asleep and waking, at any age and either side", () => {
  each((anatomy, label) => {
    for (const sleep of [0.05, 0.3, 0.6, 0.9, 1])
      for (const time of [undefined, 0, 7.3])
        for (const sleepSide of [1, -1]) {
          const pose = module.pose(anatomy, 0.4, { ...resting, sleep, sleepSide, time });
          assert.deepEqual(poseIssues(anatomy, pose), [], `${label} sleep ${sleep}`);
        }
  });
});

test("Asleep, the pose loops: breathing and twitches repeat every slumber loop", () => {
  each((anatomy, label) => {
    const loop = slumberLoop(anatomy);
    for (const time of [0, 2.9, 13.7]) {
      const a = module.pose(anatomy, time % 1, { ...resting, sleep: 1, time });
      const b = module.pose(anatomy, (time + loop) % 1, { ...resting, sleep: 1, time: time + loop });
      assert.ok(maximumPoseDifference(a, b) < 1e-6, `${label} at ${time} s`);
    }
    const still = module.pose(anatomy, 0.25, { ...resting, sleep: 1 });
    assert.ok(maximumPoseDifference(still, module.pose(anatomy, 1.25, { ...resting, sleep: 1 })) < 1e-6, `${label} without time`);
  });
});

test("Asleep, it breathes: the chest rises and falls within a breath", () => {
  const anatomy = module.createAnatomy(makeGenome(module.genes, 2407));
  const breath = slumberLoop(anatomy) / 6;
  const out = module.pose(anatomy, 0, { ...resting, sleep: 1, time: 0 }),
    held = module.pose(anatomy, 0, { ...resting, sleep: 1, time: 0.45 * breath });
  assert.ok(held.bones.chest.rotation[2] - out.bones.chest.rotation[2] > 0.02);
});

test("Sleep 0 leaves the awake pose untouched", () => {
  const anatomy = module.createAnatomy(makeGenome(module.genes, 2407));
  assert.equal(maximumPoseDifference(module.pose(anatomy, 0.3, { ...resting, time: 4 }), module.pose(anatomy, 0.3, { ...resting, time: 4, sleep: 0 })), 0);
});

/** Lowest skinned height of the hide carried mostly by bones matching `pattern`, foot claws aside. */
function lows(anatomy, pose, groups) {
  const { vertices, inverseBind } = makeSkinMesh({ ...anatomy, parts: anatomy.parts.filter(({ id }) => !id.startsWith("talon-")) });
  const matrices = boneMatrices(anatomy, pose).map((m, i) => multiply(m, inverseBind[i]));
  const out = { all: Infinity };
  for (let v = 0; v < vertices.length; v += 12) {
    const p = [vertices[v], vertices[v + 1], vertices[v + 2]],
      w = vertices[v + 11];
    const y = point(matrices[vertices[v + 9]], p)[1] * w + point(matrices[vertices[v + 10]], p)[1] * (1 - w);
    const id = anatomy.bones[w >= 0.5 ? vertices[v + 9] : vertices[v + 10]].id;
    out.all = Math.min(out.all, y);
    for (const [name, pattern] of Object.entries(groups)) if (pattern.test(id)) out[name] = Math.min(out[name] ?? Infinity, y);
  }
  return out;
}

test("Asleep, the feet, tail, head and belly rest on the ground rather than floating or sinking", () => {
  const groups = { feet: /^(toes|foot)-hind/, tail: /^tail-/, head: /^(head|jaw)$/, belly: /^(root|chest)$/ };
  const reach = { feet: 0.15, tail: 0.15, head: 0.2, belly: 0.2 };
  each((anatomy, label) => {
    const low = lows(anatomy, module.pose(anatomy, 0, { ...resting, sleep: 1, time: 0 }), groups);
    for (const [name, limit] of Object.entries(reach)) assert.ok(low[name] - low.all < limit * anatomy.scale, `${label} ${name} ${((low[name] - low.all) / anatomy.scale).toFixed(2)}`);
  });
});
