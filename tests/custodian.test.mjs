import test from "node:test";
import assert from "node:assert/strict";
import { createCustodian } from "../src/custodian/createCustodian.js";
import { custodianPose } from "../src/custodian/custodianPose.js";
import { custodianPoses, custodianStance } from "../src/custodian/custodianStances.js";
import { restJoint } from "../src/custodian/custodianSkeleton.js";
import { makeSkinMesh } from "../src/skinMesh.js";
import { boneMatrices, multiply, point } from "../src/math3d.js";
import { anatomyIssues, poseIssues } from "../tools/checks/structure.mjs";

const custodian = createCustodian();
const index = new Map(custodian.bones.map((bone, i) => [bone.id, i]));
const times = [0, 0.37, 1.1, 2.5, 4.2, 7.9];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const gap = (a, b) => Math.hypot(...sub(a, b));
const world = (pose, bone, local = [0, 0, 0]) => point(boneMatrices(custodian, pose)[index.get(bone)], local);
const palm = (pose, side) => world(pose, `hand-${side}`, sub(restJoint(`palm-${side}`), restJoint(`hand-${side}`)));

/** Heights of the posed mesh, skinned the way the renderer skins it. */
function heights(pose, parts = custodian.parts) {
  const { vertices, inverseBind } = makeSkinMesh({ ...custodian, parts });
  const bones = boneMatrices(custodian, pose).map((m, i) => multiply(m, inverseBind[i]));
  const out = [];
  for (let v = 0; v < vertices.length; v += 12) {
    const p = [vertices[v], vertices[v + 1], vertices[v + 2]];
    const w = vertices[v + 11];
    out.push(point(bones[vertices[v + 9]], p)[1] * w + point(bones[vertices[v + 10]], p)[1] * (1 - w));
  }
  return out;
}

test("the custodian is deterministic, valid plain data", () => {
  assert.deepEqual(createCustodian(), custodian);
  assert.deepEqual(anatomyIssues(custodian), []);
  assert.deepEqual(JSON.parse(JSON.stringify(custodian)), custodian);
  assert.ok(custodian.bones.length <= 64);
});

test("part ids are unique and prefixed, bones come parent before child", () => {
  const ids = custodian.parts.map((part) => part.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith("custodian-")));
  const seen = new Set();
  for (const bone of custodian.bones) {
    assert.ok(bone.parent === null || seen.has(bone.parent), `${bone.id} after ${bone.parent}`);
    assert.ok(!seen.has(bone.id), `duplicate bone ${bone.id}`);
    seen.add(bone.id);
  }
  assert.equal(custodian.bones.filter((bone) => bone.parent === null).length, 1);
});

test("every pose is valid, finite and repeatable without a clock", () => {
  for (const pose of custodianPoses)
    for (const time of times) {
      const posed = custodianPose(time, { pose });
      assert.deepEqual(poseIssues(custodian, posed), [], `${pose} at ${time}`);
      assert.deepEqual(custodianPose(time, { pose }), posed);
      assert.ok(Object.values(posed.bones).every((b) => [...b.rotation, ...(b.position ?? [])].every(Number.isFinite)));
    }
  assert.notDeepEqual(custodianPose(0.4, { pose: "idle" }), custodianPose(1.9, { pose: "idle" }), "idle breathes and sways");
});

test("a human-sized old man standing on the ground, his staff taller than him", () => {
  const idle = custodianPose(0, { pose: "idle" });
  const low = Math.min(...heights(idle));
  assert.ok(low > -0.01 && low < 0.03, `feet at ${low}`);
  const body = custodian.parts.filter((part) => !/staff|crook|stone|twist/.test(part.id));
  const crown = Math.max(...heights(idle, body));
  assert.ok(crown > 1.5 && crown < 1.72, `crown at ${crown}`);
  assert.ok(Math.max(...heights(idle)) > crown + 0.2);
});

test("idle and talking keep the staff planted and in hand while the body moves", () => {
  const foot = (posed, time, pose) => world(posed, "staff", [0, -custodianStance(time, { pose }).staff.grip, 0]);
  const planted = foot(custodianPose(0, { pose: "idle" }), 0, "idle");
  assert.ok(Math.abs(planted[1]) < 0.005, "the staff's foot is on the ground");
  for (const pose of ["idle", "talking"])
    for (const time of times) {
      const posed = custodianPose(time, { pose });
      assert.ok(gap(foot(posed, time, pose), planted) < 0.002, `${pose} at ${time}: staff foot slides`);
      assert.ok(gap(palm(posed, "right"), world(posed, "staff")) < 0.003, `${pose} at ${time}: right hand off the staff`);
    }
});

test("hands reach their targets", () => {
  for (const pose of custodianPoses)
    for (const time of times) {
      const posed = custodianPose(time, { pose });
      const stance = custodianStance(time, { pose });
      for (const side of ["right", "left"]) {
        const bent = stance[side].wrist.some((v) => v !== 0);
        const reach = bent ? gap(world(posed, `hand-${side}`), stance[side].target) - 0.08 : gap(palm(posed, side), stance[side].target);
        assert.ok(reach < 0.01, `${pose} ${side} at ${time}`);
      }
    }
});

test("the ritual raises the staff overhead", () => {
  for (const time of times) {
    const posed = custodianPose(time, { pose: "ritual" });
    const grip = custodianStance(time, { pose: "ritual" }).staff.grip;
    assert.ok(palm(posed, "right")[1] > world(posed, "head")[1] + 0.3, "hand above the head");
    assert.ok(world(posed, "staff", [0, 1.9 - grip, 0])[1] > 2.8, "staff held high");
  }
});

test("blends ease from one pose to another", () => {
  const time = 1.3;
  assert.deepEqual(custodianPose(time, { pose: "idle", toward: "ritual", blend: 0 }), custodianPose(time, { pose: "idle" }));
  const done = custodianPose(time, { pose: "idle", toward: "ritual", blend: 1 });
  for (const [id, bone] of Object.entries(custodianPose(time, { pose: "ritual" }).bones))
    bone.rotation.forEach((v, i) => assert.ok(Math.abs(done.bones[id].rotation[i] - v) < 1e-9, id));
  const half = custodianStance(time, { pose: "idle", toward: "ritual", blend: 0.5 }).right.target[1];
  assert.ok(half > custodianStance(time).right.target[1] && half < custodianStance(time, { pose: "ritual" }).right.target[1]);
});
