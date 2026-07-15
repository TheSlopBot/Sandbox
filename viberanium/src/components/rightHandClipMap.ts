import { type AnimationClip } from './animationClip.ts';
import { type RightHandStateId } from './rightHandStateMachine.ts';

export type RightHandClipId = Exclude<RightHandStateId, 'none'>;

export type RightHandClipMap = {
  clips: Partial<Record<RightHandClipId, AnimationClip>>;
};

export const createRightHandClipMap = (
  clips: Partial<Record<RightHandClipId, AnimationClip>> = {},
): RightHandClipMap => ({
  clips: { ...clips },
});

export const clearRightHandClipMap = (map: RightHandClipMap): void => {
  map.clips = {};
};
