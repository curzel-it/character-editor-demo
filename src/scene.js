import { makeGlProgram, glUniforms, GL_QUAD_VERTEX } from "./glProgram.js";
import { multiply, boneMatrices, transform, point, perspective, lookAt, invert, orientation } from "./math3d.js";
import { makeSkinMesh } from "./skinMesh.js";
import { releaseSkin, uploadSkin } from "./scene/skinBuffers.js";
import { metalShades } from "./anatomy/metalTone.js";
import { cozyEnvironment, environmentOf, palette } from "./palette.js";
import { styleConfig as lowPoly } from "./style/lowPoly.js";
import { styleConfig as cozy } from "./style/cozy.js";
import { terrainHeight } from "./course/terrainHeight.js";
import { creatureScale, lengthScale } from "./worldScale.js";
import { buildTerrainMesh } from "./scene/terrainMesh.js";
import { buildDressingMesh } from "./scene/dressingMesh.js";
import { softenDressing } from "./scene/softenDressing.js";
import { mergeMeshes } from "./scene/meshBuilder.js";
import { bakeLighting } from "./scene/bakeLighting.js";
import { createRenderTargets } from "./scene/renderTargets.js";
import * as shaders from "./scene/shaders.js";
import { toneOf } from "./scene/grade.js";
import { setMarkings } from "./scene/markingUniforms.js";
import { waterVertex, waterFragment } from "./scene/waterShaders.js";
import { buildWaterMesh } from "./scene/waterMesh.js";
import * as speedShaders from "./scene/speedShaders.js";
import { buildTrailRibbons } from "./scene/trailRibbons.js";
import * as breathShaders from "./scene/breathShaders.js";
import { breathEmitter, createBreathPlume } from "./scene/breathPlume.js";
import { statusEmitters, statusTint } from "./scene/statusAura.js";
import { createElementalManes, maneEmitter } from "./scene/elementalMane.js";
import { createShadowMaps } from "./scene/shadowMaps.js";
import { createBloom } from "./scene/bloom.js";
import { buildSplash } from "./scene/splash.js";
import { racerBoxes } from "./scene/racerBoxes.js";
import { SUN } from "./scene/sunLight.js";
import { gateMarker, markerVertex, markerFragment } from "./scene/gateMarker.js";

const configurations = { lowPoly, cozy };
const m = (v) => v * lengthScale;
// Near plane sized to the racers, far plane to the scaled world: 24-bit depth still resolves
// about a metre at 5 km and a few metres at 10 km, where only terrain and fog remain.
const NEAR = 1.5 * creatureScale,
  FAR = m(16000);
// Air motes wrap in a box around the eye, sized to the racers.
const STREAK_BOX = 110 * creatureScale,
  STREAK_COUNT = 3000;
// The next-gate arrow in the UI's accent and navy (`--dz-accent`, `--dz-navy`).
const MARKER_COLOR = [1, 0.784, 0.239],
  MARKER_SHADOW = [0.118, 0.165, 0.227];
const ATMOSPHERE = ["eye", "sunDir", "zenith", "horizon", "sunColor", "ridgeColor", "haze", "fogDensity", "fogStart", "bend", "bendFrom"];


/** The emissive triangles of a flat triangle-soup mesh (hoops, start and finish posts): what the bloom draws. */
function emissiveOf(mesh) {
  const keep = [];
  for (let t = 0; t < mesh.positions.length / 9; t++) if (mesh.colors[t * 12 + 3] > 0) keep.push(t);
  const pick = (data, size) => {
    const out = new Float32Array(keep.length * size * 3);
    keep.forEach((t, i) => out.set(data.subarray(t * size * 3, (t + 1) * size * 3), i * size * 3));
    return out;
  };
  return { positions: pick(mesh.positions, 3), colors: pick(mesh.colors, 4), surface: pick(mesh.surface, 2), normals: pick(mesh.normals, 3) };
}

/**
 * Builds the perspective view-projection for a director shot `{ eye, target, up, fov, shift }`.
 * `shift` is a vertical lens shift in clip units: 0.4 draws the target 40% of the way to the top edge.
 * `span`, the tangent of a horizontal half-angle that must stay in frame, widens `fov` on narrow canvases.
 * `near` brings the near plane in for a lens right on a racer (onboard views), at some depth precision.
 */
export function shotMatrix(shot, aspect) {
  const fov = Math.max(shot.fov ?? 0.9, shot.span ? 2 * Math.atan(shot.span / aspect) : 0);
  const matrix = multiply(
    perspective(Math.min(fov, 2.4), aspect, shot.near ?? NEAR, FAR),
    lookAt(shot.eye, shot.target, shot.up ?? [0, 1, 0]),
  );
  const shift = shot.shift ?? 0;
  if (shift) for (const k of [0, 4, 8, 12]) matrix[k + 1] += shift * matrix[k + 3];
  return matrix;
}

