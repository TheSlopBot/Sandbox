import {
  LEVEL_GROUND_PLANE_ID,
  LEVEL_PLAYER_SPAWN_ID,
  type LevelDocument,
  type LevelDocumentActorInstance,
  type LevelDocumentColliderInstance,
  type LevelDocumentGroup,
  type LevelDocumentPropInstance,
  allInstanceNames,
  applyLevelName,
  cloneLevelDocument,
  createEmptyLevelDocument,
  findSimpleActorIndexId,
  findSimplePropIndexId,
  findStandardActorIndexId,
  findStandardPropIndexId,
  ensureUniqueInstanceIds,
  maxIdSuffix,
  nextIndexId,
  resolveInstanceActorCharacter,
  resolveInstanceActorDocument,
  resolveInstancePropDefinition,
  uniqueInstanceName,
  withAnimDefaults,
} from '../catalog/levels/levelDocument.ts';
import { type PropDocument } from '../catalog/props/propDocument.ts';
import { type ActorAiPackage, type ActorDocument } from '../catalog/actors/actorDocument.ts';
import {
  type GroundPlane,
  type LevelGroundVariant,
  type LocalTransform,
  type Registry,
  type Renderable,
  type SimplePropCollider,
  type SimplePropIndex,
  type Transform,
  createLocalTransform,
  q4,
  q4Conjugate,
  q4Normalize,
  q4TransformVec3,
  v3,
  buildRuntimeScene,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../catalog/keys/components.ts';
import {
  boundsCenter,
  createEmptyBounds,
  expandBoundsFromInterleaved,
  isBoundsValid,
} from '../entities/viewer/modelBounds.ts';
import {
  clearLevelEditorEntities,
  ensureLevelOriginMarker,
  ensureLevelPivots,
  ensureLevelRoot,
  findLevelPivotEntity,
  findLevelPlacementEntity,
  removeLevelPlacementEntity,
} from '../entities/levelEditor/spawnLevelEditor.ts';
import { spawnLevelPropPlacementEntity } from '../entities/levelEditor/spawnLevelPropPlacement.ts';
import { spawnLevelActorPlacementEntity } from '../entities/levelEditor/spawnLevelActorPlacement.ts';
import { spawnLevelColliderPlacementEntity } from '../entities/levelEditor/spawnLevelColliderPlacement.ts';
import { spawnLevelPlayerSpawnEntity } from '../entities/levelEditor/spawnLevelPlayerSpawn.ts';
import { spawnLevelGroundPlaneEntity } from '../entities/levelEditor/spawnLevelGroundPlane.ts';
import { defaultColliderPart } from '../entities/propEditor/spawnPropEditor.ts';
import { LEVEL_GROUP_PIVOT_ID, LEVEL_MULTI_PIVOT_ID } from '../entities/levelEditor/levelPivot.ts';
import { type ConstructEditorSelection } from '../entities/editorCommon/editorSelection.ts';
import { applyLocalFromTRS, bakeChildWorld } from '../entities/editorCommon/trs.ts';
import { syncPartLocalToWorld } from '../entities/editorCommon/syncPartLocal.ts';
import { type ConstructGizmoMode } from '../entities/gizmos/gizmoMode.ts';
import { type Axis } from '../entities/gizmos/meshes.ts';import { clearPropEditorEntities } from '../entities/propEditor/spawnPropEditor.ts';
import { clearActorEditorEntities } from '../entities/actorEditor/spawnActorEditor.ts';
import { ensureLevelEditorSystems } from '../scenes/installEditorSystems.ts';
import { ensureSelectionEntity, resetEditorScene } from '../scenes/editorScene.ts';
import {
  type ConstructLevelPivotSnapshot,
  type ConstructLevelSelection,
  type ConstructSessionDeps,
  type ConstructSessionState,
  type ConstructTransformPatch,
} from './types.ts';

type LevelInstanceTRS = {
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
};

const notifyLevelDoc = (state: ConstructSessionState) => {
  state.levelDocListener?.(state.levelDocument);
};

const ensureLevelRootWithOrigin = (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  const rootId = ensureLevelRoot(deps.registry, state.levelDocument);
  ensureLevelOriginMarker(deps.device, deps.registry, rootId);
  ensureLevelPivots(deps.registry, rootId);
  return rootId;
};

const levelSelectionAllowsScale = (
  doc: LevelDocument,
  selection: ConstructLevelSelection,
): boolean => {
  if (selection.groupId) return false;
  if (selection.instanceIds.length === 0) return false;
  if (
    selection.instanceIds.length === 1 &&
    selection.instanceIds[0] === LEVEL_GROUND_PLANE_ID
  ) {
    return true;
  }
  const colliderIds = new Set(doc.composition.colliders.map((c) => c.id));
  return selection.instanceIds.every((id) => colliderIds.has(id));
};

const levelSelectionAllowsRotate = (selection: ConstructLevelSelection): boolean => {
  if (selection.groupId) return true;
  return !selection.instanceIds.includes(LEVEL_GROUND_PLANE_ID);
};

const levelSelectionAllowedAxes = (
  state: ConstructSessionState,
  ids: string[],
): Axis[] | null => {
  if (ids.length === 0) return null;

  if (ids.length === 1 && ids[0] === LEVEL_GROUND_PLANE_ID) {
    const gizmo = state.selectionEnt.components[CONSTRUCT_KEYS.gizmoMode] as ConstructGizmoMode | undefined;
    if (gizmo?.mode === 'rotate') return [];
    return null;
  }

  const actorIds = new Set(state.levelDocument.composition.actors.map((a) => a.id));
  actorIds.add(LEVEL_PLAYER_SPAWN_ID);
  const allYawOnly = ids.every((id) => actorIds.has(id));
  if (!allYawOnly) return null;

  const gizmo = state.selectionEnt.components[CONSTRUCT_KEYS.gizmoMode] as ConstructGizmoMode | undefined;
  if (gizmo?.mode === 'rotate') return ['y'];
  return null;
};

const applyLevelGizmoAxisPolicy = (state: ConstructSessionState, ids: string[]) => {
  const gizmo = state.selectionEnt.components[CONSTRUCT_KEYS.gizmoMode] as ConstructGizmoMode | undefined;
  if (!gizmo) return;

  if (gizmo.mode === 'scale' && !levelSelectionAllowsScale(state.levelDocument, state.levelSelection)) {
    gizmo.mode = 'move';
  }

  if (gizmo.mode === 'rotate' && !levelSelectionAllowsRotate(state.levelSelection)) {
    gizmo.mode = 'move';
  }

  gizmo.allowedAxes = levelSelectionAllowedAxes(state, ids);
};

export const refreshLevelGizmoAxisPolicy = (state: ConstructSessionState) => {
  applyLevelGizmoAxisPolicy(state, state.levelSelection.instanceIds);
};

const clearLevelSelectionState = (state: ConstructSessionState) => {
  state.levelSelection = { instanceIds: [], groupId: null };
  state.levelGroupPivotPrev = null;
  state.levelMultiPivotPrev = null;
};

const syncLevelInstanceCounters = (state: ConstructSessionState) => {
  const doc = state.levelDocument;
  state.levelPropCounter = maxIdSuffix(
    'prop_',
    doc.composition.props.map((p) => p.id),
  );
  state.levelActorCounter = maxIdSuffix(
    'actor_',
    doc.composition.actors.map((a) => a.id),
  );
  state.levelColliderCounter = maxIdSuffix(
    'col_',
    doc.composition.colliders.map((c) => c.id),
  );
  state.levelGroupCounter = maxIdSuffix(
    'group_',
    doc.groups.map((g) => g.id),
  );
};

const prepareLevelInstanceAllocation = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
) => {
  const repaired = ensureUniqueInstanceIds(state.levelDocument);
  if (repaired !== state.levelDocument) {
    state.levelDocument = repaired;
    await respawnAllLevelContent(deps, state);
    notifyLevelDoc(state);
  }
  syncLevelInstanceCounters(state);
};

