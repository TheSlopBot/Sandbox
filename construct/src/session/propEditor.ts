import { type LocalTransform, type Registry, v3, COMPONENT_KEYS } from 'viberanium';
import { CONSTRUCT_KEYS } from '../catalog/keys/components.ts';
import {
  type PropDocument,
  type PropDocumentAssetPart,
  type PropEditorTransformMode,
  applyPropName,
  createEmptyPropDocument,
  identityPartLocal,
} from '../catalog/props/propDocument.ts';
import {
  clearPropEditorEntities,
  defaultColliderPart,
  ensurePropOriginMarker,
  ensurePropRoot,
  removePropPartEntity,
} from '../entities/propEditor/spawnPropEditor.ts';
import { spawnAssetPartEntity } from '../entities/propEditor/spawnAssetPart.ts';
import { spawnColliderPartEntity } from '../entities/propEditor/spawnColliderPart.ts';
import { clearActorEditorEntities } from '../entities/actorEditor/spawnActorEditor.ts';
import { createConstructActorSelection } from '../entities/actorEditor/actorSelection.ts';
import { type ConstructEditorSelection } from '../entities/editorCommon/editorSelection.ts';
import { type ConstructGizmoMode } from '../entities/gizmos/gizmoMode.ts';
import { type ConstructPropPart } from '../entities/propEditor/propPart.ts';
import { type ConstructPropAssetMaterials } from '../entities/propEditor/propAssetMaterials.ts';
import {
  localPivotFromTransform,
  partModelSpaceCenter,
  setLocalPositionForPivot,
} from '../entities/propEditor/partPivot.ts';
import { syncPartLocalToWorld } from '../entities/editorCommon/syncPartLocal.ts';
import { stopActorSystems } from './actorEditor.ts';
import { ensureSelectionEntity, resetEditorScene } from '../scenes/editorScene.ts';
import { ensurePropStaticModelSystem } from '../scenes/installEditorSystems.ts';
import {
  type ConstructSessionDeps,
  type ConstructSessionState,
  type ConstructTransformPatch,
} from './types.ts';

const ensurePropRootWithOrigin = (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  const rootId = ensurePropRoot(deps.registry, state.propDocument);
  ensurePropOriginMarker(deps.device, deps.registry, rootId);
  return rootId;
};

const findPartEntity = (registry: Registry, partId: string) => {
  for (const e of registry.view(CONSTRUCT_KEYS.propPart)) {
    const part = e.components[CONSTRUCT_KEYS.propPart] as ConstructPropPart | undefined;
    if (part?.partId === partId) return e;
  }
  return null;
};

const notifyPropDoc = (state: ConstructSessionState) => {
  state.propDocListener?.(state.propDocument);
};

export const newProp = (deps: ConstructSessionDeps, state: ConstructSessionState): PropDocument => {
  resetEditorScene(deps, state);
  state.editorMode = 'prop';
  stopActorSystems(state);
  clearPropEditorEntities(deps.registry);
  clearActorEditorEntities(deps.registry);
  state.propDocument = createEmptyPropDocument();
  state.partCounter = 0;
  ensurePropRootWithOrigin(deps, state);
  ensureSelectionEntity(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  sel.targetId = null;
  state.selectionEnt.components[CONSTRUCT_KEYS.actorSelection] = createConstructActorSelection();
  return state.propDocument;
};

export const enterPropMode = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
): Promise<PropDocument> => {
  resetEditorScene(deps, state);
  state.editorMode = 'prop';
  stopActorSystems(state);
  clearPropEditorEntities(deps.registry);
  clearActorEditorEntities(deps.registry);
  ensureSelectionEntity(deps, state);
  const rootId = ensurePropRootWithOrigin(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  sel.targetId = null;
  state.selectionEnt.components[CONSTRUCT_KEYS.actorSelection] = createConstructActorSelection();

  ensurePropStaticModelSystem(deps.registry, state);

  for (const part of state.propDocument.parts) {
    if (part.kind === 'collider') {
      spawnColliderPartEntity(deps.device, deps.registry, rootId, part, state.showColliders);
    } else {
      await spawnAssetPartEntity(deps.device, deps.registry, deps.textures, deps.gltfCache, rootId, part);
    }
  }

  return state.propDocument;
};

export const getPropDocument = (state: ConstructSessionState): PropDocument => state.propDocument;

export const loadPropDocument = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  doc: PropDocument,
): Promise<PropDocument> => {
  resetEditorScene(deps, state);
  state.editorMode = 'prop';
  stopActorSystems(state);
  clearPropEditorEntities(deps.registry);
  clearActorEditorEntities(deps.registry);
  state.propDocument = {
    version: 1,
    id: doc.id,
    displayName: doc.displayName,
    parts: doc.parts.map((part) => ({
      ...part,
      name: part.name?.trim() ? part.name : part.id,
      ...(part.kind === 'asset' ? { tags: Array.isArray(part.tags) ? [...part.tags] : [] } : {}),
    })),
  };
  state.partCounter = state.propDocument.parts.length;
  const rootId = ensurePropRootWithOrigin(deps, state);
  ensureSelectionEntity(deps, state);
  state.selectionEnt.components[CONSTRUCT_KEYS.actorSelection] = createConstructActorSelection();

  ensurePropStaticModelSystem(deps.registry, state);

  for (const part of state.propDocument.parts) {
    if (part.kind === 'collider') {
      spawnColliderPartEntity(deps.device, deps.registry, rootId, part, state.showColliders);
    } else {
      await spawnAssetPartEntity(deps.device, deps.registry, deps.textures, deps.gltfCache, rootId, part);
    }
  }

  return state.propDocument;
};

