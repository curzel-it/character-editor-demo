import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { pose } from "../src/animate/dragon.js";
import { mouthStates } from "../src/animate/flightStates.js";
import { mouthProfiles } from "../src/animate/dragonMouth.js";
import { mouthFromEvents, envelope } from "../src/animate/mouthEvents.js";
import { dragonHeads } from "../src/anatomy/dragonHeads.js";
import { palette } from "../src/palette.js";
import { genes } from "../src/genome/dragon.js";
import { simulateRace } from "../src/race/simulateRace.js";
import { windingCourse } from "../src/race/windingCourse.js";
import { lengthScale } from "../src/worldScale.js";
import { poseIssues, maximumPoseDifference } from "../tools/checks/structure.mjs";
import { restMesh, deformMesh } from "./animationHelpers.mjs";

const module = await loadSubject("dragon");
const base = makeGenome(module.genes, 2407);
const heads = mouthProfiles.map((profile, head) => [profile, module.createAnatomy({ ...base, head })]);
const expressions = [
  ["cruise", { effort: 0.5 }],
  ["sprint", { effort: 1 }],
  ["glide", { effort: 0.15, glide: 1 }],
  ["dive", { effort: 0.15, glide: 1, climb: -0.7 }],
  ["exhausted", { effort: 0.45, fatigue: 1, gasp: 1 }],
  ["roar", { effort: 0.8, roar: 1 }],
  ["snap left", { effort: 0.8, snap: 1, snapSide: 1 }],
  ["snap right", { effort: 0.8, snap: 1, snapSide: -1 }],
  ["everything", { effort: 1, fatigue: 1, gasp: 1, roar: 1, snap: 1 }],
];

test("Every head keeps its jaw between closed and its widest gape", () => {
  for (const [profile, anatomy] of heads)
    for (const [name, motion] of expressions)
      for (const time of [undefined, 2.2, 9.7])
        for (let k = 0; k <= 24; k++) {
          const jaw = pose(anatomy, k / 24, { ...motion, time }).bones.jaw.rotation[2];
          assert.ok(jaw <= profile.closed + 1e-9, `${profile.id} ${name}: jaw passes through the palate`);
          assert.ok(jaw >= profile.closed - profile.limit - 1e-9, `${profile.id} ${name}: jaw over-opens`);
        }
});

test("Expressions read per head: streamlined glide, wider sprint, gaping exhaustion, big roar", () => {
  for (const [profile, anatomy] of heads) {
    const opening = (motion) => {
      const values = Array.from({ length: 24 }, (_, k) => profile.closed - pose(anatomy, k / 24, motion).bones.jaw.rotation[2]);
      return { mean: values.reduce((s, v) => s + v, 0) / 24, range: Math.max(...values) - Math.min(...values) };
    };
    const glide = opening({ effort: 0.15, glide: 1 }),
      cruise = opening({ effort: 0.5 }),
      sprint = opening({ effort: 1 }),
      tired = opening({ effort: 0.45, fatigue: 1 }),
      roar = opening({ effort: 0.8, roar: 1 });
    assert.ok(glide.mean < 0.03, `${profile.id}: the glide mouth is closed`);
    assert.ok(sprint.mean > cruise.mean && sprint.range > cruise.range, `${profile.id}: sprint pants harder`);
    assert.ok(tired.mean > sprint.mean, `${profile.id}: exhaustion gapes`);
    assert.ok(roar.mean > 0.5 * profile.limit + 0.1, `${profile.id}: roar drops the jaw`);
    const head = (motion) => pose(anatomy, 0.3, motion).bones.head.rotation;
    assert.ok(head({ effort: 0.8, roar: 1 })[2] > head({ effort: 0.8 })[2] + 0.3, `${profile.id}: roar throws the head up`);
    assert.ok(head({ effort: 0.8, snap: 1, snapSide: 1 })[1] < head({ effort: 0.8, snap: 1, snapSide: -1 })[1], `${profile.id}: snaps turn towards the rival`);
  }
});

