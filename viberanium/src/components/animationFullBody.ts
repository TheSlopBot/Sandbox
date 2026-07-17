import { type AnimationClip } from './animationClip.ts';

export type FullBodyClipId = 'hit' | 'death' | 'deathPose';

export type AnimationFullBody = {
  active: FullBodyClipId | null;
  stateTime: number;
  animTime: number;
  frozen: boolean;
  gpuIndices: Record<FullBodyClipId, number>;
  durations: Record<FullBodyClipId, number>;
  clips: Partial<Record<FullBodyClipId, AnimationClip>>;
};

export const createAnimationFullBody = (): AnimationFullBody => ({
  active: null,
  stateTime: 0,
  animTime: 0,
  frozen: false,
  gpuIndices: { hit: -1, death: -1, deathPose: -1 },
  durations: { hit: 0, death: 0, deathPose: 0 },
  clips: {},
});