const findInstanceTRS = (doc: LevelDocument, id: string): LevelInstanceTRS | null => {
  if (id === LEVEL_PLAYER_SPAWN_ID) {
    return {
      position: doc.playerSpawn.position,
      rotation: doc.playerSpawn.rotation,
      scale: [1, 1, 1],
    };
  }

  if (id === LEVEL_GROUND_PLANE_ID) {
    const size = doc.groundPlane.size;
    return {
      position: doc.groundPlane.position,
      rotation: [0, 0, 0, 1],
      scale: [size, 1, size],
    };
  }

  return (
    doc.composition.props.find((p) => p.id === id) ??
    doc.composition.actors.find((a) => a.id === id) ??
    doc.composition.colliders.find((c) => c.id === id) ??
    null
  );
};

export const applyShowCollidersVisibility = (deps: ConstructSessionDeps, show: boolean) => {
  for (const e of deps.registry.view(CONSTRUCT_KEYS.colliderWireframe)) {
    const renderable = e.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
    if (renderable) renderable.visible = show;
  }
};

export const applyShowBonesVisibility = (deps: ConstructSessionDeps, show: boolean) => {
  for (const e of deps.registry.view(CONSTRUCT_KEYS.skeletonOverlay)) {
    const renderable = e.components[COMPONENT_KEYS.renderable] as Renderable | undefined;
    if (renderable) renderable.visible = show;
  }
};

export const setShowColliders = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  show: boolean,
) => {
  state.showColliders = show;
  applyShowCollidersVisibility(deps, show);
};

export const setShowBones = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  show: boolean,
) => {
  state.showBones = show;
  applyShowBonesVisibility(deps, show);
};

const computeInstancesCentroid = (doc: LevelDocument, ids: string[]): [number, number, number] => {
  let x = 0;
  let y = 0;
  let z = 0;
  let n = 0;
  for (const id of ids) {
    const inst = findInstanceTRS(doc, id);
    if (!inst) continue;
    x += inst.position[0];
    y += inst.position[1];
    z += inst.position[2];
    n += 1;
  }
  if (n === 0) return [0, 0, 0];
  return [x / n, y / n, z / n];
};

const spawnLevelActorFromInstance = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  rootId: number,
  instance: LevelDocumentActorInstance,
) => {
  const actorDoc = resolveInstanceActorDocument(state.levelDocument, instance);
  const character = actorDoc?.character ?? resolveInstanceActorCharacter(state.levelDocument, instance);
  if (!character) return;

  await spawnLevelActorPlacementEntity(
    deps.device,
    deps.registry,
    deps.textures,
    deps.gltfCache,
    rootId,
    instance,
    character,
    actorDoc?.attachments ?? [],
  );
};

const respawnAllLevelContent = async (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  clearLevelEditorEntities(deps.registry);
  const rootId = ensureLevelRootWithOrigin(deps, state);
  ensureLevelEditorSystems(deps.registry, deps.device, deps.pipeline, state);

  for (const instance of state.levelDocument.composition.props) {
    const def = resolveInstancePropDefinition(state.levelDocument, instance);
    if (!def) continue;
    await spawnLevelPropPlacementEntity(
      deps.device,
      deps.registry,
      deps.textures,
      deps.gltfCache,
      rootId,
      instance,
      def,
      state.showColliders,
    );
  }

  for (const instance of state.levelDocument.composition.actors) {
    await spawnLevelActorFromInstance(deps, state, rootId, instance);
  }

  for (const instance of state.levelDocument.composition.colliders) {
    spawnLevelColliderPlacementEntity(
      deps.device,
      deps.registry,
      rootId,
      instance,
      state.showColliders,
    );
  }

  await spawnLevelPlayerSpawnEntity(
    deps.device,
    deps.registry,
    deps.textures,
    deps.gltfCache,
    rootId,
    state.levelDocument,
  );

  spawnLevelGroundPlaneEntity(deps.device, deps.registry, rootId, state.levelDocument);
};

