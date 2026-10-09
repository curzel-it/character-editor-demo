import test from "node:test";
import assert from "node:assert/strict";
import { createDirector } from "../src/camera/createDirector.js";
import { CLEARANCE, terrainHeight } from "../src/camera/courseGeometry.js";
import { cutRules, shotTypes } from "../src/camera/shotTypes.js";
import {
  createSyntheticCourse,
  createSyntheticRecording,
  truncateRecording,
} from "../src/camera/syntheticRace.js";
import { createCourse } from "../src/course/createCourse.js";
import { simulateRace } from "../src/race/simulateRace.js";
import { creatureScale, speedScale } from "../src/worldScale.js";
import { sampleRace } from "../src/race/sampleRace.js";
import { riderCam } from "../src/camera/riderCam.js";

const fixture = (() => {
  const course = createSyntheticCourse("fixture");
  return { course, recording: createSyntheticRecording(course) };
})();

const hilly = (() => {
  const course = createSyntheticCourse("hills", { hilly: 3, bend: 0.8 });
  return { course, recording: createSyntheticRecording(course, { seed: "hills" }) };
})();

const live = (() => {
  const course = createCourse("camera");
  const roster = ["Ashwing", "Emberclaw", "Skyrend", "Duskfang", "Talonfall", "Stormveil"].map(
    (name, i) => ({ id: `r${i}`, name, subject: "dragon", genome: {} }),
  );
  return { course, recording: simulateRace({ seed: "camera", course, roster }) };
})();

const cases = { fixture, hilly, live };
const lastT = (recording) => (recording.frames.length - 1) / recording.hz;
const times = (recording, step = 0.1) => {
  const out = [];
  for (let t = 0; t <= lastT(recording); t += step) out.push(Number(t.toFixed(3)));
  return out;
};

test("Direction is deterministic for a recording", () => {
  const a = createDirector(fixture.recording, fixture.course);
  const b = createDirector(fixture.recording, fixture.course);
  assert.deepEqual(a.timeline, b.timeline);
  for (const t of times(fixture.recording, 0.7)) assert.deepEqual(a.shotAt(t), b.shotAt(t));
  assert.deepEqual(a.shotAt(12.34), a.shotAt(12.34));
});

for (const [label, { course, recording }] of Object.entries(cases)) {
  test(`Shot lengths, cut rules and finish coverage hold (${label})`, () => {
    const { timeline } = createDirector(recording, course);
    assert.equal(timeline[0].start, 0);
    assert.equal(timeline[0].shot, "grid");
    assert.ok(Math.abs(timeline.at(-1).end - lastT(recording)) < 1e-9);
    timeline.forEach((shot, i) => {
      const length = shot.end - shot.start;
      assert.ok(shot.shot in shotTypes, shot.shot);
      assert.ok(length <= cutRules.maxShot + 1e-9, `${shot.shot} lasts ${length}`);
      if (i < timeline.length - 1) {
        assert.ok(length >= cutRules.minShot - 1e-9, `${shot.shot} lasts ${length}`);
        const next = timeline[i + 1];
        assert.equal(next.start, shot.end);
        assert.notEqual(next.shot, shot.shot, `jump cut at ${next.start}`);
        if (shotTypes[shot.shot].sided && shotTypes[next.shot].sided)
          assert.equal(next.side, shot.side, `line crossed at ${next.start}`);
      }
      assert.ok(shot.reason.length > 5);
    });
    const subjects = new Set(timeline.map((s) => s.subject));
    assert.ok(subjects.size >= 4, "the field gets screen time");
    const winner = recording.results[0];
    const director = createDirector(recording, course);
    for (const dt of [-1.5, 0, 0.3])
      assert.equal(director.shotAt(winner.time + dt).shot, "finish", `finish at ${dt}`);
  });

  test(`Cameras are finite, legal and oriented (${label})`, () => {
    const director = createDirector(recording, course);
    for (const t of times(recording, 0.25)) {
      const { eye, target, up, fov, shot, subject, reason } = director.shotAt(t);
      for (const v of [...eye, ...target, ...up, fov]) assert.ok(Number.isFinite(v), `NaN at ${t}`);
      assert.ok(Math.abs(Math.hypot(...up) - 1) < 1e-9);
      assert.ok(Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]) > 1);
      assert.ok(fov > 0.3 && fov < 1.4);
      assert.ok(
        // The grid and touchdown cameras stand on the ground and the rider cam rides the racer; every other shot keeps its clearance.
        eye[1] > terrainHeight(course.terrain, eye[0], eye[2]) + (shot === "grid" || shot === "landing" || shot === "rider" ? 0.5 : CLEARANCE / 2),
        `too low at ${t}`,
      );
      assert.ok(shot in shotTypes && typeof reason === "string");
      assert.ok(subject === null || recording.roster.some((r) => r.id === subject));
    }
  });
}

