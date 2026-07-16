export { useRegistry, type Registry } from './engine/registry.ts';
export { useGame, type Game } from './engine/game.ts';
export { useScene, type Scene } from './engine/scene.ts';
export { createEntity, type Entity, type EntityId } from './engine/entity.ts';
export { COMPONENT_KEYS, type ComponentKey } from './engine/componentKeys.ts';
export {
  createEngineOptimizationOptions,
  createEngineOptimizationFromPreset,
  detectPreferredQualityPreset,
  DEFAULT_ENGINE_OPTIMIZATION,
  RENDER_QUALITY_PRESETS,
  skeletonLodUpdateInterval,
  type EngineOptimizationOptions,
  type RenderQualityPresetId,
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
  type BodyY,
  bodyToAabb,
  resolveCylinderMoveAndSlide,
  pointBlocksNav,
  classifyContact,
  isSlideSlope,
  applySlideVelocity,
  DEFAULT_FLOOR_MAX_ANGLE,
  SLIDE_START_SPEED_FACTOR,
  SLIDE_MAX_SPEED_FACTOR,
  SLIDE_ACCEL_TIME_SEC,
} from './collision/characterCollision.ts';
export {
  collectCharacterCollisionColliders,
  readCharacterBodyFromCollisionColliders,
} from './collision/characterCollisionBody.ts';
export {
  type BodyContact,
  contactBodyVsCollider,
} from './collision/characterContact.ts';

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
  characterBodyToSolver,
  type CharacterController,
  type CharacterBodyCylinder,
} from './components/characterController.ts';
export { createCameraFollow, type CameraFollow } from './components/cameraFollow.ts';
export { createMovementIntent, type MovementIntent } from './components/movementIntent.ts';
export {
  createMovementImpulse,
  addMovementImpulse,
  type MovementImpulse,
} from './components/movementImpulse.ts';
export { createNavGrid, type NavGridComponent, type NavGridOpts } from './components/navGrid.ts';
export { createSkeletalModel, type SkeletalModel } from './components/skeletalModel.ts';
export { createMeshDraws, type MeshDraws, type MeshDrawPart, type GpuModelSource } from './components/meshDraws.ts';
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
  getOrBuildRuntimeScene,
  computeSkinPalette,
  snapshotPose,
  applyPose,
  updateWorldFromLocals,
  updateWorldFromLocalsDirty,
  type RuntimeScene,
  type RuntimePose,
} from './assets/gltf/runtime.ts';
export { buildRuntimeModel } from './assets/gltf/buildRuntime.ts';
export { buildGltfMaterials, getOrBuildGltfMaterials } from './assets/gltf/materials.ts';
export {
  buildMeshDrawsFromRuntimeScene,
  findBoneNodeIndex,
} from './assets/gltf/buildMeshDrawsFromRuntimeScene.ts';
export { colliderFromShape, type ColliderShapeSpec } from './components/colliderFromShape.ts';

export { buildNavGrid, updateNavGridBlocked, isWalkableWorld, worldToCell, cellToWorld, type NavGrid } from './navigation/navGrid.ts';
export { markNavGridDirty } from './navigation/markNavGridDirty.ts';
export { findPath, pickRandomObjective } from './navigation/astar.ts';

export { installMovementSystem } from './systems/movementSystem.ts';
export { installNavGridSystem } from './systems/navGridSystem.ts';
export { installCollisionSystem, type CollisionSystemOptions } from './systems/collisionSystem.ts';
export {
  installCharacterPhysicsSystem,
  type CharacterPhysicsSystemOptions,
} from './systems/characterPhysicsSystem.ts';
export { installColliderTransformSystem } from './systems/colliderTransformSystem.ts';
export { installCharacterStateSystem } from './systems/characterStateSystem.ts';
export { installAnimationFsmSystem } from './systems/animationFsmSystem.ts';
export { installCameraFollowSystem } from './systems/cameraFollowSystem.ts';
export { installTransformHierarchySystem } from './systems/transformHierarchySystem.ts';
export {
  installSkeletalCharacterSystems,
  type SkeletalCharacterSystemsOptions,
} from './systems/installSkeletalCharacterSystems.ts';
export { installSkeletalGpuPoseSystem } from './systems/skeletalGpuPoseSystem.ts';
export { installStaticModelSystem } from './systems/staticModelSystem.ts';

