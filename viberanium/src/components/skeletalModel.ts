import { type RuntimeScene } from '../assets/gltf/runtime.ts';

export type SkeletalModel = {
  bodyScene: RuntimeScene;
  visualYOffset: number;
};

export const createSkeletalModel = (
  bodyScene: RuntimeScene,
  visualYOffset = -0.55,
): SkeletalModel => ({
  bodyScene,
  visualYOffset,
});
