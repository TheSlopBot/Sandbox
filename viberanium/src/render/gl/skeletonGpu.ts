import { type GpuDevice } from './device.ts';
import { type RuntimeScene, type RuntimeSkin } from '../../assets/gltf/runtime.ts';
import { type AnimationClipMap } from '../../components/animationClipMap.ts';
import { packClipsForGpu } from '../../assets/gltf/packClipsForGpu.ts';
import {
  createJointPaletteGpu,
  MAX_JOINTS,
  type JointPaletteGpu,
} from './jointPalette.ts';

export const MAX_SKELETON_NODES = 128;
export const MAX_ATTACHMENT_MODELS = 64;

export type SkeletonGpuOffsets = {
  parentsOffset: number;
  topoOffset: number;
  bindLocalOffset: number;
  jointsOffset: number;
  inverseBindOffset: number;
  clipHeadersOffset: number;
  channelHeadersOffset: number;
  clipTimesOffset: number;
  clipValuesOffset: number;
  animatedMaskOffset: number;
  maskWords: number;
  wordCount: number;
};

export type SkeletonGpuAsset = {
  nodeCount: number;
  jointCount: number;
  rootNodeIndex: number;
  offsets: SkeletonGpuOffsets;
  skeleton: GPUBuffer;
  destroy: () => void;
};

export type SkeletonGpuInstance = {
  asset: SkeletonGpuAsset;
  palette: JointPaletteGpu;
  scratch: GPUBuffer;
  meshModels: GPUBuffer;
  attachmentModels: GPUBuffer;
  meshJobs: GPUBuffer;
  attachmentJobs: GPUBuffer;
  paramBuffer: GPUBuffer;
  computeBindGroup: GPUBindGroup | null;
  destroy: () => void;
};

const align4 = (n: number) => (n + 3) & ~3;

const buildTopoOrder = (nodeCount: number, parents: Int32Array): Uint32Array => {
  const order = new Uint32Array(nodeCount);
  const depth = new Int32Array(nodeCount);
  depth.fill(-1);

  const nodeDepth = (i: number): number => {
    if (depth[i]! >= 0) return depth[i]!;
    const p = parents[i]!;
    depth[i] = p < 0 ? 0 : nodeDepth(p) + 1;
    return depth[i]!;
  };

  for (let i = 0; i < nodeCount; i++) nodeDepth(i);

  const indices = new Array<number>(nodeCount);
  for (let i = 0; i < nodeCount; i++) indices[i] = i;
  indices.sort((a, b) => depth[a]! - depth[b]! || a - b);
  for (let i = 0; i < nodeCount; i++) order[i] = indices[i]!;
  return order;
};