export const addAssetPart = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  url: string,
  materialPrefix = 'prop',
): Promise<PropDocument> => {
  const rootId = ensurePropRootWithOrigin(deps, state);
  state.partCounter += 1;
  const local = identityPartLocal();
  local.position = [deps.orbit.target[0], deps.orbit.target[1], deps.orbit.target[2]];
  const part: PropDocumentAssetPart = {
    id: `mesh_${state.partCounter}`,
    name: `mesh_${state.partCounter}`,
    kind: 'asset',
    url,
    materialPrefix,
    tags: [],
    ...local,
  };
  state.propDocument = { ...state.propDocument, parts: [...state.propDocument.parts, part] };

  ensurePropStaticModelSystem(deps.registry, state);
  await spawnAssetPartEntity(deps.device, deps.registry, deps.textures, deps.gltfCache, rootId, part);

  ensureSelectionEntity(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  sel.targetId = part.id;
  return state.propDocument;
};

export const addColliderPart = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  shape: 'box' | 'cylinder' | 'sphere',
): PropDocument => {
  const rootId = ensurePropRootWithOrigin(deps, state);
  state.partCounter += 1;
  const part = defaultColliderPart(shape, `col_${state.partCounter}`);
  state.propDocument = { ...state.propDocument, parts: [...state.propDocument.parts, part] };
  spawnColliderPartEntity(deps.device, deps.registry, rootId, part, state.showColliders);

  ensureSelectionEntity(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  sel.targetId = part.id;
  return state.propDocument;
};

export const selectPart = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  partId: string | null,
) => {
  ensureSelectionEntity(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  sel.targetId = partId;
};

export const setTransformMode = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  mode: PropEditorTransformMode,
) => {
  ensureSelectionEntity(deps, state);
  const gizmo = state.selectionEnt.components[CONSTRUCT_KEYS.gizmoMode] as ConstructGizmoMode;
  gizmo.mode = mode;
};

export const renameProp = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  name: string,
): PropDocument => {
  const next = applyPropName(state.propDocument, name);
  if (next === state.propDocument) return state.propDocument;

  state.propDocument = next;

  const root = deps.registry.view(CONSTRUCT_KEYS.propRoot)[0];
  if (root) {
    const propRoot = root.components[CONSTRUCT_KEYS.propRoot] as { documentId: string } | undefined;
    if (propRoot) propRoot.documentId = state.propDocument.id;
  }

  notifyPropDoc(state);
  return state.propDocument;
};

export const updatePartName = (
  state: ConstructSessionState,
  partId: string,
  name: string,
): PropDocument => {
  const trimmed = name.trim();
  if (!trimmed) return state.propDocument;

  state.propDocument = {
    ...state.propDocument,
    parts: state.propDocument.parts.map((part) => (part.id === partId ? { ...part, name: trimmed } : part)),
  };
  notifyPropDoc(state);
  return state.propDocument;
};

