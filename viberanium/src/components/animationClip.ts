import { type AnimClip } from './animation.ts';

export type AnimationClip = {
  clip: AnimClip;
};

export const createAnimationClip = (clip: AnimClip): AnimationClip => ({
  clip,
});
