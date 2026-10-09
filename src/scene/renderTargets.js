/**
 * A multisampled colour target with depth, resolved into colour and depth textures so the composite
 * pass can outline racers, blur and cast shadows. Alpha is the racer mask: only racers write it.
 * @param {WebGL2RenderingContext} gl
 */
export function createRenderTargets(gl) {
  const samples = Math.min(2, gl.getParameter(gl.MAX_SAMPLES));
  const msaa = gl.createFramebuffer();
  const buffers = [gl.createRenderbuffer(), gl.createRenderbuffer()];
  const texture = gl.createTexture();
  const depthTexture = gl.createTexture();
  const resolved = gl.createFramebuffer();
  let width = 0,
    height = 0;

  function resize(w, h) {
    if (w === width && h === height) return;
    width = w;
    height = h;
    gl.bindFramebuffer(gl.FRAMEBUFFER, msaa);
    [gl.RGBA8, gl.DEPTH_COMPONENT24].forEach((format, i) => {
      gl.bindRenderbuffer(gl.RENDERBUFFER, buffers[i]);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, format, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, i ? gl.DEPTH_ATTACHMENT : gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, buffers[i]);
    });
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error("Could not create the scene render target.");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, resolved);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error("Could not create the scene depth target.");
  }

  return {
    texture,
    depthTexture,
    begin(w, h) {
      resize(w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, msaa);
      gl.viewport(0, 0, w, h);
      gl.colorMask(true, true, true, true);
      gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
      gl.clearBufferfv(gl.DEPTH, 0, [1]);
    },
    worldOnly() {
      gl.colorMask(true, true, true, false);
    },
    withMask() {
      gl.colorMask(true, true, true, true);
    },
    resolve() {
      gl.colorMask(true, true, true, true);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msaa);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, resolved);
      gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    dispose() {
      gl.deleteFramebuffer(msaa);
      gl.deleteFramebuffer(resolved);
      buffers.forEach((b) => gl.deleteRenderbuffer(b));
      gl.deleteTexture(texture);
      gl.deleteTexture(depthTexture);
    },
  };
}
