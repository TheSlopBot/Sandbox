import {
  createInterleavedMesh,
  createSkinnedMesh,
  destroyMesh,
  type Mesh,
  type SkinnedMesh,
} from './mesh.ts';
import { type GpuDevice } from './device.ts';

export type SharedMeshCache = {
  getInterleaved: (key: string, vertices: Float32Array, indices: Uint32Array) => Mesh;
  getSkinned: (
    key: string,
    vertices: Float32Array,
    joints: Uint16Array,
    weights: Float32Array,
    indices: Uint32Array,
    jointCount: number,
  ) => SkinnedMesh;
  destroy: () => void;
};

export const createSharedMeshCache = (device: GpuDevice): SharedMeshCache => {
  const meshes = new Map<string, Mesh>();

  return {
    getInterleaved: (key, vertices, indices) => {
      const existing = meshes.get(key);
      if (existing) return existing;

      const mesh = createInterleavedMesh(device, vertices, indices);
      meshes.set(key, mesh);
      return mesh;
    },
    getSkinned: (key, vertices, joints, weights, indices, jointCount) => {
      const existing = meshes.get(key);
      if (existing) return existing as SkinnedMesh;

      const mesh = createSkinnedMesh(device, vertices, joints, weights, indices, jointCount);
      meshes.set(key, mesh);
      return mesh;
    },
    destroy: () => {
      for (const mesh of meshes.values()) destroyMesh(device, mesh);
      meshes.clear();
    },
  };
};
