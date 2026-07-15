export type AnimationPoseOverlay = {
  spineYawRad: number;
  headYawRad: number;
};

export const createAnimationPoseOverlay = (): AnimationPoseOverlay => ({
  spineYawRad: 0,
  headYawRad: 0,
});
