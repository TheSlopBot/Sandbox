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
  dispatch: (entries: readonly PoseDispatchEntry[], encoder?: GPUCommandEncoder) => void;
  destroy: () => void;
};

const FRAME_U32 = 16;
const MAX_POSE_GROUPS = 8;
const align256 = (n: number) => (n + 255) & ~255;

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

  const frameBuffers = Array.from({ length: MAX_POSE_GROUPS }, () =>
    gpu.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }),
  );
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
  const byAsset = new Map<SkeletonGpuAsset, PoseDispatchEntry[]>();

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
    byAsset.clear();
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

  const writeInstance = (
    instanceIndex: number,
    entry: PoseDispatchEntry,
    meshStart: number,
    attachStart: number,
  ) => {
    const base = instanceIndex * POSE_INSTANCE_FLOATS;
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

  const createGroupBindGroup = (
    skeleton: GPUBuffer,
    frameBuf: GPUBuffer,
    instanceOffset: number,
    instanceSize: number,
    meshOffset: number,
    meshSize: number,
    attachOffset: number,
    attachSize: number,
  ): GPUBindGroup =>
    gpu.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: frameBuf } },
        {
          binding: 1,
          resource: { buffer: instanceBuffer!, offset: instanceOffset, size: instanceSize },
        },
        { binding: 2, resource: { buffer: skeleton } },
        { binding: 3, resource: { buffer: scratchBuffer! } },
        { binding: 4, resource: { buffer: paletteBuffer! } },
        {
          binding: 5,
          resource: { buffer: meshJobsBuffer!, offset: meshOffset, size: meshSize },
        },
        { binding: 6, resource: { buffer: meshModels! } },
        {
          binding: 7,
          resource: { buffer: attachmentJobsBuffer!, offset: attachOffset, size: attachSize },
        },
        { binding: 8, resource: { buffer: attachmentModels! } },
      ],
    });

  const dispatch: SkeletalPosePass['dispatch'] = (entries, externalEncoder) => {
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

    const groups: {
      asset: SkeletonGpuAsset;
      group: PoseDispatchEntry[];
      instanceByteOffset: number;
      instanceCount: number;
      meshByteOffset: number;
      meshCount: number;
      attachByteOffset: number;
      attachCount: number;
      frameIndex: number;
    }[] = [];

    let instanceFloatCursor = 0;
    let meshU32Cursor = 0;
    let attachByteCursor = 0;
    let totalMeshJobs = 0;
    let totalAttachJobs = 0;
    for (const group of byAsset.values()) {
      for (const entry of group) {
        totalMeshJobs += entry.meshJobs.length;
        totalAttachJobs += entry.attachmentJobs.length;
      }
    }

    const instanceFloatNeeded = entries.length * POSE_INSTANCE_FLOATS;
    if (instanceCpu.length < instanceFloatNeeded) {
      instanceCpu = new Float32Array(Math.max(instanceFloatNeeded, slotCapacity * POSE_INSTANCE_FLOATS));
      instanceU32 = new Uint32Array(instanceCpu.buffer);
    }
    if (meshJobCpu.length < Math.max(4, totalMeshJobs * 4)) {
      meshJobCpu = new Uint32Array(Math.max(64, totalMeshJobs * 4));
    }
    const attachBytesNeeded = Math.max(144, totalAttachJobs * 144);
    if (attachmentJobBytes.byteLength < attachBytesNeeded) {
      attachmentJobBytes = new ArrayBuffer(attachBytesNeeded);
      attachmentJobU32 = new Uint32Array(attachmentJobBytes);
      attachmentJobF32 = new Float32Array(attachmentJobBytes);
    }

    let frameIndex = 0;
    for (const [asset, group] of byAsset) {
      if (frameIndex >= MAX_POSE_GROUPS) break;

      instanceFloatCursor = align256(instanceFloatCursor * 4) >> 2;
      meshU32Cursor = align256(meshU32Cursor * 4) >> 2;
      attachByteCursor = align256(attachByteCursor);

      const instanceByteOffset = instanceFloatCursor * 4;
      const meshByteOffset = meshU32Cursor * 4;
      const attachByteOffset = attachByteCursor;

      let meshCursor = 0;
      let attachCursor = 0;
      for (let i = 0; i < group.length; i++) {
        const entry = group[i]!;
        const meshStart = meshCursor;
        for (let j = 0; j < entry.meshJobs.length; j++) {
          const job = entry.meshJobs[j]!;
          const base = meshU32Cursor + meshCursor * 4;
          meshJobCpu[base] = job.nodeIndex;
          meshJobCpu[base + 1] = job.outIndex;
          meshJobCpu[base + 2] = 0;
          meshJobCpu[base + 3] = 0;
          meshCursor++;
        }
        const attachStart = attachCursor;
        for (let j = 0; j < entry.attachmentJobs.length; j++) {
          const job = entry.attachmentJobs[j]!;
          const baseU = (attachByteCursor + attachCursor * 144) >> 2;
          attachmentJobU32[baseU] = job.boneNodeIndex;
          attachmentJobU32[baseU + 1] = 0;
          attachmentJobU32[baseU + 2] = job.outIndex;
          attachmentJobU32[baseU + 3] = 0;
          attachmentJobF32.set(job.localOffset, baseU + 4);
          attachmentJobF32.set(job.attachNodeWorld, baseU + 20);
          attachCursor++;
        }
        writeInstance(instanceFloatCursor / POSE_INSTANCE_FLOATS + i, entry, meshStart, attachStart);
        const palette = paletteBinding(entry.slotIndex);
        if (entry.skin.paletteGpu !== palette) entry.skin.paletteGpu = palette;
      }

      groups.push({
        asset,
        group,
        instanceByteOffset,
        instanceCount: group.length,
        meshByteOffset,
        meshCount: meshCursor,
        attachByteOffset,
        attachCount: attachCursor,
        frameIndex,
      });

      instanceFloatCursor += group.length * POSE_INSTANCE_FLOATS;
      meshU32Cursor += meshCursor * 4;
      attachByteCursor += attachCursor * 144;
      frameIndex++;
    }

    const instanceWriteBytes = instanceFloatCursor * 4;
    if (instanceWriteBytes > 0) {
      gpu.queue.writeBuffer(
        instanceBuffer!,
        0,
        instanceCpu.buffer as ArrayBuffer,
        0,
        Math.min(instanceWriteBytes, instanceCpu.byteLength),
      );
    }
    if (meshU32Cursor > 0) {
      gpu.queue.writeBuffer(
        meshJobsBuffer!,
        0,
        meshJobCpu.buffer as ArrayBuffer,
        0,
        meshU32Cursor * 4,
      );
    }
    if (attachByteCursor > 0) {
      gpu.queue.writeBuffer(attachmentJobsBuffer!, 0, attachmentJobBytes, 0, attachByteCursor);
    }

    const encoder = externalEncoder ?? gpu.createCommandEncoder();

    for (const packed of groups) {
      const { asset, group, instanceByteOffset, meshByteOffset, attachByteOffset, frameIndex: fi } =
        packed;
      const frameBuf = frameBuffers[fi]!;

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
      gpu.queue.writeBuffer(frameBuf, 0, frameU32);

      const instanceSize = Math.max(POSE_INSTANCE_STRIDE, group.length * POSE_INSTANCE_STRIDE);
      const meshSize = Math.max(16, packed.meshCount * 16);
      const attachSize = Math.max(144, packed.attachCount * 144);

      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(
        0,
        createGroupBindGroup(
          asset.skeleton,
          frameBuf,
          instanceByteOffset,
          instanceSize,
          meshByteOffset,
          meshSize,
          attachByteOffset,
          attachSize,
        ),
      );
      pass.dispatchWorkgroups(group.length);
      pass.end();
    }

    if (!externalEncoder) gpu.queue.submit([encoder.finish()]);
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
      for (const buf of frameBuffers) buf.destroy();
    },
  };
};
