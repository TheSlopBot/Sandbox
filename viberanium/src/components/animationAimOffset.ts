export type AnimationAimOffset = {
  torsoYawRad: number;
  headYawRad: number;
  maxTorsoYawRad: number;
  maxHeadYawRad: number;
  enabled: boolean;
};

export const createAnimationAimOffset = (): AnimationAimOffset => ({
  torsoYawRad: 0,
  headYawRad: 0,
  maxTorsoYawRad: Math.PI / 3,
  maxHeadYawRad: Math.PI / 3,
  enabled: true,
});
