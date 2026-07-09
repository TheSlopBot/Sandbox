export type Mesh = {
  vao: WebGLVertexArrayObject;
  indexCount: number;
  boundsMin: readonly [number, number, number];
  boundsMax: readonly [number, number, number];
  boundsCenter: readonly [number, number, number];
  boundsRadius: number;
};

export const destroyMesh = (gl: WebGL2RenderingContext, mesh: Mesh): void => {
  gl.deleteVertexArray(mesh.vao);
};

const computeBounds = (
  vertices: Float32Array,
): {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  radius: number;
} => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < vertices.length; i += 8) {
    const x = vertices[i + 0]!;
    const y = vertices[i + 1]!;
    const z = vertices[i + 2]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  if (!Number.isFinite(minX)) {
    return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], radius: 0 };
  }

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const radius = Math.hypot(maxX - cx, maxY - cy, maxZ - cz);

  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ], center: [cx, cy, cz], radius };
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

  const bounds = computeBounds(vertices);

  return {
    vao,
    indexCount: indices.length,
    boundsMin: bounds.min,
    boundsMax: bounds.max,
    boundsCenter: bounds.center,
    boundsRadius: bounds.radius,
  };
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

  const bounds = computeBounds(vertices);

  return {
    vao,
    indexCount: indices.length,
    jointCount,
    boundsMin: bounds.min,
    boundsMax: bounds.max,
    boundsCenter: bounds.center,
    boundsRadius: bounds.radius,
  };
};