test("Mouth previews are deterministic, finite, bounded and continuous in time", () => {
  for (const [profile, anatomy] of heads) {
    const ids = new Set(anatomy.bones.map((bone) => bone.id));
    const mesh = restMesh(anatomy);
    const { center, radius } = anatomy.bounds;
    for (const state of mouthStates)
      for (let k = 0; k < 80; k++) {
        const time = k * 0.041,
          t = (time * 1.7) % 1;
        const motion = state.motionAt(time);
        const result = pose(anatomy, t, motion);
        assert.deepEqual(result, pose(anatomy, t, state.motionAt(time)));
        assert.deepEqual(poseIssues(anatomy, result), []);
        for (const [id, bone] of Object.entries(result.bones)) {
          assert.ok(ids.has(id), `${state.id} animates retained bone ${id}`);
          for (const value of [...(bone.rotation || []), ...(bone.position || [])])
            assert.ok(Number.isFinite(value), `${state.id}: ${id} is finite`);
        }
        const next = pose(anatomy, t + 1e-3, state.motionAt(time + 1e-3));
        assert.ok(maximumPoseDifference(result, next) < 0.03, `${profile.id} ${state.id} is continuous at ${time}`);
        if (k % 8) continue;
        const posed = deformMesh(anatomy, mesh, result);
        for (let i = 0; i < mesh.count; i++)
          assert.ok(
            Math.hypot(posed[i * 3] - center[0], posed[i * 3 + 1] - center[1], posed[i * 3 + 2] - center[2]) <= radius,
            `${profile.id} ${state.id}: vertex leaves the bounds`,
          );
      }
  }
});

test("Constant mouth cues still loop exactly without time", () => {
  for (const [, anatomy] of heads)
    for (const [name, motion] of expressions)
      assert.ok(maximumPoseDifference(pose(anatomy, 0, motion), pose(anatomy, 1, motion)) < 1e-6, `${name} loops`);
});

const racer = (id, x, z, progress, extra = {}) => ({
  id, position: [x, 50, z], forward: [1, 0, 0], progress, finished: false, ...extra,
});
function syntheticRecording() {
  const frames = [];
  for (let k = 0; k <= 200; k++) {
    const t = k / 20,
      x = 40 * t;
    const close = t > 2 && t < 6;
    frames.push({
      t,
      racers: [
        racer("a", x, 0, x),
        racer("b", x + (close ? 2 : 60) * lengthScale, close ? 5 * lengthScale : 0, x + (close ? 2 : 60) * lengthScale),
        racer("c", x - 200, 0, x - 200),
      ],
    });
  }
  const events = [
    { t: 1, type: "overtake", racer: "a", other: "b", place: 1 },
    { t: 1.5, type: "overtake", racer: "a", other: "c", place: 1 },
    { t: 8, type: "overtake", racer: "b", other: "c", place: 2 },
    { t: 9, type: "finish", racer: "a", place: 1 },
  ];
  return { hz: 20, duration: 10, frames, events };
}

const truncate = (recording, t) => ({
  ...recording,
  frames: recording.frames.filter((frame) => frame.t <= t),
  events: recording.events.filter((event) => event.t <= t),
});

test("Race events drive roars, snaps and gasps", () => {
  const recording = syntheticRecording();
  const at = (id, t) => mouthFromEvents(recording, id, t);
  assert.deepEqual(at("a", 0.9), { roar: 0, snap: 0, snapSide: 1, gasp: 0 }, "Nothing before the first event");
  assert.ok(at("a", 1.5).roar > 0.8, "Overtaking roars");
  assert.ok(at("a", 1.9).roar > at("a", 2.5).roar, "The roar decays");
  assert.ok(at("b", 8.4).roar > 0.5, "Any overtake roars");
  assert.ok(at("a", 10).roar === 1, "The winner roars through the finish");
  const snaps = (id) => Array.from({ length: 1000 }, (_, k) => at(id, k / 100));
  const a = snaps("a"), b = snaps("b");
  assert.ok(Math.max(...a.slice(0, 200).map((m) => m.snap)) === 0, "No snaps apart");
  assert.ok(Math.max(...a.slice(200, 650).map((m) => m.snap)) > 0.9, "Racers alongside snap");
  assert.ok(Math.max(...a.slice(700).map((m) => m.snap)) === 0, "Snapping stops once the rival is gone");
  assert.ok(a.some((m) => m.snap > 0.5 && m.snapSide === 1), "a snaps towards b on its left (+Z)");
  assert.ok(b.some((m) => m.snap > 0.5 && m.snapSide === -1), "b snaps back to its right");
  for (let k = 1; k < 1000; k++)
    for (const key of ["roar", "snap", "gasp"])
      assert.ok(Math.abs(a[k][key] - a[k - 1][key]) < 0.2, `${key} is smooth at ${k / 100}`);
});

