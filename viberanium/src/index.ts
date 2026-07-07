export { useRegistry, type Registry } from './engine/registry.ts';
export { useGame } from './engine/game.ts';
export { createEntity, type Entity, type EntityId } from './engine/entity.ts';

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
export { installCharacterSystem } from './starter/systems/characterSystem.ts';
export { installCameraSystem } from './starter/systems/cameraSystem.ts';
export {
  installAnimationSystem,
  type AnimClips,
  type CharacterPart,
} from './starter/systems/animationSystem.ts';
