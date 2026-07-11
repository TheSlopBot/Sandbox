import { createInterleavedMesh, destroyMesh, type Mesh } from './mesh.ts';
import { type GpuDevice } from './device.ts';

export type SharedMeshCache = {
  getInterleaved: (key: string, vertices: Float32Array, indices: Uint32Array) => Mesh;
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
    destroy: () => {
      for (const mesh of meshes.values()) destroyMesh(device, mesh);
      meshes.clear();
    },
  };
};
