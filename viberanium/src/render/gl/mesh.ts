export type Mesh = {
  vao: WebGLVertexArrayObject;
  indexCount: number;
};

export const destroyMesh = (gl: WebGL2RenderingContext, mesh: Mesh): void => {
  gl.deleteVertexArray(mesh.vao);
};

export const createInterleavedMesh = (
  gl: WebGL2RenderingContext,
  vertices: Float32Array,
  indices: Uint32Array,
): Mesh => {
  // layout: position.xyz normal.xyz uv.xy (8 floats)
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  const ibo = gl.createBuffer();
  if (!vao || !vbo || !ibo) throw new Error('create VAO/VBO/IBO failed');

  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  const stride = 8 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);

  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);

  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return { vao, indexCount: indices.length };
};

export type SkinnedMesh = Mesh & { jointCount: number };

export const createSkinnedMesh = (
  gl: WebGL2RenderingContext,
  vertices: Float32Array, // pos/nrm/uv
  joints: Uint16Array, // 4 per vertex
  weights: Float32Array, // 4 per vertex
  indices: Uint32Array,
  jointCount: number,
): SkinnedMesh => {
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  const jbo = gl.createBuffer();
  const wbo = gl.createBuffer();
  const ibo = gl.createBuffer();
  if (!vao || !vbo || !jbo || !wbo || !ibo) throw new Error('create VAO buffers failed');

  gl.bindVertexArray(vao);

  // attributes 0-2 same as static mesh (pos/nrm/uv)
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  const stride = 8 * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 3 * 4);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 6 * 4);

  // joints (u16vec4) at location 3
  gl.bindBuffer(gl.ARRAY_BUFFER, jbo);
  gl.bufferData(gl.ARRAY_BUFFER, joints, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(3);
  gl.vertexAttribIPointer(3, 4, gl.UNSIGNED_SHORT, 0, 0);

  // weights (vec4) at location 4
  gl.bindBuffer(gl.ARRAY_BUFFER, wbo);
  gl.bufferData(gl.ARRAY_BUFFER, weights, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(4);
  gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return { vao, indexCount: indices.length, jointCount };
};

