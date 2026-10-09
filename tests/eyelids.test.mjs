import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { boneMatrices, inverseRigid, multiply, point } from "../src/math3d.js";
import { primitive } from "../src/geometry.js";
import { cast } from "../src/anatomy/meshCast.js";
import { eyeFrame } from "../src/anatomy/dragonEyes.js";
import { blinkOf } from "../src/animate/dragonBlink.js";
import { glanceOf } from "../src/animate/dragonGaze.js";
import { add, dot, scale, sub } from "../src/vec3.js";

const module = await loadSubject("dragon");
const standing = { effort: 0, glide: 1, stand: 1 };
const each = (run) => {
  for (const age of ["kid", "teen", "adult"])
    for (const head of age === "kid" ? [0] : [0, 1, 2, 3, 4]) run(module.createAnatomy({ ...makeGenome(module.genes, 2407), head }, { age }), `${age} head ${head}`);
};

/** The posed triangles of the parts whose ids match `pattern`, in model space. */
function posed(anatomy, pose, pattern) {
  const ids = anatomy.bones.map(({ id }) => id),
    matrices = boneMatrices(anatomy, pose),
    skinning = boneMatrices(anatomy).map((m, i) => multiply(matrices[i], inverseRigid(m)));
  const vertices = [],
    indices = [];
  for (const part of anatomy.parts.filter(({ id }) => pattern.test(id))) {
    const geometry = primitive(part),
      base = vertices.length / 3;
    for (let i = 0; i < geometry.vertices.length; i += 3) {
      const v = geometry.vertices.slice(i, i + 3);
      if (part.skin) {
        const [a, b] = part.skin.joints[i / 3].map((id) => skinning[ids.indexOf(id)]),
          w = part.skin.weights[i / 3];
        vertices.push(...add(scale(point(a, v), w), scale(point(b, v), 1 - w)));
      } else {
        const m = multiply(matrices[ids.indexOf(part.bone)], transformOf(part));
        vertices.push(...point(m, v));
      }
    }
    indices.push(...geometry.indices.map((i) => base + i));
  }
  return { vertices, indices };
}

const transformOf = ({ position, rotation, scale: size, shape }) => {
  const m = boneMatrices({ bones: [{ id: "p", position, rotation }] })[0];
  if (shape === "mesh") return m;
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) m[c * 4 + r] *= size[c];
  return m;
};

/** Points across each iris in model space, with the eye's outward direction. */
function irises(anatomy, pose) {
  const ids = anatomy.bones.map(({ id }) => id),
    head = boneMatrices(anatomy, pose)[ids.indexOf("head")],
    turn = (v) => sub(point(head, v), point(head, [0, 0, 0]));
  return [-1, 1].map((s) => {
    const { core, along, up, normal, radii } = eyeFrame(anatomy.parts.find(({ id }) => id === `eye-${s}`), s);
    const points = [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.45], [0, -0.45]].map(([x, y]) =>
      point(head, add(core, add(add(scale(along, x * radii[0]), scale(up, y * radii[1])), scale(normal, radii[2] * Math.sqrt(1 - x * x - y * y))))),
    );
    return { s, points, normal: turn(normal), reach: 4 * radii[2] };
  });
}

/** For each iris point, whether a lid lies over it, looking straight at the eye. */
function covered(anatomy, pose) {
  const lids = posed(anatomy, pose, /^lid-/),
    eyes = posed(anatomy, pose, /^(eye-|eye-rim-|pupil-)/);
  return irises(anatomy, pose).flatMap(({ points, normal, reach }) =>
    points.map((p) => {
      const from = add(p, scale(normal, reach)),
        down = scale(normal, -1);
      return cast(lids, from, down) < cast(eyes, from, down);
    }),
  );
}

test("Open eyelids never show over the eye, shut ones cover it whole, asleep too", () => {
  each((anatomy, label) => {
    assert.ok(!covered(anatomy, module.pose(anatomy, 0, standing)).some(Boolean), `${label} open`);
    assert.ok(covered(anatomy, module.pose(anatomy, 0, { ...standing, lids: 1 })).every(Boolean), `${label} shut`);
    assert.ok(covered(anatomy, module.pose(anatomy, 0, { ...standing, sleep: 1, time: 0 })).every(Boolean), `${label} asleep`);
  });
});

test("Half way through a blink the upper lid covers the top of the eye and the middle stays open", () => {
  each((anatomy, label) => {
    const pose = module.pose(anatomy, 0, { ...standing, lids: 0.5 }),
      lids = posed(anatomy, pose, /^lid-upper/),
      eyes = posed(anatomy, pose, /^(eye-|eye-rim-|pupil-)/);
    for (const { points, normal, reach } of irises(anatomy, pose)) {
      const hidden = (p) => cast(lids, add(p, scale(normal, reach)), scale(normal, -1)) < cast(eyes, add(p, scale(normal, reach)), scale(normal, -1));
      assert.ok(hidden(points[3]) && !hidden(points[0]), label);
    }
  });
});

