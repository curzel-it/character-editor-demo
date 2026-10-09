import test from "node:test";
import assert from "node:assert/strict";
import { createAltarStone, addAltarStone, altarGlowMesh } from "../src/scene/altarStone.js";
import { createBuilder } from "../src/scene/meshBuilder.js";
import { environments, palette } from "../src/palette.js";

const env = environments.valley;
const emissives = (mesh) => Array.from({ length: mesh.colors.length / 4 }, (_, i) => mesh.colors[i * 4 + 3]);

test("the altar is human-scale and the egg rests on the middle of its top", () => {
  const altar = createAltarStone({ position: [10, 2, -4], yaw: 0.7, seed: "a" });
  assert.ok(altar.top >= 1 && altar.top <= 1.4, "waist to chest high");
  assert.deepEqual(altar.eggPoint.map((v) => +v.toFixed(9)), [10, 2 + altar.top, -4]);
  assert.ok(altar.radius > 2 && altar.radius < 4);
  const builder = createBuilder();
  addAltarStone(builder, altar, env);
  const { positions } = builder.result();
  let highest = -Infinity;
  for (let i = 1; i < positions.length; i += 3) highest = Math.max(highest, positions[i]);
  assert.ok(Math.abs(highest - altar.eggPoint[1]) < 0.03, "nothing stands above the egg's resting surface");
});

test("the altar is deterministic from its seed and varies between seeds", () => {
  const a = createAltarStone({ seed: "x" }),
    b = createAltarStone({ seed: "x" }),
    c = createAltarStone({ seed: "y" });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.courses, c.courses);
});

test("the carved channels stay dark and unlit in the static stone", () => {
  const builder = createBuilder();
  addAltarStone(builder, createAltarStone(), env);
  assert.ok(emissives(builder.result()).every((e) => e === 0));
});

test("the glow mesh is empty at no glow and lights the channels with the amount given", () => {
  const altar = createAltarStone();
  assert.equal(altarGlowMesh(altar, 0, palette.elementGlow.fire, env).positions.length, 0);
  for (const glow of [0.5, 1]) {
    const e = emissives(altarGlowMesh(altar, glow, palette.elementGlow.fire, env));
    assert.ok(e.length > 0);
    assert.equal(Math.max(...e), glow);
  }
  assert.equal(Math.max(...emissives(altarGlowMesh(altar, 3, palette.elementGlow.water, env))), 1, "clamped");
});

test("the glow takes one colour, or spreads several round the altar", () => {
  const altar = createAltarStone();
  const hues = Object.values(palette.elementGlow);
  const mesh = altarGlowMesh(altar, 1, hues, env);
  const seen = new Set();
  for (let i = 0; i < mesh.colors.length; i += 4) seen.add(mesh.colors.slice(i, i + 3).join());
  for (const hue of hues) assert.ok(seen.has(Float32Array.from(hue).join()), `lights ${hue}`);
  const single = altarGlowMesh(altar, 1, hues[0], env);
  const lit = new Set();
  for (let i = 0; i < single.colors.length; i += 4) if (single.colors[i + 3] === 1) lit.add(single.colors.slice(i, i + 3).join());
  assert.deepEqual([...lit], [Float32Array.from(hues[0]).join()]);
});
