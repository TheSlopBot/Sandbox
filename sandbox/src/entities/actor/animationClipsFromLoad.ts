import { type AnimStateId, type AnimationClip } from 'viberanium';
import { type SkeletalCharacterLoad } from './loadSkeletalCharacter.ts';

export const animationClipsFromLoad = (
  clips: SkeletalCharacterLoad['clips'],
): Record<AnimStateId, AnimationClip> => ({
  idle: clips.idle,
  run: clips.run,
  walkBack: clips.walkBack,
  jumpStart: clips.jumpStart,
  jumpAir: clips.jumpIdle,
  jumpLand: clips.jumpLand,
});
