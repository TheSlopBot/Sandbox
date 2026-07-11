import { type GpuDevice } from '../gl/device.ts';
import { skeletalPoseWGSL } from '../shaders/skeletalPoseWgsl.ts';
import {
  type SkeletonGpuAsset,
  MAX_ATTACHMENT_MODELS,
  MAX_SKELETON_NODES,
} from '../gl/skeletonGpu.ts';
import { JOINT_BUFFER_SIZE, type JointPaletteGpu } from '../gl/jointPalette.ts';
import { type Mat4 } from '../../math/mat4.ts';
import { type SkinInstance } from '../../components/skin.ts';

export const POSE_INSTANCE_FLOATS = 32;
export const POSE_INSTANCE_STRIDE = POSE_INSTANCE_FLOATS * 4;
export const SCRATCH_FLOATS_PER_SLOT = MAX_SKELETON_NODES * 10 + MAX_SKELETON_NODES * 16;

export type PoseMeshJob = {
  nodeIndex: number;
  outIndex: number;
};

export type PoseAttachmentJob = {
  boneNodeIndex: number;
  outIndex: number;
  localOffset: Mat4;
  attachNodeWorld: Mat4;
};

export type PoseDispatchEntry = {
  asset: SkeletonGpuAsset;
  slotIndex: number;
  skin: SkinInstance;
  renderRoot: Mat4;
  animTime: number;
  clipIndex: number;
  loop: boolean;
  skip: boolean;
  meshJobs: readonly PoseMeshJob[];
  attachmentJobs: readonly PoseAttachmentJob[];
};

export type SkeletalPosePass = {
  paletteLayout: GPUBindGroupLayout;
  allocSlot: () => number;
  freeSlot: (slot: number) => void;
  meshModelsBuffer: () => GPUBuffer;
  attachmentModelsBuffer: () => GPUBuffer;
  paletteBinding: (slot: number) => JointPaletteGpu;
  meshModelByteOffset: (slot: number, outIndex: number) => number;
  attachmentModelByteOffset: (slot: number, outIndex: number) => number;
  dispatch: (entries: readonly PoseDispatchEntry[]) => void;
  destroy: () => void;
};

const FRAME_U32 = 16;

