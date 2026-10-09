import { makeGlProgram, glUniforms, GL_QUAD_VERTEX } from "./glProgram.js";
import { multiply, boneMatrices, camera, invert, point } from "./math3d.js";
import { makeSkinMesh } from "./skinMesh.js";
import { releaseSkin, uploadSkin } from "./scene/skinBuffers.js";
import { metalShades } from "./anatomy/metalTone.js";
import { cozyEnvironment, environments, palette } from "./palette.js";
import { styleConfig as lowPoly } from "./style/lowPoly.js";
import { styleConfig as cozy } from "./style/cozy.js";
import { racerVertex, racerFragment, studioFragment } from "./scene/shaders.js";
import { createRenderTargets } from "./scene/renderTargets.js";
import { sunFacing } from "./scene/sunLight.js";
import { toneOf } from "./scene/grade.js";
import { setMarkings } from "./scene/markingUniforms.js";

const configurations = { lowPoly, cozy };
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** Studio subjects stand in the stable yard's light: its valley sky, and the sun as it falls on a dragon at a yard spot. */
const environment = environments.valley;
const SUN = sunFacing([0.6, 0, 0.8]);

/**
 * One subject at a time on a flat background, shaded, graded and outlined exactly like a racer in
 * the scene. With `transparent`, nothing is drawn behind the subject and the canvas keeps its alpha.
 */
