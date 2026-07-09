import { type Material } from '../render/types.ts';
import { type Mat4 } from '../math/mat4.ts';
import { type SkinInstance } from './skin.ts';

export type MeshDrawPart = {
  mesh: {
    vao: WebGLVertexArrayObject;
    indexCount: number;
    boundsMin: readonly [number, number, number];
    boundsMax: readonly [number, number, number];
    boundsCenter: readonly [number, number, number];
    boundsRadius: number;
  };
  material: Material;
  gltfNodeIndex: number;
  skin?: SkinInstance;
  model?: Mat4;
  visible?: boolean;
  castShadow?: boolean;
};

export type MeshDraws = {
  parts: MeshDrawPart[];
};

export const createMeshDraws = (parts: MeshDrawPart[]): MeshDraws => ({
  parts,
});
