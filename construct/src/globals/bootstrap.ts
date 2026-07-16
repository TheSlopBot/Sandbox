import {
  createGltfCache,
  createTextureCache,
  createTransform,
  installRenderPipeline,
  useGame,
  useScene,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../catalog/keys/components.ts';
import { type ConstructGizmoMode } from '../entities/gizmos/gizmoMode.ts';import { createConstructOrbit } from '../entities/orbit/orbit.ts';
import { createConstructOrbitOriginMarker } from '../entities/orbit/orbitOriginMarker.ts';
import { createConstructAnim } from '../entities/orbit/constructAnim.ts';
import {
  createSelectionEntity,
  destroyAllEntities,
  ensureEditorGround,
  spawnEditorSceneScaffold,
} from '../scenes/editorScene.ts';
import { installEditorSceneSystems, stopModeSystems } from '../scenes/installEditorSystems.ts';
import { applyClip, clearAnimationPreview, loadAnimationPack, resetToBindPose, setAnimationPaused } from '../session/anim.ts';
import { loadModel, setTextureVariant } from '../session/preview.ts';
import {
  addAssetPart,
  addColliderPart,
  applyPropGizmoCommit,
  enterPropMode,
  getPropDocument,
  loadPropDocument,
  newProp,
  removePart,
  renameProp,
  selectPart,
  setPartTextureVariant,
  setPropDocumentListener,
  setTransformMode,
  updatePartLocal,
  updatePartName,
  updatePartTags,
} from '../session/propEditor.ts';
import {
  addActorAttachment,
  addActorCollider,
  applyActorGizmoCommit,
  enterActorMode,
  getActorBoneNames,
  getActorDocument,
  loadActorDocument,
  newActor,
  removeAttachment,
  removeCollider,
  renameActor,
  selectActor,
  setActorCharacter,
  setActorDocumentListener,
  setAiPackage,
  updateActorTags,
  updateAttachmentLocal,
  updateAttachmentName,
  updateAttachmentPlaceholder,
  updateAttachmentTags,
  updateAttachmentTextureVariant,
  updateCharacterTextureVariant,
  updateColliderFlags,
  updateColliderLocal,
  updateColliderName,
} from '../session/actorEditor.ts';
import {
  addEquipmentCollider,
  applyEquipmentGizmoCommit,
  clearEquipmentMesh,
  enterEquipmentMode,
  getEquipmentDocument,
  loadEquipmentDocument,
  newEquipment,
  removeEquipmentCollider,
  renameEquipment,
  selectEquipment,
  setEquipmentDocumentListener,
  setEquipmentMesh,
  updateColliderRole,
  updateEquipmentClips,
  updateEquipmentColliderName,
  updateEquipmentKind,
  updateEquipmentPartLocal,
  updateEquipmentProjectile,
  updateEquipmentSlotTags,
  updateEquipmentStats,
} from '../session/equipmentEditor.ts';
import {
  addLevelCollider,
  addSimpleActor,
  addSimpleProp,
  addStandardActor,
  addStandardProp,
  applyLevelGizmoCommit,
  refreshLevelGizmoAxisPolicy,
  assignToGroup,
  computeSimplePropCollider,
  createGroup,
  deleteGroup,
  enterLevelMode,
  getLevelDocument,
  getLevelSelection,
  loadLevelDocument,
  newLevel,
  removeInstances,
  renameGroup,
  renameInstance,
  renameLevel,
  selectLevelGroup,
  selectLevelInstances,
  selectLevelGroundPlane,
  selectLevelPlayerSpawn,
  selectLevelRoot,
  setGroundPlaneVariant,
  setInstanceAiPackage,
  setLevelDocumentListener,
  setShowBones,
  setShowColliders,
  setSimpleVariant,
  ungroup,
  ungroupInstances,
  updateGroupLocal,
  updateInstanceLocal,
} from '../session/levelEditor.ts';
import { createConstructSessionState, type ConstructSession, type ConstructSessionDeps } from '../session/types.ts';
import { ACTOR_SEED_DOCUMENTS } from '../catalog/actors/actorSeeds.ts';
import { EQUIPMENT_SEED_DOCUMENTS } from '../catalog/equipment/equipmentSeeds.ts';
import { seedLocalActorsIfEmpty } from '../storage/actorLocalStore.ts';
import { seedLocalEquipmentIfEmpty } from '../storage/equipmentLocalStore.ts';

const installOrbitInput = (
  canvas: HTMLCanvasElement,
  orbit: ReturnType<typeof createConstructOrbit>,
  isActive: () => boolean,
) => {
  let activePointerId: number | null = null;
  let isPointerOverCanvas = false;

  const onPointerEnter = () => {
    isPointerOverCanvas = true;
  };

  const onPointerLeave = () => {
    isPointerOverCanvas = false;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!isActive()) return;

    const orbitWithMeta = e.button === 0 && e.metaKey;
    if (e.button !== 1 && e.button !== 2 && !orbitWithMeta) return;

    orbit.dragging = true;
    orbit.dragButton = orbitWithMeta || e.button === 1 ? 1 : 2;
    activePointerId = e.pointerId;
    orbit.lastX = e.clientX;
    orbit.lastY = e.clientY;

    e.preventDefault();

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (activePointerId !== e.pointerId) return;
    orbit.dragging = false;
    orbit.dragButton = null;
    activePointerId = null;
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (activePointerId !== e.pointerId) return;
    orbit.dragging = false;
    orbit.dragButton = null;
    activePointerId = null;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isActive()) return;
    if (!orbit.dragging) return;
    if (activePointerId !== e.pointerId) return;
    if (orbit.dragButton === null) return;

    const dx = e.clientX - orbit.lastX;
    const dy = e.clientY - orbit.lastY;
    orbit.lastX = e.clientX;
    orbit.lastY = e.clientY;

    if (orbit.dragButton === 1) {
      orbit.pendingDx += dx;
      orbit.pendingDy += dy;
      return;
    }

    orbit.pendingPanDx += dx;
    orbit.pendingPanDy += dy;
  };

  const onWindowPointerMove = (e: PointerEvent) => {
    onPointerMove(e);
  };

  const onWindowPointerUp = (e: PointerEvent) => {
    if (activePointerId !== e.pointerId) return;
    orbit.dragging = false;
    orbit.dragButton = null;
    activePointerId = null;
  };

  const onWindowPointerCancel = (e: PointerEvent) => {
    if (activePointerId !== e.pointerId) return;
    orbit.dragging = false;
    orbit.dragButton = null;
    activePointerId = null;
  };

  const onWheel = (e: WheelEvent) => {
    if (!isActive()) return;
    if (!isPointerOverCanvas) return;
    e.preventDefault();
    e.stopPropagation();
    orbit.pendingWheel += e.deltaY;
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  canvas.addEventListener('pointerenter', onPointerEnter);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);

  window.addEventListener('pointermove', onWindowPointerMove);
  window.addEventListener('pointerup', onWindowPointerUp);
  window.addEventListener('pointercancel', onWindowPointerCancel);

  return () => {
    canvas.removeEventListener('pointerenter', onPointerEnter);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);

    window.removeEventListener('pointermove', onWindowPointerMove);
    window.removeEventListener('pointerup', onWindowPointerUp);
    window.removeEventListener('pointercancel', onWindowPointerCancel);
  };
};