export function createRenderer(canvas, { transparent = false } = {}) {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: transparent,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error("WebGL 2 is required. Enable hardware acceleration and reload.");
  const subject = makeGlProgram(gl, racerVertex, racerFragment);
  const su = glUniforms(gl, subject, [
    "bones[0]",
    "model",
    "viewProjection",
    "eye",
    "sunDir",
    "zenith",
    "horizon",
    "sunColor",
    "ridgeColor",
    "haze",
    "fogDensity",
    "fillColor",
    "rimColor",
    "metalSheen[0]",
    "metalShadow[0]",
    "glow",
    "glowColor",
    "markings",
    "markingColor",
    "soft",
  ]);
  const finish = makeGlProgram(gl, GL_QUAD_VERTEX, studioFragment);
  const fu = glUniforms(gl, finish, [
    "colorTexture",
    "texel",
    "width",
    "strength",
    "ink",
    "halo",
    "background",
    "transparent",
    "tone",
    "warm",
    "cool",
  ]);
  const targets = createRenderTargets(gl);
  const emptyVao = gl.createVertexArray();
  const caches = new Map(),
    resources = new Set();
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const info = {
    vendor: gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
    renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    version: gl.getParameter(gl.VERSION),
  };
  let lost = false;
  const onLost = (event) => {
    event.preventDefault();
    lost = true;
  };
  canvas.addEventListener("webglcontextlost", onLost);
  const matrices = new Float32Array(64 * 16);

  function prepare(anatomy, round) {
    if (!caches.has(round)) caches.set(round, new WeakMap());
    const cache = caches.get(round);
    let mesh = cache.get(anatomy);
    if (mesh && !mesh.disposed) return mesh;
    if (anatomy.bones.length > 64) throw new Error("Anatomy exceeds 64 bones");
    const data = makeSkinMesh(anatomy, { round });
    mesh = { ...uploadSkin(gl, data), inverseBind: data.inverseBind };
    cache.set(anatomy, mesh);
    resources.add(mesh);
    if (resources.size > 160) {
      const oldest = resources.values().next().value;
      releaseSkin(gl, oldest);
      oldest.disposed = true;
      resources.delete(oldest);
    }
    return mesh;
  }

  function begin(options) {
    if (lost) throw new Error("WebGL context lost; reload the gallery to restore it.");
    const config = configurations[options.style || "cozy"];
    if (!config) throw new Error(`Style not available: ${options.style}`);
    targets.begin(canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(subject);
    gl.uniform3fv(su.sunDir, SUN);
    gl.uniform3fv(su.zenith, environment.skyZenith);
    gl.uniform3fv(su.horizon, environment.skyHorizon);
    gl.uniform3fv(su.sunColor, environment.sun);
    gl.uniform3fv(su.ridgeColor, environment.ridge);
    gl.uniform3fv(su.haze, environment.haze);
    gl.uniform1f(su.fogDensity, 0);
    gl.uniform1i(su.soft, config.soft ? 1 : 0);
    gl.uniform3fv(su.fillColor, environment.fill);
    gl.uniform3fv(su.rimColor, environment.rim);
    gl.uniform3fv(su["metalSheen[0]"], metalShades.sheen);
    gl.uniform3fv(su["metalShadow[0]"], metalShades.shadow);
    gl.uniform1f(su.glow, 0);
    gl.uniform3fv(su.glowColor, palette.hatchGlow);
    gl.uniformMatrix4fv(su.model, false, IDENTITY);
    return config;
  }

  function end(config, options) {
    targets.resolve();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(finish);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets.texture);
    gl.uniform1i(fu.colorTexture, 0);
    gl.uniform2f(fu.texel, 1 / canvas.width, 1 / canvas.height);
    gl.uniform1f(fu.width, 1.3 * Math.max(1, canvas.height / 720));
    gl.uniform1f(fu.strength, config.edge);
    gl.uniform3fv(fu.ink, palette.ink);
    gl.uniform3fv(fu.halo, environment.halo);
    gl.uniform3fv(fu.background, options.background || palette.background);
    gl.uniform1i(fu.transparent, transparent ? 1 : 0);
    const { grade } = config.soft ? cozyEnvironment(environment) : environment;
    gl.uniform4fv(fu.tone, toneOf(grade));
    gl.uniform3fv(fu.warm, grade.warm);
    gl.uniform3fv(fu.cool, grade.cool);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function draw(anatomy, pose, options, rect) {
    const config = configurations[options.style || "cozy"];
    const mesh = prepare(anatomy, config.round ?? 0);
    boneMatrices(anatomy, pose).forEach((matrix, index) => matrices.set(multiply(matrix, mesh.inverseBind[index]), index * 16));
    const view = camera(
      options.center ?? anatomy.bounds.center,
      anatomy.bounds.radius,
      rect[2] / rect[3],
      options.yaw ?? -0.6,
      options.pitch ?? 0.2,
      options.zoom ?? 1,
    );
    gl.uniformMatrix4fv(su["bones[0]"], false, matrices);
    setMarkings(gl, su, anatomy);
    gl.uniformMatrix4fv(su.viewProjection, false, view);
    gl.uniform3fv(su.eye, point(invert(view), [0, 0, -1]));
    gl.bindVertexArray(mesh.vao);
    gl.viewport(...rect);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    return { triangles: mesh.count / 3, bounds: anatomy.bounds };
  }

  return {
    info,
    render(anatomy, pose, options = {}) {
      const frame = begin(options);
      const result = draw(anatomy, pose, options, [0, 0, canvas.width, canvas.height]);
      end(frame, options);
      return result;
    },
    renderBatch(instances, options = {}) {
      const frame = begin(options);
      const columns = options.columns || 4,
        rows = Math.max(1, Math.ceil(instances.length / columns));
      const w = Math.floor(canvas.width / columns),
        h = Math.floor(canvas.height / rows);
      const result = instances.map((entry, index) =>
        draw(entry.anatomy, entry.pose, options, [(index % columns) * w, (rows - 1 - Math.floor(index / columns)) * h, w, h]),
      );
      end(frame, options);
      return result;
    },
    readPixels() {
      const data = new Uint8Array(canvas.width * canvas.height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return { data, width: canvas.width, height: canvas.height };
    },
    dispose() {
      canvas.removeEventListener("webglcontextlost", onLost);
      for (const resource of resources) {
        releaseSkin(gl, resource);
      }
      resources.clear();
      targets.dispose();
      gl.deleteVertexArray(emptyVao);
      gl.deleteProgram(subject);
      gl.deleteProgram(finish);
    },
  };
}
