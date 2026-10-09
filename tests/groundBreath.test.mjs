import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { pose } from "../src/animate/dragon.js";
import { groundBreathCue, groundBreathLength, modelTarget } from "../src/animate/dragonGroundBreath.js";
import { boneMatrices, point } from "../src/math3d.js";
import { breathEmitter } from "../src/scene/breathPlume.js";
import { lowestPoint } from "../src/scene/groundContact.js";
import { poseIssues } from "../tools/checks/structure.mjs";

const module = await loadSubject("dragon");
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const cases = [1, 7, 42, 64, 99, 2407].flatMap((seed) =>
  ["adult", "teen", "kid"].map((age) => ({ seed, age, anatomy: module.createAnatomy(makeGenome(module.genes, seed), { age }) })),
);
const floorOf = (anatomy) => lowestPoint(anatomy, pose(anatomy, 0, { stand: 1 }), anatomy.bones[0].position, [1, 0, 0]);
const targetOf = (anatomy, ahead = 9, side = 0) => [anatomy.bones[0].position[0] + ahead, floorOf(anatomy), side];
const at = (anatomy, matrices, id) => point(matrices[anatomy.bones.findIndex((bone) => bone.id === id)], [0, 0, 0]);

test("The ground breath is finite through the whole move for every seed and age", () => {
  for (const { seed, age, anatomy } of cases)
    for (let time = 0; time <= groundBreathLength; time += 0.35) {
      const motion = { ...groundBreathCue(time), breathTarget: targetOf(anatomy, 9, 2), time };
      const result = pose(anatomy, time % 1, motion);
      assert.deepEqual(poseIssues(anatomy, result), [], `${age} ${seed} at ${time}`);
      assert.ok(boneMatrices(anatomy, result).every((m) => m.every(Number.isFinite)), `${age} ${seed} at ${time}`);
    }
});

test("The move starts and ends standing", () => {
  assert.deepEqual(groundBreathCue(0), { stand: 1, crouch: 0, breath: 0 });
  assert.deepEqual(groundBreathCue(groundBreathLength), { stand: 1, crouch: 0, breath: 0 });
  const peak = groundBreathCue(3.4);
  assert.equal(peak.crouch, 1);
  assert.equal(peak.breath, 1);
});

test("Crouching sinks the body with the feet kept planted", () => {
  for (const { seed, age, anatomy } of cases) {
    const standing = boneMatrices(anatomy, pose(anatomy, 0, { stand: 1 }));
    const low = boneMatrices(anatomy, pose(anatomy, 0, { stand: 1, crouch: 1, breathTarget: targetOf(anatomy) }));
    assert.ok(at(anatomy, low, "chest")[1] < at(anatomy, standing, "chest")[1] - 0.2 * anatomy.scale, `${age} ${seed}: chest drops`);
    for (const id of ["toes-hind-1", "toes-hind--1"]) {
      const before = at(anatomy, standing, id),
        after = at(anatomy, low, id);
      assert.ok(Math.hypot(before[0] - after[0], before[1] - after[1]) < 0.02 * anatomy.scale, `${age} ${seed}: ${id} stays put`);
    }
  }
});

test("The breath drives the head towards the target and aims the plume at it", () => {
  for (const { seed, age, anatomy } of cases)
    for (const side of [-3, 0, 4]) {
      const breathTarget = targetOf(anatomy, 9 * anatomy.scale, side * anatomy.scale);
      const mouth = (motion) => breathEmitter({ anatomy, breath: {} }, boneMatrices(anatomy, pose(anatomy, 0, motion)), IDENTITY);
      const gap = (e) => Math.hypot(...breathTarget.map((v, k) => v - e.origin[k]));
      const standing = mouth({ stand: 1, breathTarget }),
        coiled = mouth({ stand: 1, crouch: 1, breathTarget }),
        breathing = mouth({ stand: 1, crouch: 1, breath: 1, breathTarget, time: 3 });
      assert.ok(gap(coiled) < gap(standing), `${age} ${seed} ${side}: crouching brings the head closer`);
      assert.ok(gap(breathing) < gap(coiled), `${age} ${seed} ${side}: the breath drives the head forward`);
      const to = breathTarget.map((v, k) => (v - breathing.origin[k]) / gap(breathing));
      const cos = to.reduce((sum, v, k) => sum + v * breathing.direction[k], 0);
      assert.ok(cos > Math.cos(0.05), `${age} ${seed} ${side}: the plume leaves towards the target`);
    }
});

test("Without a crouch the ground breath leaves the pose alone", () => {
  const { anatomy } = cases[0];
  for (const motion of [{ effort: 0.6 }, { stand: 1 }, { stand: 1, breath: 1 }])
    assert.deepEqual(pose(anatomy, 0.3, { ...motion, crouch: 0, breathTarget: targetOf(anatomy) }), pose(anatomy, 0.3, motion));
});

test("World targets map into the model frame the scene draws a dragon in", () => {
  const { anatomy } = cases[0];
  const root = anatomy.bones[0].position;
  const ahead = modelTarget(anatomy, [10, 5, 10], [0, 0, 1], [10, 0, 16]);
  [root[0] + 6, root[1] - 5, root[2]].forEach((v, i) => assert.ok(Math.abs(ahead[i] - v) < 1e-9));
  const left = modelTarget(anatomy, [0, 0, 0], [1, 0, 0], [0, 0, 3]);
  assert.ok(Math.abs(left[2] - 3) < 1e-9);
});
