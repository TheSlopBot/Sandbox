import { type GpuDevice } from './device.ts';

export type Mesh = {
  indexCount: number;
  boundsMin: readonly [number, number, number];
  boundsMax: readonly [number, number, number];
  boundsCenter: readonly [number, number, number];
  boundsRadius: number;
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
};

export type SkinnedMesh = Mesh & {
  jointCount: number;
  jointBuffer: GPUBuffer;
  weightBuffer: GPUBuffer;
};

export const destroyMesh = (_device: GpuDevice, mesh: Mesh): void => {
  mesh.vertexBuffer.destroy();
  mesh.indexBuffer.destroy();
  if ('jointBuffer' in mesh) {
    (mesh as SkinnedMesh).jointBuffer.destroy();
    (mesh as SkinnedMesh).weightBuffer.destroy();
  }
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

const createBuffer = (
  device: GpuDevice,
  data: Float32Array | Uint16Array | Uint32Array,
  usage: GPUBufferUsageFlags,
): GPUBuffer => {
  const size = Math.max(4, Math.ceil(data.byteLength / 4) * 4);
  const buffer = device.gpu.createBuffer({
    size,
    usage,
    mappedAtCreation: true,
  });
  new Uint8Array(buffer.getMappedRange()).set(
    new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength),
  );
  buffer.unmap();
  return buffer;
};

export const createInterleavedMesh = (
  device: GpuDevice,
  vertices: Float32Array,
  indices: Uint32Array,
): Mesh => {
  const vertexBuffer = createBuffer(
    device,
    vertices,
    GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  );
  const indexBuffer = createBuffer(
    device,
    indices,
    GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  );
  const bounds = computeBounds(vertices);

  return {
    indexCount: indices.length,
    boundsMin: bounds.min,
    boundsMax: bounds.max,
    boundsCenter: bounds.center,
    boundsRadius: bounds.radius,
    vertexBuffer,
    indexBuffer,
  };
};

export const createSkinnedMesh = (
  device: GpuDevice,
  vertices: Float32Array,
  joints: Uint16Array,
  weights: Float32Array,
  indices: Uint32Array,
  jointCount: number,
): SkinnedMesh => {
  const vertexBuffer = createBuffer(
    device,
    vertices,
    GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  );
  const jointBuffer = createBuffer(
    device,
    joints,
    GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  );
  const weightBuffer = createBuffer(
    device,
    weights,
    GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  );
  const indexBuffer = createBuffer(
    device,
    indices,
    GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  );
  const bounds = computeBounds(vertices);

  return {
    indexCount: indices.length,
    jointCount,
    boundsMin: bounds.min,
    boundsMax: bounds.max,
    boundsCenter: bounds.center,
    boundsRadius: bounds.radius,
    vertexBuffer,
    indexBuffer,
    jointBuffer,
    weightBuffer,
  };
};