export { createDevice, type GpuDevice } from './render/gl/device.ts';
export {
  installRenderPipeline,
  type RenderPipeline,
  type PostProcessStage,
  type PipelineOptions,
} from './render/pipeline.ts';
export { createTextureCache, type TextureCache, type TextureHandle } from './render/gl/texture.ts';
export { createInterleavedMesh, createSkinnedMesh, destroyMesh, type Mesh, type SkinnedMesh } from './render/gl/mesh.ts';
export { createSharedMeshCache, type SharedMeshCache } from './render/gl/sharedMeshCache.ts';
export {
  createStaticPropBatcher,
  type StaticPropBatcher,
  type StaticPropBatchHandle,
  type PreparedStaticBatch,
} from './render/gl/staticPropBatcher.ts';
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

export {
  type ActorAttachmentDef,
  type ActorCharacterDef,
  type ActorColliderDef,
  type ActorColliderParent,
  type ActorColliderShape,
  type ActorDefinition,
  identityAttachmentLocal,
  collectUrlsFromActor,
} from './definitions/actors/actorDefinition.ts';
export { actorDefinitionToSkeletalDef } from './definitions/actors/actorDefinitionToSkeletalDef.ts';
export {
  buildSimpleActor,
  type BuildSimpleActorOpts,
  type SimpleActorAttachment,
} from './definitions/actors/buildSimpleActor.ts';
export { DEFAULT_CHARACTER_BODY_CYLINDER, DEFAULT_CHARACTER_HURTBOX } from './definitions/actors/defaultCharacterBodyCylinder.ts';
export {
  type PropPartLocal,
  type PropAssetPart,
  type PropColliderPart,
  type PropDefinition,
  identityPartLocal,
} from './definitions/props/propDefinition.ts';
export {
  buildSimpleProp,
  type SimplePropCollider,
} from './definitions/props/buildSimpleProp.ts';
export {
  type AnimClipRef,
  type BoneAttachmentDef,
  type SkeletalCharacterDef,
  type SkeletalCharacterClipNames,
  collectUrlsFromDef,
} from './definitions/characters/skeletalCharacterDef.ts';
export {
  type LevelNavGridConfig,
  type SimplePropIndex,
  type LevelPropKind,
  type LevelActorKind,
  type LevelPropInstance,
  type LevelActorInstance,
  type LevelColliderShape,
  type LevelColliderInstance,
  type LevelPlayerSpawn,
  type LevelGroundVariant,
  type LevelGroundPlane,
  type LevelIndex,
  type LevelComposition,
  type LevelDefinition,
  DEFAULT_LEVEL_NAV_GRID,
  DEFAULT_LEVEL_PLAYER_SPAWN,
  DEFAULT_LEVEL_GROUND_PLANE,
  LEVEL_GROUND_VARIANTS,
  groundVariantIndex,
  normalizeLevelGroundVariant,
  identityLevelLocal,
  collectUrlsFromLevel,
  resolveLevelPropDefinition,
  resolveLevelActorDefinition,
  resolveLevelColliderPropDefinition,
} from './definitions/levels/levelDefinition.ts';
export {
  instantiateProp,
  type PropPlacement,
  type InstantiatePropOptions,
} from './spawn/instantiateProp.ts';
export { COMBAT_LAYER, COMBAT_MASK, isPhysicsLayer, combatLayersOverlap, type CombatLayerBits } from './combat/combatLayers.ts';
export { pushCombatEvent, drainCombatEvents, peekCombatEvents, type CombatEvent } from './combat/combatEvents.ts';
export {
  collidersOverlap,
  shapesOverlapApprox,
  colliderCenter,
  distanceSqBetweenColliders,
  sweptSphereHitsAabb,
} from './combat/combatContact.ts';
export {
  rebuildCombatBroadphase,
  queryCombatNearby,
  findCombatOverlaps,
} from './combat/combatBroadphase.ts';

