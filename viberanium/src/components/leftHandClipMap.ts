import { type AnimationClip } from './animationClip.ts';
import { type LeftHandStateId } from './leftHandStateMachine.ts';

export type LeftHandClipId = Exclude<LeftHandStateId, 'none'>;

export type LeftHandClipMap = {
  clips: Partial<Record<LeftHandClipId, AnimationClip>>;
};

export const createLeftHandClipMap = (
  clips: Partial<Record<LeftHandClipId, AnimationClip>> = {},
): LeftHandClipMap => ({
  clips: { ...clips },
});

export const clearLeftHandClipMap = (map: LeftHandClipMap): void => {
  map.clips = {};
};
