import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { pose } from "../src/animate/dragon.js";
import {
  motionFromRacer,
  blendMotion,
  resolveMotion,
} from "../src/animate/flightMotion.js";
import { flightStates, autoMotion } from "../src/animate/flightStates.js";
import { withAttitude } from "../src/animate/flightAttitude.js";
import { poseIssues, maximumPoseDifference } from "../tools/checks/structure.mjs";
import { boneMatrices } from "../src/math3d.js";
import {
  restMesh,
  deformMesh,
  restPositions,
  stretch,
} from "./animationHelpers.mjs";

const module = await loadSubject("dragon");
const defaults = Object.fromEntries(module.genes.map((g) => [g.name, g.default]));
const genomes = [
  ["seed 2407", makeGenome(module.genes, 2407)],
  ["seed 7", makeGenome(module.genes, 7)],
  ["all minima", Object.fromEntries(module.genes.map((g) => [g.name, g.min]))],
  ["all maxima", Object.fromEntries(module.genes.map((g) => [g.name, g.max]))],
  ["defaults", defaults],
];
const anatomy = module.createAnatomy(genomes[0][1]);
/** A pose without its eyes, whose blinks and glances are quick on purpose (see eyelids.test.mjs). */
const body = ({ bones }) => ({ bones: Object.fromEntries(Object.entries(bones).filter(([id]) => !/^(lid|gaze)-/.test(id))) });

const motions = [
  ["default", undefined],
  ...flightStates.map((state) => [state.id, state.motion]),
];

test("Flight poses are deterministic, finite and only animate retained bones", () => {
  const ids = new Set(anatomy.bones.map((bone) => bone.id));
  for (const [name, motion] of motions)
    for (const time of [undefined, 0, 12.345])
      for (let frame = 0; frame <= 24; frame++) {
        const input = motion && { ...motion, time };
        const result = pose(anatomy, frame / 24, input);
        assert.deepEqual(result, pose(anatomy, frame / 24, input), `${name} is deterministic`);
        assert.deepEqual(poseIssues(anatomy, result), [], `${name}, frame ${frame}`);
        for (const [id, bone] of Object.entries(result.bones)) {
          assert.ok(ids.has(id), `${name} animates retained bone ${id}`);
          for (const value of [...(bone.rotation || []), ...(bone.position || [])])
            assert.ok(Number.isFinite(value), `${name}: ${id} is finite`);
        }
      }
});

test("Default and constant motions loop exactly over the one-second wing cycle", () => {
  for (const [name, motion] of motions) {
    assert.ok(
      maximumPoseDifference(pose(anatomy, 0, motion), pose(anatomy, 1, motion)) < 1e-6,
      `${name} loops without time`,
    );
    const timed = motion && { ...motion, time: 8.25 };
    assert.ok(
      maximumPoseDifference(pose(anatomy, 0, timed), pose(anatomy, 1, timed)) < 1e-6,
      `${name} loops in phase at a fixed time`,
    );
  }
  assert.deepEqual(pose(anatomy, 0.3), pose(anatomy, 0.3, {}), "Empty motion is the default cruise");
});

test("Small changes in phase, time or motion give small pose changes", () => {
  const step = 1e-3;
  const bodyPose = (...args) => body(pose(...args));
  for (const [name, motion] of motions) {
    const base = { ...(motion || {}), time: 5.5 };
    for (let frame = 0; frame < 24; frame++) {
      const t = frame / 24,
        reference = bodyPose(anatomy, t, base);
      assert.ok(maximumPoseDifference(reference, bodyPose(anatomy, t + step, base)) < 0.03, `${name}: phase`);
      assert.ok(
        maximumPoseDifference(reference, bodyPose(anatomy, t, { ...base, time: base.time + step })) < 0.01,
        `${name}: time`,
      );
      for (const key of ["effort", "glide", "bank", "climb", "fatigue"]) {
        const nudged = { ...resolveMotion(base), [key]: resolveMotion(base)[key] + (key === "glide" || key === "fatigue" ? -step : step) };
        assert.ok(
          maximumPoseDifference(reference, bodyPose(anatomy, t, nudged)) < 0.01,
          `${name}: ${key} is continuous`,
        );
      }
    }
  }
  for (let k = 0; k < 400; k++) {
    const time = k * 0.05;
    assert.ok(
      maximumPoseDifference(
        bodyPose(anatomy, time % 1, autoMotion(time).motion),
        bodyPose(anatomy, (time + 0.01) % 1, autoMotion(time + 0.01).motion),
      ) < 0.1,
      // A sprint downstroke alone turns the shoulder about 0.085 rad per 1% of the cycle.
      `Auto blends continuously at ${time.toFixed(2)} s`,
    );
  }
});

