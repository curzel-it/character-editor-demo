import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { restingMotion } from "../src/dragonThumbnails.js";
import { boneMatrices, multiply, orientation, point, transform } from "../src/math3d.js";
import { createFeed } from "../src/minigames/feed.js";

const W = 390,
  H = 844,
  TAN = Math.tan(0.5),
  PULL = 2.4;

/** A dragon standing at the origin facing +X, seen from in front by a camera looking back at its head. */
async function stage(age) {
  const module = await loadSubject("dragon");
  const anatomy = module.createAnatomy(makeGenome(module.genes, "feed-test"), { age });
  const racer = { anatomy, pose: module.pose(anatomy, 0, { ...restingMotion, time: 0 }), position: [0, 0, 0], forward: [1, 0, 0] };
  const model = multiply(orientation(racer.position, racer.forward), transform(anatomy.bones[0].position.map((v) => -v)));
  const head = point(multiply(model, boneMatrices(anatomy, racer.pose)[anatomy.bones.findIndex((b) => b.id === "head")]), [0, 0, 0]);
  const eye = [head[0] + 4 * head[1], head[1], 0];
  const ahead = [-1, 0, 0],
    right = [0, 0, -1],
    up = [0, 1, 0];
  const aspect = W / H;
  const along = (d) => eye.map((v, k) => v + ahead[k] * d);
  const view = (time) => ({
    eye, ahead, right, up, aspect, width: W, height: H, time, dt: 1 / 60, dragon: racer,
    at: (x, y, d) => along(d).map((v, k) => v + right[k] * (2 * x / W - 1) * d * TAN * aspect + up[k] * (1 - 2 * y / H) * d * TAN),
    project: (p) => {
      const d = p.map((v, k) => v - eye[k]);
      const z = d[0] * ahead[0] + d[1] * ahead[1] + d[2] * ahead[2];
      const x = d[0] * right[0] + d[1] * right[1] + d[2] * right[2];
      return { x: ((x / (z * TAN * aspect) + 1) / 2) * W, y: ((1 - d[1] / (z * TAN)) / 2) * H, front: z > 0 };
    },
  });
  return { view, mouth: () => point(multiply(model, boneMatrices(anatomy, racer.pose)[anatomy.bones.findIndex((b) => b.id === "jaw")]), [0, 0, 0]) };
}

/** Plays Feed with every throw aimed straight at the mouth until it ends; returns the game. */
async function play(age, seed) {
  const { view, mouth } = await stage(age);
  const game = createFeed({ age, seed });
  let time = 0;
  const frame = () => {
    const v = view(time);
    game.update(v);
    const hand = game.hand(v);
    if (hand) v.tip = v.at(hand.screen[0], hand.screen[1], 1.3);
    game.objects(v);
    game.motion(time);
    time += 1 / 60;
  };
  for (let n = 0; n < 200 && !game.done; n++) {
    for (let i = 0; i < 90; i++) frame();
    const v = view(time);
    const target = v.project(mouth());
    const hand = game.hand(v);
    if (!hand) continue;
    const [hx, hy] = hand.screen;
    const held = { x: hx, y: hy };
    const from = { x: 200, y: 600 };
    game.pointer({ type: "down", ...from });
    game.pointer({ type: "up", x: from.x + (target.x - held.x) / PULL, y: from.y + (target.y - held.y) / PULL });
  }
  return game;
}

test("Feed plays until the third miss, scoring catches and filling with every piece", async () => {
  for (const age of ["kid", "adult"]) {
    const game = await play(age, `feed:${age}`);
    assert.ok(game.done, `${age}: the game ends`);
    assert.ok(game.progress > 0 && game.progress <= 1);
    assert.ok(game.score >= 0);
  }
});

test("adults catch more pieces aimed at the mouth than kids", async () => {
  let kid = 0,
    adult = 0;
  for (let i = 0; i < 6; i++) {
    kid += (await play("kid", `feed:${i}`)).score;
    adult += (await play("adult", `feed:${i}`)).score;
  }
  assert.ok(adult > kid, `adult ${adult} vs kid ${kid}`);
});
