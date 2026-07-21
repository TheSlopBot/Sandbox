import { type LocalTransform, type Registry, v3, COMPONENT_KEYS } from 'viberanium';
import { CONSTRUCT_KEYS } from '../catalog/keys/components.ts';
import {
  EQUIPMENT_MESH_PART_ID,
  type EquipmentDocument,
  type EquipmentDocumentCollider,
  type EquipmentDocumentProjectile,
  type EquipmentEditorSelection,
  applyEquipmentName,
  createEmptyEquipmentDocument,
  defaultSlotTagsForKind,
} from '../catalog/equipment/equipmentDocument.ts';
import { type PropDocument } from '../catalog/props/propDocument.ts';
import {
  clearPropEditorEntities,
  ensurePropOriginMarker,
  ensurePropRoot,
  removePropPartEntity,
} from '../entities/propEditor/spawnPropEditor.ts';
import { spawnColliderPartEntity } from '../entities/propEditor/spawnColliderPart.ts';
import {
  defaultEquipmentCollider,
  equipmentColliderToPropPart,
  replaceEquipmentMeshEntity,
  spawnEquipmentContent,
} from '../entities/equipmentEditor/spawnEquipmentEditor.ts';
import { clearActorEditorEntities } from '../entities/actorEditor/spawnActorEditor.ts';
import { createConstructActorSelection } from '../entities/actorEditor/actorSelection.ts';
import { type ConstructEditorSelection } from '../entities/editorCommon/editorSelection.ts';
import { type ConstructGizmoMode } from '../entities/gizmos/gizmoMode.ts';
import { type ConstructPropPart } from '../entities/propEditor/propPart.ts';
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

const IDENTITY_ROTATION: [number, number, number, number] = [0, 0, 0, 1];

const equipmentSelectionAllowsRotate = (targetId: string | null, doc: EquipmentDocument): boolean => {
  if (!targetId || targetId === EQUIPMENT_MESH_PART_ID) return false;
  return doc.colliders.some((c) => c.id === targetId);
};

const applyEquipmentGizmoAxisPolicy = (state: ConstructSessionState) => {
  const gizmo = state.selectionEnt.components[CONSTRUCT_KEYS.gizmoMode] as ConstructGizmoMode | undefined;
  if (!gizmo) return;

  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  if (gizmo.mode === 'rotate' && !equipmentSelectionAllowsRotate(sel.targetId, state.equipmentDocument)) {
    gizmo.mode = 'move';
  }
};

const equipmentAsPropDoc = (doc: EquipmentDocument): PropDocument => ({
  version: 1,
  id: doc.id,
  displayName: doc.displayName,
  parts: [],
});

