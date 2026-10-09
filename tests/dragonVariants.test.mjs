import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { pose } from "../src/animate/dragon.js";
import { flightStates } from "../src/animate/flightStates.js";
import { deriveStats } from "../src/race/deriveStats.js";
import { boneMatrices, point } from "../src/math3d.js";
import { creatureScale } from "../src/worldScale.js";
import { anatomyIssues } from "../tools/checks/structure.mjs";
import { restMesh, deformMesh, restPositions, stretch } from "./animationHelpers.mjs";

const module = await loadSubject("dragon");
const choices = (name) => module.genes.find((gene) => gene.name === name).choices;
const base = makeGenome(module.genes, 2407);
const motions = [["default", undefined], ...flightStates.map((state) => [state.id, state.motion])];

test("Every dragon head and headgear combination builds on retained bones", () => {
  const signatures = new Set();
  for (let head = 0; head < choices("head").length; head++)
    for (let headgear = 0; headgear < choices("headgear").length; headgear++) {
      const anatomy = module.createAnatomy({ ...base, head, headgear });
      const bones = new Set(anatomy.bones.map(({ id }) => id));
      const ids = anatomy.parts.map(({ id }) => id);
      assert.equal(new Set(ids).size, ids.length, "Part ids are unique");
      for (const part of anatomy.parts) {
        assert.ok(bones.has(part.bone), `${part.id} has a bone`);
        for (const value of part.vertices || [])
          assert.ok(Number.isFinite(value), `${part.id} has finite vertices`);
      }
      signatures.add(ids.filter((id) => !/^(eye|pupil)-/.test(id)).join());
    }
  assert.equal(signatures.size, choices("head").length * choices("headgear").length, "Each combination has its own parts");
  const edge = module.createAnatomy({ ...base, head: 99, headgear: 99 });
  assert.ok(edge.parts.some(({ id }) => id.startsWith("antler-")));
});

test("Every head, headgear, leg shape, wing fingers and feet combination builds cleanly", () => {
  const legs = new Map(), joints = new Map(), feetParts = new Map();
  const below = /^(toe|talon|hallux|sole|tarsus-scute|foot-)/;
  for (let head = 0; head < choices("head").length; head++)
    for (let headgear = 0; headgear < choices("headgear").length; headgear++)
      for (let legShape = 0; legShape < choices("legShape").length; legShape++)
        for (let wingFingers = 0; wingFingers < choices("wingFingers").length; wingFingers++)
        for (let feet = 0; feet < choices("feet").length; feet++) {
          const label = `${head}/${headgear}/${legShape}/${wingFingers}/${feet}`;
          const anatomy = module.createAnatomy({ ...base, head, headgear, legShape, wingFingers, feet });
          assert.deepEqual(anatomyIssues(anatomy), [], label);
          const ids = anatomy.parts.map(({ id }) => id);
          assert.equal(new Set(ids).size, ids.length, `${label}: part ids are unique`);
          const bones = new Set(anatomy.bones.map(({ id }) => id));
          assert.equal(anatomy.bones.length, module.createAnatomy(base).bones.length, `${label}: same skeleton`);
          for (const part of anatomy.parts) {
            assert.ok(bones.has(part.bone), `${label}: ${part.id} has a bone`);
            for (const value of part.vertices || []) assert.ok(Number.isFinite(value), `${label}: ${part.id} is finite`);
            if (part.skin)
              part.skin.joints.forEach((pair, i) => {
                assert.ok(pair.every((id) => bones.has(id)), `${label}: ${part.id} skins to retained bones`);
                assert.ok(part.skin.weights[i] >= 0 && part.skin.weights[i] <= 1, `${label}: ${part.id} weight`);
              });
          }
          const hide = anatomy.parts.find(({ id }) => id === "hindlimb-hide-1");
          assert.ok(hide.skin.joints.some((pair) => pair.includes("root")), `${label}: leg hide blends into the body`);
          if (!head && !headgear) {
            legs.set(legShape, ids.filter((id) => /^(heel|thigh|shin|tarsal|knee)/.test(id)).join());
            joints.set(wingFingers, anatomy.parts.filter((part) => part.bone === "wing-hand-1").map(({ id, vertices }) => `${id}:${vertices?.slice(-3)}`).join());
            feetParts.set(feet, ids.filter((id) => below.test(id)).join());
            assert.ok(
              anatomy.parts.filter((part) => below.test(part.id)).every((part) => /^(foot|toes|hallux)-hind-/.test(part.bone)),
              `${label}: feet only use the foot, toe and hallux bones`,
            );
          }
        }
  assert.equal(new Set(legs.values()).size, choices("legShape").length, "Leg shapes have their own parts");
  assert.equal(new Set(joints.values()).size, choices("wingFingers").length, "Wing fingers have their own parts");
  assert.equal(new Set(feetParts.values()).size, choices("feet").length, "Feet have their own parts");
});

