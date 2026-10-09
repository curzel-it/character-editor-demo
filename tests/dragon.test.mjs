import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";

test("Dragons have two articulated wings, two hind legs, no forelegs and a skinned body", async () => {
  const dragonModule = await loadSubject("dragon");
  for (const seed of [1, 7, 42, 64]) {
    const genome = makeGenome(dragonModule.genes, seed);
    const dragon = dragonModule.createAnatomy(genome);
    assert.deepEqual(dragon.genome, genome);
    assert.equal(dragon.subject, "dragon");
    assert.equal(
      dragon.bones.filter(({ id }) => /^wing--?1$/.test(id)).length,
      2,
    );
    assert.equal(
      dragon.bones.filter(({ id }) => id.startsWith("leg-hind-")).length,
      2,
    );
    assert.equal(
      dragon.bones.filter(({ id }) => /^(leg|shin)-front-/.test(id)).length,
      0,
    );
    const ids = new Set(dragon.bones.map(({ id }) => id));
    for (const part of dragon.parts)
      assert.ok(ids.has(part.bone), `Part ${part.id} has a retained bone`);
    for (const bone of dragon.bones)
      assert.ok(
        bone.parent === null || ids.has(bone.parent),
        `Bone ${bone.id} has a retained parent`,
      );
    for (let frame = 0; frame < 12; frame++) {
      const pose = dragonModule.pose(dragon, frame / 12);
      assert.ok(
        Object.keys(pose.bones).every((id) => ids.has(id)),
        "Flight pose only animates retained bones",
      );
    }
    for (const side of [-1, 1]) {
      const shoulder = dragon.bones.find(({ id }) => id === `wing-${side}`);
      const elbow = dragon.bones.find(({ id }) => id === `wing-elbow-${side}`);
      const wrist = dragon.bones.find(({ id }) => id === `wing-wrist-${side}`);
      assert.equal(elbow.parent, shoulder.id);
      assert.equal(wrist.parent, elbow.id);
    }
    const bodySkin = dragon.parts.find(
      (part) =>
        part.skin?.joints.some((pair) =>
          pair.some((id) => id.startsWith("neck-")),
        ) &&
        part.skin.joints.some((pair) =>
          pair.some((id) => id.startsWith("tail-")),
        ),
    );
    assert.ok(bodySkin, "A shared body skin connects the neck, torso and tail");
    assert.ok(
      bodySkin.skin.weights.some((weight) => weight > 0 && weight < 1),
      "Body joints blend between adjacent bones",
    );
    for (const side of [-1, 1]) {
      const membrane = dragon.parts.find((part) =>
        part.skin?.joints.some((pair) =>
          pair.some((id) => id.startsWith(`spar-${side}-`)),
        ),
      );
      assert.ok(
        membrane,
        `Wing ${side} has a membrane attached to articulated spars`,
      );
    }
  }
});

test("Dragon rig: chest carries neck and wings, membrane hinges and articulated feet", async () => {
  const { anatomyIssues } = await import("../tools/checks/structure.mjs");
  const module = await loadSubject("dragon");
  const defaults = Object.fromEntries(module.genes.map((g) => [g.name, g.default]));
  const cases = [
    makeGenome(module.genes, 2407),
    Object.fromEntries(module.genes.map((g) => [g.name, g.min])),
    Object.fromEntries(module.genes.map((g) => [g.name, g.max])),
    ...["legs", "thighs"].flatMap((name) => {
      const gene = module.genes.find((g) => g.name === name);
      return [gene.min, gene.max].map((value) => ({ ...defaults, [name]: value }));
    }),
  ];
  for (const genome of cases) {
    const dragon = module.createAnatomy(genome);
    assert.deepEqual(anatomyIssues(dragon), []);
    const parent = Object.fromEntries(dragon.bones.map((bone) => [bone.id, bone.parent]));
    assert.equal(parent.chest, "root");
    assert.equal(parent["neck-0"], "chest");
    for (const side of [-1, 1]) {
      assert.equal(parent[`wing-${side}`], "chest");
      assert.equal(parent[`wing-anchor-${side}`], "root");
      assert.equal(parent[`toes-hind-${side}`], `foot-hind-${side}`);
      assert.equal(parent[`hallux-hind-${side}`], `foot-hind-${side}`);
      const membrane = dragon.parts.find((part) => part.id === `wing-membrane-${side}`);
      assert.ok(
        membrane.skin.joints.every((pair) => !pair.includes("root") || pair.every((id) => id === "chest" || id === "root")),
        "The membrane hinges on its anchor, and only its body seam rides the torso",
      );
      const toes = dragon.parts.filter((part) => /^toe-/.test(part.id) && part.id.startsWith(`toe-${side}-`)).length;
      assert.ok(toes >= 2, "Each foot has forward toes");
      assert.equal(dragon.parts.filter((part) => part.id.startsWith(`talon-${side}-`)).length, toes + 1, "Every toe and the hallux has a claw");
      assert.ok(dragon.parts.some((part) => part.id === `hallux-${side}`));
      const hide = dragon.parts.find((part) => part.id === `hindlimb-hide-${side}`);
      assert.ok(hide.skin.joints.some((pair) => pair.includes("root")), "Leg hide blends into the body");
    }
    for (const part of dragon.parts.filter((part) => part.skin))
      part.skin.weights.forEach((weight) => assert.ok(weight >= 0 && weight <= 1));
    const sockets = Object.fromEntries(dragon.sockets.map((socket) => [socket.id, socket]));
    assert.equal(sockets.saddle.bone, "chest");
    assert.equal(sockets["saddle-rear"].bone, "root");
  }
});

test("Leg genes are appended, keep old seeds and scale the legs", async () => {
  const module = await loadSubject("dragon");
  const names = module.genes.map((gene) => gene.name);
  assert.deepEqual(names.slice(names.indexOf("legs"), names.indexOf("legs") + 5), ["legs", "thighs", "legShape", "wingFingers", "feet"]);
  const defaults = Object.fromEntries(module.genes.map((g) => [g.name, g.default]));
  const legs = module.genes.find((gene) => gene.name === "legs");
  const reach = (value) => {
    const dragon = module.createAnatomy({ ...defaults, legs: value });
    return ["shin-hind-1", "foot-hind-1", "toes-hind-1"]
      .map((id) => Math.hypot(...dragon.bones.find((bone) => bone.id === id).position))
      .reduce((sum, length) => sum + length, 0);
  };
  assert.ok(Math.abs(reach(legs.default) - legs.default) < 0.05, "Leg length gene is the leg's bone length in metres");
  assert.ok(reach(legs.max) > reach(legs.min) * 1.3);
  const thighs = module.genes.find((gene) => gene.name === "thighs");
  const girth = (value) => {
    const hide = module.createAnatomy({ ...defaults, thighs: value }).parts.find((part) => part.id === "hindlimb-hide-1");
    let low = Infinity, high = -Infinity;
    for (let i = 2; i < hide.vertices.length; i += 3) (low = Math.min(low, hide.vertices[i])), (high = Math.max(high, hide.vertices[i]));
    return high - low;
  };
  assert.ok(girth(thighs.max) > girth(thighs.min));
});