export const enterLevelMode = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
): Promise<LevelDocument> => {
  resetEditorScene(deps, state, { spawnGround: false });
  state.editorMode = 'level';
  clearPropEditorEntities(deps.registry);
  clearActorEditorEntities(deps.registry);
  state.levelDocument = ensureUniqueInstanceIds(state.levelDocument);
  syncLevelInstanceCounters(state);
  ensureSelectionEntity(deps, state);
  clearLevelSelectionState(state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  sel.targetId = null;
  await respawnAllLevelContent(deps, state);
  return state.levelDocument;
};

export const newLevel = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
): Promise<LevelDocument> => {
  resetEditorScene(deps, state, { spawnGround: false });
  state.editorMode = 'level';
  clearPropEditorEntities(deps.registry);
  clearActorEditorEntities(deps.registry);
  state.levelDocument = createEmptyLevelDocument();
  state.levelPropCounter = 0;
  state.levelActorCounter = 0;
  state.levelColliderCounter = 0;
  state.levelGroupCounter = 0;
  clearLevelSelectionState(state);
  ensureSelectionEntity(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  sel.targetId = null;
  await respawnAllLevelContent(deps, state);
  return state.levelDocument;
};

export const getLevelDocument = (state: ConstructSessionState): LevelDocument => state.levelDocument;

export const loadLevelDocument = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  doc: LevelDocument,
): Promise<LevelDocument> => {
  resetEditorScene(deps, state, { spawnGround: false });
  state.editorMode = 'level';
  clearPropEditorEntities(deps.registry);
  clearActorEditorEntities(deps.registry);
  state.levelDocument = ensureUniqueInstanceIds(cloneLevelDocument(doc));
  syncLevelInstanceCounters(state);
  clearLevelSelectionState(state);
  ensureSelectionEntity(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  sel.targetId = null;
  await respawnAllLevelContent(deps, state);
  return state.levelDocument;
};

export const setLevelDocumentListener = (
  state: ConstructSessionState,
  fn: ((doc: LevelDocument) => void) | null,
) => {
  state.levelDocListener = fn;
};

export const computeSimplePropCollider = async (
  deps: ConstructSessionDeps,
  url: string,
): Promise<SimplePropCollider> => {
  const loaded = await deps.gltfCache.getOrLoad(url);
  const scene = buildRuntimeScene(loaded);
  const bounds = createEmptyBounds();

  for (const pair of scene.meshNodePairs) {
    const model = scene.models[pair.meshIndex];
    if (!model) continue;
    const node = scene.nodes[pair.nodeIndex];
    if (!node) continue;

    for (const prim of model.primitives) {
      if (prim.kind === 'skinned') continue;
      expandBoundsFromInterleaved(bounds, prim.vertices, node.worldM);
    }
  }

  if (!isBoundsValid(bounds)) {
    return { shape: 'box', halfExtents: [0.5, 0.5, 0.5] };
  }

  const center = boundsCenter(bounds);
  const halfExtents: [number, number, number] = [
    Math.max(0.05, (bounds.max[0] - bounds.min[0]) * 0.5),
    Math.max(0.05, (bounds.max[1] - bounds.min[1]) * 0.5),
    Math.max(0.05, (bounds.max[2] - bounds.min[2]) * 0.5),
  ];

  const isCentered = Math.hypot(center[0], center[1], center[2]) < 1e-4;
  if (isCentered) return { shape: 'box', halfExtents };
  return { shape: 'box', halfExtents, position: center };
};

export const addSimpleProp = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  url: string,
  materialPrefix: string,
  displayName: string,
  textureVariantUrl: string | null = null,
): Promise<LevelDocument> => {
  await prepareLevelInstanceAllocation(deps, state);
  const rootId = ensureLevelRootWithOrigin(deps, state);

  let indexId = findSimplePropIndexId(state.levelDocument, url, materialPrefix, textureVariantUrl);
  let nextIndex = state.levelDocument.index.simpleProps;
  if (!indexId) {
    indexId = nextIndexId('simpleProp', state.levelDocument.index.simpleProps);
    const entry: SimplePropIndex = {
      id: indexId,
      displayName,
      url,
      materialPrefix,
      textureVariantUrl,
      collider: null,
    };
    nextIndex = { ...nextIndex, [indexId]: entry };
  }

  state.levelPropCounter += 1;
  const instanceId = `prop_${state.levelPropCounter}`;
  const name = uniqueInstanceName(displayName, allInstanceNames(state.levelDocument));
  const instance: LevelDocumentPropInstance = {
    id: instanceId,
    name,
    kind: 'simpleProp',
    indexId,
    position: [deps.orbit.target[0], deps.orbit.target[1], deps.orbit.target[2]],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
    groupId: null,
  };

  state.levelDocument = {
    ...state.levelDocument,
    index: { ...state.levelDocument.index, simpleProps: nextIndex },
    composition: {
      ...state.levelDocument.composition,
      props: [...state.levelDocument.composition.props, instance],
    },
  };

  const def = resolveInstancePropDefinition(state.levelDocument, instance);
  if (def) {
    await spawnLevelPropPlacementEntity(
      deps.device,
      deps.registry,
      deps.textures,
      deps.gltfCache,
      rootId,
      instance,
      def,
      state.showColliders,
    );
  }

  selectLevelInstances(deps, state, [instance.id]);
  notifyLevelDoc(state);
  return state.levelDocument;
};

export const addStandardProp = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  doc: PropDocument,
): Promise<LevelDocument> => {
  await prepareLevelInstanceAllocation(deps, state);
  const rootId = ensureLevelRootWithOrigin(deps, state);

  let indexId = findStandardPropIndexId(state.levelDocument, doc.id);
  if (!indexId) {
    indexId = nextIndexId('standardProp', state.levelDocument.index.standardProps);
  }
  const nextIndex = { ...state.levelDocument.index.standardProps, [indexId]: doc };

  state.levelPropCounter += 1;
  const instanceId = `prop_${state.levelPropCounter}`;
  const name = uniqueInstanceName(doc.displayName, allInstanceNames(state.levelDocument));
  const instance: LevelDocumentPropInstance = {
    id: instanceId,
    name,
    kind: 'standardProp',
    indexId,
    position: [deps.orbit.target[0], deps.orbit.target[1], deps.orbit.target[2]],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
    groupId: null,
  };

  state.levelDocument = {
    ...state.levelDocument,
    index: { ...state.levelDocument.index, standardProps: nextIndex },
    composition: {
      ...state.levelDocument.composition,
      props: [...state.levelDocument.composition.props, instance],
    },
  };

  const def = resolveInstancePropDefinition(state.levelDocument, instance);
  if (def) {
    await spawnLevelPropPlacementEntity(
      deps.device,
      deps.registry,
      deps.textures,
      deps.gltfCache,
      rootId,
      instance,
      def,
      state.showColliders,
    );
  }

  selectLevelInstances(deps, state, [instance.id]);
  notifyLevelDoc(state);
  return state.levelDocument;
};

export const addSimpleActor = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  url: string,
  materialPrefix: string,
  displayName: string,
  textureVariantUrl: string | null = null,
): Promise<LevelDocument> => {
  await prepareLevelInstanceAllocation(deps, state);
  const rootId = ensureLevelRootWithOrigin(deps, state);

  let indexId = findSimpleActorIndexId(state.levelDocument, url, materialPrefix, textureVariantUrl);
  let nextIndex = state.levelDocument.index.simpleActors;
  if (!indexId) {
    indexId = nextIndexId('simpleActor', state.levelDocument.index.simpleActors);
    const doc = withAnimDefaults({
      version: 1,
      id: indexId,
      displayName,
      tags: [],
      aiPackage: 'none',
      character: { url, materialPrefix, textureVariantUrl },
      attachments: [],
      colliders: [],
      animPack: null,
      clips: null,
    });
    nextIndex = { ...nextIndex, [indexId]: doc };
  }

  state.levelActorCounter += 1;
  const instanceId = `actor_${state.levelActorCounter}`;
  const name = uniqueInstanceName(displayName, allInstanceNames(state.levelDocument));
  const instance: LevelDocumentActorInstance = {
    id: instanceId,
    name,
    kind: 'simpleActor',
    indexId,
    position: [deps.orbit.target[0], deps.orbit.target[1], deps.orbit.target[2]],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
    aiPackage: 'none',
    groupId: null,
  };

  state.levelDocument = {
    ...state.levelDocument,
    index: { ...state.levelDocument.index, simpleActors: nextIndex },
    composition: {
      ...state.levelDocument.composition,
      actors: [...state.levelDocument.composition.actors, instance],
    },
  };

  const character = resolveInstanceActorCharacter(state.levelDocument, instance);
  if (character) {
    await spawnLevelActorFromInstance(deps, state, rootId, instance);
  }

  selectLevelInstances(deps, state, [instance.id]);
  notifyLevelDoc(state);
  return state.levelDocument;
};