export const bootstrap = async (canvas: HTMLCanvasElement): Promise<ConstructSession> => {
  const game = useGame();
  const gameRegistry = game.registry;
  const scene = useScene();
  const sceneRegistry = scene.registry;

  const pipeline = await installRenderPipeline(gameRegistry, canvas, {
    getEntityRegistry: () => sceneRegistry,
  });

  const device = pipeline.device;
  const textures = createTextureCache(device);
  const gltfCache = createGltfCache();

  const orbit = createConstructOrbit();
  const markerT = createTransform();
  markerT.position[0] = orbit.target[0];
  markerT.position[1] = orbit.target[1];
  markerT.position[2] = orbit.target[2];
  markerT.dirty = true;
  const marker = createConstructOrbitOriginMarker();
  const constructAnim = createConstructAnim();

  const deps: ConstructSessionDeps = {
    device,
    registry: sceneRegistry,
    pipeline,
    textures,
    gltfCache,
    orbit,
    markerT,
    marker,
    constructAnim,
  };

  spawnEditorSceneScaffold(deps);

  const selectionEnt = createSelectionEntity(sceneRegistry);
  const state = createConstructSessionState(selectionEnt);

  ensureEditorGround(deps);

  seedLocalActorsIfEmpty(ACTOR_SEED_DOCUMENTS);
  seedLocalEquipmentIfEmpty(EQUIPMENT_SEED_DOCUMENTS);

  let active = false;
  let gizmoDragging = () => false;

  const removeOrbitInput = installOrbitInput(canvas, orbit, () => active && !gizmoDragging());

  const { removeOrbitSystem, gizmoController } = installEditorSceneSystems(
    device,
    sceneRegistry,
    pipeline,
    canvas,
    () => state.propDocument,
    (doc) => {
      state.propDocument = doc;
      state.propDocListener?.(doc);
    },
    () => active,
    (partId, local) => {
      if (state.editorMode === 'actor') {
        applyActorGizmoCommit(state, partId, local);
        return;
      }
      if (state.editorMode === 'level') {
        applyLevelGizmoCommit(deps, state, partId, local);
        return;
      }
      if (state.editorMode === 'equipment') {
        applyEquipmentGizmoCommit(state, partId, local);
        return;
      }
      applyPropGizmoCommit(state, partId, local);
    },
  );
  gizmoDragging = () => gizmoController.isDragging();

  const setActive = (next: boolean) => {
    active = next;
    game.setActiveScene(next ? scene : null);
  };

  game.start();

  return {
    canvas,
    gameRegistry,
    sceneRegistry,
    pipeline,
    textures,
    gltfCache,
    setActive,
    loadModel: (modelUrl, textureVariants) => loadModel(deps, state, modelUrl, textureVariants),
    loadAnimationPack: (packUrl) => loadAnimationPack(deps, state, packUrl),
    applyClip: (clipName) => applyClip(deps, state, clipName),
    clearAnimationPreview: () => clearAnimationPreview(deps, state),
    resetToBindPose: () => resetToBindPose(deps),
    setAnimationPaused: (paused) => setAnimationPaused(deps, paused),
    setTextureVariant: (variantUrl) => setTextureVariant(deps, state, variantUrl),
    setPartTextureVariant: (partId, variantUrl) => setPartTextureVariant(deps, state, partId, variantUrl),
    newProp: () => newProp(deps, state),
    enterPropMode: () => enterPropMode(deps, state),
    getPropDocument: () => getPropDocument(state),
    loadPropDocument: (doc) => loadPropDocument(deps, state, doc),
    addAssetPart: (url, materialPrefix) => addAssetPart(deps, state, url, materialPrefix),
    addColliderPart: (shape) => addColliderPart(deps, state, shape),
    selectPart: (partId) => selectPart(deps, state, partId),
    setTransformMode: (mode) => {
      setTransformMode(deps, state, mode);
      if (state.editorMode === 'level') {
        refreshLevelGizmoAxisPolicy(state);
      } else {
        const gizmo = state.selectionEnt.components[CONSTRUCT_KEYS.gizmoMode] as ConstructGizmoMode;
        gizmo.allowedAxes = null;
      }
    },
    renameProp: (name) => renameProp(deps, state, name),
    updatePartName: (partId, name) => updatePartName(state, partId, name),
    updatePartTags: (partId, tags) => updatePartTags(state, partId, tags),
    updatePartLocal: (partId, patch) => updatePartLocal(deps, state, partId, patch),
    removePart: (partId) => removePart(deps, state, partId),
    setPropDocumentListener: (fn) => setPropDocumentListener(state, fn),
    enterActorMode: () => enterActorMode(deps, state),
    newActor: () => newActor(deps, state),
    getActorDocument: () => getActorDocument(state),
    loadActorDocument: (doc) => loadActorDocument(deps, state, doc),
    setActorCharacter: (url, materialPrefix) => setActorCharacter(deps, state, url, materialPrefix),
    addActorAttachment: (url, boneName, materialPrefix) =>
      addActorAttachment(deps, state, url, boneName, materialPrefix),
    addActorCollider: (shape, parent) => addActorCollider(deps, state, shape, parent),
    selectActor: (sel) => selectActor(deps, state, sel),
    renameActor: (name) => renameActor(deps, state, name),
    updateActorTags: (tags) => updateActorTags(state, tags),
    updateCharacterTextureVariant: (variantUrl) => updateCharacterTextureVariant(deps, state, variantUrl),
    setAiPackage: (aiPackage) => setAiPackage(state, aiPackage),
    updateAttachmentName: (attachmentId, name) => updateAttachmentName(state, attachmentId, name),
    updateAttachmentLocal: (attachmentId, patch) => updateAttachmentLocal(deps, state, attachmentId, patch),
    updateAttachmentTags: (attachmentId, tags) => updateAttachmentTags(state, attachmentId, tags),
    updateAttachmentPlaceholder: (attachmentId, placeholder) =>
      updateAttachmentPlaceholder(deps, state, attachmentId, placeholder),
    updateAttachmentTextureVariant: (attachmentId, variantUrl) =>
      updateAttachmentTextureVariant(deps, state, attachmentId, variantUrl),
    removeAttachment: (attachmentId) => removeAttachment(deps, state, attachmentId),
    updateColliderName: (colliderId, name) => updateColliderName(state, colliderId, name),
    updateColliderLocal: (colliderId, patch) => updateColliderLocal(deps, state, colliderId, patch),
    updateColliderFlags: (colliderId, flags) => updateColliderFlags(deps, state, colliderId, flags),
    removeCollider: (colliderId) => removeCollider(deps, state, colliderId),
    setActorDocumentListener: (fn) => setActorDocumentListener(state, fn),
    getActorBoneNames: () => getActorBoneNames(deps),
    getOrbitAngles: () => ({ yawRad: orbit.yawRad, pitchRad: orbit.pitchRad }),
    newEquipment: () => newEquipment(deps, state),
    enterEquipmentMode: () => enterEquipmentMode(deps, state),
    getEquipmentDocument: () => getEquipmentDocument(state),
    loadEquipmentDocument: (doc) => loadEquipmentDocument(deps, state, doc),
    setEquipmentMesh: (url, materialPrefix) => setEquipmentMesh(deps, state, url, materialPrefix),
    addEquipmentCollider: (shape) => addEquipmentCollider(deps, state, shape),
    selectEquipment: (sel) => selectEquipment(deps, state, sel),
    renameEquipment: (name) => renameEquipment(deps, state, name),
    updateEquipmentKind: (kind) => updateEquipmentKind(state, kind),
    updateEquipmentSlotTags: (tags) => updateEquipmentSlotTags(state, tags),
    updateEquipmentStats: (partial) => updateEquipmentStats(state, partial),
    updateEquipmentClips: (partial) => updateEquipmentClips(state, partial),
    updateEquipmentProjectile: (projectile) => updateEquipmentProjectile(state, projectile),
    updateEquipmentColliderRole: (colliderId, role) => updateColliderRole(state, colliderId, role),
    updateEquipmentColliderName: (colliderId, name) =>
      updateEquipmentColliderName(state, colliderId, name),
    updateEquipmentPartLocal: (partId, patch) => updateEquipmentPartLocal(deps, state, partId, patch),
    removeEquipmentCollider: (colliderId) => removeEquipmentCollider(deps, state, colliderId),
    clearEquipmentMesh: () => clearEquipmentMesh(deps, state),
    setEquipmentDocumentListener: (fn) => setEquipmentDocumentListener(state, fn),
    enterLevelMode: () => enterLevelMode(deps, state),
    newLevel: () => newLevel(deps, state),
    getLevelDocument: () => getLevelDocument(state),
    loadLevelDocument: (doc) => loadLevelDocument(deps, state, doc),
    setLevelDocumentListener: (fn) => setLevelDocumentListener(state, fn),
    computeSimplePropCollider: (url) => computeSimplePropCollider(deps, url),
    addSimpleProp: (url, materialPrefix, displayName, textureVariantUrl) =>
      addSimpleProp(deps, state, url, materialPrefix, displayName, textureVariantUrl ?? null),
    addStandardProp: (doc) => addStandardProp(deps, state, doc),
    addSimpleActor: (url, materialPrefix, displayName, textureVariantUrl) =>
      addSimpleActor(deps, state, url, materialPrefix, displayName, textureVariantUrl ?? null),
    addStandardActor: (doc) => addStandardActor(deps, state, doc),
    addLevelCollider: (shape) => addLevelCollider(deps, state, shape),
    selectLevelInstances: (ids) => selectLevelInstances(deps, state, ids),
    selectLevelGroup: (groupId) => selectLevelGroup(deps, state, groupId),
    selectLevelRoot: () => selectLevelRoot(deps, state),
    selectLevelPlayerSpawn: () => selectLevelPlayerSpawn(deps, state),
    selectLevelGroundPlane: () => selectLevelGroundPlane(deps, state),
    setGroundPlaneVariant: (variant) => setGroundPlaneVariant(deps, state, variant),
    getLevelSelection: () => getLevelSelection(state),
    renameLevel: (name) => renameLevel(deps, state, name),
    renameInstance: (instanceId, name) => renameInstance(state, instanceId, name),
    renameGroup: (groupId, name) => renameGroup(state, groupId, name),
    updateInstanceLocal: (instanceId, patch) => updateInstanceLocal(deps, state, instanceId, patch),
    updateGroupLocal: (groupId, patch) => updateGroupLocal(deps, state, groupId, patch),
    setInstanceAiPackage: (instanceId, aiPackage) => setInstanceAiPackage(state, instanceId, aiPackage),
    setSimpleVariant: (instanceId, variantUrl) => setSimpleVariant(deps, state, instanceId, variantUrl),
    removeInstances: (ids) => removeInstances(deps, state, ids),
    createGroup: (instanceIds, name) => createGroup(deps, state, instanceIds, name),
    assignToGroup: (instanceIds, groupId) => assignToGroup(deps, state, instanceIds, groupId),
    ungroup: (groupId) => ungroup(deps, state, groupId),
    ungroupInstances: (instanceIds) => ungroupInstances(deps, state, instanceIds),
    deleteGroup: (groupId, removeMembers) => deleteGroup(deps, state, groupId, removeMembers),
    setShowColliders: (show) => setShowColliders(deps, state, show),
    setShowBones: (show) => setShowBones(deps, state, show),
    getShowColliders: () => state.showColliders,
    getShowBones: () => state.showBones,
    unload: () => {
      removeOrbitInput();
      removeOrbitSystem();
      gizmoController.destroy();
      stopModeSystems(state);

      game.stop();
      game.setActiveScene(null);

      destroyAllEntities(sceneRegistry);

      state.loadedModelUrl = null;
      state.currentClipsByName = new Map();
      state.activeMaterials = [];
      state.textureVariants = [];
      state.activeTextureVariantUrl = null;
      state.defaultBaseColorTex = null;
      state.propDocListener = null;
      state.actorDocListener = null;
      state.equipmentDocListener = null;
      state.levelDocListener = null;

      textures.destroy();
      gltfCache.clear();
      pipeline.destroy();
    },
  };
};

export type { ConstructSession, ConstructLoadedModel, ConstructLoadedAnimationPack, ConstructTextureVariant } from '../session/types.ts';