test("Racer recordings map to motion with eased effort and daze", () => {
  const racer = { effort: 0.9, bank: 0.4, forward: [0.9, Math.sin(0.2), 0] };
  const motion = motionFromRacer(racer, 10);
  assert.equal(motion.effort, 0.9);
  assert.equal(motion.glide, 0);
  assert.equal(motion.bank, 0.4);
  assert.ok(Math.abs(motion.climb - 0.2) < 1e-9);
  assert.equal(motion.fatigue, 0);
  assert.equal(motion.time, 10);
  assert.equal(motionFromRacer({ ...racer, effort: 0.1 }, 10).glide, 1);
  const tired = motionFromRacer({ ...racer, effects: [{ id: "daze", until: 11 }] }, 10.05, motion);
  assert.ok(tired.fatigue > 0 && tired.fatigue < 0.2, "A daze eases in");
  assert.deepEqual(motionFromRacer(racer, 9, tired), motionFromRacer(racer, 9), "Scrubbing back resets easing");
  assert.deepEqual(motionFromRacer(racer, 10, motion), motionFromRacer(racer, 10, motion));
  assert.deepEqual(blendMotion({ effort: 0 }, { effort: 1, time: 2 }, 0.25), { effort: 0.25, glide: 0, bank: 0, climb: 0, fatigue: 0, flare: 0, stand: 0, impact: 0, time: 2 });
});

test("Poses stay inside the framing sphere without tearing skin or crossing wings", () => {
  for (const [genomeName, genome] of genomes) {
    const body = module.createAnatomy(genome);
    const mesh = restMesh(body),
      rest = restPositions(mesh);
    const { center, radius } = body.bounds;
    for (const [name, motion] of motions)
      for (const time of [undefined, 3.3, 17.9])
        for (let frame = 0; frame < 24; frame++) {
          const context = `${genomeName}, ${name}, frame ${frame}`;
          const posed = deformMesh(body, mesh, pose(body, frame / 24, motion && { ...motion, time }));
          for (let i = 0; i < mesh.count; i++) {
            const distance = Math.hypot(
              posed[i * 3] - center[0],
              posed[i * 3 + 1] - center[1],
              posed[i * 3 + 2] - center[2],
            );
            assert.ok(distance <= radius, `${context}: vertex leaves the bounds`);
          }
          for (const side of [-1, 1]) {
            const range = mesh.perPart.get(`wing-membrane-${side}`);
            const wing = stretch(rest, posed, range);
            assert.ok(wing.low > 0.22 && wing.high < (name === "stand" ? 3 : 1.75), `${context}: wing ${side} membrane tears or collapses (${wing.low}, ${wing.high})`);
            for (let i = range[0]; i < range[1]; i++)
              assert.ok(side * posed[i * 3 + 2] > 0.2, `${context}: wing ${side} crosses the body midline`);
          }
          const hide = stretch(rest, posed, mesh.perPart.get("continuous-hide"));
          assert.ok(hide.low > 0.65 && hide.high < 1.4, `${context}: body skin stretches (${hide.low}, ${hide.high})`);
          for (const [id, range] of mesh.perPart)
            if (/^wing-arm-hide/.test(id)) {
              const limb = stretch(rest, posed, range);
              assert.ok(limb.low > 0.65 && limb.high < 1.4, `${context}: ${id} stretches`);
            } else if (/^hindlimb-hide/.test(id)) {
              // The hip crease folds into the belly when an exhausted racer's legs dangle.
              const limb = stretch(rest, posed, range);
              assert.ok(limb.low > 0.3 && limb.high < 1.55, `${context}: ${id} stretches (${limb.low}, ${limb.high})`);
            }
        }
  }
});

