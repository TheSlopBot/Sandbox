import { type AnimClip, getClipAnimatedNodes } from '../../components/animation.ts';
import { type AnimStateId } from '../../components/animationStateMachine.ts';
import { type AnimationClipMap } from '../../components/animationClipMap.ts';
import { type RightHandClipMap } from '../../components/rightHandClipMap.ts';
import { type LeftHandClipMap } from '../../components/leftHandClipMap.ts';
import { type RightHandStateId } from '../../components/rightHandStateMachine.ts';
import { type LeftHandStateId } from '../../components/leftHandStateMachine.ts';

export const GPU_MOVEMENT_CLIP_ORDER: readonly AnimStateId[] = [
  'idle',
  'run',
  'walkBack',
  'jumpStart',
  'jumpAir',
  'jumpLand',
];

export const GPU_RIGHT_HAND_CLIP_ORDER: readonly RightHandStateId[] = [
  'none',
  'idleHold',
  'aim',
  'attack',
  'reload',
];

export const GPU_LEFT_HAND_CLIP_ORDER: readonly LeftHandStateId[] = [
  'none',
  'idleHold',
  'block',
  'attack',
];

export const GPU_CLIP_STATE_ORDER = GPU_MOVEMENT_CLIP_ORDER;

export const GPU_MOVEMENT_CLIP_COUNT = GPU_MOVEMENT_CLIP_ORDER.length;
export const GPU_RIGHT_HAND_CLIP_COUNT = GPU_RIGHT_HAND_CLIP_ORDER.length;
export const GPU_LEFT_HAND_CLIP_COUNT = GPU_LEFT_HAND_CLIP_ORDER.length;
export const GPU_TOTAL_CLIP_COUNT =
  GPU_MOVEMENT_CLIP_COUNT + GPU_RIGHT_HAND_CLIP_COUNT + GPU_LEFT_HAND_CLIP_COUNT;

export const clipStateIndex = (state: AnimStateId): number => {
  const idx = GPU_MOVEMENT_CLIP_ORDER.indexOf(state);
  return idx < 0 ? 0 : idx;
};

export const rightHandClipStateIndex = (state: RightHandStateId): number => {
  const idx = GPU_RIGHT_HAND_CLIP_ORDER.indexOf(state);
  return GPU_MOVEMENT_CLIP_COUNT + (idx < 0 ? 0 : idx);
};

export const leftHandClipStateIndex = (state: LeftHandStateId): number => {
  const idx = GPU_LEFT_HAND_CLIP_ORDER.indexOf(state);
  return GPU_MOVEMENT_CLIP_COUNT + GPU_RIGHT_HAND_CLIP_COUNT + (idx < 0 ? 0 : idx);
};

export type GpuPackedClips = {
  clipCount: number;
  channelCount: number;
  nodeCount: number;
  clipHeaders: Uint32Array;
  channelHeaders: Uint32Array;
  times: Float32Array;
  values: Float32Array;
  animatedMask: Uint32Array;
};

export type PackClipsForGpuOpts = {
  rightHandClipMap?: RightHandClipMap | null;
  leftHandClipMap?: LeftHandClipMap | null;
};

const PATH_TRANSLATION = 0;
const PATH_ROTATION = 1;
const PATH_SCALE = 2;

const pathToCode = (path: 'translation' | 'rotation' | 'scale'): number => {
  if (path === 'translation') return PATH_TRANSLATION;
  if (path === 'rotation') return PATH_ROTATION;
  return PATH_SCALE;
};

const rightClipOf = (
  map: RightHandClipMap | null | undefined,
  state: RightHandStateId,
): AnimClip | null => {
  if (state === 'none' || !map) return null;
  return map.clips[state]?.clip ?? null;
};

const leftClipOf = (
  map: LeftHandClipMap | null | undefined,
  state: LeftHandStateId,
): AnimClip | null => {
  if (state === 'none' || !map) return null;
  return map.clips[state]?.clip ?? null;
};

export const packClipsForGpu = (
  clipMap: AnimationClipMap,
  nodeCount: number,
  opts: PackClipsForGpuOpts = {},
): GpuPackedClips => {
  const clips: (AnimClip | null)[] = [
    ...GPU_MOVEMENT_CLIP_ORDER.map((id) => clipMap.clips[id]?.clip ?? null),
    ...GPU_RIGHT_HAND_CLIP_ORDER.map((id) => rightClipOf(opts.rightHandClipMap, id)),
    ...GPU_LEFT_HAND_CLIP_ORDER.map((id) => leftClipOf(opts.leftHandClipMap, id)),
  ];

  const clipHeaders = new Uint32Array(clips.length * 4);
  const channelHeaders: number[] = [];
  const times: number[] = [];
  const values: number[] = [];
  const maskWords = Math.ceil(Math.max(1, nodeCount) / 32);
  const animatedMask = new Uint32Array(clips.length * maskWords);

  let channelCount = 0;

  for (let ci = 0; ci < clips.length; ci++) {
    const clip = clips[ci];
    const headerBase = ci * 4;

    if (!clip) {
      clipHeaders[headerBase] = 0;
      clipHeaders[headerBase + 1] = 0;
      clipHeaders[headerBase + 2] = channelCount;
      clipHeaders[headerBase + 3] = 0;
      continue;
    }

    const durationBits = new Uint32Array(new Float32Array([clip.duration]).buffer)[0]!;
    clipHeaders[headerBase] = durationBits;
    clipHeaders[headerBase + 1] = clip.channels.length;
    clipHeaders[headerBase + 2] = channelCount;
    clipHeaders[headerBase + 3] = 1;

    const animated = getClipAnimatedNodes(clip);
    const maskBase = ci * maskWords;
    for (let i = 0; i < animated.length; i++) {
      const node = animated[i]!;
      if (node < 0 || node >= nodeCount) continue;
      animatedMask[maskBase + (node >>> 5)]! |= 1 << (node & 31);
    }

    for (const ch of clip.channels) {
      channelHeaders.push(
        ch.targetNodeIndex,
        pathToCode(ch.path),
        ch.times.length,
        times.length,
        values.length,
        0,
      );
      for (let i = 0; i < ch.times.length; i++) times.push(ch.times[i]!);
      for (let i = 0; i < ch.values.length; i++) values.push(ch.values[i]!);
      channelCount++;
    }
  }

  return {
    clipCount: clips.length,
    channelCount,
    nodeCount,
    clipHeaders,
    channelHeaders: new Uint32Array(channelHeaders),
    times: new Float32Array(times.length ? times : [0]),
    values: new Float32Array(values.length ? values : [0]),
    animatedMask,
  };
};
