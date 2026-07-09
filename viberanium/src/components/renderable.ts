import { type Material } from '../render/types.ts';
import { type Mat4 } from '../math/mat4.ts';

export type Renderable = {
  mesh: {
    vao: WebGLVertexArrayObject;
    indexCount: number;
    boundsMin: readonly [number, number, number];
    boundsMax: readonly [number, number, number];
    boundsCenter: readonly [number, number, number];
    boundsRadius: number;
  };
  material: Material;
  model?: Mat4;
  visible?: boolean;
  castShadow?: boolean;
};