export const addStandardActor = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  doc: ActorDocument,
): Promise<LevelDocument> => {
  if (!doc.character) return state.levelDocument;

  await prepareLevelInstanceAllocation(deps, state);
  const rootId = ensureLevelRootWithOrigin(deps, state);
  const docWithDefaults = withAnimDefaults(doc);

  let indexId = findStandardActorIndexId(state.levelDocument, docWithDefaults.id);
  if (!indexId) {
    indexId = nextIndexId('standardActor', state.levelDocument.index.standardActors);
  }
  const nextIndex = { ...state.levelDocument.index.standardActors, [indexId]: docWithDefaults };

  state.levelActorCounter += 1;
  const instanceId = `actor_${state.levelActorCounter}`;
  const name = uniqueInstanceName(docWithDefaults.displayName, allInstanceNames(state.levelDocument));
  const instance: LevelDocumentActorInstance = {
    id: instanceId,
    name,
    kind: 'standardActor',
    indexId,
    position: [deps.orbit.target[0], deps.orbit.target[1], deps.orbit.target[2]],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
    aiPackage: docWithDefaults.aiPackage,
    groupId: null,
  };

  state.levelDocument = {
    ...state.levelDocument,
    index: { ...state.levelDocument.index, standardActors: nextIndex },
    composition: {
      ...state.levelDocument.composition,
      actors: [...state.levelDocument.composition.actors, instance],
    },
  };

  const character = resolveInstanceActorCharacter(state.levelDocument, instance);
  if (character) {
    await spawnLevelActorFromInstance(deps, state, rootId, instance);
  }

  selectLevelInstances(deps, state, [instance.id]);
  notifyLevelDoc(state);
  return state.levelDocument;
};


export const addLevelCollider = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  shape: 'box' | 'cylinder' | 'sphere' | 'capsule',
): Promise<LevelDocument> => {
  await prepareLevelInstanceAllocation(deps, state);
  const rootId = ensureLevelRootWithOrigin(deps, state);
  state.levelColliderCounter += 1;
  const part = defaultColliderPart(shape, `col_${state.levelColliderCounter}`);
  const name = uniqueInstanceName(part.name, allInstanceNames(state.levelDocument));
  const instance: LevelDocumentColliderInstance = {
    id: part.id,
    name,
    shape: part.shape,
    halfExtents: part.halfExtents,
    radius: part.radius,
    halfHeight: part.halfHeight,
    position: [deps.orbit.target[0], deps.orbit.target[1], deps.orbit.target[2]],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
    groupId: null,
  };

  state.levelDocument = {
    ...state.levelDocument,
    composition: {
      ...state.levelDocument.composition,
      colliders: [...state.levelDocument.composition.colliders, instance],
    },
  };

  spawnLevelColliderPlacementEntity(
    deps.device,
    deps.registry,
    rootId,
    instance,
    state.showColliders,
  );
  selectLevelInstances(deps, state, [instance.id]);
  notifyLevelDoc(state);
  return state.levelDocument;
};

export const selectLevelPlayerSpawn = (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  selectLevelInstances(deps, state, [LEVEL_PLAYER_SPAWN_ID]);
};

export const selectLevelGroundPlane = (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  selectLevelInstances(deps, state, [LEVEL_GROUND_PLANE_ID]);
};

export const setGroundPlaneVariant = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  variant: LevelGroundVariant,
): LevelDocument => {
  state.levelDocument = {
    ...state.levelDocument,
    groundPlane: {
      ...state.levelDocument.groundPlane,
      variant,
    },
  };

  const entity = findLevelPlacementEntity(deps.registry, LEVEL_GROUND_PLANE_ID);
  const ground = entity?.components[COMPONENT_KEYS.groundPlane] as GroundPlane | undefined;
  if (ground) ground.variant = variant;

  notifyLevelDoc(state);
  return state.levelDocument;
};

