import {
  createGltfCache,
  createTextureCache,
  createTransform,
  installCharacterStateSystem,
  installColliderTransformSystem,
  installRenderPipeline,
  installTransformHierarchySystem,
  useGame,
  useScene,
} from 'viberanium';
import { createConstructOrbit } from '../entities/orbit/orbit.ts';
import { createConstructOrbitOriginMarker } from '../entities/orbit/orbitOriginMarker.ts';
import { createConstructAnim } from '../entities/orbit/constructAnim.ts';
import { installConstructOrbitSystem } from '../entities/orbit/orbitSystem.ts';
import { installConstructGizmoSystem } from '../entities/gizmos/gizmoSystem.ts';
import {
  createSelectionEntity,
  ensureEditorGround,
  resetEditorScene,
  spawnEditorSceneScaffold,
} from '../scenes/editorScene.ts';
import { applyClip, clearAnimationPreview, loadAnimationPack, resetToBindPose } from '../session/anim.ts';
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
import { createConstructSessionState, type ConstructSession, type ConstructSessionDeps } from '../session/types.ts';

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

export const bootstrap = (canvas: HTMLCanvasElement): ConstructSession => {
  const game = useGame();
  const gameRegistry = game.registry;
  const scene = useScene();
  const sceneRegistry = scene.registry;

  const pipeline = installRenderPipeline(gameRegistry, canvas, {
    getEntityRegistry: () => sceneRegistry,
  });

  const gl = pipeline.device.gl;
  const textures = createTextureCache(gl);
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
    gl,
    registry: sceneRegistry,
    textures,
    gltfCache,
    orbit,
    markerT,
    marker,
    constructAnim,
  };

  spawnEditorSceneScaffold(deps);

  const removeOrbitSystem = installConstructOrbitSystem(sceneRegistry, pipeline);
  installCharacterStateSystem(sceneRegistry);
  installTransformHierarchySystem(sceneRegistry);
  installColliderTransformSystem(sceneRegistry);

  const selectionEnt = createSelectionEntity(sceneRegistry);
  const state = createConstructSessionState(selectionEnt);

  ensureEditorGround(deps);

  let active = false;
  let gizmoDragging = () => false;

  const removeOrbitInput = installOrbitInput(canvas, orbit, () => active && !gizmoDragging());

  const gizmoController = installConstructGizmoSystem(
    gl,
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
    setTextureVariant: (variantUrl) => setTextureVariant(deps, state, variantUrl),
    setPartTextureVariant: (partId, variantUrl) => setPartTextureVariant(deps, state, partId, variantUrl),
    newProp: () => newProp(deps, state),
    enterPropMode: () => enterPropMode(deps, state),
    getPropDocument: () => getPropDocument(state),
    loadPropDocument: (doc) => loadPropDocument(deps, state, doc),
    addAssetPart: (url, materialPrefix) => addAssetPart(deps, state, url, materialPrefix),
    addColliderPart: (shape) => addColliderPart(deps, state, shape),
    selectPart: (partId) => selectPart(deps, state, partId),
    setTransformMode: (mode) => setTransformMode(deps, state, mode),
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
    unload: () => {
      removeOrbitInput();
      removeOrbitSystem();
      gizmoController.destroy();
      game.stop();
      game.setActiveScene(null);
      pipeline.destroy();
      resetEditorScene(deps, state);
    },
  };
};

export type { ConstructSession, ConstructLoadedModel, ConstructLoadedAnimationPack, ConstructTextureVariant } from '../session/types.ts';