/**
 * The scene renderer for `canvas`. While the WebGL context is lost frames are skipped, and once the
 * browser restores it every GPU resource is built again.
 */
export function createSceneRenderer(canvas) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) throw new Error("WebGL 2 is required. Enable hardware acceleration and reload.");
  let scene = null;
  const build = () => {
    try {
      scene = sceneOnContext(canvas, gl);
    } catch (error) {
      if (!gl.isContextLost()) throw error;
    }
  };
  const onLost = (event) => {
    event.preventDefault();
    scene = null;
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", build);
  if (!gl.isContextLost()) build();
  return {
    get info() {
      return scene?.info ?? null;
    },
    render(frame) {
      if (scene && !gl.isContextLost()) return scene.render(frame);
      return { triangles: 0, viewProjection: shotMatrix(frame.camera, canvas.width / canvas.height) };
    },
    finish() {
      scene?.finish();
    },
    dispose() {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", build);
      scene?.dispose();
      scene = null;
    },
  };
}

/** @param {HTMLCanvasElement} canvas @param {WebGL2RenderingContext} gl */
function sceneOnContext(canvas, gl) {
  const program = (vertex, fragment, names) => {
    const p = makeGlProgram(gl, vertex, fragment);
    return { p, u: glUniforms(gl, p, [...ATMOSPHERE, ...names]) };
  };
  const sky = program(shaders.skyVertex, shaders.skyFragment, ["inverseViewProjection", "ridgeHeight"]);
  const world = program(shaders.worldVertex, shaders.worldFragment, [
    "viewProjection",
    "fillColor",
    "bounceColor",
    "strata[0]",
    "lightMap",
    "lightArea",
    "lightSoft",
    "propLight",
    "shadowLift",
    "emissive",
    "backdrop",
    "opacity",
    "soft",
  ]);
  const water = program(waterVertex, waterFragment, [
    "viewProjection",
    "fillColor",
    "shadowLift",
    "lightMap",
    "lightArea",
    "lightSoft",
    "time",
    "deepColor",
    "shallowColor",
    "foamColor",
    "skyTint",
    "fresnel",
    "glitter",
    "shape",
  ]);
  const glow = program(shaders.glowVertex, shaders.glowFragment, ["viewProjection", "depthTexture", "viewport", "clip", "distant", "slack"]);
  const racer = program(shaders.racerVertex, shaders.racerFragment, [
    "bones[0]",
    "model",
    "viewProjection",
    "fillColor",
    "rimColor",
    "metalSheen[0]",
    "metalShadow[0]",
    "glow",
    "glowColor",
    "markings",
    "markingColor",
    "coatCount",
    "coat[0]",
    "coatLook[0]",
    "mudColor",
    "foamColor",
    "soft",
  ]);
  const coatSpots = new Float32Array(12 * 4),
    coatLooks = new Float32Array(12 * 2);
  const streak = program(speedShaders.streakVertex, speedShaders.streakFragment, [
    "viewProjection",
    "previousViewProjection",
    "box",
    "exposure",
    "viewport",
    "lineWidth",
    "color",
    "strength",
  ]);
  const trail = program(speedShaders.trailVertex, speedShaders.trailFragment, ["viewProjection", "color"]);
  const breath = program(breathShaders.breathVertex, breathShaders.breathFragment, ["viewProjection", "bloomPass"]);
  const thermal = program(shaders.thermalVertex, shaders.thermalFragment, [
    "viewProjection",
    "base",
    "radius",
    "height",
    "time",
    "tint",
  ]);
  const marker = program(markerVertex, markerFragment, ["viewProjection", "color", "depthTexture"]);
  const composite = program(GL_QUAD_VERTEX, shaders.compositeFragment, [
    "colorTexture",
    "texel",
    "width",
    "strength",
    "ink",
    "halo",
    "depthTexture",
    "inverseViewProjection",
    "previousViewProjection",
    "blur",
    "shadowColor",
    "casterCount",
    "casters[0]",
    "shadowAtlas",
    "vignette",
    "tone",
    "warm",
    "cool",
    "racerCount",
    "racerBoxes[0]",
    "bloomTexture",
    "bloomTexel",
    "bloom",
  ]);
  const targets = createRenderTargets(gl);
  const shadowMaps = createShadowMaps(gl);
  const bloom = createBloom(gl);
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const info = {
    vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
    renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    version: gl.getParameter(gl.VERSION),
  };
  const lightMap = gl.createTexture();
  const emptyVao = gl.createVertexArray();
  const trailVao = gl.createVertexArray(),
    trailBuffer = gl.createBuffer();
  gl.bindVertexArray(trailVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, trailBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
  gl.bindVertexArray(null);
  const breathVao = gl.createVertexArray(),
    breathBuffer = gl.createBuffer();
  gl.bindVertexArray(breathVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, breathBuffer);
  [3, 2, 4, 2].reduce((offset, size, i) => {
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, size, gl.FLOAT, false, 44, offset);
    return offset + size * 4;
  }, 0);
  gl.bindVertexArray(null);
  const markerVao = gl.createVertexArray(),
    markerBuffer = gl.createBuffer();
  gl.bindVertexArray(markerVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, markerBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  const plume = createBreathPlume();
  const manes = createElementalManes();
  const splashVao = gl.createVertexArray(),
    splashBuffers = [gl.createBuffer(), gl.createBuffer(), gl.createBuffer(), gl.createBuffer()];
  gl.bindVertexArray(splashVao);
  [3, 4, 2, 3].forEach((size, i) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, splashBuffers[i]);
    gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(i, size, gl.FLOAT, false, 0, 0);
  });
  gl.bindVertexArray(null);
  const racerMeshes = new Map(),
    racerResources = new Set();
  const matrices = new Float32Array(64 * 16);
  let courseMeshes = null;
  let environment = environmentOf(null);
  const cylinder = (() => {
    const data = [],
      sides = 28;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2,
        b = ((i + 1) / sides) * Math.PI * 2;
      const p = (angle, y) => [Math.cos(angle), y, Math.sin(angle)];
      data.push(...p(a, 0), ...p(b, 0), ...p(b, 1), ...p(a, 0), ...p(b, 1), ...p(a, 1));
    }
    const vao = gl.createVertexArray(),
      buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    return { vao, buffer, count: data.length / 3 };
  })();

  function staticMesh(mesh) {
    const vao = gl.createVertexArray();
    const buffers = [gl.createBuffer(), gl.createBuffer(), gl.createBuffer(), gl.createBuffer()];
    gl.bindVertexArray(vao);
    [
      [mesh.positions, 3],
      [mesh.colors, 4],
      [mesh.surface, 2],
      [mesh.normals, 3],
    ].forEach(([data, size], i) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, size, gl.FLOAT, false, 0, 0);
    });
    let indexBuffer = null;
    if (mesh.indices) {
      indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    }
    gl.bindVertexArray(null);
    return {
      vao,
      buffers: indexBuffer ? [...buffers, indexBuffer] : buffers,
      count: mesh.indices ? mesh.indices.length : mesh.positions.length / 3,
      indexed: !!mesh.indices,
    };
  }

  /** Uploads a per-frame mesh in the world layout (splash, props) and binds it for drawing. */
  function streamMesh(mesh) {
    gl.bindVertexArray(splashVao);
    [mesh.positions, mesh.colors, mesh.surface, mesh.normals].forEach((data, i) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, splashBuffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    });
  }

  function waterMesh(mesh) {
    const vao = gl.createVertexArray(),
      buffers = [gl.createBuffer(), gl.createBuffer()];
    gl.bindVertexArray(vao);
    [
      [mesh.positions, 3],
      [mesh.banks, 2],
    ].forEach(([data, size], i) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[i]);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, size, gl.FLOAT, false, 0, 0);
    });
    gl.bindVertexArray(null);
    return { vao, buffers, count: mesh.positions.length / 3 };
  }

  function releaseMesh(mesh) {
    if (!mesh) return;
    mesh.buffers.forEach((b) => gl.deleteBuffer(b));
    gl.deleteVertexArray(mesh.vao);
  }

  function releaseCourse() {
    if (!courseMeshes) return;
    for (const mesh of [courseMeshes.terrain, courseMeshes.dressing, courseMeshes.growth, courseMeshes.glow, courseMeshes.water, courseMeshes.building, courseMeshes.buildingGlow]) releaseMesh(mesh);
    courseMeshes.screens.flat().forEach(releaseMesh);
    courseMeshes = null;
  }

  function uploadLighting(bake) {
    gl.bindTexture(gl.TEXTURE_2D, lightMap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, bake.columns, bake.rows, 0, gl.RGBA, gl.FLOAT, bake.data);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const { origin, texel, columns, rows, drop } = bake;
    return {
      area: [origin[0] - texel / 2, origin[1] - texel / 2, 1 / (columns * texel), 1 / (rows * texel)],
      soft: [-0.2 * drop, 0.9 * drop],
      nudge: bake.nudge ?? 0,
    };
  }

  // A dressing's styled pieces in the version a style draws: the plain one, or the soft one rounded by `round`.
  const styledOf = (dressing, round, near) => (dressing.styled ? staticMesh(round ? softenDressing(dressing.styled.soft, round, near) : dressing.styled.flat) : null);
  const withPlain = (mesh) => (mesh.styled ? mergeMeshes(mesh, mesh.styled.flat) : mesh);
  // Each of the course's screens as the meshes a style draws for it.
  const screensOf = (course, round) => (course.screens ?? []).map(({ mesh }) => [staticMesh(softenDressing(mesh, round, course.near)), styledOf(mesh, round, course.near)].filter(Boolean));

  /** The course's meshes, its dressing and building rounded by `round` (a style's `scenery`), their styled pieces picked by it. */
  function prepareCourse(course, round) {
    if (courseMeshes?.course === course && courseMeshes.round === round) return courseMeshes;
    if (courseMeshes?.course === course) {
      releaseMesh(courseMeshes.dressing);
      releaseMesh(courseMeshes.building);
      releaseMesh(courseMeshes.growth);
      courseMeshes.growth = styledOf(courseMeshes.flat, round, course.near);
      courseMeshes.dressing = staticMesh(softenDressing(courseMeshes.flat, round, course.near));
      courseMeshes.building = course.building ? staticMesh(softenDressing(course.building, round, course.near)) : null;
      courseMeshes.screens.flat().forEach(releaseMesh);
      courseMeshes.screens = screensOf(course, round);
      courseMeshes.round = round;
      return courseMeshes;
    }
    releaseCourse();
    const dressing = course.dressing ?? buildDressingMesh(course);
    courseMeshes = {
      course,
      round,
      flat: dressing,
      terrain: staticMesh(buildTerrainMesh(course)),
      dressing: staticMesh(softenDressing(dressing, round, course.near)),
      growth: styledOf(dressing, round, course.near),
      glow: staticMesh(emissiveOf(dressing)),
      building: course.building ? staticMesh(softenDressing(course.building, round, course.near)) : null,
      buildingGlow: course.building ? staticMesh(emissiveOf(course.building)) : null,
      screens: screensOf(course, round),
      water: waterMesh(buildWaterMesh(course)),
      lighting: uploadLighting(bakeLighting(course, withPlain(course.casters ?? dressing), environmentOf(course).sunDir ?? SUN)),
      thermals: course.thermals.map((t) => {
        const ground = terrainHeight(course.terrain, t.position[0], t.position[2]);
        return { base: [t.position[0], ground, t.position[2]], radius: t.radius, height: t.position[1] - ground + m(120) };
      }),
    };
    return courseMeshes;
  }

  /** Mud and lather spots on a racer (`racer.coat`: `{ at, radius, mud, foam }` in its rest pose), up to 12. */
  function setCoat(spots = []) {
    const count = Math.min(12, spots.length);
    for (let i = 0; i < count; i++) {
      coatSpots.set([...spots[i].at, spots[i].radius], i * 4);
      coatLooks.set([spots[i].mud, spots[i].foam], i * 2);
    }
    gl.uniform1i(racer.u.coatCount, count);
    if (!count) return;
    gl.uniform4fv(racer.u["coat[0]"], coatSpots);
    gl.uniform2fv(racer.u["coatLook[0]"], coatLooks);
  }

  function prepareRacer(anatomy, round) {
    if (!racerMeshes.has(round)) racerMeshes.set(round, new WeakMap());
    let mesh = racerMeshes.get(round).get(anatomy);
    if (mesh && !mesh.disposed) return mesh;
    if (anatomy.bones.length > 64) throw new Error("Anatomy exceeds 64 bones");
    const data = makeSkinMesh(anatomy, { round });
    const root = anatomy.bones[0].position;
    mesh = {
      ...uploadSkin(gl, data),
      inverseBind: data.inverseBind,
      offset: transform(root.map((v) => -v)),
    };
    racerMeshes.get(round).set(anatomy, mesh);
    racerResources.add(mesh);
    if (racerResources.size > 48) {
      const oldest = racerResources.values().next().value;
      releaseSkin(gl, oldest);
      oldest.disposed = true;
      racerResources.delete(oldest);
    }
    return mesh;
  }

  function setAtmosphere(u, eye) {
    gl.uniform3fv(u.eye, eye);
    gl.uniform3fv(u.sunDir, environment.sunDir ?? SUN);
    gl.uniform3fv(u.zenith, environment.skyZenith);
    gl.uniform3fv(u.horizon, environment.skyHorizon);
    gl.uniform3fv(u.sunColor, environment.sun);
    gl.uniform3fv(u.ridgeColor, environment.ridge);
    gl.uniform3fv(u.haze, environment.haze);
    gl.uniform1f(u.fogDensity, 1 / m(environment.fogRange));
    gl.uniform1f(u.fogStart, m(environment.fogStart));
    gl.uniform2f(u.bend, environment.bend.strength / lengthScale, m(environment.bend.reach));
    gl.uniform3fv(u.bendFrom, eye);
  }

  return {
    info,
    render(frame) {
      const config = configurations[frame.style || "cozy"];
      if (!config) throw new Error(`Style not available: ${frame.style}`);
      environment = config.soft ? cozyEnvironment(environmentOf(frame.course)) : environmentOf(frame.course);
      const width = canvas.width,
        height = canvas.height;
      const shot = frame.camera;
      const viewProjection = shotMatrix(shot, width / height);
      const inverseViewProjection = invert(viewProjection);
      const previousViewProjection = frame.previousCamera
        ? shotMatrix(frame.previousCamera, width / height)
        : viewProjection;
      const motion = { blur: 0, streaks: 0, trails: 0, ...frame.motion };
      const meshes = prepareCourse(frame.course, config.scenery ?? 0);
      const time = frame.time ?? 0;
      let triangles = 0;

      targets.begin(width, height);
      targets.worldOnly();
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.useProgram(sky.p);
      setAtmosphere(sky.u, shot.eye);
      gl.uniformMatrix4fv(sky.u.inverseViewProjection, false, inverseViewProjection);
      gl.uniform1f(sky.u.ridgeHeight, environment.skyRidges ?? 1);
      gl.bindVertexArray(emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.useProgram(world.p);
      setAtmosphere(world.u, shot.eye);
      gl.uniformMatrix4fv(world.u.viewProjection, false, viewProjection);
      gl.uniform3fv(world.u.fillColor, environment.fill);
      gl.uniform3fv(world.u.bounceColor, environment.bounce);
      gl.uniform3fv(world.u["strata[0]"], environment.strata.flat());
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, lightMap);
      gl.uniform1i(world.u.lightMap, 4);
      gl.uniform4fv(world.u.lightArea, meshes.lighting.area);
      gl.uniform3f(world.u.lightSoft, ...meshes.lighting.soft, meshes.lighting.nudge);
      gl.uniform2f(world.u.shadowLift, environment.shadowLift.sun, environment.shadowLift.fill);
      const backdrop = environment.backdrop;
      gl.uniform2f(world.u.backdrop, backdrop?.flatten ?? 0, m(backdrop?.ranges[0]?.[0] ?? 1));
      gl.uniform3f(world.u.emissive, environment.glow.gain, environment.glow.saturation, environment.glow.clear);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(world.u.opacity, 1);
      gl.uniform1i(world.u.soft, config.soft ? 1 : 0);
      const buildingOpacity = meshes.building ? Math.max(0, Math.min(1, frame.buildingOpacity ?? 1)) : 0;
      const building = buildingOpacity > 0 ? meshes.building : null;
      const drawWorld = (mesh) => {
        gl.uniform1i(world.u.propLight, mesh === meshes.terrain ? 0 : 1);
        gl.bindVertexArray(mesh.vao);
        if (mesh.indexed) gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
        else gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
        triangles += mesh.count / 3;
      };
      drawWorld(meshes.terrain);
      drawWorld(meshes.dressing);
      if (meshes.growth) drawWorld(meshes.growth);
      if (building && buildingOpacity === 1) drawWorld(building);
      const screenOpacity = (i) => Math.max(0, Math.min(1, frame.screenOpacity?.[i] ?? 1));
      meshes.screens.forEach((parts, i) => screenOpacity(i) === 1 && parts.forEach(drawWorld));
      const splash = frame.landings?.length ? buildSplash(frame.landings, time, environment) : null;
      if (splash) {
        streamMesh(splash);
        gl.drawArrays(gl.TRIANGLES, 0, splash.positions.length / 3);
        triangles += splash.positions.length / 9;
      }
      const props = (frame.props ?? []).filter((mesh) => mesh.positions.length);
      for (const mesh of props) {
        streamMesh(mesh);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.positions.length / 3);
        triangles += mesh.positions.length / 9;
      }
      if (meshes.water.count) {
        const look = environment.waterSurface;
        gl.useProgram(water.p);
        setAtmosphere(water.u, shot.eye);
        gl.uniformMatrix4fv(water.u.viewProjection, false, viewProjection);
        gl.uniform3fv(water.u.fillColor, environment.fill);
        gl.uniform2f(water.u.shadowLift, environment.shadowLift.sun, environment.shadowLift.fill);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, lightMap);
        gl.uniform1i(water.u.lightMap, 4);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform4fv(water.u.lightArea, meshes.lighting.area);
        gl.uniform2fv(water.u.lightSoft, meshes.lighting.soft);
        gl.uniform1f(water.u.time, time);
        gl.uniform3fv(water.u.deepColor, look.deep);
        gl.uniform3fv(water.u.shallowColor, look.shallow);
        gl.uniform3fv(water.u.foamColor, look.foam);
        gl.uniform3fv(water.u.skyTint, look.sky);
        gl.uniform4f(water.u.fresnel, ...look.fresnel, look.peak);
        gl.uniform4f(water.u.glitter, ...look.glitter, look.farGlitter[1], look.farGlitter[0]);
        gl.uniform4f(water.u.shape, m(look.facet), look.tilt, m(look.shallowDepth), m(look.foamDepth));
        gl.bindVertexArray(meshes.water.vao);
        gl.drawArrays(gl.TRIANGLES, 0, meshes.water.count);
        triangles += meshes.water.count / 3;
      }

      targets.withMask();
      gl.useProgram(racer.p);
      setAtmosphere(racer.u, shot.eye);
      gl.uniformMatrix4fv(racer.u.viewProjection, false, viewProjection);
      gl.uniform3fv(racer.u.fillColor, environment.fill);
      gl.uniform3fv(racer.u.rimColor, environment.rim);
      gl.uniform3fv(racer.u.glowColor, palette.hatchGlow);
      gl.uniform3fv(racer.u.mudColor, palette.coat.mud);
      gl.uniform3fv(racer.u.foamColor, palette.coat.foam);
      gl.uniform3fv(racer.u["metalSheen[0]"], metalShades.sheen);
      gl.uniform3fv(racer.u["metalShadow[0]"], metalShades.shadow);
      gl.uniform1i(racer.u.soft, config.soft ? 1 : 0);
      const emitters = [],
        maneEmitters = [],
        casters = [];
      for (const r of frame.racers) {
        const mesh = prepareRacer(r.anatomy, config.round ?? 0);
        const bones = boneMatrices(r.anatomy, r.pose);
        bones.forEach((matrix, index) => matrices.set(multiply(matrix, mesh.inverseBind[index]), index * 16));
        const model = multiply(orientation(r.position, r.forward, r.bank ?? 0), mesh.offset);
        if (r.breath) emitters.push(breathEmitter(r, bones, model));
        if (r.aura?.length) emitters.push(...statusEmitters(r, bones, model));
        if (r.anatomy.mane) maneEmitters.push(maneEmitter(r.anatomy, matrices, model));
        gl.uniformMatrix4fv(racer.u["bones[0]"], false, matrices);
        gl.uniformMatrix4fv(racer.u.model, false, model);
        const tint = r.glow ? null : statusTint(r, time);
        gl.uniform3fv(racer.u.glowColor, r.glowColor ?? tint?.color ?? palette.hatchGlow);
        gl.uniform1f(racer.u.glow, r.glow ?? tint?.amount ?? 0);
        setCoat(r.coat);
        setMarkings(gl, racer.u, r.anatomy);
        const center = point(model, r.anatomy.bounds.center);
        const distance = Math.hypot(...center.map((v, k) => v - shot.eye[k]));
        casters.push({ mesh, bones: matrices.slice(0, bones.length * 16), model, center, radius: r.anatomy.bounds.radius, distance });
        gl.bindVertexArray(mesh.vao);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
        triangles += mesh.count / 3;
      }
      targets.worldOnly();
      // A fading building or screen goes over what stands behind it, its nearest faces alone laid down first in depth.
      const fade = (parts, opacity) => {
        gl.useProgram(world.p);
        gl.colorMask(false, false, false, false);
        parts.forEach(drawWorld);
        targets.worldOnly();
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform1f(world.u.opacity, opacity);
        parts.forEach(drawWorld);
        gl.uniform1f(world.u.opacity, 1);
        gl.disable(gl.BLEND);
        gl.depthFunc(gl.LESS);
      };
      if (building && buildingOpacity < 1) fade([building], buildingOpacity);
      meshes.screens.forEach((parts, i) => screenOpacity(i) > 0 && screenOpacity(i) < 1 && fade(parts, screenOpacity(i)));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.depthMask(false);
      gl.useProgram(thermal.p);
      setAtmosphere(thermal.u, shot.eye);
      gl.uniformMatrix4fv(thermal.u.viewProjection, false, viewProjection);
      gl.uniform1f(thermal.u.time, time);
      gl.uniform3fv(thermal.u.tint, environment.thermal);
      gl.bindVertexArray(cylinder.vao);
      for (const t of meshes.thermals) {
        gl.uniform3fv(thermal.u.base, t.base);
        gl.uniform1f(thermal.u.radius, t.radius);
        gl.uniform1f(thermal.u.height, t.height);
        gl.drawArrays(gl.TRIANGLES, 0, cylinder.count);
      }

      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const ribbons = motion.trails > 0 ? buildTrailRibbons(frame.racers, shot.eye, motion.trails) : null;
      if (ribbons?.count) {
        gl.useProgram(trail.p);
        setAtmosphere(trail.u, shot.eye);
        gl.uniformMatrix4fv(trail.u.viewProjection, false, viewProjection);
        gl.uniform3fv(trail.u.color, environment.vapour);
        gl.bindVertexArray(trailVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, trailBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, ribbons.data, gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, ribbons.count);
      }
      plume.update(emitters, time);
      const puffs = plume.build(shot.eye);
      if (puffs.count) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(breath.p);
        setAtmosphere(breath.u, shot.eye);
        gl.uniformMatrix4fv(breath.u.viewProjection, false, viewProjection);
        gl.bindVertexArray(breathVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, breathBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, puffs.data, gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, puffs.count);
        triangles += puffs.count / 3;
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
      manes.update(maneEmitters, time);
      const flames = manes.build(shot.eye);
      if (flames.count) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(breath.p);
        setAtmosphere(breath.u, shot.eye);
        gl.uniformMatrix4fv(breath.u.viewProjection, false, viewProjection);
        gl.uniform1i(breath.u.bloomPass, 0);
        gl.bindVertexArray(breathVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, breathBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flames.data, gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, flames.count);
        triangles += flames.count / 3;
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
      const sparks = frame.fireworks ? frame.fireworks.show.build(frame.fireworks.t, shot.eye) : null;
      if (sparks?.count) {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(breath.p);
        setAtmosphere(breath.u, shot.eye);
        gl.uniformMatrix4fv(breath.u.viewProjection, false, viewProjection);
        gl.uniform1i(breath.u.bloomPass, 0);
        gl.bindVertexArray(breathVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, breathBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, sparks.data, gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, sparks.count);
        triangles += sparks.count / 3;
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }
      if (motion.streaks > 0 && previousViewProjection !== viewProjection) {
        const k = Math.max(1, height / 720);
        gl.useProgram(streak.p);
        setAtmosphere(streak.u, shot.eye);
        gl.uniformMatrix4fv(streak.u.viewProjection, false, viewProjection);
        gl.uniformMatrix4fv(streak.u.previousViewProjection, false, previousViewProjection);
        gl.uniform1f(streak.u.box, STREAK_BOX);
        gl.uniform1f(streak.u.exposure, 5);
        gl.uniform2f(streak.u.viewport, width, height);
        gl.uniform1f(streak.u.lineWidth, 1.1 * k);
        gl.uniform3fv(streak.u.color, environment.airMote);
        gl.uniform1f(streak.u.strength, motion.streaks * 0.55);
        gl.bindVertexArray(emptyVao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, STREAK_COUNT);
      }
      gl.disable(gl.BLEND);
      gl.depthMask(true);

      targets.resolve();
      const shadowed = casters.sort((a, b) => a.distance - b.distance).slice(0, shaders.MAX_CASTERS);
      if (shadowed.length) shadowMaps.render(shadowed, environment.sunDir ?? SUN);
      gl.bindVertexArray(emptyVao);
      const buildingGlow = building && meshes.buildingGlow.count > 0 ? meshes.buildingGlow : null;
      const glowing = meshes.glow.count > 0 || buildingGlow || props.length > 0 || sparks?.count > 0;
      if (glowing) {
        const size = bloom.begin(width, height);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.MAX);
        gl.useProgram(glow.p);
        setAtmosphere(glow.u, shot.eye);
        gl.uniformMatrix4fv(glow.u.viewProjection, false, viewProjection);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, targets.depthTexture);
        gl.uniform1i(glow.u.depthTexture, 2);
        gl.uniform2fv(glow.u.viewport, size);
        gl.uniform2f(glow.u.clip, shot.near ?? NEAR, FAR);
        gl.uniform1f(glow.u.distant, environment.glow.distant);
        gl.uniform1f(glow.u.slack, m(2));
        gl.bindVertexArray(meshes.glow.vao);
        gl.drawArrays(gl.TRIANGLES, 0, meshes.glow.count);
        // Far hoops are thinner than a bloom texel; their edges as lines still light a pixel.
        gl.drawArrays(gl.LINES, 0, meshes.glow.count);
        if (buildingGlow) {
          gl.bindVertexArray(buildingGlow.vao);
          gl.drawArrays(gl.TRIANGLES, 0, buildingGlow.count);
        }
        // Props are seen up close: a tight depth slack keeps their far side from glowing through them.
        gl.uniform1f(glow.u.slack, 0.03);
        for (const mesh of props) {
          streamMesh(mesh);
          gl.drawArrays(gl.TRIANGLES, 0, mesh.positions.length / 3);
        }
        gl.blendEquation(gl.FUNC_ADD);
        if (sparks?.count) {
          gl.blendFunc(gl.ONE, gl.ONE);
          gl.useProgram(breath.p);
          setAtmosphere(breath.u, shot.eye);
          gl.uniformMatrix4fv(breath.u.viewProjection, false, viewProjection);
          gl.uniform1i(breath.u.bloomPass, 1);
          gl.bindVertexArray(breathVao);
          gl.drawArrays(gl.TRIANGLES, 0, sparks.count);
          gl.uniform1i(breath.u.bloomPass, 0);
        }
        gl.bindVertexArray(emptyVao);
        bloom.blur(environment.glow.reach);
      }
      gl.viewport(0, 0, width, height);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(composite.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets.texture);
      gl.uniform1i(composite.u.colorTexture, 0);
      gl.uniform2f(composite.u.texel, 1 / width, 1 / height);
      const outline = 1.3 * Math.max(1, height / 720);
      gl.uniform1f(composite.u.width, outline);
      const reach = outline * 2 + 2;
      const edges = racerBoxes(casters, viewProjection, [reach / width, reach / height], shaders.MAX_RACER_BOXES);
      gl.uniform1i(composite.u.racerCount, config.edge > 0 ? edges.count : 0);
      gl.uniform4fv(composite.u["racerBoxes[0]"], edges.boxes);
      gl.uniform1f(composite.u.strength, config.edge);
      gl.uniform1f(composite.u.vignette, environment.vignette);
      gl.uniform3fv(composite.u.ink, palette.ink);
      gl.uniform3fv(composite.u.halo, environment.halo);
      gl.uniform3fv(composite.u.shadowColor, environment.shadow);
      const { warm, cool } = environment.grade;
      gl.uniform4f(composite.u.tone, ...toneOf(environment.grade));
      gl.uniform3fv(composite.u.warm, warm);
      gl.uniform3fv(composite.u.cool, cool);
      setAtmosphere(composite.u, shot.eye);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, targets.depthTexture);
      gl.uniform1i(composite.u.depthTexture, 2);
      gl.uniformMatrix4fv(composite.u.inverseViewProjection, false, inverseViewProjection);
      gl.uniformMatrix4fv(composite.u.previousViewProjection, false, previousViewProjection);
      gl.uniform1f(composite.u.blur, motion.blur);
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, shadowMaps.texture);
      gl.uniform1i(composite.u.shadowAtlas, 3);
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, bloom.texture);
      gl.uniform1i(composite.u.bloomTexture, 5);
      gl.uniform2fv(composite.u.bloomTexel, bloom.texel);
      gl.uniform1f(composite.u.bloom, glowing ? environment.glow.halo : 0);
      gl.uniform1i(composite.u.casterCount, shadowed.length);
      if (shadowed.length) gl.uniform4fv(composite.u["casters[0]"], shadowMaps.casters);
      gl.bindVertexArray(emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const arrow = frame.marker && gateMarker(frame.marker.position, viewProjection, frame.marker.size);
      if (arrow) {
        gl.useProgram(marker.p);
        setAtmosphere(marker.u, shot.eye);
        gl.uniformMatrix4fv(marker.u.viewProjection, false, viewProjection);
        gl.uniform1i(marker.u.depthTexture, 2);
        gl.bindVertexArray(markerVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, markerBuffer);
        for (const [shape, color] of [[arrow.shadow, MARKER_SHADOW], [arrow.arrow, MARKER_COLOR]]) {
          gl.uniform3fv(marker.u.color, color);
          gl.bufferData(gl.ARRAY_BUFFER, shape, gl.STREAM_DRAW);
          gl.drawArrays(gl.TRIANGLES, 0, shape.length / 3);
        }
      }
      gl.activeTexture(gl.TEXTURE0);
      return { triangles, viewProjection };
    },
    finish() {
      const pixel = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    },
    dispose() {
      releaseCourse();
      for (const mesh of racerResources) {
        releaseSkin(gl, mesh);
      }
      racerResources.clear();
      gl.deleteTexture(lightMap);
      gl.deleteBuffer(cylinder.buffer);
      gl.deleteVertexArray(cylinder.vao);
      gl.deleteVertexArray(emptyVao);
      gl.deleteBuffer(trailBuffer);
      splashBuffers.forEach((b) => gl.deleteBuffer(b));
      gl.deleteVertexArray(splashVao);
      gl.deleteVertexArray(trailVao);
      gl.deleteBuffer(breathBuffer);
      gl.deleteVertexArray(breathVao);
      gl.deleteBuffer(markerBuffer);
      gl.deleteVertexArray(markerVao);
      targets.dispose();
      shadowMaps.dispose();
      bloom.dispose();
      for (const p of [sky, world, water, glow, racer, streak, trail, breath, thermal, marker, composite]) gl.deleteProgram(p.p);
    },
  };
}