export const selectLevelInstances = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  ids: string[],
) => {
  ensureSelectionEntity(deps, state);
  const uniqueIds = [...new Set(ids)];
  state.levelSelection = { instanceIds: uniqueIds, groupId: null };
  state.levelGroupPivotPrev = null;

  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;

  if (uniqueIds.length === 0) {
    state.levelMultiPivotPrev = null;
    sel.targetId = null;
    applyLevelGizmoAxisPolicy(state, []);
    return;
  }

  if (uniqueIds.length === 1) {
    state.levelMultiPivotPrev = null;
    sel.targetId = uniqueIds[0]!;
    applyLevelGizmoAxisPolicy(state, uniqueIds);
    return;
  }

  const centroid = computeInstancesCentroid(state.levelDocument, uniqueIds);
  const pivot = findLevelPivotEntity(deps.registry, 'multi');
  const local = pivot?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
  const t = pivot?.components[COMPONENT_KEYS.transform] as Transform | undefined;
  const childOf = pivot?.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
  const parent = childOf ? deps.registry.get(childOf.parentId) : null;
  const parentT = parent?.components[COMPONENT_KEYS.transform] as Transform | undefined;

  if (local && t && parentT) {
    local.position[0] = centroid[0];
    local.position[1] = centroid[1];
    local.position[2] = centroid[2];
    local.rotation[0] = 0;
    local.rotation[1] = 0;
    local.rotation[2] = 0;
    local.rotation[3] = 1;
    local.scale[0] = 1;
    local.scale[1] = 1;
    local.scale[2] = 1;
    bakeChildWorld(parentT, t, local);
  }

  state.levelMultiPivotPrev = { position: centroid, rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
  sel.targetId = LEVEL_MULTI_PIVOT_ID;
  applyLevelGizmoAxisPolicy(state, uniqueIds);
};

export const selectLevelGroup = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  groupId: string | null,
) => {
  ensureSelectionEntity(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;

  if (!groupId) {
    clearLevelSelectionState(state);
    sel.targetId = null;
    applyLevelGizmoAxisPolicy(state, []);
    return;
  }

  const group = state.levelDocument.groups.find((g) => g.id === groupId);
  if (!group) return;

  state.levelSelection = { instanceIds: [...group.memberInstanceIds], groupId };
  state.levelMultiPivotPrev = null;

  const pivot = findLevelPivotEntity(deps.registry, 'group');
  const local = pivot?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
  const t = pivot?.components[COMPONENT_KEYS.transform] as Transform | undefined;
  const childOf = pivot?.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
  const parent = childOf ? deps.registry.get(childOf.parentId) : null;
  const parentT = parent?.components[COMPONENT_KEYS.transform] as Transform | undefined;

  if (local && t && parentT) {
    applyLocalFromTRS(local, group);
    bakeChildWorld(parentT, t, local);
  }

  state.levelGroupPivotPrev = { position: [...group.position], rotation: [...group.rotation], scale: [...group.scale] };
  sel.targetId = LEVEL_GROUP_PIVOT_ID;
  applyLevelGizmoAxisPolicy(state, group.memberInstanceIds);
};

export const selectLevelRoot = (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  ensureSelectionEntity(deps, state);
  clearLevelSelectionState(state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  sel.targetId = null;
  applyLevelGizmoAxisPolicy(state, []);
};

export const getLevelSelection = (state: ConstructSessionState): ConstructLevelSelection => state.levelSelection;

export const renameLevel = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  name: string,
): LevelDocument => {
  const next = applyLevelName(state.levelDocument, name);
  if (next === state.levelDocument) return state.levelDocument;

  state.levelDocument = next;

  const root = deps.registry.view(CONSTRUCT_KEYS.levelRoot)[0];
  if (root) {
    const levelRoot = root.components[CONSTRUCT_KEYS.levelRoot] as { documentId: string } | undefined;
    if (levelRoot) levelRoot.documentId = state.levelDocument.id;
  }

  notifyLevelDoc(state);
  return state.levelDocument;
};

export const renameInstance = (
  state: ConstructSessionState,
  instanceId: string,
  name: string,
): LevelDocument => {
  const trimmed = name.trim();
  if (!trimmed) return state.levelDocument;

  state.levelDocument = {
    ...state.levelDocument,
    composition: {
      props: state.levelDocument.composition.props.map((p) => (p.id === instanceId ? { ...p, name: trimmed } : p)),
      actors: state.levelDocument.composition.actors.map((a) =>
        a.id === instanceId ? { ...a, name: trimmed } : a,
      ),
      colliders: state.levelDocument.composition.colliders.map((c) =>
        c.id === instanceId ? { ...c, name: trimmed } : c,
      ),
    },
  };
  notifyLevelDoc(state);
  return state.levelDocument;
};

export const renameGroup = (state: ConstructSessionState, groupId: string, name: string): LevelDocument => {
  const trimmed = name.trim();
  if (!trimmed) return state.levelDocument;

  state.levelDocument = {
    ...state.levelDocument,
    groups: state.levelDocument.groups.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g)),
  };
  notifyLevelDoc(state);
  return state.levelDocument;
};

export const setInstanceAiPackage = (
  state: ConstructSessionState,
  instanceId: string,
  aiPackage: ActorAiPackage,
): LevelDocument => {
  state.levelDocument = {
    ...state.levelDocument,
    composition: {
      ...state.levelDocument.composition,
      actors: state.levelDocument.composition.actors.map((a) =>
        a.id === instanceId ? { ...a, aiPackage } : a,
      ),
    },
  };
  notifyLevelDoc(state);
  return state.levelDocument;
};

export const setSimpleVariant = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  instanceId: string,
  variantUrl: string | null,
): Promise<LevelDocument> => {
  const rootId = ensureLevelRootWithOrigin(deps, state);
  const propInst = state.levelDocument.composition.props.find(
    (p) => p.id === instanceId && p.kind === 'simpleProp',
  );

  if (propInst) {
    const entry = state.levelDocument.index.simpleProps[propInst.indexId];
    if (!entry) return state.levelDocument;

    let indexId = findSimplePropIndexId(state.levelDocument, entry.url, entry.materialPrefix, variantUrl);
    let nextIndex = state.levelDocument.index.simpleProps;
    if (!indexId) {
      indexId = nextIndexId('simpleProp', state.levelDocument.index.simpleProps);
      nextIndex = { ...nextIndex, [indexId]: { ...entry, id: indexId, textureVariantUrl: variantUrl } };
    }

    state.levelDocument = {
      ...state.levelDocument,
      index: { ...state.levelDocument.index, simpleProps: nextIndex },
      composition: {
        ...state.levelDocument.composition,
        props: state.levelDocument.composition.props.map((p) =>
          p.id === instanceId ? { ...p, indexId: indexId! } : p,
        ),
      },
    };

    const updated = state.levelDocument.composition.props.find((p) => p.id === instanceId)!;
    const def = resolveInstancePropDefinition(state.levelDocument, updated);
    removeLevelPlacementEntity(deps.registry, instanceId);
    if (def) {
      await spawnLevelPropPlacementEntity(
        deps.device,
        deps.registry,
        deps.textures,
        deps.gltfCache,
        rootId,
        updated,
        def,
        state.showColliders,
      );
    }
    notifyLevelDoc(state);
    return state.levelDocument;
  }

  const actorInst = state.levelDocument.composition.actors.find(
    (a) => a.id === instanceId && a.kind === 'simpleActor',
  );
  if (!actorInst) return state.levelDocument;

  const entry = state.levelDocument.index.simpleActors[actorInst.indexId];
  if (!entry?.character) return state.levelDocument;

  let indexId = findSimpleActorIndexId(
    state.levelDocument,
    entry.character.url,
    entry.character.materialPrefix,
    variantUrl,
  );
  let nextIndex = state.levelDocument.index.simpleActors;
  if (!indexId) {
    indexId = nextIndexId('simpleActor', state.levelDocument.index.simpleActors);
    nextIndex = {
      ...nextIndex,
      [indexId]: { ...entry, id: indexId, character: { ...entry.character, textureVariantUrl: variantUrl } },
    };
  }

  state.levelDocument = {
    ...state.levelDocument,
    index: { ...state.levelDocument.index, simpleActors: nextIndex },
    composition: {
      ...state.levelDocument.composition,
      actors: state.levelDocument.composition.actors.map((a) =>
        a.id === instanceId ? { ...a, indexId: indexId! } : a,
      ),
    },
  };

  const updated = state.levelDocument.composition.actors.find((a) => a.id === instanceId)!;
  removeLevelPlacementEntity(deps.registry, instanceId);
  await spawnLevelActorFromInstance(deps, state, rootId, updated);
  notifyLevelDoc(state);
  return state.levelDocument;
};