test("Preview attitude only rolls and pitches the root", () => {
  const base = pose(anatomy, 0.2, { bank: 0.5, climb: -0.3 });
  const tilted = withAttitude(base, { bank: 0.5, climb: -0.3 });
  assert.equal(tilted.bones.root.rotation[0], base.bones.root.rotation[0] + 0.5);
  assert.equal(tilted.bones.root.rotation[2], base.bones.root.rotation[2] - 0.3);
  assert.deepEqual(tilted.bones.head, base.bones.head);
});

test("Hind legs streamline at speed, hang in a glide and dangle when exhausted", () => {
  const body = module.createAnatomy(defaults);
  const toes = (motion, t = 0.3) => {
    const index = body.bones.findIndex((bone) => bone.id === "toes-hind-1");
    const root = body.bones.findIndex((bone) => bone.id === "root");
    const matrices = boneMatrices(body, pose(body, t, motion));
    const at = (i) => [matrices[i][12], matrices[i][13]];
    const [x, y] = at(index), [rx, ry] = at(root);
    return { back: rx - x, drop: ry - y };
  };
  const average = (motion) => {
    const samples = Array.from({ length: 12 }, (_, k) => toes({ ...motion, time: 4 }, k / 12));
    return { back: samples.reduce((s, v) => s + v.back, 0) / 12, drop: samples.reduce((s, v) => s + v.drop, 0) / 12 };
  };
  const sprint = average({ effort: 1 }), glide = average({ effort: 0.15, glide: 1 }), tired = average({ effort: 0.45, fatigue: 1 });
  assert.ok(sprint.drop < glide.drop && glide.drop < tired.drop, "Legs lower from sprint to glide to exhaustion");
  assert.ok(sprint.back > glide.back && glide.back > tired.back, "Legs trail back most at speed");
  const swing = (motion) => {
    const values = Array.from({ length: 24 }, (_, k) => pose(body, k / 24, motion).bones["leg-hind-1"].rotation[2]);
    return Math.max(...values) - Math.min(...values);
  };
  assert.ok(swing({ effort: 0.45, fatigue: 1 }) > swing({ effort: 1 }), "Exhausted legs swing loosely");
  assert.ok(swing({ effort: 1 }) > 0.05, "Legs kick with the downstroke");
  const left = pose(body, 0.3, { effort: 0.55, bank: 0.8 }).bones,
    level = pose(body, 0.3, { effort: 0.55 }).bones;
  for (const side of [-1, 1])
    assert.ok(left[`leg-hind-${side}`].rotation[0] > level[`leg-hind-${side}`].rotation[0], "Legs swing outward in a bank");
  const toesCurl = pose(body, 0.3, { effort: 1 }).bones["toes-hind-1"].rotation[2];
  assert.ok(toesCurl > pose(body, 0.3, { effort: 0.45, fatigue: 1 }).bones["toes-hind-1"].rotation[2], "Talons clench at speed and relax when exhausted");
});

test("The chest flexes with the downstroke and the membrane hinge follows the wing", () => {
  const chest = Array.from({ length: 24 }, (_, k) => pose(anatomy, k / 24, { effort: 1 }).bones.chest.rotation[2]);
  assert.ok(Math.max(...chest) - Math.min(...chest) > 0.15, "Sprint strokes crunch the chest");
  for (let k = 0; k < 24; k++) {
    const bones = pose(anatomy, k / 24, { effort: 1 }).bones;
    for (const side of [-1, 1]) {
      const wing = bones[`wing-${side}`].rotation[0], anchor = bones[`wing-anchor-${side}`].rotation[0];
      assert.ok(Math.sign(anchor) === Math.sign(wing) && Math.abs(anchor) <= Math.abs(wing), "Anchor follows part of the wing elevation");
    }
  }
  const elevation = Array.from({ length: 48 }, (_, k) => pose(anatomy, k / 48, { effort: 1 }).bones["wing-1"].rotation[0]);
  assert.ok(Math.max(...elevation) - Math.min(...elevation) > 1.3, "Sprint strokes are deep");
});
