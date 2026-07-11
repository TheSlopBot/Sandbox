import { type Material } from '../render/types.ts';
import { type Mat4 } from '../math/mat4.ts';
import { type Mesh } from '../render/gl/mesh.ts';

export type Renderable = {
  mesh: Mesh;
  material: Material;
  model?: Mat4;
  visible?: boolean;
  castShadow?: boolean;
  overlay?: boolean;
};