export const createSkeletalPosePass = (device: GpuDevice): SkeletalPosePass => {
  const gpu = device.gpu;
  const shader = gpu.createShaderModule({ code: skeletalPoseWGSL });
  void shader.getCompilationInfo().then((info) => {
    for (const message of info.messages) {
      if (message.type === 'error') console.error('skeletalPose WGSL:', message.message);
    }
  });

  const bindGroupLayout = gpu.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 7, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 8, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
    ],
  });

  const pipeline = gpu.createComputePipeline({
    layout: gpu.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    compute: { module: shader, entryPoint: 'resolvePoses' },
  });

  const paletteLayout = gpu.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });

  const frameBuffer = gpu.createBuffer({
    size: 256,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const frameU32 = new Uint32Array(FRAME_U32);

  let slotCapacity = 0;
  let nextSlot = 0;
  const freeSlots: number[] = [];
  let instanceBuffer: GPUBuffer | null = null;
  let scratchBuffer: GPUBuffer | null = null;
  let paletteBuffer: GPUBuffer | null = null;
  let meshModels: GPUBuffer | null = null;
  let attachmentModels: GPUBuffer | null = null;
  let meshJobsBuffer: GPUBuffer | null = null;
  let attachmentJobsBuffer: GPUBuffer | null = null;
  let instanceCpu = new Float32Array(0);
  let instanceU32 = new Uint32Array(0);
  let meshJobCpu = new Uint32Array(0);
  let attachmentJobBytes = new ArrayBuffer(0);
  let attachmentJobU32 = new Uint32Array(0);
  let attachmentJobF32 = new Float32Array(0);
  const paletteBindBySlot = new Map<number, JointPaletteGpu>();
  const computeBindBySkeleton = new Map<GPUBuffer, { generation: number; bindGroup: GPUBindGroup }>();
  const byAsset = new Map<SkeletonGpuAsset, PoseDispatchEntry[]>();
  let slabGeneration = 0;

  const destroySlabs = () => {
    instanceBuffer?.destroy();
    scratchBuffer?.destroy();
    paletteBuffer?.destroy();
    meshModels?.destroy();
    attachmentModels?.destroy();
    meshJobsBuffer?.destroy();
    attachmentJobsBuffer?.destroy();
    instanceBuffer = null;
    scratchBuffer = null;
    paletteBuffer = null;
    meshModels = null;
    attachmentModels = null;
    meshJobsBuffer = null;
    attachmentJobsBuffer = null;
    paletteBindBySlot.clear();
    computeBindBySkeleton.clear();
    byAsset.clear();
    slabGeneration++;
  };

  const ensureSlotCapacity = (count: number) => {
    if (count <= slotCapacity && paletteBuffer && meshModels && attachmentModels && scratchBuffer) return;

    destroySlabs();
    slotCapacity = Math.max(64, count * 2);
    instanceCpu = new Float32Array(slotCapacity * POSE_INSTANCE_FLOATS);
    instanceU32 = new Uint32Array(instanceCpu.buffer);
    instanceBuffer = gpu.createBuffer({
      size: slotCapacity * POSE_INSTANCE_STRIDE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    scratchBuffer = gpu.createBuffer({
      size: Math.max(4, slotCapacity * SCRATCH_FLOATS_PER_SLOT * 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    paletteBuffer = gpu.createBuffer({
      size: slotCapacity * JOINT_BUFFER_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    meshModels = gpu.createBuffer({
      size: slotCapacity * MAX_SKELETON_NODES * 64,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    attachmentModels = gpu.createBuffer({
      size: slotCapacity * MAX_ATTACHMENT_MODELS * 64,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    meshJobsBuffer = gpu.createBuffer({
      size: Math.max(16, slotCapacity * MAX_SKELETON_NODES * 16),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    attachmentJobsBuffer = gpu.createBuffer({
      size: Math.max(144, slotCapacity * MAX_ATTACHMENT_MODELS * 144),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    meshJobCpu = new Uint32Array(slotCapacity * MAX_SKELETON_NODES * 4);
    attachmentJobBytes = new ArrayBuffer(slotCapacity * MAX_ATTACHMENT_MODELS * 144);
    attachmentJobU32 = new Uint32Array(attachmentJobBytes);
    attachmentJobF32 = new Float32Array(attachmentJobBytes);
  };

  const allocSlot: SkeletalPosePass['allocSlot'] = () => {
    const fromFree = freeSlots.pop();
    if (fromFree !== undefined) return fromFree;
    return nextSlot++;
  };

  const freeSlot: SkeletalPosePass['freeSlot'] = (slot) => {
    freeSlots.push(slot);
    paletteBindBySlot.delete(slot);
  };

  const ensureForSlots = () => {
    ensureSlotCapacity(Math.max(1, nextSlot));
  };

  const paletteBinding: SkeletalPosePass['paletteBinding'] = (slot) => {
    ensureForSlots();
    const existing = paletteBindBySlot.get(slot);
    if (existing && existing.buffer === paletteBuffer) return existing;
    const bindGroup = gpu.createBindGroup({
      layout: paletteLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: paletteBuffer!,
            offset: slot * JOINT_BUFFER_SIZE,
            size: JOINT_BUFFER_SIZE,
          },
        },
      ],
    });
    const entry = { buffer: paletteBuffer!, bindGroup };
    paletteBindBySlot.set(slot, entry);
    return entry;
  };

  const writeInstance = (index: number, entry: PoseDispatchEntry, meshStart: number, attachStart: number) => {
    const base = index * POSE_INSTANCE_FLOATS;
    instanceCpu.set(entry.renderRoot, base);
    instanceCpu[base + 16] = entry.animTime;
    instanceU32[base + 17] = entry.clipIndex;
    instanceU32[base + 18] = entry.loop ? 1 : 0;
    instanceU32[base + 19] = entry.slotIndex;
    instanceU32[base + 20] = meshStart;
    instanceU32[base + 21] = entry.meshJobs.length;
    instanceU32[base + 22] = attachStart;
    instanceU32[base + 23] = entry.attachmentJobs.length;
    instanceU32[base + 24] = 0;
    instanceU32[base + 25] = 0;
    instanceU32[base + 26] = 0;
    instanceU32[base + 27] = 0;
    instanceU32[base + 28] = 0;
    instanceU32[base + 29] = 0;
    instanceU32[base + 30] = 0;
    instanceU32[base + 31] = 0;
  };

  const ensureComputeBindGroup = (skeleton: GPUBuffer): GPUBindGroup => {
    const cached = computeBindBySkeleton.get(skeleton);
    if (cached && cached.generation === slabGeneration) return cached.bindGroup;

    const bindGroup = gpu.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: frameBuffer } },
        { binding: 1, resource: { buffer: instanceBuffer! } },
        { binding: 2, resource: { buffer: skeleton } },
        { binding: 3, resource: { buffer: scratchBuffer! } },
        { binding: 4, resource: { buffer: paletteBuffer! } },
        { binding: 5, resource: { buffer: meshJobsBuffer! } },
        { binding: 6, resource: { buffer: meshModels! } },
        { binding: 7, resource: { buffer: attachmentJobsBuffer! } },
        { binding: 8, resource: { buffer: attachmentModels! } },
      ],
    });
    computeBindBySkeleton.set(skeleton, { generation: slabGeneration, bindGroup });
    return bindGroup;
  };

  const dispatch: SkeletalPosePass['dispatch'] = (entries) => {
    if (entries.length === 0) return;

    let maxSlot = 0;
    for (const entry of entries) {
      if (entry.slotIndex > maxSlot) maxSlot = entry.slotIndex;
    }
    ensureSlotCapacity(maxSlot + 1);

    byAsset.clear();
    for (const entry of entries) {
      if (entry.skip) continue;
      const list = byAsset.get(entry.asset);
      if (list) list.push(entry);
      else byAsset.set(entry.asset, [entry]);
    }

    if (byAsset.size === 0) return;

    for (const [asset, group] of byAsset) {
      let meshJobCount = 0;
      let attachJobCount = 0;
      for (const entry of group) {
        meshJobCount += entry.meshJobs.length;
        attachJobCount += entry.attachmentJobs.length;
      }

      if (meshJobCpu.length < Math.max(4, meshJobCount * 4)) {
        meshJobCpu = new Uint32Array(Math.max(64, meshJobCount * 4));
      }
      const attachBytesNeeded = Math.max(144, attachJobCount * 144);
      if (attachmentJobBytes.byteLength < attachBytesNeeded) {
        attachmentJobBytes = new ArrayBuffer(attachBytesNeeded);
        attachmentJobU32 = new Uint32Array(attachmentJobBytes);
        attachmentJobF32 = new Float32Array(attachmentJobBytes);
      }

      let meshCursor = 0;
      let attachCursor = 0;
      for (let i = 0; i < group.length; i++) {
        const entry = group[i]!;
        const meshStart = meshCursor;
        for (let j = 0; j < entry.meshJobs.length; j++) {
          const job = entry.meshJobs[j]!;
          const base = meshCursor * 4;
          meshJobCpu[base] = job.nodeIndex;
          meshJobCpu[base + 1] = job.outIndex;
          meshJobCpu[base + 2] = 0;
          meshJobCpu[base + 3] = 0;
          meshCursor++;
        }
        const attachStart = attachCursor;
        for (let j = 0; j < entry.attachmentJobs.length; j++) {
          const job = entry.attachmentJobs[j]!;
          const baseU = (attachCursor * 144) >> 2;
          attachmentJobU32[baseU] = job.boneNodeIndex;
          attachmentJobU32[baseU + 1] = 0;
          attachmentJobU32[baseU + 2] = job.outIndex;
          attachmentJobU32[baseU + 3] = 0;
          attachmentJobF32.set(job.localOffset, baseU + 4);
          attachmentJobF32.set(job.attachNodeWorld, baseU + 20);
          attachCursor++;
        }
        writeInstance(i, entry, meshStart, attachStart);
        const palette = paletteBinding(entry.slotIndex);
        if (entry.skin.paletteGpu !== palette) entry.skin.paletteGpu = palette;
      }

      frameU32[0] = asset.nodeCount;
      frameU32[1] = asset.jointCount;
      frameU32[2] = asset.rootNodeIndex;
      frameU32[3] = group.length;
      frameU32[4] = asset.offsets.parentsOffset;
      frameU32[5] = asset.offsets.topoOffset;
      frameU32[6] = asset.offsets.bindLocalOffset;
      frameU32[7] = asset.offsets.jointsOffset;
      frameU32[8] = asset.offsets.inverseBindOffset;
      frameU32[9] = asset.offsets.clipHeadersOffset;
      frameU32[10] = asset.offsets.channelHeadersOffset;
      frameU32[11] = asset.offsets.clipTimesOffset;
      frameU32[12] = asset.offsets.clipValuesOffset;
      frameU32[13] = asset.offsets.animatedMaskOffset;
      frameU32[14] = asset.offsets.maskWords;
      frameU32[15] = SCRATCH_FLOATS_PER_SLOT;
      gpu.queue.writeBuffer(frameBuffer, 0, frameU32);
      gpu.queue.writeBuffer(
        instanceBuffer!,
        0,
        instanceCpu.buffer as ArrayBuffer,
        0,
        group.length * POSE_INSTANCE_STRIDE,
      );

      if (meshCursor > 0) {
        gpu.queue.writeBuffer(
          meshJobsBuffer!,
          0,
          meshJobCpu.buffer as ArrayBuffer,
          0,
          meshCursor * 16,
        );
      }
      if (attachCursor > 0) {
        gpu.queue.writeBuffer(
          attachmentJobsBuffer!,
          0,
          attachmentJobBytes,
          0,
          attachCursor * 144,
        );
      }

      const encoder = gpu.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, ensureComputeBindGroup(asset.skeleton));
      pass.dispatchWorkgroups(group.length);
      pass.end();
      gpu.queue.submit([encoder.finish()]);
    }
  };

  return {
    paletteLayout,
    allocSlot,
    freeSlot,
    meshModelsBuffer: () => {
      ensureForSlots();
      return meshModels!;
    },
    attachmentModelsBuffer: () => {
      ensureForSlots();
      return attachmentModels!;
    },
    paletteBinding,
    meshModelByteOffset: (slot, outIndex) => (slot * MAX_SKELETON_NODES + outIndex) * 64,
    attachmentModelByteOffset: (slot, outIndex) => (slot * MAX_ATTACHMENT_MODELS + outIndex) * 64,
    dispatch,
    destroy: () => {
      destroySlabs();
      frameBuffer.destroy();
    },
  };
};
