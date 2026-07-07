import { type Mat4 } from '../math/mat4.ts';
import { createInterleavedMesh } from '../render/gl/mesh.ts';
import { createTransform } from '../components/transform.ts';

export const createGroundMesh = (
  gl: WebGL2RenderingContext,
): { mesh: { vao: WebGLVertexArrayObject; indexCount: number }; model: Mat4 } => {
  const size = 60;
  const y = 0;
  const v = new Float32Array([
    -size, y, -size,  0, 1, 0,  0, 0,
     size, y, -size,  0, 1, 0,  1, 0,
     size, y,  size,  0, 1, 0,  1, 1,
    -size, y,  size,  0, 1, 0,  0, 1,
  ]);
  const idx = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const mesh = createInterleavedMesh(gl, v, idx);
  const model = createTransform().world;
  return { mesh, model };
};
