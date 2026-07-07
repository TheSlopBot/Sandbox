import { type Material } from '../render/types.ts';
import { type Mat4 } from '../math/mat4.ts';

export type Renderable = {
  mesh: { vao: WebGLVertexArrayObject; indexCount: number };
  material: Material;
  model?: Mat4;
};
