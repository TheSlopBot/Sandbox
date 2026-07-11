import { type Registry } from '../engine/registry.ts';
import { type EngineOptimizationOptions } from '../engine/optimizationOptions.ts';
import { type Vec3 } from '../math/vec3.ts';
import { type GpuDevice } from '../render/gl/device.ts';
import { installTransformHierarchySystem } from './transformHierarchySystem.ts';
import { installAnimationFsmSystem } from './animationFsmSystem.ts';
import { installSkeletalGpuPoseSystem } from './skeletalGpuPoseSystem.ts';

export type SkeletalCharacterSystemsOptions = {
  device: GpuDevice;
  setPreDrawEncode?: (fn: ((encoder: GPUCommandEncoder) => void) | null) => void;
  getLodOrigin?: () => Vec3;
  optimization?: EngineOptimizationOptions;
};

export const installSkeletalCharacterSystems = (
  registry: Registry,
  options: SkeletalCharacterSystemsOptions,
) => {
  const removeHierarchy = installTransformHierarchySystem(registry);
  const removeFsm = installAnimationFsmSystem(registry);
  const removeGpuPose = installSkeletalGpuPoseSystem(registry, {
    device: options.device,
    setPreDrawEncode: options.setPreDrawEncode,
    getLodOrigin: options.getLodOrigin,
    optimization: options.optimization,
  });

  return () => {
    removeHierarchy();
    removeFsm();
    removeGpuPose();
  };
};
