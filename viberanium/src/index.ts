export { useRegistry, type Registry } from './engine/registry.ts';
export { useGame, type Game } from './engine/game.ts';
export { useScene, type Scene } from './engine/scene.ts';
export { createEntity, type Entity, type EntityId } from './engine/entity.ts';
export { COMPONENT_KEYS, type ComponentKey } from './engine/componentKeys.ts';
export {
  createEngineOptimizationOptions,
  DEFAULT_ENGINE_OPTIMIZATION,
  skeletonSkipChanceForDist,
  type EngineOptimizationOptions,
  type SkeletonLodOptions,
} from './engine/optimizationOptions.ts';

export { createInput, type Input } from './input/input.ts';

export { v3, v3Set, v3Copy, v3Normalize, type Vec3 } from './math/vec3.ts';
export { m4, m4Copy, m4Mul, m4Invert, m4LookAt, m4Perspective, m4Ortho, m4FromTRS, m4FromTRSQuat, type Mat4 } from './math/mat4.ts';
export {
  q4,
  q4Copy,
  q4Normalize,
  q4Slerp,
  q4FromYaw,
  q4Conjugate,
  q4TransformVec3,
  type Quat,
} from './math/quat.ts';

export {
  aabbIntersects,
  aabbOverlapsYStrict,
  makeAabb,
} from './collision/aabb.ts';
export {
  type CapsuleY,
  capsuleToAabb,
  resolveCapsuleHorizontal,
  resolveCapsuleVertical,
  getCapsuleSupportSurfaceY,
  hasCapsuleSupport,
  pointBlocksNav,
} from './collision/capsule.ts';

export { createTransform, updateWorldMatrix, type Transform } from './components/transform.ts';
export { type Renderable } from './components/renderable.ts';
export {
  createGroundPlane,
  type GroundPlane,
  type GroundPlaneMesh,
} from './components/groundPlane.ts';
export {
  aabb,
  createBoxCollider,
  createCylinderCollider,
  createSphereCollider,
  createEllipsoidCollider,
  updateColliderAabbFromShape,
  bakeColliderWorldFromLocal,
  type Collider,
  type ColliderShape,
  type Aabb,
} from './components/collider.ts';
export { createSkinInstance, type SkinInstance } from './components/skin.ts';
export {
  buildRetargetedClips,
  getClipAnimatedNodes,
  sampleClipToNodes,
  type AnimClip,
} from './components/animation.ts';

export {
  createCharacterController,
  characterFootOffset,
  characterHeadOffset,
  type CharacterController,
} from './components/characterController.ts';
export { createCameraFollow, type CameraFollow } from './components/cameraFollow.ts';
export { createMovementIntent, type MovementIntent } from './components/movementIntent.ts';
export { createNavGrid, type NavGridComponent, type NavGridOpts } from './components/navGrid.ts';
export { createSkeletalModel, type SkeletalModel } from './components/skeletalModel.ts';
export { createMeshDraws, type MeshDraws, type MeshDrawPart } from './components/meshDraws.ts';
export { createChildOf, type ChildOf } from './components/childOf.ts';
export { createChildren, addChildId, removeChildId, type Children } from './components/children.ts';
export { createLocalTransform, type LocalTransform } from './components/localTransform.ts';
export {
  createBoneAttachment,
  createAttachmentOffset,
  type BoneAttachment,
} from './components/boneAttachment.ts';
export { createAnimationClip, type AnimationClip } from './components/animationClip.ts';
export {
  createAnimationClipMap,
  type AnimationClipMap,
} from './components/animationClipMap.ts';
export {
  createAnimationStateMachine,
  stepAnimationFsm,
  type AnimationStateMachine,
  type AnimStateId,
} from './components/animationStateMachine.ts';
export { createStaticModel, type StaticModel } from './components/staticModel.ts';
export { createRenderGroup, type RenderGroup } from './components/renderGroup.ts';

export { loadGltf, type LoadedGltf } from './assets/gltf/loader.ts';
export { createGltfCache, type GltfCache } from './assets/gltf/cache.ts';
export {
  buildRuntimeScene,
  computeSkinPalette,
  snapshotPose,
  updateWorldFromLocals,
  updateWorldFromLocalsDirty,
  type RuntimeScene,
} from './assets/gltf/runtime.ts';
export { buildRuntimeModel } from './assets/gltf/buildRuntime.ts';
export { buildGltfMaterials } from './assets/gltf/materials.ts';

export { buildNavGrid, updateNavGridBlocked, isWalkableWorld, worldToCell, cellToWorld, type NavGrid } from './navigation/navGrid.ts';
export { markNavGridDirty } from './navigation/markNavGridDirty.ts';
export { findPath, pickRandomObjective } from './navigation/astar.ts';

export { installMovementSystem } from './systems/movementSystem.ts';
export { installNavGridSystem } from './systems/navGridSystem.ts';
export { installCharacterPhysicsSystem } from './systems/characterPhysicsSystem.ts';
export { installCollisionSystem, getObstacles } from './systems/collisionSystem.ts';
export { installColliderTransformSystem } from './systems/colliderTransformSystem.ts';
export { installCharacterStateSystem } from './systems/characterStateSystem.ts';
export { installAnimationFsmSystem } from './systems/animationFsmSystem.ts';
export { installCameraFollowSystem } from './systems/cameraFollowSystem.ts';
export { installTransformHierarchySystem } from './systems/transformHierarchySystem.ts';
export { installSkeletalPoseSystem } from './systems/skeletalPoseSystem.ts';
export { installSkeletalMeshSystem } from './systems/skeletalMeshSystem.ts';
export { installBoneAttachmentSystem } from './systems/boneAttachmentSystem.ts';
export {
  installSkeletalCharacterSystems,
  type SkeletalCharacterSystemsOptions,
} from './systems/installSkeletalCharacterSystems.ts';
export { installStaticModelSystem } from './systems/staticModelSystem.ts';

export {
  installRenderPipeline,
  type RenderPipeline,
  type PostProcessStage,
  type PipelineOptions,
} from './render/pipeline.ts';
export { createTextureCache, type TextureCache } from './render/gl/texture.ts';
export { createInterleavedMesh, createSkinnedMesh, destroyMesh } from './render/gl/mesh.ts';
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
