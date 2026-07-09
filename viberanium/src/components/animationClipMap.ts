import { type AnimationClip } from './animationClip.ts';
import { type AnimStateId } from './animationStateMachine.ts';

export type AnimationClipMap = {
  clips: Record<AnimStateId, AnimationClip>;
};

export const createAnimationClipMap = (
  clips: Record<AnimStateId, AnimationClip>,
): AnimationClipMap => ({
  clips,
});
