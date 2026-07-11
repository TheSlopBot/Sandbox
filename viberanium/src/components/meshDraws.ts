import { type Material } from '../render/types.ts';
import { type Mat4 } from '../math/mat4.ts';
import { type SkinInstance } from './skin.ts';
import { type Mesh } from '../render/gl/mesh.ts';

export type GpuModelSource = {
  buffer: GPUBuffer;
  byteOffset: number;
};

export type MeshDrawPart = {
  mesh: Mesh;
  material: Material;
  gltfNodeIndex: number;
  skin?: SkinInstance;
  model?: Mat4;
  gpuModel?: GpuModelSource;
  visible?: boolean;
  castShadow?: boolean;
};

export type MeshDraws = {
  parts: MeshDrawPart[];
};

export const createMeshDraws = (parts: MeshDrawPart[]): MeshDraws => ({
  parts,
});