export const removeInstances = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  ids: string[],
): LevelDocument => {
  const idSet = new Set(
    ids.filter((id) => id !== LEVEL_PLAYER_SPAWN_ID && id !== LEVEL_GROUND_PLANE_ID),
  );
  for (const id of idSet) removeLevelPlacementEntity(deps.registry, id);

  state.levelDocument = {
    ...state.levelDocument,
    composition: {
      props: state.levelDocument.composition.props.filter((p) => !idSet.has(p.id)),
      actors: state.levelDocument.composition.actors.filter((a) => !idSet.has(a.id)),
      colliders: state.levelDocument.composition.colliders.filter((c) => !idSet.has(c.id)),
    },
    groups: state.levelDocument.groups
      .map((g) => ({
        ...g,
        memberInstanceIds: g.memberInstanceIds.filter((mid) => !idSet.has(mid)),
      }))
      .filter((g) => g.memberInstanceIds.length > 0),
  };

  selectLevelRoot(deps, state);
  notifyLevelDoc(state);
  return state.levelDocument;
};

export const createGroup = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  instanceIds: string[],
  name?: string,
): LevelDocument => {
  const validIds = instanceIds.filter(
    (id) =>
      id !== LEVEL_PLAYER_SPAWN_ID &&
      id !== LEVEL_GROUND_PLANE_ID &&
      (state.levelDocument.composition.props.some((p) => p.id === id) ||
        state.levelDocument.composition.actors.some((a) => a.id === id) ||
        state.levelDocument.composition.colliders.some((c) => c.id === id)),
  );
  if (validIds.length === 0) return state.levelDocument;

  syncLevelInstanceCounters(state);
  state.levelGroupCounter += 1;
  const groupId = `group_${state.levelGroupCounter}`;
  const centroid = computeInstancesCentroid(state.levelDocument, validIds);
  const usedNames = new Set(state.levelDocument.groups.map((g) => g.name));
  const groupName = uniqueInstanceName(name?.trim() || 'Group', usedNames);

  const group: LevelDocumentGroup = {
    id: groupId,
    name: groupName,
    position: centroid,
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
    memberInstanceIds: validIds,
  };

  state.levelDocument = {
    ...state.levelDocument,
    groups: [...state.levelDocument.groups, group],
    composition: {
      props: state.levelDocument.composition.props.map((p) =>
        validIds.includes(p.id) ? { ...p, groupId } : p,
      ),
      actors: state.levelDocument.composition.actors.map((a) =>
        validIds.includes(a.id) ? { ...a, groupId } : a,
      ),
      colliders: state.levelDocument.composition.colliders.map((c) =>
        validIds.includes(c.id) ? { ...c, groupId } : c,
      ),
    },
  };

  selectLevelGroup(deps, state, groupId);
  notifyLevelDoc(state);
  return state.levelDocument;
};

export const assignToGroup = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  instanceIds: string[],
  groupId: string,
): LevelDocument => {
  const group = state.levelDocument.groups.find((g) => g.id === groupId);
  if (!group) return state.levelDocument;

  const idSet = new Set(
    instanceIds.filter((id) => id !== LEVEL_PLAYER_SPAWN_ID && id !== LEVEL_GROUND_PLANE_ID),
  );
  const memberSet = new Set([...group.memberInstanceIds, ...idSet]);

  state.levelDocument = {
    ...state.levelDocument,
    groups: state.levelDocument.groups.map((g) =>
      g.id === groupId ? { ...g, memberInstanceIds: [...memberSet] } : g,
    ),
    composition: {
      props: state.levelDocument.composition.props.map((p) => (idSet.has(p.id) ? { ...p, groupId } : p)),
      actors: state.levelDocument.composition.actors.map((a) => (idSet.has(a.id) ? { ...a, groupId } : a)),
      colliders: state.levelDocument.composition.colliders.map((c) =>
        idSet.has(c.id) ? { ...c, groupId } : c,
      ),
    },
  };

  selectLevelGroup(deps, state, groupId);
  notifyLevelDoc(state);
  return state.levelDocument;
};


export const ungroupInstances = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  instanceIds: string[],
): LevelDocument => {
  const idSet = new Set(
    instanceIds.filter((id) => id !== LEVEL_PLAYER_SPAWN_ID && id !== LEVEL_GROUND_PLANE_ID),
  );
  if (idSet.size === 0) return state.levelDocument;

  const nextGroups = [];
  for (const group of state.levelDocument.groups) {
    const remaining = group.memberInstanceIds.filter((id) => !idSet.has(id));
    if (remaining.length === 0) continue;
    if (remaining.length === group.memberInstanceIds.length) {
      nextGroups.push(group);
      continue;
    }
    nextGroups.push({ ...group, memberInstanceIds: remaining });
  }

  state.levelDocument = {
    ...state.levelDocument,
    groups: nextGroups,
    composition: {
      props: state.levelDocument.composition.props.map((p) =>
        idSet.has(p.id) ? { ...p, groupId: null } : p,
      ),
      actors: state.levelDocument.composition.actors.map((a) =>
        idSet.has(a.id) ? { ...a, groupId: null } : a,
      ),
      colliders: state.levelDocument.composition.colliders.map((c) =>
        idSet.has(c.id) ? { ...c, groupId: null } : c,
      ),
    },
  };

  selectLevelInstances(deps, state, [...idSet]);
  notifyLevelDoc(state);
  return state.levelDocument;
};

export const ungroup = (deps: ConstructSessionDeps, state: ConstructSessionState, groupId: string): LevelDocument => {
  const group = state.levelDocument.groups.find((g) => g.id === groupId);
  if (!group) return state.levelDocument;

  const memberSet = new Set(group.memberInstanceIds);
  state.levelDocument = {
    ...state.levelDocument,
    groups: state.levelDocument.groups.filter((g) => g.id !== groupId),
    composition: {
      props: state.levelDocument.composition.props.map((p) =>
        memberSet.has(p.id) ? { ...p, groupId: null } : p,
      ),
      actors: state.levelDocument.composition.actors.map((a) =>
        memberSet.has(a.id) ? { ...a, groupId: null } : a,
      ),
      colliders: state.levelDocument.composition.colliders.map((c) =>
        memberSet.has(c.id) ? { ...c, groupId: null } : c,
      ),
    },
  };

  selectLevelInstances(deps, state, [...memberSet]);
  notifyLevelDoc(state);
  return state.levelDocument;
};

