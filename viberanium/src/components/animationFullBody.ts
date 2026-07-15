export type AnimationFullBody = {
  active: 'hit' | 'death' | null;
  stateTime: number;
  animTime: number;
};

export const createAnimationFullBody = (): AnimationFullBody => ({
  active: null,
  stateTime: 0,
  animTime: 0,
});