test("Envelopes are continuous and only look back", () => {
  for (let k = 0; k < 3000; k++) {
    const age = -0.5 + k * 1e-3;
    assert.ok(Math.abs(envelope(age + 1e-3, 0.09, 0.03, 0.16) - envelope(age, 0.09, 0.03, 0.16)) < 0.02);
    if (age < 0) assert.equal(envelope(age, 0.1, 0, 0.1), 0);
  }
  const recording = syntheticRecording();
  for (let k = 0; k <= 100; k++) {
    const t = k * 0.1 + 0.013;
    for (const id of ["a", "b", "c"])
      assert.deepEqual(mouthFromEvents(truncate(recording, t), id, t), mouthFromEvents(recording, id, t), `${id} at ${t}`);
  }
});

test("A simulated race gives deterministic mouths that ignore the future", () => {
  const roster = Array.from({ length: 6 }, (_, i) => ({ id: `m-${i}`, name: `M${i}`, subject: "dragon", genome: makeGenome(genes, `mouth:${i}`) }));
  const recording = simulateRace({ seed: "mouth", course: windingCourse("mouth"), roster });
  let roars = 0,
    snaps = 0;
  for (let k = 0; k < 60; k++) {
    const t = (recording.duration * k) / 60;
    const cut = truncate(recording, t);
    for (const { id } of roster) {
      const cue = mouthFromEvents(recording, id, t);
      assert.deepEqual(mouthFromEvents(cut, id, t), cue);
      for (const value of Object.values(cue)) assert.ok(Number.isFinite(value));
      roars += cue.roar > 0;
      snaps += cue.snap > 0;
    }
  }
  assert.ok(roars > 0, "Someone roars during a race");
  assert.ok(Number.isFinite(snaps));
});

test("Heads put tongues and nostrils on their own bones when the anatomy offers them", () => {
  const colors = { skin: palette.ivory, under: palette.ivory, ridge: palette.ivory, horn: palette.ivory, mouth: palette.dark, tongue: palette.dark };
  for (const head of dragonHeads) {
    const plain = { parts: [], ...colors };
    head.build(plain);
    const bones = [],
      rigged = { parts: [], ...colors, rig: (id, parent, position) => bones.push({ id, parent, position }) };
    head.build(rigged);
    assert.deepEqual(bones.map((bone) => bone.id), ["tongue", "tongue-tip", "nostril--1", "nostril-1"], head.id);
    assert.equal(plain.parts.length, rigged.parts.length);
    const origin = (id) => {
      const bone = bones.find((b) => b.id === id);
      const parent = bone.parent === "tongue" ? origin("tongue") : [0, 0, 0];
      return bone.position.map((v, i) => v + parent[i]);
    };
    plain.parts.forEach((part, index) => {
      const moved = rigged.parts[index];
      if (moved.bone === part.bone) return assert.deepEqual(moved, part);
      assert.ok(["tongue", "tongue-tip", "nostril--1", "nostril-1"].includes(moved.bone));
      const at = origin(moved.bone);
      const [before, after] = part.vertices ? [part.vertices, moved.vertices] : [part.position, moved.position];
      for (let i = 0; i < before.length; i++) {
        const k = i % 3,
          value = before[i];
        const squeezed = k === 0 && value > 0 ? value * 0.83 : value;
        assert.ok(Math.abs(after[i] + at[k] - squeezed) < 1e-9, `${head.id} ${moved.id} keeps its place`);
      }
    });
  }
});