export const deleteGroup = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  groupId: string,
  removeMembers: boolean,
): LevelDocument => {
  const group = state.levelDocument.groups.find((g) => g.id === groupId);
  if (!group) return state.levelDocument;

  if (!removeMembers) return ungroup(deps, state, groupId);

  const memberSet = new Set(group.memberInstanceIds);
  for (const id of memberSet) removeLevelPlacementEntity(deps.registry, id);

  state.levelDocument = {
    ...state.levelDocument,
    groups: state.levelDocument.groups.filter((g) => g.id !== groupId),
    composition: {
      props: state.levelDocument.composition.props.filter((p) => !memberSet.has(p.id)),
      actors: state.levelDocument.composition.actors.filter((a) => !memberSet.has(a.id)),
      colliders: state.levelDocument.composition.colliders.filter((c) => !memberSet.has(c.id)),
    },
  };

  selectLevelRoot(deps, state);
  notifyLevelDoc(state);
  return state.levelDocument;
};

const q4MulLocal = (out: Float32Array, a: Float32Array, b: Float32Array) => {
  const ax = a[0]!, ay = a[1]!, az = a[2]!, aw = a[3]!;
  const bx = b[0]!, by = b[1]!, bz = b[2]!, bw = b[3]!;
  out[0] = aw * bx + ax * bw + ay * bz - az * by;
  out[1] = aw * by - ax * bz + ay * bw + az * bx;
  out[2] = aw * bz + ax * by - ay * bx + az * bw;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
};

const applyDeltaToTRS = (
  trs: LevelInstanceTRS,
  prevPivot: ConstructLevelPivotSnapshot,
  nextPivot: ConstructLevelPivotSnapshot,
): LevelInstanceTRS => {
  const prevRotQ = q4(prevPivot.rotation[0], prevPivot.rotation[1], prevPivot.rotation[2], prevPivot.rotation[3]);
  const nextRotQ = q4(nextPivot.rotation[0], nextPivot.rotation[1], nextPivot.rotation[2], nextPivot.rotation[3]);
  const prevRotConj = q4();
  q4Conjugate(prevRotConj, prevRotQ);
  const rotDelta = q4();
  q4MulLocal(rotDelta, nextRotQ, prevRotConj);
  q4Normalize(rotDelta, rotDelta);

  const scaleDelta: [number, number, number] = [
    prevPivot.scale[0] !== 0 ? nextPivot.scale[0] / prevPivot.scale[0] : 1,
    prevPivot.scale[1] !== 0 ? nextPivot.scale[1] / prevPivot.scale[1] : 1,
    prevPivot.scale[2] !== 0 ? nextPivot.scale[2] / prevPivot.scale[2] : 1,
  ];

  const offset = v3(
    trs.position[0] - prevPivot.position[0],
    trs.position[1] - prevPivot.position[1],
    trs.position[2] - prevPivot.position[2],
  );
  const scaledOffset = v3(offset[0] * scaleDelta[0], offset[1] * scaleDelta[1], offset[2] * scaleDelta[2]);
  const rotatedOffset = v3();
  q4TransformVec3(rotatedOffset, rotDelta, scaledOffset);

  const position: [number, number, number] = [
    nextPivot.position[0] + rotatedOffset[0],
    nextPivot.position[1] + rotatedOffset[1],
    nextPivot.position[2] + rotatedOffset[2],
  ];

  const memberRotQ = q4(trs.rotation[0], trs.rotation[1], trs.rotation[2], trs.rotation[3]);
  const newRotQ = q4();
  q4MulLocal(newRotQ, rotDelta, memberRotQ);
  q4Normalize(newRotQ, newRotQ);

  const rotation: [number, number, number, number] = [newRotQ[0]!, newRotQ[1]!, newRotQ[2]!, newRotQ[3]!];
  const scale: [number, number, number] = [
    trs.scale[0] * scaleDelta[0],
    trs.scale[1] * scaleDelta[1],
    trs.scale[2] * scaleDelta[2],
  ];

  return { position, rotation, scale };
};

const writeInstanceLocalToEntity = (registry: Registry, instanceId: string, trs: LevelInstanceTRS) => {
  const entity = findLevelPlacementEntity(registry, instanceId);
  const local = entity?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
  if (!entity || !local) return;

  local.position[0] = trs.position[0];
  local.position[1] = trs.position[1];
  local.position[2] = trs.position[2];
  local.rotation[0] = trs.rotation[0];
  local.rotation[1] = trs.rotation[1];
  local.rotation[2] = trs.rotation[2];
  local.rotation[3] = trs.rotation[3];
  local.scale[0] = trs.scale[0];
  local.scale[1] = trs.scale[1];
  local.scale[2] = trs.scale[2];
  syncPartLocalToWorld(registry, entity);
};

const localToSnapshot = (local: LocalTransform): ConstructLevelPivotSnapshot => ({
  position: [local.position[0], local.position[1], local.position[2]],
  rotation: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
  scale: [local.scale[0], local.scale[1], local.scale[2]],
});

const applyGroupPivotCommit = (deps: ConstructSessionDeps, state: ConstructSessionState, local: LocalTransform) => {
  const groupId = state.levelSelection.groupId;
  const group = groupId ? state.levelDocument.groups.find((g) => g.id === groupId) : null;
  if (!group || !groupId) return;

  const prevPivot: ConstructLevelPivotSnapshot =
    state.levelGroupPivotPrev ?? { position: group.position, rotation: group.rotation, scale: group.scale };
  const nextPivot = localToSnapshot(local);
  const memberSet = new Set(group.memberInstanceIds);

  state.levelDocument = {
    ...state.levelDocument,
    groups: state.levelDocument.groups.map((g) => (g.id === groupId ? { ...g, ...nextPivot } : g)),
    composition: {
      props: state.levelDocument.composition.props.map((p) => {
        if (!memberSet.has(p.id)) return p;
        const next = applyDeltaToTRS(p, prevPivot, nextPivot);
        writeInstanceLocalToEntity(deps.registry, p.id, next);
        return { ...p, ...next };
      }),
      actors: state.levelDocument.composition.actors.map((a) => {
        if (!memberSet.has(a.id)) return a;
        const next = applyDeltaToTRS(a, prevPivot, nextPivot);
        writeInstanceLocalToEntity(deps.registry, a.id, next);
        return { ...a, ...next };
      }),
      colliders: state.levelDocument.composition.colliders.map((c) => {
        if (!memberSet.has(c.id)) return c;
        const next = applyDeltaToTRS(c, prevPivot, nextPivot);
        writeInstanceLocalToEntity(deps.registry, c.id, next);
        return { ...c, ...next };
      }),
    },
  };

  state.levelGroupPivotPrev = nextPivot;
  notifyLevelDoc(state);
};