test("Idle dragons blink now and then, quickly and the same way every time", () => {
  for (const seed of [3, 41.5, 77]) {
    const frames = Array.from({ length: 60 * 120 }, (_, i) => blinkOf(i / 60, seed));
    const shut = frames.filter((v) => v > 0.5).length / frames.length;
    assert.ok(shut > 0.005 && shut < 0.05, `seed ${seed} shut ${shut}`);
    const starts = frames.flatMap((v, i) => (v > 0.5 && !(frames[i - 1] > 0.5) ? [i / 60] : []));
    assert.ok(starts.length > 15 && starts.length < 60, `seed ${seed} ${starts.length} blinks`);
    assert.deepEqual(frames.slice(0, 600), Array.from({ length: 600 }, (_, i) => blinkOf(i / 60, seed)));
  }
});

test("Idle glances stay within reach, move smoothly and often look straight ahead", () => {
  for (const seed of [3, 41.5, 77]) {
    let ahead = 0,
      previous = glanceOf(0, seed);
    for (let i = 1; i < 60 * 60; i++) {
      const [x, y] = glanceOf(i / 60, seed);
      assert.ok(Math.abs(x) <= 1 && Math.abs(y) <= 1);
      assert.ok(Math.hypot(x - previous[0], y - previous[1]) < 0.2, `seed ${seed} at ${i / 60}`);
      if (!x && !y) ahead++;
      previous = [x, y];
    }
    assert.ok(ahead > 0.2 * 3600 && ahead < 0.8 * 3600, `seed ${seed} ahead ${ahead}`);
  }
});

test("A glancing pupil slides over the iris and never leaves it", () => {
  each((anatomy, label) => {
    for (const gaze of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, -0.7]]) {
      const pose = module.pose(anatomy, 0, { ...standing, gaze }),
        ids = anatomy.bones.map(({ id }) => id),
        matrices = boneMatrices(anatomy, pose),
        head = matrices[ids.indexOf("head")];
      for (const s of [-1, 1]) {
        const eye = anatomy.parts.find(({ id }) => id === `eye-${s}`),
          pupil = anatomy.parts.find(({ id }) => id === `pupil-${s}`),
          { core, along, up, normal, radii } = eyeFrame(eye, s),
          toEye = inverseRigid(head),
          { vertices } = primitive(pupil),
          m = multiply(matrices[ids.indexOf(pupil.bone)], transformOf(pupil));
        assert.ok(pose.bones[pupil.bone], `${label} ${gaze} moves`);
        for (let i = 0; i < vertices.length; i += 3) {
          const p = sub(point(toEye, point(m, vertices.slice(i, i + 3))), core),
            u = [dot(p, along) / radii[0], dot(p, up) / radii[1], dot(p, normal) / radii[2]];
          assert.ok(Math.acos(u[2] / Math.hypot(...u)) <= eye.cap + 1e-6, `${label} side ${s} gaze ${gaze}`);
        }
      }
    }
  });
});

test("A glum dragon's upper lids droop at the back corners and leave the middle of the eye open", () => {
  each((anatomy, label) => {
    const pose = module.pose(anatomy, 0, { ...standing, glum: 1 }),
      lids = posed(anatomy, pose, /^lid-upper/),
      eyes = posed(anatomy, pose, /^(eye-|eye-rim-|pupil-)/),
      ids = anatomy.bones.map(({ id }) => id),
      head = boneMatrices(anatomy, pose)[ids.indexOf("head")];
    for (const s of [-1, 1]) {
      const { core, along, up, normal, radii } = eyeFrame(anatomy.parts.find(({ id }) => id === `eye-${s}`), s),
        front = along[0] < 0 ? -1 : 1,
        out = sub(point(head, normal), point(head, [0, 0, 0])),
        at = (x, y) => point(head, add(core, add(add(scale(along, front * x * radii[0]), scale(up, y * radii[1])), scale(normal, radii[2] * Math.sqrt(1 - x * x - y * y))))),
        hidden = (p) => cast(lids, add(p, scale(out, 4 * radii[2])), scale(out, -1)) < cast(eyes, add(p, scale(out, 4 * radii[2])), scale(out, -1));
      assert.ok(!hidden(at(0, -0.1)), `${label} side ${s} middle`);
      const rows = [0.7, 0.55, 0.4, 0.25, 0.1],
        reach = (x) => rows.filter((y) => hidden(at(x, y))).length;
      assert.ok(reach(-0.55) > reach(0.55), `${label} side ${s} back ${reach(-0.55)} front ${reach(0.55)}`);
    }
  });
});
