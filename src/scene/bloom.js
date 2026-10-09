import { makeGlProgram, glUniforms, GL_QUAD_VERTEX } from "../glProgram.js";
import { bloomDownFragment, bloomUpFragment } from "./shaders.js";

const LEVELS = 5;

/**
 * The hoops' halo, kept off the full-resolution image: emissive geometry is drawn into a
 * half-resolution source (`begin`), stepped down four mips and tented back up to quarter
 * resolution (`blur`), where the composite pass reads it (`texture`, `texel`).
 * @param {WebGL2RenderingContext} gl
 */
export function createBloom(gl) {
  const float = !!gl.getExtension("EXT_color_buffer_float");
  const levels = Array.from({ length: LEVELS }, () => ({ texture: gl.createTexture(), framebuffer: gl.createFramebuffer(), w: 0, h: 0 }));
  const down = makeGlProgram(gl, GL_QUAD_VERTEX, bloomDownFragment),
    up = makeGlProgram(gl, GL_QUAD_VERTEX, bloomUpFragment);
  const uniforms = new Map([down, up].map((p) => [p, glUniforms(gl, p, ["source", "texel"])]));
  let width = 0,
    height = 0;

  function resize(w, h) {
    if (w === width && h === height) return;
    width = w;
    height = h;
    levels.forEach((level, i) => {
      level.w = Math.max(1, Math.ceil(w / 2 ** (i + 1)));
      level.h = Math.max(1, Math.ceil(h / 2 ** (i + 1)));
      gl.bindTexture(gl.TEXTURE_2D, level.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, level.w, level.h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, level.w, level.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, level.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, level.texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
        throw new Error("Could not create the bloom target.");
    });
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  function pass(program, from, to, reach) {
    const u = uniforms.get(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, to.framebuffer);
    gl.viewport(0, 0, to.w, to.h);
    gl.useProgram(program);
    gl.bindTexture(gl.TEXTURE_2D, from.texture);
    gl.uniform1i(u.source, 0);
    gl.uniform2f(u.texel, reach / from.w, reach / from.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return {
    get texture() {
      return levels[1].texture;
    },
    get texel() {
      return [0.5 / (levels[1].w || 1), 0.5 / (levels[1].h || 1)];
    },
    /** Binds and clears the half-resolution source for a `w`×`h` frame; returns its size. */
    begin(w, h) {
      resize(w, h);
      const [source] = levels;
      gl.bindFramebuffer(gl.FRAMEBUFFER, source.framebuffer);
      gl.viewport(0, 0, source.w, source.h);
      gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 1]);
      return [source.w, source.h];
    },
    /** Blurs the source down the mips and back up; `reach` scales the tap spacing. Expects the empty VAO bound. */
    blur(reach) {
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0);
      for (let i = 1; i < LEVELS; i++) pass(down, levels[i - 1], levels[i], reach);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = LEVELS - 1; i > 1; i--) pass(up, levels[i], levels[i - 1], reach);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    dispose() {
      for (const level of levels) {
        gl.deleteTexture(level.texture);
        gl.deleteFramebuffer(level.framebuffer);
      }
      gl.deleteProgram(down);
      gl.deleteProgram(up);
    },
  };
}
