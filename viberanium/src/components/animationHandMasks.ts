import { type RuntimeScene } from '../assets/gltf/runtime.ts';

export type AnimationHandMasks = {
  lowerBodyMask: Uint32Array;
  rightArmMask: Uint32Array;
  leftArmMask: Uint32Array;
  spineNodeIndex: number;
  headNodeIndex: number;
  maskWords: number;
};

const DEFAULT_RIGHT_ARM_ROOT = 'upperarm.r';
const DEFAULT_LEFT_ARM_ROOT = 'upperarm.l';
const DEFAULT_SPINE = 'spine';
const DEFAULT_HEAD = 'head';

const findNodeIndex = (nodes: RuntimeScene['nodes'], name: string): number => {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i]!.name === name) return i;
  }
  return -1;
};

const maskWordsFor = (nodeCount: number): number => Math.ceil(Math.max(1, nodeCount) / 32);

const setBit = (mask: Uint32Array, node: number): void => {
  if (node < 0) return;
  mask[node >>> 5]! |= 1 << (node & 31);
};

const hasBit = (mask: Uint32Array, node: number): boolean =>
  ((mask[node >>> 5] ?? 0) & (1 << (node & 31))) !== 0;

const collectSubtree = (
  nodes: RuntimeScene['nodes'],
  rootIndex: number,
  out: Uint32Array,
): void => {
  if (rootIndex < 0) return;
  setBit(out, rootIndex);
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i]!.parent === rootIndex) collectSubtree(nodes, i, out);
  }
};

export const buildAnimationHandMasks = (
  scene: RuntimeScene,
  opts: {
    rightArmRootBone?: string;
    leftArmRootBone?: string;
    spineBone?: string;
    headBone?: string;
  } = {},
): AnimationHandMasks => {
  const nodeCount = scene.nodes.length;
  const maskWords = maskWordsFor(nodeCount);
  const rightArmMask = new Uint32Array(maskWords);
  const leftArmMask = new Uint32Array(maskWords);
  const lowerBodyMask = new Uint32Array(maskWords);

  const rightRoot = findNodeIndex(scene.nodes, opts.rightArmRootBone ?? DEFAULT_RIGHT_ARM_ROOT);
  const leftRoot = findNodeIndex(scene.nodes, opts.leftArmRootBone ?? DEFAULT_LEFT_ARM_ROOT);
  const spineNodeIndex = findNodeIndex(scene.nodes, opts.spineBone ?? DEFAULT_SPINE);
  const headNodeIndex = findNodeIndex(scene.nodes, opts.headBone ?? DEFAULT_HEAD);

  collectSubtree(scene.nodes, rightRoot, rightArmMask);
  collectSubtree(scene.nodes, leftRoot, leftArmMask);

  for (let i = 0; i < nodeCount; i++) {
    if (hasBit(rightArmMask, i) || hasBit(leftArmMask, i)) continue;
    setBit(lowerBodyMask, i);
  }

  return {
    lowerBodyMask,
    rightArmMask,
    leftArmMask,
    spineNodeIndex: spineNodeIndex >= 0 ? spineNodeIndex : 0,
    headNodeIndex: headNodeIndex >= 0 ? headNodeIndex : 0,
    maskWords,
  };
};

export const createAnimationHandMasks = (
  scene: RuntimeScene,
  opts?: {
    rightArmRootBone?: string;
    leftArmRootBone?: string;
    spineBone?: string;
    headBone?: string;
  },
): AnimationHandMasks => buildAnimationHandMasks(scene, opts);
