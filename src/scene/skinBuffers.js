/**
 * Uploads a `makeSkinMesh` result for the racer shader: the interleaved vertices on attributes 0 to 4,
 * each vertex's metal on attribute 5 and its markings on attribute 6. Returns the vertex array, its buffers and the vertex count.
 * @param {WebGL2RenderingContext} gl
 * @param {{ vertices: Float32Array, metals: Float32Array, markings: Float32Array }} data
 */
export function uploadSkin(gl, data) {
  const vao = gl.createVertexArray(),
    buffer = gl.createBuffer(),
    metals = gl.createBuffer(),
    markings = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.STATIC_DRAW);
  for (const [index, size, offset] of [
    [0, 3, 0],
    [1, 3, 12],
    [2, 3, 24],
    [3, 2, 36],
    [4, 1, 44],
  ]) {
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(index, size, gl.FLOAT, false, 48, offset);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, metals);
  gl.bufferData(gl.ARRAY_BUFFER, data.metals, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(5);
  gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, markings);
  gl.bufferData(gl.ARRAY_BUFFER, data.markings, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(6);
  gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 0, 0);
  return { vao, buffers: [buffer, metals, markings], count: data.vertices.length / 12 };
}

/** Frees what `uploadSkin` made. */
export function releaseSkin(gl, mesh) {
  for (const buffer of mesh.buffers) gl.deleteBuffer(buffer);
  gl.deleteVertexArray(mesh.vao);
}