export { createHealth, type Health } from './components/health.ts';
export {
  createCombatIntent,
  clearCombatIntentEdges,
  type CombatIntent,
} from './components/combatIntent.ts';
export { createWeapon, type Weapon, type WeaponKind, type WeaponRuntimeState } from './components/weapon.ts';
export { createProjectile, type Projectile } from './components/projectile.ts';
export {
  createEquipmentSlots,
  type EquipmentSlots,
  type EquipmentSlotState,
  type EquipmentPlaceholderSlot,
} from './components/equipmentSlots.ts';
export {
  createRightHandStateMachine,
  stepRightHandFsm,
  type RightHandStateMachine,
  type RightHandStateId,
} from './components/rightHandStateMachine.ts';
export {
  createLeftHandStateMachine,
  stepLeftHandFsm,
  type LeftHandStateMachine,
  type LeftHandStateId,
} from './components/leftHandStateMachine.ts';
export {
  createRightHandClipMap,
  clearRightHandClipMap,
  type RightHandClipMap,
  type RightHandClipId,
} from './components/rightHandClipMap.ts';
export {
  createLeftHandClipMap,
  clearLeftHandClipMap,
  type LeftHandClipMap,
  type LeftHandClipId,
} from './components/leftHandClipMap.ts';
export {
  createAnimationHandMasks,
  buildAnimationHandMasks,
  type AnimationHandMasks,
} from './components/animationHandMasks.ts';
export { createAnimationAimOffset, type AnimationAimOffset } from './components/animationAimOffset.ts';
export {
  createAnimationPoseOverlay,
  type AnimationPoseOverlay,
} from './components/animationPoseOverlay.ts';
export { createAnimationFullBody, type AnimationFullBody } from './components/animationFullBody.ts';
export { createDestructible, type Destructible } from './components/destructible.ts';

export {
  type WeaponDefinition,
  type WeaponColliderDef,
  type WeaponClipBinding,
  type WeaponClipSlot,
  normalizeWeaponClipBinding,
  collectUrlsFromWeapon,
} from './definitions/weapons/weaponDefinition.ts';

export {
  DEFAULT_MELEE_TORSO_YAW_CURVE,
  sampleMeleeTorsoYaw,
  type MeleeTorsoYawCurve,
} from './combat/meleeTorsoYawCurve.ts';

export { spawnActorColliders } from './spawn/spawnActorColliders.ts';
export { spawnProjectile } from './spawn/combat/spawnProjectile.ts';
export { attachWeaponHitbox, detachWeaponHitbox } from './spawn/combat/attachWeaponHitbox.ts';

export { installProjectileSystem } from './systems/combat/installProjectileSystem.ts';
export { installCombatResolveSystem, type CombatResolveDeps } from './systems/combat/installCombatResolveSystem.ts';
export { installHealthSystem, type HealthSystemHooks } from './systems/combat/installHealthSystem.ts';
export { installHitboxFollowSystem } from './systems/combat/installHitboxFollowSystem.ts';
export {
  installRightHandAnimationFsmSystem,
  installLeftHandAnimationFsmSystem,
} from './systems/combat/installHandAnimationFsmSystems.ts';
export { installAnimationAimOffsetSystem } from './systems/combat/installAnimationAimOffsetSystem.ts';
export {
  installAnimationPoseOverlaySystem,
  type AnimationPoseOverlayDeps,
} from './systems/combat/installAnimationPoseOverlaySystem.ts';
export { installCombatFacingSystem } from './systems/combat/installCombatFacingSystem.ts';