export const updatePartTags = (
  state: ConstructSessionState,
  partId: string,
  tags: string[],
): PropDocument => {
  state.propDocument = {
    ...state.propDocument,
    parts: state.propDocument.parts.map((part) =>
      part.id === partId && part.kind === 'asset' ? { ...part, tags: [...tags] } : part,
    ),
  };
  notifyPropDoc(state);
  return state.propDocument;
};

export const updatePartLocal = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  partId: string,
  patch: ConstructTransformPatch,
): PropDocument => {
  const entity = findPartEntity(deps.registry, partId);
  const local = entity?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
  if (!entity || !local) return state.propDocument;

  const keepPivot = !!(patch.scale || patch.rotation);
  const modelCenter = keepPivot ? partModelSpaceCenter(v3(), entity) : null;
  const pivotParent = modelCenter ? localPivotFromTransform(v3(), local, modelCenter) : null;

  if (patch.position) {
    local.position[0] = patch.position[0];
    local.position[1] = patch.position[1];
    local.position[2] = patch.position[2];
  }
  if (patch.scale) {
    local.scale[0] = patch.scale[0];
    local.scale[1] = patch.scale[1];
    local.scale[2] = patch.scale[2];
  }
  if (patch.rotation) {
    local.rotation[0] = patch.rotation[0];
    local.rotation[1] = patch.rotation[1];
    local.rotation[2] = patch.rotation[2];
    local.rotation[3] = patch.rotation[3];
  }

  if (modelCenter && pivotParent) {
    setLocalPositionForPivot(local, pivotParent, modelCenter);
  }

  syncPartLocalToWorld(deps.registry, entity);

  state.propDocument = {
    ...state.propDocument,
    parts: state.propDocument.parts.map((part) => {
      if (part.id !== partId) return part;
      return {
        ...part,
        position: [local.position[0], local.position[1], local.position[2]],
        rotation: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
        scale: [local.scale[0], local.scale[1], local.scale[2]],
      };
    }),
  };
  notifyPropDoc(state);
  return state.propDocument;
};

export const removePart = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  partId: string,
): PropDocument => {
  if (!state.propDocument.parts.some((part) => part.id === partId)) return state.propDocument;

  removePropPartEntity(deps.registry, partId);
  state.propDocument = {
    ...state.propDocument,
    parts: state.propDocument.parts.filter((part) => part.id !== partId),
  };

  ensureSelectionEntity(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  if (sel.targetId === partId) sel.targetId = null;

  notifyPropDoc(state);
  return state.propDocument;
};

export const setPropDocumentListener = (
  state: ConstructSessionState,
  fn: ((doc: PropDocument) => void) | null,
) => {
  state.propDocListener = fn;
};

export const setPartTextureVariant = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  partId: string,
  variantUrl: string | null,
): Promise<PropDocument> => {
  const entity = findPartEntity(deps.registry, partId);
  const assetMaterials = entity?.components[CONSTRUCT_KEYS.propAssetMaterials] as
    | ConstructPropAssetMaterials
    | undefined;
  if (!entity || !assetMaterials) return state.propDocument;

  if (!variantUrl) {
    assetMaterials.textureVariantUrl = null;
    const tex = assetMaterials.defaultBaseColorTex;
    for (const mat of assetMaterials.materials) {
      if (tex) mat.baseColorTex = tex;
    }
  } else {
    const tex = await deps.textures.getOrLoad(variantUrl);
    assetMaterials.textureVariantUrl = variantUrl;
    for (const mat of assetMaterials.materials) {
      mat.baseColorTex = tex;
    }
  }

  state.propDocument = {
    ...state.propDocument,
    parts: state.propDocument.parts.map((part) => {
      if (part.id !== partId || part.kind !== 'asset') return part;
      return { ...part, textureVariantUrl: variantUrl };
    }),
  };
  notifyPropDoc(state);
  return state.propDocument;
};

export const applyPropGizmoCommit = (state: ConstructSessionState, partId: string, local: LocalTransform) => {
  state.propDocument = {
    ...state.propDocument,
    parts: state.propDocument.parts.map((part) => {
      if (part.id !== partId) return part;
      return {
        ...part,
        position: [local.position[0], local.position[1], local.position[2]],
        rotation: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
        scale: [local.scale[0], local.scale[1], local.scale[2]],
      };
    }),
  };
  state.propDocListener?.(state.propDocument);
};
