import { makeGlProgram, glUniforms } from "../glProgram.js";
import { shadowMapVertex, shadowMapFragment, MAX_CASTERS } from "./shaders.js";

const GRID = 4,
  TILE = 512;

/**
 * @typedef {{ mesh: { vao: WebGLVertexArrayObject, count: number }, bones: Float32Array,
 *   model: Float32Array, center: number[], radius: number }} ShadowCaster
 */

/**
 * Sun shadow maps for the racers: each caster's posed mesh is rendered along the sun into its own
 * tile of a depth atlas, framed on its bounds. `casters` packs, per tile, the world centre and the
 * tile's half size for the composite pass.
 * @param {WebGL2RenderingContext} gl
 */
export function createShadowMaps(gl) {
  const size = GRID * TILE;
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
    throw new Error("Could not create the shadow map target.");
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const program = makeGlProgram(gl, shadowMapVertex, shadowMapFragment);
  const u = glUniforms(gl, program, ["bones[0]", "model", "caster", "sunDir"]);
  const casters = new Float32Array(MAX_CASTERS * 4);

  return {
    texture,
    casters,
    grid: GRID,
    /**
     * @param {ShadowCaster[]} list at most MAX_CASTERS, in tile order
     * @param {number[]} sun unit vector toward the sun
     */
    render(list, sun) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, size, size);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.clearBufferfv(gl.DEPTH, 0, [1]);
      gl.useProgram(program);
      gl.uniform3fv(u.sunDir, sun);
      list.forEach((c, i) => {
        const half = c.radius * 1.2;
        casters.set([...c.center, half], i * 4);
        gl.viewport((i % GRID) * TILE, Math.floor(i / GRID) * TILE, TILE, TILE);
        gl.uniform4f(u.caster, c.center[0], c.center[1], c.center[2], half);
        gl.uniformMatrix4fv(u["bones[0]"], false, c.bones);
        gl.uniformMatrix4fv(u.model, false, c.model);
        gl.bindVertexArray(c.mesh.vao);
        gl.drawArrays(gl.TRIANGLES, 0, c.mesh.count);
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    dispose() {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
    },
  };
}