test("Part choice genes are appended, clamp at their endpoints and default to the original parts", () => {
  const names = module.genes.map((gene) => gene.name);
  assert.deepEqual(names.slice(names.indexOf("legShape"), names.indexOf("legShape") + 5), ["legShape", "wingFingers", "feet", "tailTip", "hindWings"]);
  const ids = (genome) => module.createAnatomy(genome).parts.map(({ id }) => id).join();
  for (const name of ["legShape", "wingFingers", "feet", "tailTip", "hindWings"]) {
    const gene = module.genes.find((g) => g.name === name);
    assert.equal(gene.min, 0);
    assert.equal(gene.max, gene.choices.length);
    assert.equal(gene.default, 0);
    const last = { ...base, [name]: gene.choices.length - 1 };
    assert.equal(ids({ ...base, [name]: gene.max }), ids(last), `${name} max is the last variant`);
    assert.equal(ids({ ...base, [name]: gene.max - 1e-9 }), ids(last));
    assert.equal(ids({ ...base, [name]: gene.min }), ids({ ...base, [name]: 0 }));
    const missing = { ...base };
    delete missing[name];
    assert.equal(ids(missing), ids({ ...base, [name]: 0 }), `${name} falls back to the first variant`);
  }
  const original = module.createAnatomy({ ...base, legShape: 0, wingFingers: 0, feet: 0 }).parts.map(({ id }) => id);
  for (const id of ["heel-spur-1", "thigh-spur-1", "wing-claw-1-0", "wing-claw--1-2"]) assert.ok(original.includes(id), id);
});

test("Part choice genes are cosmetic and never change the race stats", () => {
  const stats = deriveStats("dragon", base);
  for (const name of ["legShape", "wingFingers", "feet", "head", "headgear", "tailTip", "hindWings"]) {
    const gene = module.genes.find((g) => g.name === name);
    for (let value = 0; value < gene.max; value++)
      assert.deepEqual(deriveStats("dragon", { ...base, [name]: value }), stats, `${name} ${value}`);
  }
});

test("Every leg shape and foot type stays in bounds without tearing its hide in every flight state", () => {
  const combos = [];
  for (let legShape = 0; legShape < choices("legShape").length; legShape++)
    for (let feet = 0; feet < choices("feet").length; feet++) combos.push([legShape, feet]);
  for (const [legShape, feet] of combos)
    for (const genome of [base, Object.fromEntries(module.genes.map((g) => [g.name, g.min])), Object.fromEntries(module.genes.map((g) => [g.name, g.max - 1e-6]))]) {
      const body = module.createAnatomy({ ...genome, legShape, feet, wingFingers: (legShape + feet) % choices("wingFingers").length });
      const mesh = restMesh(body),
        rest = restPositions(mesh);
      const { center, radius } = body.bounds;
      for (const [name, motion] of motions)
        for (let frame = 0; frame < 8; frame++) {
          const label = `leg ${legShape}, feet ${feet}, ${name}, frame ${frame}`;
          const posed = deformMesh(body, mesh, pose(body, frame / 8, motion && { ...motion, time: 5.5 }));
          for (let i = 0; i < mesh.count; i++)
            assert.ok(Math.hypot(posed[i * 3] - center[0], posed[i * 3 + 1] - center[1], posed[i * 3 + 2] - center[2]) <= radius, `${label}: leaves the bounds`);
          for (const side of [-1, 1]) {
            const limb = stretch(rest, posed, mesh.perPart.get(`hindlimb-hide-${side}`));
            assert.ok(limb.low > 0.3 && limb.high < 1.55, `${label}: hide stretches (${limb.low}, ${limb.high})`);
          }
        }
    }
});

// Segment/triangle intersection (Möller-Trumbore), for joint edges piercing the membrane.
function pierces(p, q, a, b, c) {
  const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-12) return false;
  const s = sub(p, a), u = dot(s, h) / det;
  if (u < 0 || u > 1) return false;
  const qv = cross(s, e1), v = dot(d, qv) / det;
  if (v < 0 || u + v > 1) return false;
  const t = dot(e2, qv) / det;
  return t > 0 && t < 1;
}

test("Wing fingers stay clear of the membrane through the whole wingbeat", () => {
  const knuckle = 0.18 * creatureScale;
  for (let wingFingers = 0; wingFingers < choices("wingFingers").length; wingFingers++) {
    const body = module.createAnatomy({ ...base, wingFingers });
    const mesh = restMesh(body);
    const index = body.bones.findIndex(({ id }) => id === "wing-hand-1");
    const jointRanges = body.parts.filter((part) => part.bone === "wing-hand-1").map(({ id }) => mesh.perPart.get(id));
    const membrane = mesh.perPart.get("wing-membrane-1");
    for (const [name, motion] of motions)
      for (let frame = 0; frame < 24; frame++) {
        const bodyPose = pose(body, frame / 24, motion && { ...motion, time: 3.3 });
        const posed = deformMesh(body, mesh, bodyPose);
        const wrist = point(boneMatrices(body, bodyPose)[index], [0, 0, 0]);
        const at = (i) => [posed[i * 3], posed[i * 3 + 1], posed[i * 3 + 2]];
        const near = (p, r) => Math.hypot(p[0] - wrist[0], p[1] - wrist[1], p[2] - wrist[2]) < r;
        const triangles = [];
        for (let t = membrane[0]; t < membrane[1]; t += 3) {
          const tri = [at(t), at(t + 1), at(t + 2)];
          if (tri.some((p) => near(p, 1.2 * creatureScale))) triangles.push(tri);
        }
        for (const [start, end] of jointRanges)
          for (let t = start; t < end; t += 3)
            for (let k = 0; k < 3; k++) {
              const p = at(t + k), q = at(t + (k + 1) % 3);
              if (near(p, knuckle) && near(q, knuckle)) continue;
              for (const [a, b, c] of triangles)
                assert.ok(!pierces(p, q, a, b, c), `${choices("wingFingers")[wingFingers]}, ${name}, frame ${frame}: finger pierces the membrane`);
            }
      }
  }
});
