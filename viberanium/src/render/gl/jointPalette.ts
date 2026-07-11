import { type GpuDevice } from './device.ts';

export const MAX_JOINTS = 128;
export const JOINT_MATRIX_FLOATS = 16;
export const JOINT_BUFFER_SIZE = MAX_JOINTS * JOINT_MATRIX_FLOATS * 4;

export type JointPaletteGpu = {
  buffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

export const createJointPaletteBindGroupLayout = (gpu: GPUDevice): GPUBindGroupLayout =>
  gpu.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });

export const createJointPaletteGpu = (
  device: GpuDevice,
  layout: GPUBindGroupLayout,
): JointPaletteGpu => {
  const buffer = device.gpu.createBuffer({
    size: JOINT_BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  const bindGroup = device.gpu.createBindGroup({
    layout,
    entries: [{ binding: 0, resource: { buffer } }],
  });

  return { buffer, bindGroup };
};
