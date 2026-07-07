export { useRegistry, type Registry } from './engine/registry.ts';
export { useGame, type Game } from './engine/game.ts';
export { useScene, type Scene } from './engine/scene.ts';
export { createEntity, type Entity, type EntityId } from './engine/entity.ts';
export { COMPONENT_KEYS, type ComponentKey } from './engine/componentKeys.ts';

export { createInput, type Input } from './input/input.ts';

export { v3, v3Set, v3Copy, v3Normalize, type Vec3 } from './math/vec3.ts';
export { m4, m4Copy, m4Mul, m4LookAt, m4Perspective, m4Ortho, type Mat4 } from './math/mat4.ts';

export {
  aabbIntersects,
  aabbOverlapsYStrict,
  makeAabb,
} from './collision/aabb.ts';
export {
  obbIntersectsAabb,
  hasHorizontalSupport,
  resolveAabbVsObbHorizontal,
  getSupportSurfaceY,
} from './collision/obb.ts';

export { createTransform, updateWorldMatrix, type Transform } from './components/transform.ts';
export { type Renderable } from './components/renderable.ts';
export { aabb, type Collider, type Aabb } from './components/collider.ts';
export { createSkinInstance, type SkinInstance } from './components/skin.ts';
export {
  buildRetargetedClips,
  sampleClipToNodes,
  type AnimClip,
} from './components/animation.ts';

export { loadGltf } from './assets/gltf/loader.ts';
export {
  buildRuntimeScene,
  computeSkinPalette,
  snapshotPose,
  updateWorldFromLocals,
  type RuntimeScene,
} from './assets/gltf/runtime.ts';
export { buildRuntimeModel } from './assets/gltf/buildRuntime.ts';
export { buildGltfMaterials } from './assets/gltf/materials.ts';

export {
  installRenderPipeline,
  type RenderPipeline,
  type PostProcessStage,
  type PipelineOptions,
} from './render/pipeline.ts';
export { TextureCache } from './render/gl/texture.ts';
export { createInterleavedMesh, createSkinnedMesh } from './render/gl/mesh.ts';
export { type Material, type DrawItem, type Camera, DIRECTIONAL_LIGHT } from './render/types.ts';
export {
  createLoadingScreen,
  fadeOutLoadingScreen,
  type LoadingScreen,
  type LoadingScreenColors,
  type LoadingScreenOptions,
} from './render/loading/loadingScreen.ts';
export {
  createAsciiPostProcessStage,
  type AsciiStageOptions,
} from './render/createAsciiPostProcessStage.ts';

export { createCharacterController, type CharacterController } from './starter/components/characterController.ts';
export { createCameraFollow, type CameraFollow } from './starter/components/cameraFollow.ts';
export { createLocomotionIntent, type LocomotionIntent } from './starter/components/locomotionIntent.ts';
export { createPlayerController, type PlayerController } from './starter/components/playerController.ts';
export { createAiController, type AiController } from './starter/components/aiController.ts';
export {
  createSkeletalRig,
  type SkeletalRig,
  type AnimClips,
  type CharacterPart,
} from './starter/components/skeletalRig.ts';

export { installPlayerInputSystem } from './starter/systems/playerInputSystem.ts';
export { installAiControllerSystem } from './starter/systems/aiControllerSystem.ts';
export { installLocomotionSystem } from './starter/systems/locomotionSystem.ts';
export { installCharacterPhysicsSystem } from './starter/systems/characterPhysicsSystem.ts';
export { installCollisionSystem } from './starter/systems/collisionSystem.ts';
export { installCharacterStateSystem } from './starter/systems/characterStateSystem.ts';
export { installCameraFollowSystem } from './starter/systems/cameraFollowSystem.ts';
export { installSkeletalAnimationSystem } from './starter/systems/skeletalAnimationSystem.ts';
