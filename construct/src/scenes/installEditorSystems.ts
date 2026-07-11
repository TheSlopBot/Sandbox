import {
  type GpuDevice,
  type LocalTransform,
  type Registry,
  type RenderPipeline,
  installCharacterStateSystem,
  installColliderTransformSystem,
  installSkeletalCharacterSystems,
  installStaticModelSystem,
  installTransformHierarchySystem,
} from 'viberanium';
import { type PropDocument } from '../catalog/props/propDocument.ts';
import { installConstructOrbitSystem } from '../entities/orbit/orbitSystem.ts';
import { installConstructGizmoSystem } from '../entities/gizmos/gizmoSystem.ts';
import { installSkeletonOverlaySystem } from '../entities/actorEditor/skeletonOverlaySystem.ts';
import { installActorColliderFollowSystem } from '../entities/actorEditor/installActorColliderFollowSystem.ts';
import { type ConstructSessionState } from '../session/types.ts';

export type EditorSceneSystems = {
  removeOrbitSystem: () => void;
  gizmoController: ReturnType<typeof installConstructGizmoSystem>;
};

export const installEditorSceneSystems = (
  device: GpuDevice,
  registry: Registry,
  pipeline: RenderPipeline,
  canvas: HTMLCanvasElement,
  getPropDocument: () => PropDocument,
  setPropDocument: (doc: PropDocument) => void,
  isActive: () => boolean,
  onGizmoCommit: (partId: string, local: LocalTransform) => void,
): EditorSceneSystems => {
  const removeOrbitSystem = installConstructOrbitSystem(registry, pipeline);
  installCharacterStateSystem(registry);
  installTransformHierarchySystem(registry);
  installColliderTransformSystem(registry);

  const gizmoController = installConstructGizmoSystem(
    device,
    registry,
    pipeline,
    canvas,
    getPropDocument,
    setPropDocument,
    isActive,
    onGizmoCommit,
  );

  return { removeOrbitSystem, gizmoController };
};

export const ensurePreviewSkeletalSystems = (
  registry: Registry,
  device: GpuDevice,
  pipeline: RenderPipeline,
  state: ConstructSessionState,
) => {
  if (state.removeSkeletalSystem) state.removeSkeletalSystem();
  state.removeSkeletalSystem = installSkeletalCharacterSystems(registry, {
    device,
    setPreDrawEncode: pipeline.setPreDrawEncode,
  });
};

export const ensurePropStaticModelSystem = (registry: Registry, state: ConstructSessionState) => {
  if (state.removeStaticModelSystem) return;
  state.removeStaticModelSystem = installStaticModelSystem(registry);
};

export const ensureActorEditorSystems = (
  registry: Registry,
  device: GpuDevice,
  pipeline: RenderPipeline,
  state: ConstructSessionState,
) => {
  if (!state.removeSkeletalSystem) {
    state.removeSkeletalSystem = installSkeletalCharacterSystems(registry, {
      device,
      setPreDrawEncode: pipeline.setPreDrawEncode,
    });
  }
  if (!state.removeSkeletonOverlaySystem) {
    state.removeSkeletonOverlaySystem = installSkeletonOverlaySystem(registry);
  }
  if (!state.removeActorColliderFollowSystem) {
    state.removeActorColliderFollowSystem = installActorColliderFollowSystem(registry);
  }
};

export const stopActorEditorSystems = (state: ConstructSessionState) => {
  if (state.removeSkeletonOverlaySystem) {
    state.removeSkeletonOverlaySystem();
    state.removeSkeletonOverlaySystem = null;
  }
  if (state.removeActorColliderFollowSystem) {
    state.removeActorColliderFollowSystem();
    state.removeActorColliderFollowSystem = null;
  }
};

export const stopModeSystems = (state: ConstructSessionState) => {
  if (state.removeSkeletalSystem) {
    state.removeSkeletalSystem();
    state.removeSkeletalSystem = null;
  }
  if (state.removeStaticModelSystem) {
    state.removeStaticModelSystem();
    state.removeStaticModelSystem = null;
  }
  stopActorEditorSystems(state);
};
