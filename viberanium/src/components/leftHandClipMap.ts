import { type AnimationClip } from './animationClip.ts';
import { type LeftHandStateId } from './leftHandStateMachine.ts';

export type LeftHandClipId = Exclude<LeftHandStateId, 'none'>;

export type LeftHandClipMap = {
  clips: Partial<Record<LeftHandClipId, AnimationClip>>;
  gpuIndices: Partial<Record<LeftHandClipId, number>>;
};

export const createLeftHandClipMap = (
  clips: Partial<Record<LeftHandClipId, AnimationClip>> = {},
): LeftHandClipMap => ({
  clips: { ...clips },
  gpuIndices: {},
});

export const clearLeftHandClipMap = (map: LeftHandClipMap): void => {
  map.clips = {};
  map.gpuIndices = {};
};