export const buildSkeletonBlob = (
  scene: RuntimeScene,
  skin: RuntimeSkin,
  clipMap: AnimationClipMap,
): { words: Uint32Array; offsets: SkeletonGpuOffsets; nodeCount: number; jointCount: number } => {
  const nodeCount = Math.min(MAX_SKELETON_NODES, scene.nodes.length);
  const jointCount = Math.min(MAX_JOINTS, skin.joints.length);
  const clips = packClipsForGpu(clipMap, nodeCount);
  const maskWords = Math.ceil(Math.max(1, nodeCount) / 32);
  const parentsCpu = new Int32Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) parentsCpu[i] = scene.nodes[i]!.parent;
  const topo = buildTopoOrder(nodeCount, parentsCpu);

  let cursor = 0;
  const parentsOffset = cursor;
  cursor += nodeCount;
  const topoOffset = cursor;
  cursor += nodeCount;
  const bindLocalOffset = cursor;
  cursor += nodeCount * 10;
  const jointsOffset = cursor;
  cursor += MAX_JOINTS;
  const inverseBindOffset = cursor;
  cursor += MAX_JOINTS * 16;
  const clipHeadersOffset = cursor;
  cursor += clips.clipHeaders.length;
  const channelHeadersOffset = cursor;
  cursor += Math.max(6, clips.channelHeaders.length);
  const clipTimesOffset = cursor;
  cursor += clips.times.length;
  const clipValuesOffset = cursor;
  cursor += clips.values.length;
  const animatedMaskOffset = cursor;
  cursor += clips.animatedMask.length;
  cursor = align4(cursor);

  const words = new Uint32Array(cursor);
  const asF32 = new Float32Array(words.buffer);
  const asI32 = new Int32Array(words.buffer);

  for (let i = 0; i < nodeCount; i++) {
    asI32[parentsOffset + i] = parentsCpu[i]!;
    words[topoOffset + i] = topo[i]!;
    const n = scene.nodes[i]!;
    const b = bindLocalOffset + i * 10;
    asF32[b] = n.localT[0];
    asF32[b + 1] = n.localT[1];
    asF32[b + 2] = n.localT[2];
    asF32[b + 3] = n.localR[0];
    asF32[b + 4] = n.localR[1];
    asF32[b + 5] = n.localR[2];
    asF32[b + 6] = n.localR[3];
    asF32[b + 7] = n.localS[0];
    asF32[b + 8] = n.localS[1];
    asF32[b + 9] = n.localS[2];
  }

  for (let j = 0; j < MAX_JOINTS; j++) {
    asI32[jointsOffset + j] = j < jointCount ? skin.joints[j]! : -1;
  }

  for (let j = 0; j < jointCount; j++) {
    asF32.set(skin.inverseBind[j]!, inverseBindOffset + j * 16);
  }

  words.set(clips.clipHeaders, clipHeadersOffset);
  if (clips.channelHeaders.length > 0) {
    words.set(clips.channelHeaders, channelHeadersOffset);
  }
  asF32.set(clips.times, clipTimesOffset);
  asF32.set(clips.values, clipValuesOffset);
  words.set(clips.animatedMask, animatedMaskOffset);

  return {
    words,
    nodeCount,
    jointCount,
    offsets: {
      parentsOffset,
      topoOffset,
      bindLocalOffset,
      jointsOffset,
      inverseBindOffset,
      clipHeadersOffset,
      channelHeadersOffset,
      clipTimesOffset,
      clipValuesOffset,
      animatedMaskOffset,
      maskWords,
      wordCount: cursor,
    },
  };
};

export const createSkeletonGpuAsset = (
  device: GpuDevice,
  scene: RuntimeScene,
  skin: RuntimeSkin,
  rootNodeIndex: number,
  clipMap: AnimationClipMap,
): SkeletonGpuAsset => {
  const packed = buildSkeletonBlob(scene, skin, clipMap);
  const skeleton = device.gpu.createBuffer({
    size: Math.max(4, packed.words.byteLength),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint32Array(skeleton.getMappedRange()).set(packed.words);
  skeleton.unmap();

  return {
    nodeCount: packed.nodeCount,
    jointCount: packed.jointCount,
    rootNodeIndex,
    offsets: packed.offsets,
    skeleton,
    destroy: () => {
      skeleton.destroy();
    },
  };
};

export const createSkeletonGpuInstance = (
  device: GpuDevice,
  asset: SkeletonGpuAsset,
  paletteLayout: GPUBindGroupLayout,
  existingPalette?: JointPaletteGpu | null,
): SkeletonGpuInstance => {
  const palette = existingPalette ?? createJointPaletteGpu(device, paletteLayout);
  const scratchFloats = asset.nodeCount * 10 + asset.nodeCount * 16;
  const scratch = device.gpu.createBuffer({
    size: Math.max(4, scratchFloats * 4),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const meshModels = device.gpu.createBuffer({
    size: MAX_SKELETON_NODES * 64,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const attachmentModels = device.gpu.createBuffer({
    size: MAX_ATTACHMENT_MODELS * 64,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const meshJobs = device.gpu.createBuffer({
    size: MAX_SKELETON_NODES * 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const attachmentJobs = device.gpu.createBuffer({
    size: MAX_ATTACHMENT_MODELS * (16 + 64 + 64),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const paramBuffer = device.gpu.createBuffer({
    size: 40 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  return {
    asset,
    palette,
    scratch,
    meshModels,
    attachmentModels,
    meshJobs,
    attachmentJobs,
    paramBuffer,
    computeBindGroup: null,
    destroy: () => {
      if (!existingPalette) palette.buffer.destroy();
      scratch.destroy();
      meshModels.destroy();
      attachmentModels.destroy();
      meshJobs.destroy();
      attachmentJobs.destroy();
      paramBuffer.destroy();
    },
  };
};
