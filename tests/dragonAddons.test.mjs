import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { pose } from "../src/animate/dragon.js";
import { flightStates } from "../src/animate/flightStates.js";
import { boneMatrices, point } from "../src/math3d.js";
import { dragonTailTips } from "../src/anatomy/dragonTailTips.js";
import { dragonHindWings } from "../src/anatomy/dragonHindWings.js";
import { anatomyIssues } from "../tools/checks/structure.mjs";
import { restMesh, deformMesh, restPositions, stretch } from "./animationHelpers.mjs";

const module = await loadSubject("dragon");
const choices = (name) => module.genes.find((gene) => gene.name === name).choices;
const base = makeGenome(module.genes, 2407);
const motions = [["default", undefined], ...flightStates.map((state) => [state.id, state.motion])];
const extremes = [
  base,
  Object.fromEntries(module.genes.map((g) => [g.name, g.min])),
  Object.fromEntries(module.genes.map((g) => [g.name, g.max - 1e-6])),
];

test("Every tail tip and hind-wing choice builds on the same skeleton and lists its addons", () => {
  const skeleton = module.createAnatomy(base).bones.map(({ id }) => id).join();
  const tips = new Map(), wings = new Map();
  for (let tailTip = 0; tailTip < choices("tailTip").length; tailTip++)
    for (let hindWings = 0; hindWings < choices("hindWings").length; hindWings++) {
      const label = `tail ${tailTip}, hind wings ${hindWings}`;
      const anatomy = module.createAnatomy({ ...base, tailTip, hindWings });
      assert.deepEqual(anatomyIssues(anatomy), [], label);
      assert.equal(anatomy.bones.map(({ id }) => id).join(), skeleton, `${label}: same skeleton`);
      const slots = Object.fromEntries(anatomy.addons.map((addon) => [addon.slot, addon]));
      assert.equal(slots.tailTip.id, dragonTailTips[tailTip].id, label);
      assert.equal(slots.hindWings.id, dragonHindWings[hindWings].id, label);
      assert.equal(!!slots.hindWings.keepClear.length, hindWings > 0, `${label}: hind wings keep clear only when present`);
      const ids = anatomy.parts.map(({ id }) => id);
      tips.set(tailTip, ids.filter((id) => id.startsWith("tail-") && !id.startsWith("tail-crest")).join());
      wings.set(hindWings, ids.filter((id) => id.startsWith("hindwing-")).join());
    }
  assert.equal(new Set(tips.values()).size, choices("tailTip").length, "Tail tips have their own parts");
  assert.equal(new Set(wings.values()).size, choices("hindWings").length, "Hind wings have their own parts");
  assert.equal(wings.get(0), "", "No hind wings by choice 0");
});

test("Addon keep-clear zones are in scaled rest-pose metres, well behind the saddle", () => {
  for (let hindWings = 1; hindWings < choices("hindWings").length; hindWings++) {
    const anatomy = module.createAnatomy({ ...base, hindWings, tailTip: 1 });
    const bind = boneMatrices(anatomy);
    const index = new Map(anatomy.bones.map((b, i) => [b.id, i]));
    const socket = (id) => {
      const s = anatomy.sockets.find((entry) => entry.id === id);
      return point(bind[index.get(s.bone)], s.position);
    };
    const rear = socket("saddle-rear");
    for (const addon of anatomy.addons)
      for (const zone of addon.keepClear) {
        assert.ok(zone.radius > 0);
        assert.ok(zone.center[0] + zone.radius < rear[0] - 0.5, `${addon.slot} zone stays behind the rear saddle`);
      }
    const root = point(bind[index.get("hindwing-1")], [0, 0, 0]);
    const zone = anatomy.addons.find((a) => a.slot === "hindWings").keepClear.find((z) => z.center[2] > 0);
    assert.ok(Math.hypot(...root.map((v, i) => v - zone.center[i])) < 1e-6, "Hind-wing zone sits on the wing root");
  }
});

test("Tail tips and hind wings stay in bounds and hold together in every flight state", () => {
  for (let tailTip = 0; tailTip < choices("tailTip").length; tailTip++)
    for (let hindWings = 0; hindWings < choices("hindWings").length; hindWings++)
      for (const genome of extremes) {
        const body = module.createAnatomy({ ...genome, tailTip, hindWings });
        const mesh = restMesh(body),
          rest = restPositions(mesh);
        const { center, radius } = body.bounds;
        for (const [name, motion] of motions)
          for (let frame = 0; frame < 6; frame++) {
            const label = `tail ${tailTip}, hind wings ${hindWings}, ${name}, frame ${frame}`;
            const posed = deformMesh(body, mesh, pose(body, frame / 6, motion && { ...motion, time: 4.1 }));
            for (let i = 0; i < mesh.count; i++)
              assert.ok(Math.hypot(posed[i * 3] - center[0], posed[i * 3 + 1] - center[1], posed[i * 3 + 2] - center[2]) <= radius, `${label}: leaves the bounds`);
            for (const side of [-1, 1]) {
              const range = mesh.perPart.get(`hindwing-membrane-${side}`);
              if (!range) continue;
              const sheet = stretch(rest, posed, range);
              assert.ok(sheet.low > 0.35 && sheet.high < 1.8, `${label}: hind-wing membrane stretches (${sheet.low}, ${sheet.high})`);
            }
          }
      }
});

test("About one seeded dragon in five grows hind wings, without disturbing the other genes", () => {
  const gene = module.genes.find((g) => g.name === "hindWings");
  assert.deepEqual(gene.weights, [8, 1, 1]);
  let winged = 0;
  const kinds = new Set();
  for (let seed = 1; seed <= 2000; seed++) {
    const genome = makeGenome(module.genes, seed);
    assert.ok(Number.isInteger(genome.hindWings) && genome.hindWings >= gene.min && genome.hindWings < gene.max);
    winged += genome.hindWings > 0;
    kinds.add(genome.hindWings);
  }
  assert.equal(kinds.size, 3, "Every hind-wing choice still occurs");
  assert.ok(winged > 2000 * 0.16 && winged < 2000 * 0.24, `${winged} of 2000 have hind wings`);
  const unweighted = module.genes.map(({ weights, ...rest }) => rest);
  const a = makeGenome(module.genes, 77), b = makeGenome(unweighted, 77);
  for (const g of module.genes) if (!g.weights) assert.equal(a[g.name], b[g.name], g.name);
});