test("A director truncated at t + 3 frames the same shot at t", () => {
  for (const { course, recording } of [fixture, live]) {
    const full = createDirector(recording, course);
    const end = lastT(recording);
    const scripted = [3.3, 11.05, 26.8, 44.13].map((t) => Number((t * speedScale).toFixed(2)));
    for (const t of [0, ...scripted, end * 0.5, end * 0.8, end - 9.9, end - 6.2, end - 4]) {
      const cut = createDirector(truncateRecording(recording, t + 3), course);
      assert.deepEqual(cut.shotAt(t), full.shotAt(t), `diverged at ${t}`);
      const past = (d) => d.timeline.filter((s) => s.start <= t).map(({ end, ...s }) => s);
      assert.deepEqual(past(cut), past(full));
    }
  }
});

const topSpeed = (recording) =>
  Math.max(...recording.frames.flatMap((f) => f.racers.map((r) => r.speed)));

for (const [label, { course, recording }] of Object.entries({ hilly, live }))
  test(`The eye moves smoothly within a shot (${label})`, () => {
    const director = createDirector(recording, course);
    const step = 0.05;
    let worst = 0;
    for (const shot of director.timeline)
      for (let t = shot.start; t + step < shot.end; t += step) {
        const a = director.shotAt(t).eye,
          b = director.shotAt(t + step).eye;
        worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / step);
      }
    const cap = 1.4 * topSpeed(recording);
    assert.ok(worst < cap, `eye speed peaked at ${worst.toFixed(1)} m/s, cap ${cap.toFixed(1)}`);
  });

test("Chase and side-track cameras keep up with racers at full speed", () => {
  for (const { course, recording } of [fixture, live]) {
    assert.ok(topSpeed(recording) > 30 * speedScale, "racers fly at the scaled speed");
    const director = createDirector(recording, course);
    for (const shot of director.timeline) {
      if (shot.shot !== "chase" && shot.shot !== "leader") continue;
      for (let t = shot.start; t < shot.end; t += 0.5) {
        const { eye } = director.shotAt(t);
        const p = sampleRace(recording, t).racers.find((r) => r.id === shot.subject).position;
        const d = Math.hypot(eye[0] - p[0], eye[1] - p[1], eye[2] - p[2]);
        assert.ok(d < 45 * creatureScale, `${shot.shot} ${d.toFixed(1)} m from its subject at ${t}`);
      }
    }
  }
});

test("The rider cam sits behind and above the saddle, looking along the neck", () => {
  const forward = [0.6, 0.1, -0.8];
  for (const bank of [0, 0.5, -0.9])
    for (const size of [0.5, 1]) {
      const cam = riderCam({ position: [10, 40, 5], forward, bank, size, side: 1 });
      const toEye = cam.eye.map((v, i) => v - cam.seat[i]),
        toTarget = cam.target.map((v, i) => v - cam.seat[i]);
      const along = (v) => v.reduce((sum, x, i) => sum + x * forward[i], 0) / Math.hypot(...forward);
      assert.ok(along(toEye) < -2 && along(toTarget) > 2, "behind the rider, looking ahead");
      const reach = Math.hypot(...toEye);
      assert.ok(reach > 2.5 && reach < 4.5, `${reach.toFixed(2)} m from the saddle`);
      assert.ok(Math.abs(cam.roll) <= 0.22 + 1e-9, "limited roll");
    }
});

test("Rider shots ride along with their subject and share the screen", () => {
  const { course, recording } = live;
  const director = createDirector(recording, course);
  const riders = director.timeline.filter((s) => s.shot === "rider");
  assert.ok(riders.length > 0, "the director cuts onboard");
  const share = riders.reduce((sum, s) => sum + s.end - s.start, 0) / lastT(recording);
  assert.ok(share < 0.25, `rider cam holds ${(share * 100).toFixed(0)}% of the race`);
  for (const shot of riders)
    for (let t = shot.start; t < shot.end; t += 0.25) {
      const cam = director.shotAt(t);
      const p = sampleRace(recording, t).racers.find((r) => r.id === shot.subject).position;
      const d = Math.hypot(cam.eye[0] - p[0], cam.eye[1] - p[1], cam.eye[2] - p[2]);
      assert.ok(d < 6 * creatureScale, `${d.toFixed(1)} m from its rider at ${t}`);
      assert.ok(Math.abs(cam.roll) <= 0.22 + 1e-9 && cam.shake <= 0.3, "steady onboard");
    }
});
