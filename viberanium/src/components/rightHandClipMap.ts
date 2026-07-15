import { type AnimationClip } from './animationClip.ts';
import { type RightHandStateId } from './rightHandStateMachine.ts';

export type RightHandClipId = Exclude<RightHandStateId, 'none'>;

export type RightHandClipMap = {
  clips: Partial<Record<RightHandClipId, AnimationClip>>;
  gpuIndices: Partial<Record<RightHandClipId, number>>;
};

export const createRightHandClipMap = (
  clips: Partial<Record<RightHandClipId, AnimationClip>> = {},
): RightHandClipMap => ({
  clips: { ...clips },
  gpuIndices: {},
});

export const clearRightHandClipMap = (map: RightHandClipMap): void => {
  map.clips = {};
  map.gpuIndices = {};
};