const applyMultiPivotCommit = (deps: ConstructSessionDeps, state: ConstructSessionState, local: LocalTransform) => {
  const ids = state.levelSelection.instanceIds;
  if (ids.length === 0) return;

  const prevPivot: ConstructLevelPivotSnapshot =
    state.levelMultiPivotPrev ?? { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
  const nextPivot = localToSnapshot(local);
  const idSet = new Set(ids);

  state.levelDocument = {
    ...state.levelDocument,
    composition: {
      props: state.levelDocument.composition.props.map((p) => {
        if (!idSet.has(p.id)) return p;
        const next = applyDeltaToTRS(p, prevPivot, nextPivot);
        writeInstanceLocalToEntity(deps.registry, p.id, next);
        return { ...p, ...next };
      }),
      actors: state.levelDocument.composition.actors.map((a) => {
        if (!idSet.has(a.id)) return a;
        const next = applyDeltaToTRS(a, prevPivot, nextPivot);
        writeInstanceLocalToEntity(deps.registry, a.id, next);
        return { ...a, ...next };
      }),
      colliders: state.levelDocument.composition.colliders.map((c) => {
        if (!idSet.has(c.id)) return c;
        const next = applyDeltaToTRS(c, prevPivot, nextPivot);
        writeInstanceLocalToEntity(deps.registry, c.id, next);
        return { ...c, ...next };
      }),
    },
  };

  state.levelMultiPivotPrev = nextPivot;
  notifyLevelDoc(state);
};

const applyInstanceCommit = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  instanceId: string,
  local: LocalTransform,
) => {
  const trs = localToSnapshot(local);
  writeInstanceLocalToEntity(deps.registry, instanceId, trs);

  if (instanceId === LEVEL_PLAYER_SPAWN_ID) {
    state.levelDocument = {
      ...state.levelDocument,
      playerSpawn: {
        position: trs.position,
        rotation: trs.rotation,
      },
    };
    notifyLevelDoc(state);
    return;
  }

  if (instanceId === LEVEL_GROUND_PLANE_ID) {
    const size = Math.max(0.5, (Math.abs(trs.scale[0]) + Math.abs(trs.scale[2])) * 0.5);
    const next: LevelInstanceTRS = {
      position: trs.position,
      rotation: [0, 0, 0, 1],
      scale: [size, 1, size],
    };
    writeInstanceLocalToEntity(deps.registry, instanceId, next);
    state.levelDocument = {
      ...state.levelDocument,
      groundPlane: {
        position: next.position,
        size,
        variant: state.levelDocument.groundPlane.variant,
      },
    };
    notifyLevelDoc(state);
    return;
  }

  if (state.levelDocument.composition.props.some((p) => p.id === instanceId)) {
    state.levelDocument = {
      ...state.levelDocument,
      composition: {
        ...state.levelDocument.composition,
        props: state.levelDocument.composition.props.map((p) => (p.id === instanceId ? { ...p, ...trs } : p)),
      },
    };
    notifyLevelDoc(state);
    return;
  }

  if (state.levelDocument.composition.actors.some((a) => a.id === instanceId)) {
    state.levelDocument = {
      ...state.levelDocument,
      composition: {
        ...state.levelDocument.composition,
        actors: state.levelDocument.composition.actors.map((a) =>
          a.id === instanceId ? { ...a, ...trs } : a,
        ),
      },
    };
    notifyLevelDoc(state);
    return;
  }

  state.levelDocument = {
    ...state.levelDocument,
    composition: {
      ...state.levelDocument.composition,
      colliders: state.levelDocument.composition.colliders.map((c) =>
        c.id === instanceId ? { ...c, ...trs } : c,
      ),
    },
  };

  notifyLevelDoc(state);
};

export const applyLevelGizmoCommit = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  targetId: string,
  local: LocalTransform,
) => {
  if (targetId === LEVEL_GROUP_PIVOT_ID) {
    applyGroupPivotCommit(deps, state, local);
    return;
  }
  if (targetId === LEVEL_MULTI_PIVOT_ID) {
    applyMultiPivotCommit(deps, state, local);
    return;
  }
  applyInstanceCommit(deps, state, targetId, local);
};

const trsToLocal = (trs: LevelInstanceTRS): LocalTransform => {
  const local = createLocalTransform();
  applyLocalFromTRS(local, trs);
  return local;
};

const mergeInstancePatch = (
  current: LevelInstanceTRS,
  patch: ConstructTransformPatch,
  options: { allowScale: boolean; allowRotate: boolean },
): LevelInstanceTRS => ({
  position: patch.position
    ? [patch.position[0], patch.position[1], patch.position[2]]
    : [current.position[0], current.position[1], current.position[2]],
  rotation:
    options.allowRotate && patch.rotation
      ? [patch.rotation[0], patch.rotation[1], patch.rotation[2], patch.rotation[3]]
      : [current.rotation[0], current.rotation[1], current.rotation[2], current.rotation[3]],
  scale:
    options.allowScale && patch.scale
      ? [patch.scale[0], patch.scale[1], patch.scale[2]]
      : [current.scale[0], current.scale[1], current.scale[2]],
});

export const updateInstanceLocal = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  instanceId: string,
  patch: ConstructTransformPatch,
): LevelDocument => {
  const current = findInstanceTRS(state.levelDocument, instanceId);
  if (!current) return state.levelDocument;

  const selection: ConstructLevelSelection = { instanceIds: [instanceId], groupId: null };
  const next = mergeInstancePatch(current, patch, {
    allowScale: levelSelectionAllowsScale(state.levelDocument, selection),
    allowRotate: levelSelectionAllowsRotate(selection),
  });

  applyInstanceCommit(deps, state, instanceId, trsToLocal(next));
  return state.levelDocument;
};

export const updateGroupLocal = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  groupId: string,
  patch: ConstructTransformPatch,
): LevelDocument => {
  const group = state.levelDocument.groups.find((g) => g.id === groupId);
  if (!group) return state.levelDocument;

  const next = mergeInstancePatch(
    { position: group.position, rotation: group.rotation, scale: group.scale },
    patch,
    { allowScale: false, allowRotate: true },
  );

  const pivot = findLevelPivotEntity(deps.registry, 'group');
  const local = pivot?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
  const t = pivot?.components[COMPONENT_KEYS.transform] as Transform | undefined;
  const childOf = pivot?.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
  const parent = childOf ? deps.registry.get(childOf.parentId) : null;
  const parentT = parent?.components[COMPONENT_KEYS.transform] as Transform | undefined;

  const commitLocal = local ?? trsToLocal(next);
  applyLocalFromTRS(commitLocal, next);
  if (local && t && parentT) {
    bakeChildWorld(parentT, t, local);
  }

  applyGroupPivotCommit(deps, state, commitLocal);
  return state.levelDocument;
};
