import { type Registry } from '../engine/registry.ts';
import { type EngineOptimizationOptions } from '../engine/optimizationOptions.ts';
import { type Vec3 } from '../math/vec3.ts';
import { type GpuDevice } from '../render/gl/device.ts';
import { installTransformHierarchySystem } from './transformHierarchySystem.ts';
import { installAnimationFsmSystem } from './animationFsmSystem.ts';
import { installSkeletalPoseSystem } from './skeletalPoseSystem.ts';
import { installSkeletalMeshSystem } from './skeletalMeshSystem.ts';
import { installBoneAttachmentSystem } from './boneAttachmentSystem.ts';
import { installSkeletalGpuPoseSystem } from './skeletalGpuPoseSystem.ts';

export type SkeletalCharacterSystemsOptions = {
  device?: GpuDevice;
  getLodOrigin?: () => Vec3;
  optimization?: EngineOptimizationOptions;
};

export const installSkeletalCharacterSystems = (
  registry: Registry,
  options: SkeletalCharacterSystemsOptions = {},
) => {
  const removeHierarchy = installTransformHierarchySystem(registry);
  const removeFsm = installAnimationFsmSystem(registry);

  if (options.device) {
    const removeGpuPose = installSkeletalGpuPoseSystem(registry, {
      device: options.device,
      getLodOrigin: options.getLodOrigin,
      optimization: options.optimization,
    });

    return () => {
      removeHierarchy();
      removeFsm();
      removeGpuPose();
    };
  }

  const removePose = installSkeletalPoseSystem(registry, options);
  const removeMesh = installSkeletalMeshSystem(registry, options);
  const removeBone = installBoneAttachmentSystem(registry, options);

  return () => {
    removeHierarchy();
    removeFsm();
    removePose();
    removeMesh();
    removeBone();
  };
};
