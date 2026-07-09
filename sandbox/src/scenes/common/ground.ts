import { type Mat4, createInterleavedMesh, createTransform } from 'viberanium';

export const createGroundMesh = (
  gl: WebGL2RenderingContext,
): { mesh: ReturnType<typeof createInterleavedMesh>; model: Mat4 } => {
  const size = 60;
  const y = 0;
  const v = new Float32Array([
    -size, y, -size,  0, 1, 0,  0, 0,
     size, y, -size,  0, 1, 0,  1, 0,
     size, y,  size,  0, 1, 0,  1, 1,
    -size, y,  size,  0, 1, 0,  0, 1,
  ]);
  const idx = new Uint32Array([0, 2, 1, 0, 3, 2]);
  const mesh = createInterleavedMesh(gl, v, idx);
  const model = createTransform().world;
  return { mesh, model };
};