const ensureEquipmentRootWithOrigin = (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  const rootId = ensurePropRoot(deps.registry, equipmentAsPropDoc(state.equipmentDocument));
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

const notifyEquipmentDoc = (state: ConstructSessionState) => {
  state.equipmentDocListener?.(state.equipmentDocument);
};

const isOnlyDefaultSlotTags = (tags: string[], kind: EquipmentDocument['kind']) => {
  if (tags.length === 0) return true;
  const defaults = defaultSlotTagsForKind(kind);
  if (tags.length !== defaults.length) return false;
  return tags.every((t) => defaults.includes(t));
};

const prepareEquipmentScene = (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  resetEditorScene(deps, state);
  state.editorMode = 'equipment';
  stopActorSystems(state);
  clearPropEditorEntities(deps.registry);
  clearActorEditorEntities(deps.registry);
  ensureSelectionEntity(deps, state);
  const rootId = ensureEquipmentRootWithOrigin(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  sel.targetId = null;
  state.selectionEnt.components[CONSTRUCT_KEYS.actorSelection] = createConstructActorSelection();
  ensurePropStaticModelSystem(deps.registry, state);
  return rootId;
};

export const newEquipment = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
): EquipmentDocument => {
  prepareEquipmentScene(deps, state);
  state.equipmentDocument = createEmptyEquipmentDocument();
  state.partCounter = 0;
  ensureEquipmentRootWithOrigin(deps, state);
  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const enterEquipmentMode = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
): Promise<EquipmentDocument> => {
  state.equipmentDocument = {
    ...state.equipmentDocument,
    mesh: {
      ...state.equipmentDocument.mesh,
      rotation: IDENTITY_ROTATION,
    },
  };
  const rootId = prepareEquipmentScene(deps, state);
  await spawnEquipmentContent(
    deps.device,
    deps.registry,
    deps.textures,
    deps.gltfCache,
    rootId,
    state.equipmentDocument,
    state.showColliders,
  );
  return state.equipmentDocument;
};

export const getEquipmentDocument = (state: ConstructSessionState): EquipmentDocument =>
  state.equipmentDocument;

export const loadEquipmentDocument = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  doc: EquipmentDocument,
): Promise<EquipmentDocument> => {
  state.equipmentDocument = {
    ...structuredClone(doc),
    mesh: {
      ...doc.mesh,
      rotation: IDENTITY_ROTATION,
    },
  };
  state.partCounter = state.equipmentDocument.colliders.length;
  const rootId = prepareEquipmentScene(deps, state);
  await spawnEquipmentContent(
    deps.device,
    deps.registry,
    deps.textures,
    deps.gltfCache,
    rootId,
    state.equipmentDocument,
    state.showColliders,
  );
  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const setEquipmentMesh = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  url: string,
  materialPrefix = 'prop',
): Promise<EquipmentDocument> => {
  const rootId = ensureEquipmentRootWithOrigin(deps, state);
  const local = {
    position: [deps.orbit.target[0], deps.orbit.target[1], deps.orbit.target[2]] as [
      number,
      number,
      number,
    ],
    rotation: [0, 0, 0, 1] as [number, number, number, number],
    scale: [1, 1, 1] as [number, number, number],
  };

  state.equipmentDocument = {
    ...state.equipmentDocument,
    mesh: {
      url,
      materialPrefix,
      position: local.position,
      rotation: local.rotation,
      scale: local.scale,
    },
  };

  ensurePropStaticModelSystem(deps.registry, state);
  await replaceEquipmentMeshEntity(
    deps.device,
    deps.registry,
    deps.textures,
    deps.gltfCache,
    rootId,
    state.equipmentDocument,
  );

  ensureSelectionEntity(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  sel.targetId = EQUIPMENT_MESH_PART_ID;
  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const clearEquipmentMesh = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
): EquipmentDocument => {
  removePropPartEntity(deps.registry, EQUIPMENT_MESH_PART_ID);
  state.equipmentDocument = {
    ...state.equipmentDocument,
    mesh: {
      ...state.equipmentDocument.mesh,
      url: '',
      materialPrefix: '',
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
  };

  ensureSelectionEntity(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  if (sel.targetId === EQUIPMENT_MESH_PART_ID) sel.targetId = null;

  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const addEquipmentCollider = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  shape: 'box' | 'cylinder' | 'sphere',
): EquipmentDocument => {
  const rootId = ensureEquipmentRootWithOrigin(deps, state);
  state.partCounter += 1;
  const role: EquipmentDocumentCollider['role'] =
    state.equipmentDocument.kind === 'shield' ? 'shield' : 'weapon';
  const collider = defaultEquipmentCollider(shape, `col_${state.partCounter}`, role);
  collider.position = [deps.orbit.target[0], deps.orbit.target[1], deps.orbit.target[2]];

  state.equipmentDocument = {
    ...state.equipmentDocument,
    colliders: [...state.equipmentDocument.colliders, collider],
  };

  spawnColliderPartEntity(
    deps.device,
    deps.registry,
    rootId,
    equipmentColliderToPropPart(collider),
    state.showColliders,
  );

  ensureSelectionEntity(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  sel.targetId = collider.id;
  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const selectEquipment = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  sel: EquipmentEditorSelection,
) => {
  ensureSelectionEntity(deps, state);
  const editorSel = state.selectionEnt.components[
    CONSTRUCT_KEYS.editorSelection
  ] as ConstructEditorSelection;

  if (!sel || sel.kind === 'root' || sel.kind === 'projectile') {
    editorSel.targetId = null;
    applyEquipmentGizmoAxisPolicy(state);
    return;
  }

  if (sel.kind === 'mesh') {
    editorSel.targetId = EQUIPMENT_MESH_PART_ID;
    applyEquipmentGizmoAxisPolicy(state);
    return;
  }

  editorSel.targetId = sel.colliderId;
  applyEquipmentGizmoAxisPolicy(state);
};

export const renameEquipment = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  name: string,
): EquipmentDocument => {
  const next = applyEquipmentName(state.equipmentDocument, name);
  if (next === state.equipmentDocument) return state.equipmentDocument;

  state.equipmentDocument = next;

  const root = deps.registry.view(CONSTRUCT_KEYS.propRoot)[0];
  if (root) {
    const propRoot = root.components[CONSTRUCT_KEYS.propRoot] as { documentId: string } | undefined;
    if (propRoot) propRoot.documentId = state.equipmentDocument.id;
  }

  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const updateEquipmentKind = (
  state: ConstructSessionState,
  kind: EquipmentDocument['kind'],
): EquipmentDocument => {
  const prev = state.equipmentDocument;
  const shouldResetSlots = isOnlyDefaultSlotTags(prev.slotTags, prev.kind);
  let projectile = prev.projectile;

  if (kind !== 'gun') {
    projectile = undefined;
  } else if (!projectile) {
    projectile = {
      localOffset: [0, 0.2, 0.4],
      equipmentId: '',
    };
  }

  const nextStats =
    kind === 'projectile'
      ? {
          damage: 0,
          moveSpeed: prev.stats.moveSpeed ?? 25,
        }
      : kind === 'gun'
        ? {
            damage: prev.stats.damage,
            fireRate: prev.stats.fireRate ?? 0.35,
          }
        : { ...prev.stats };

  state.equipmentDocument = {
    ...prev,
    kind,
    slotTags: shouldResetSlots ? defaultSlotTagsForKind(kind) : [...prev.slotTags],
    projectile,
    stats: nextStats,
  };
  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const updateEquipmentSlotTags = (
  state: ConstructSessionState,
  tags: string[],
): EquipmentDocument => {
  state.equipmentDocument = {
    ...state.equipmentDocument,
    slotTags: [...tags],
  };
  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const updateEquipmentStats = (
  state: ConstructSessionState,
  partial: Partial<EquipmentDocument['stats']>,
): EquipmentDocument => {
  state.equipmentDocument = {
    ...state.equipmentDocument,
    stats: { ...state.equipmentDocument.stats, ...partial },
  };
  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const updateEquipmentClips = (
  state: ConstructSessionState,
  partial: Partial<EquipmentDocument['clips']>,
): EquipmentDocument => {
  const clips: EquipmentDocument['clips'] = {
    ...state.equipmentDocument.clips,
    ...partial,
  };

  for (const key of Object.keys(partial) as (keyof EquipmentDocument['clips'])[]) {
    if (partial[key] === undefined) delete clips[key];
  }

  state.equipmentDocument = {
    ...state.equipmentDocument,
    clips,
  };
  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const updateEquipmentProjectile = (
  state: ConstructSessionState,
  projectile: EquipmentDocumentProjectile | undefined,
): EquipmentDocument => {
  state.equipmentDocument = {
    ...state.equipmentDocument,
    projectile: projectile ? { ...projectile } : undefined,
  };
  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const updateColliderRole = (
  state: ConstructSessionState,
  colliderId: string,
  role: EquipmentDocumentCollider['role'],
): EquipmentDocument => {
  state.equipmentDocument = {
    ...state.equipmentDocument,
    colliders: state.equipmentDocument.colliders.map((c) =>
      c.id === colliderId ? { ...c, role } : c,
    ),
  };
  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const updateEquipmentColliderName = (
  state: ConstructSessionState,
  colliderId: string,
  name: string,
): EquipmentDocument => {
  const trimmed = name.trim();
  if (!trimmed) return state.equipmentDocument;

  state.equipmentDocument = {
    ...state.equipmentDocument,
    colliders: state.equipmentDocument.colliders.map((c) =>
      c.id === colliderId ? { ...c, name: trimmed } : c,
    ),
  };
  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const updateEquipmentPartLocal = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  partId: string,
  patch: ConstructTransformPatch,
): EquipmentDocument => {
  const entity = findPartEntity(deps.registry, partId);
  const local = entity?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
  if (!entity || !local) return state.equipmentDocument;

  const allowRotate = partId !== EQUIPMENT_MESH_PART_ID;
  const keepPivot = !!(patch.scale || (patch.rotation && allowRotate));
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
  if (patch.rotation && allowRotate) {
    local.rotation[0] = patch.rotation[0];
    local.rotation[1] = patch.rotation[1];
    local.rotation[2] = patch.rotation[2];
    local.rotation[3] = patch.rotation[3];
  }

  if (!allowRotate) {
    local.rotation[0] = IDENTITY_ROTATION[0];
    local.rotation[1] = IDENTITY_ROTATION[1];
    local.rotation[2] = IDENTITY_ROTATION[2];
    local.rotation[3] = IDENTITY_ROTATION[3];
  }

  if (modelCenter && pivotParent) {
    setLocalPositionForPivot(local, pivotParent, modelCenter);
  }

  syncPartLocalToWorld(deps.registry, entity);

  const nextLocal = {
    position: [local.position[0], local.position[1], local.position[2]] as [number, number, number],
    rotation: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]] as [
      number,
      number,
      number,
      number,
    ],
    scale: [local.scale[0], local.scale[1], local.scale[2]] as [number, number, number],
  };

  if (partId === EQUIPMENT_MESH_PART_ID) {
    state.equipmentDocument = {
      ...state.equipmentDocument,
      mesh: {
        ...state.equipmentDocument.mesh,
        position: nextLocal.position,
        scale: nextLocal.scale,
        rotation: IDENTITY_ROTATION,
      },
    };
  } else {
    state.equipmentDocument = {
      ...state.equipmentDocument,
      colliders: state.equipmentDocument.colliders.map((c) =>
        c.id === partId ? { ...c, ...nextLocal } : c,
      ),
    };
  }

  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const removeEquipmentCollider = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  colliderId: string,
): EquipmentDocument => {
  if (!state.equipmentDocument.colliders.some((c) => c.id === colliderId)) {
    return state.equipmentDocument;
  }

  removePropPartEntity(deps.registry, colliderId);
  state.equipmentDocument = {
    ...state.equipmentDocument,
    colliders: state.equipmentDocument.colliders.filter((c) => c.id !== colliderId),
  };

  ensureSelectionEntity(deps, state);
  const sel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  if (sel.targetId === colliderId) sel.targetId = null;

  notifyEquipmentDoc(state);
  return state.equipmentDocument;
};

export const setEquipmentDocumentListener = (
  state: ConstructSessionState,
  fn: ((doc: EquipmentDocument) => void) | null,
) => {
  state.equipmentDocListener = fn;
};

export const applyEquipmentGizmoCommit = (
  state: ConstructSessionState,
  partId: string,
  local: LocalTransform,
) => {
  if (partId === EQUIPMENT_MESH_PART_ID) {
    local.rotation[0] = IDENTITY_ROTATION[0];
    local.rotation[1] = IDENTITY_ROTATION[1];
    local.rotation[2] = IDENTITY_ROTATION[2];
    local.rotation[3] = IDENTITY_ROTATION[3];

    state.equipmentDocument = {
      ...state.equipmentDocument,
      mesh: {
        ...state.equipmentDocument.mesh,
        position: [local.position[0], local.position[1], local.position[2]],
        scale: [local.scale[0], local.scale[1], local.scale[2]],
        rotation: IDENTITY_ROTATION,
      },
    };
  } else {
    state.equipmentDocument = {
      ...state.equipmentDocument,
      colliders: state.equipmentDocument.colliders.map((c) =>
        c.id === partId
          ? {
              ...c,
              position: [local.position[0], local.position[1], local.position[2]],
              rotation: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
              scale: [local.scale[0], local.scale[1], local.scale[2]],
            }
          : c,
      ),
    };
  }

  state.equipmentDocListener?.(state.equipmentDocument);
};
