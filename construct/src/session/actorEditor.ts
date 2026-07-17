import {
  type Collider,
  type Entity,
  type LocalTransform,
  type Material,
  type Registry,
  type RuntimeScene,
  type SkeletalModel,
  type Transform,
  bakeColliderWorldFromLocal,
  m4,
  m4FromTRSQuat,
  m4Mul,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../catalog/keys/components.ts';
import {
  type ActorAiPackage,
  type ActorColliderShape,
  type ActorDocument,
  type ActorDocumentAttachment,
  type ActorDocumentClips,
  type ActorDocumentColliderParent,
  type ActorEditorSelection,
  applyActorName,
  createEmptyActorDocument,
  defaultActorCollider,
  identityAttachmentLocal,
} from '../catalog/actors/actorDocument.ts';
import { KAYKIT_MEDIUM_CLIPS } from '../catalog/manifest/kaykitMediumDefaults.ts';
import {
  clearActorEditorEntities,
  ensureActorOriginMarker,
  ensureActorRoot,
} from '../entities/actorEditor/spawnActorEditor.ts';
import { spawnActorCharacter } from '../entities/actorEditor/spawnActorCharacter.ts';
import {
  removeActorAttachmentEntity,
  spawnActorAttachment,
  syncAttachmentOffsetFromLocal,
} from '../entities/actorEditor/spawnActorAttachment.ts';
import { removeActorColliderEntity, spawnActorCollider } from '../entities/actorEditor/spawnActorCollider.ts';
import { spawnSkeletonOverlay } from '../entities/actorEditor/spawnSkeletonOverlay.ts';
import { createConstructActorSelection } from '../entities/actorEditor/actorSelection.ts';
import { type ConstructActorAttachment } from '../entities/actorEditor/actorAttachment.ts';
import { type ConstructActorCollider } from '../entities/actorEditor/actorCollider.ts';
import { clearPropEditorEntities } from '../entities/propEditor/spawnPropEditor.ts';
import { applyActorColliderWireColor } from '../entities/editorCommon/colliderShapeResources.ts';
import { createConstructEditorSelection, type ConstructEditorSelection } from '../entities/editorCommon/editorSelection.ts';
import {
  ensureActorEditorSystems,
  stopActorEditorSystems,
} from '../scenes/installEditorSystems.ts';
import { applyShowBonesVisibility } from './levelEditor.ts';
import { ensureSelectionEntity, resetEditorScene } from '../scenes/editorScene.ts';
import {
  type ConstructSessionDeps,
  type ConstructSessionState,
  type ConstructTransformPatch,
} from './types.ts';

const getActorCharacterEntity = (registry: Registry): Entity | undefined =>
  registry.view(CONSTRUCT_KEYS.actorCharacter)[0];

const getActorBodyScene = (registry: Registry): RuntimeScene | null => {
  const entity = getActorCharacterEntity(registry);
  const model = entity?.components[COMPONENT_KEYS.skeletalModel] as SkeletalModel | undefined;
  return model?.bodyScene ?? null;
};

const computeBoneNames = (bodyScene: RuntimeScene): string[] =>
  bodyScene.skins[0]?.joints
    .map((j) => bodyScene.nodes[j]?.name ?? '')
    .filter((n) => n.length > 0) ?? [];

const notifyActorDoc = (state: ConstructSessionState) => {
  state.actorDocListener?.(state.actorDocument);
};

export const stopActorSystems = (state: ConstructSessionState) => {
  stopActorEditorSystems(state);
};

const ensureActorSystems = (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  ensureActorEditorSystems(deps.registry, deps.device, deps.pipeline, state);
};

const ensureActorRootWithOrigin = (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  const rootId = ensureActorRoot(deps.registry, state.actorDocument);
  ensureActorOriginMarker(deps.device, deps.registry, rootId);
  return rootId;
};

const respawnActorContent = async (deps: ConstructSessionDeps, state: ConstructSessionState) => {
  clearActorEditorEntities(deps.registry);
  ensureActorRootWithOrigin(deps, state);

  if (!state.actorDocument.character) return;

  ensureActorSystems(deps, state);

  const spawned = await spawnActorCharacter(
    deps.device,
    deps.registry,
    deps.textures,
    deps.gltfCache,
    state.actorDocument.character,
  );
  spawnSkeletonOverlay(deps.device, deps.registry, spawned.bodyScene, spawned.boneNames);
  applyShowBonesVisibility(deps, state.showBones);

  for (const attachment of state.actorDocument.attachments) {
    await spawnActorAttachment(
      deps.device,
      deps.registry,
      deps.textures,
      deps.gltfCache,
      spawned.entityId,
      spawned.bodyScene,
      attachment,
    );
  }

  for (const collider of state.actorDocument.colliders) {
    spawnActorCollider(deps.device, deps.registry, spawned.entityId, spawned.bodyScene, collider, state.showColliders);
  }
};

const findAttachmentEntity = (registry: Registry, attachmentId: string): Entity | null => {
  for (const e of registry.view(CONSTRUCT_KEYS.actorAttachment)) {
    const att = e.components[CONSTRUCT_KEYS.actorAttachment] as ConstructActorAttachment | undefined;
    if (att?.attachmentId === attachmentId) return e;
  }
  return null;
};

const findColliderEntity = (registry: Registry, colliderId: string): Entity | null => {
  for (const e of registry.view(CONSTRUCT_KEYS.actorCollider)) {
    const col = e.components[CONSTRUCT_KEYS.actorCollider] as ConstructActorCollider | undefined;
    if (col?.colliderId === colliderId) return e;
  }
  return null;
};

export const selectActor = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  sel: ActorEditorSelection,
) => {
  ensureSelectionEntity(deps, state);

  if (sel === null) {
    state.selectionEnt.components[CONSTRUCT_KEYS.actorSelection] = { kind: 'none' };
  } else {
    state.selectionEnt.components[CONSTRUCT_KEYS.actorSelection] = { ...sel };
  }

  const editorSel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  editorSel.targetId =
    sel?.kind === 'attachment'
      ? sel.attachmentId
      : sel?.kind === 'collider'
        ? sel.colliderId
        : null;
};

export const enterActorMode = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
): Promise<ActorDocument> => {
  resetEditorScene(deps, state);
  state.editorMode = 'actor';
  clearPropEditorEntities(deps.registry);
  clearActorEditorEntities(deps.registry);
  ensureSelectionEntity(deps, state);
  state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] = createConstructEditorSelection();
  state.selectionEnt.components[CONSTRUCT_KEYS.actorSelection] = createConstructActorSelection();
  await respawnActorContent(deps, state);
  return state.actorDocument;
};

export const newActor = (deps: ConstructSessionDeps, state: ConstructSessionState): ActorDocument => {
  resetEditorScene(deps, state);
  state.editorMode = 'actor';
  clearPropEditorEntities(deps.registry);
  clearActorEditorEntities(deps.registry);
  state.actorDocument = createEmptyActorDocument();
  state.attachmentCounter = 0;
  state.colliderCounter = 0;
  ensureActorRootWithOrigin(deps, state);
  ensureSelectionEntity(deps, state);
  state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] = createConstructEditorSelection();
  state.selectionEnt.components[CONSTRUCT_KEYS.actorSelection] = createConstructActorSelection();
  return state.actorDocument;
};

export const getActorDocument = (state: ConstructSessionState): ActorDocument => state.actorDocument;

export const loadActorDocument = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  doc: ActorDocument,
): Promise<ActorDocument> => {
  resetEditorScene(deps, state);
  state.editorMode = 'actor';
  clearPropEditorEntities(deps.registry);
  clearActorEditorEntities(deps.registry);
  state.actorDocument = {
    version: 1,
    id: doc.id,
    displayName: doc.displayName,
    tags: [...doc.tags],
    aiPackage: doc.aiPackage,
    character: doc.character ? { ...doc.character } : null,
    attachments: doc.attachments.map((a) => ({ ...a, tags: [...a.tags] })),
    colliders: doc.colliders.map((c) => ({
      ...c,
      parent: { ...c.parent },
      halfExtents: c.halfExtents ? ([...c.halfExtents] as [number, number, number]) : undefined,
    })),
    animPack: doc.animPack ? { ...doc.animPack } : null,
    clips: doc.clips ? { ...doc.clips } : null,
    ...(doc.baseColorTextureUrl ? { baseColorTextureUrl: doc.baseColorTextureUrl } : {}),
    ...(doc.visualYOffset !== undefined ? { visualYOffset: doc.visualYOffset } : {}),
  };
  state.attachmentCounter = state.actorDocument.attachments.length;
  state.colliderCounter = state.actorDocument.colliders.length;
  ensureSelectionEntity(deps, state);
  state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] = createConstructEditorSelection();
  state.selectionEnt.components[CONSTRUCT_KEYS.actorSelection] = createConstructActorSelection();
  await respawnActorContent(deps, state);
  return state.actorDocument;
};

export const setActorCharacter = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  url: string,
  materialPrefix: string,
): Promise<ActorDocument> => {
  state.editorMode = 'actor';
  state.actorDocument = {
    ...state.actorDocument,
    character: { url, materialPrefix, textureVariantUrl: null },
  };
  await respawnActorContent(deps, state);
  notifyActorDoc(state);
  return state.actorDocument;
};

export const addActorAttachment = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  url: string,
  boneName: string,
  materialPrefix = 'attachment',
): Promise<ActorDocument> => {
  const characterEntity = getActorCharacterEntity(deps.registry);
  const bodyScene = getActorBodyScene(deps.registry);
  if (!characterEntity || !bodyScene || !state.actorDocument.character) {
    return state.actorDocument;
  }

  state.attachmentCounter += 1;
  const local = identityAttachmentLocal();
  const attachment: ActorDocumentAttachment = {
    id: `att_${state.attachmentCounter}`,
    name: `att_${state.attachmentCounter}`,
    boneName,
    url,
    materialPrefix,
    textureVariantUrl: null,
    tags: [],
    placeholder: false,
    ...local,
  };

  state.actorDocument = {
    ...state.actorDocument,
    attachments: [...state.actorDocument.attachments, attachment],
  };

  await spawnActorAttachment(
    deps.device,
    deps.registry,
    deps.textures,
    deps.gltfCache,
    characterEntity.id,
    bodyScene,
    attachment,
  );

  ensureSelectionEntity(deps, state);
  selectActor(deps, state, { kind: 'attachment', attachmentId: attachment.id });
  notifyActorDoc(state);
  return state.actorDocument;
};

export const renameActor = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  name: string,
): ActorDocument => {
  const next = applyActorName(state.actorDocument, name);
  if (next === state.actorDocument) return state.actorDocument;

  state.actorDocument = next;

  const root = deps.registry.view(CONSTRUCT_KEYS.actorRoot)[0];
  if (root) {
    const actorRoot = root.components[CONSTRUCT_KEYS.actorRoot] as { documentId: string } | undefined;
    if (actorRoot) actorRoot.documentId = state.actorDocument.id;
  }

  notifyActorDoc(state);
  return state.actorDocument;
};

export const updateActorTags = (state: ConstructSessionState, tags: string[]): ActorDocument => {
  state.actorDocument = { ...state.actorDocument, tags: [...tags] };
  notifyActorDoc(state);
  return state.actorDocument;
};

export const updateActorClips = (
  state: ConstructSessionState,
  partial: Partial<ActorDocumentClips>,
): ActorDocument => {
  const base: ActorDocumentClips = state.actorDocument.clips
    ? { ...state.actorDocument.clips }
    : { ...KAYKIT_MEDIUM_CLIPS };

  state.actorDocument = {
    ...state.actorDocument,
    clips: { ...base, ...partial },
  };
  notifyActorDoc(state);
  return state.actorDocument;
};

export const updateCharacterTextureVariant = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  variantUrl: string | null,
): Promise<ActorDocument> => {
  if (!state.actorDocument.character) return state.actorDocument;

  state.actorDocument = {
    ...state.actorDocument,
    character: { ...state.actorDocument.character, textureVariantUrl: variantUrl },
  };
  await respawnActorContent(deps, state);
  notifyActorDoc(state);
  return state.actorDocument;
};

export const setAiPackage = (state: ConstructSessionState, aiPackage: ActorAiPackage): ActorDocument => {
  state.actorDocument = { ...state.actorDocument, aiPackage };
  notifyActorDoc(state);
  return state.actorDocument;
};

export const updateAttachmentName = (
  state: ConstructSessionState,
  attachmentId: string,
  name: string,
): ActorDocument => {
  const trimmed = name.trim();
  if (!trimmed) return state.actorDocument;

  state.actorDocument = {
    ...state.actorDocument,
    attachments: state.actorDocument.attachments.map((a) => (a.id === attachmentId ? { ...a, name: trimmed } : a)),
  };
  notifyActorDoc(state);
  return state.actorDocument;
};

export const updateAttachmentLocal = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  attachmentId: string,
  patch: ConstructTransformPatch,
): ActorDocument => {
  const entity = findAttachmentEntity(deps.registry, attachmentId);
  const local = entity?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
  if (!entity || !local) return state.actorDocument;

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

  syncAttachmentOffsetFromLocal(entity);

  state.actorDocument = {
    ...state.actorDocument,
    attachments: state.actorDocument.attachments.map((a) => {
      if (a.id !== attachmentId) return a;
      return {
        ...a,
        position: [local.position[0], local.position[1], local.position[2]],
        rotation: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
        scale: [local.scale[0], local.scale[1], local.scale[2]],
      };
    }),
  };
  notifyActorDoc(state);
  return state.actorDocument;
};

export const updateAttachmentTags = (
  state: ConstructSessionState,
  attachmentId: string,
  tags: string[],
): ActorDocument => {
  state.actorDocument = {
    ...state.actorDocument,
    attachments: state.actorDocument.attachments.map((a) => (a.id === attachmentId ? { ...a, tags: [...tags] } : a)),
  };
  notifyActorDoc(state);
  return state.actorDocument;
};

export const updateAttachmentPlaceholder = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  attachmentId: string,
  placeholder: boolean,
): Promise<ActorDocument> => {
  const existing = state.actorDocument.attachments.find((a) => a.id === attachmentId);
  const characterEntity = getActorCharacterEntity(deps.registry);
  const bodyScene = getActorBodyScene(deps.registry);
  if (!existing || !characterEntity || !bodyScene) return state.actorDocument;

  const next: ActorDocumentAttachment = { ...existing, placeholder };
  state.actorDocument = {
    ...state.actorDocument,
    attachments: state.actorDocument.attachments.map((a) => (a.id === attachmentId ? next : a)),
  };

  removeActorAttachmentEntity(deps.registry, attachmentId);
  await spawnActorAttachment(
    deps.device,
    deps.registry,
    deps.textures,
    deps.gltfCache,
    characterEntity.id,
    bodyScene,
    next,
  );
  notifyActorDoc(state);
  return state.actorDocument;
};

export const updateAttachmentTextureVariant = async (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  attachmentId: string,
  variantUrl: string | null,
): Promise<ActorDocument> => {
  const existing = state.actorDocument.attachments.find((a) => a.id === attachmentId);
  const characterEntity = getActorCharacterEntity(deps.registry);
  const bodyScene = getActorBodyScene(deps.registry);
  if (!existing || !characterEntity || !bodyScene) return state.actorDocument;

  const next: ActorDocumentAttachment = { ...existing, textureVariantUrl: variantUrl };
  state.actorDocument = {
    ...state.actorDocument,
    attachments: state.actorDocument.attachments.map((a) => (a.id === attachmentId ? next : a)),
  };

  removeActorAttachmentEntity(deps.registry, attachmentId);
  await spawnActorAttachment(
    deps.device,
    deps.registry,
    deps.textures,
    deps.gltfCache,
    characterEntity.id,
    bodyScene,
    next,
  );
  notifyActorDoc(state);
  return state.actorDocument;
};

export const removeAttachment = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  attachmentId: string,
): ActorDocument => {
  if (!state.actorDocument.attachments.some((a) => a.id === attachmentId)) return state.actorDocument;

  const childColliderIds = state.actorDocument.colliders
    .filter((c) => c.parent.kind === 'attachment' && c.parent.attachmentId === attachmentId)
    .map((c) => c.id);

  for (const colliderId of childColliderIds) {
    removeActorColliderEntity(deps.registry, colliderId);
  }

  removeActorAttachmentEntity(deps.registry, attachmentId);
  state.actorDocument = {
    ...state.actorDocument,
    attachments: state.actorDocument.attachments.filter((a) => a.id !== attachmentId),
    colliders: state.actorDocument.colliders.filter(
      (c) => !(c.parent.kind === 'attachment' && c.parent.attachmentId === attachmentId),
    ),
  };

  ensureSelectionEntity(deps, state);
  const actorSel = state.selectionEnt.components[CONSTRUCT_KEYS.actorSelection] as
    | { kind: string; attachmentId?: string; colliderId?: string }
    | undefined;
  if (actorSel?.kind === 'attachment' && actorSel.attachmentId === attachmentId) {
    selectActor(deps, state, null);
  }
  if (actorSel?.kind === 'collider' && actorSel.colliderId && childColliderIds.includes(actorSel.colliderId)) {
    selectActor(deps, state, null);
  }

  const editorSel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  if (editorSel.targetId === attachmentId || childColliderIds.includes(editorSel.targetId ?? '')) {
    editorSel.targetId = null;
  }

  notifyActorDoc(state);
  return state.actorDocument;
};

export const addActorCollider = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  shape: ActorColliderShape,
  parent: ActorDocumentColliderParent,
): ActorDocument => {
  const characterEntity = getActorCharacterEntity(deps.registry);
  const bodyScene = getActorBodyScene(deps.registry);
  if (!characterEntity || !bodyScene || !state.actorDocument.character) {
    return state.actorDocument;
  }

  if (parent.kind === 'attachment') {
    const exists = state.actorDocument.attachments.some((a) => a.id === parent.attachmentId);
    if (!exists) return state.actorDocument;
  }

  if (parent.kind === 'bone' && !computeBoneNames(bodyScene).includes(parent.boneName)) {
    return state.actorDocument;
  }

  state.colliderCounter += 1;
  const collider = defaultActorCollider(shape, `col_${state.colliderCounter}`, parent);
  state.actorDocument = {
    ...state.actorDocument,
    colliders: [...state.actorDocument.colliders, collider],
  };

  spawnActorCollider(deps.device, deps.registry, characterEntity.id, bodyScene, collider, state.showColliders);

  selectActor(deps, state, { kind: 'collider', colliderId: collider.id });
  notifyActorDoc(state);
  return state.actorDocument;
};

export const updateColliderName = (
  state: ConstructSessionState,
  colliderId: string,
  name: string,
): ActorDocument => {
  const trimmed = name.trim();
  if (!trimmed) return state.actorDocument;

  state.actorDocument = {
    ...state.actorDocument,
    colliders: state.actorDocument.colliders.map((c) => (c.id === colliderId ? { ...c, name: trimmed } : c)),
  };
  notifyActorDoc(state);
  return state.actorDocument;
};

export const updateColliderLocal = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  colliderId: string,
  patch: ConstructTransformPatch,
): ActorDocument => {
  const entity = findColliderEntity(deps.registry, colliderId);
  const local = entity?.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
  if (!entity || !local) return state.actorDocument;

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

  syncAttachmentOffsetFromLocal(entity);
  const t = entity.components[COMPONENT_KEYS.transform] as Transform | undefined;
  if (t && !entity.components[COMPONENT_KEYS.boneAttachment]) {
    const childOf = entity.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
    const parent = childOf ? deps.registry.get(childOf.parentId) : null;
    const parentT = parent?.components[COMPONENT_KEYS.transform] as Transform | undefined;
    if (parentT) {
      const localM = m4();
      m4FromTRSQuat(localM, local.position, local.rotation, local.scale);
      m4Mul(t.world, parentT.world, localM);
      t.dirty = false;
      const collider = entity.components[COMPONENT_KEYS.collider] as Collider | undefined;
      if (collider) bakeColliderWorldFromLocal(collider, t.world);
    }
  }

  state.actorDocument = {
    ...state.actorDocument,
    colliders: state.actorDocument.colliders.map((c) => {
      if (c.id !== colliderId) return c;
      return {
        ...c,
        position: [local.position[0], local.position[1], local.position[2]],
        rotation: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
        scale: [local.scale[0], local.scale[1], local.scale[2]],
      };
    }),
  };
  notifyActorDoc(state);
  return state.actorDocument;
};

export const updateColliderFlags = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  colliderId: string,
  flags: { collision?: boolean; hitbox?: boolean },
): ActorDocument => {
  state.actorDocument = {
    ...state.actorDocument,
    colliders: state.actorDocument.colliders.map((c) => {
      if (c.id !== colliderId) return c;
      let collision = flags.collision ?? c.collision;
      let hitbox = flags.hitbox ?? c.hitbox;
      if (!collision && !hitbox) {
        if (flags.collision === false) hitbox = true;
        else collision = true;
      }
      return { ...c, collision, hitbox };
    }),
  };

  const entity = findColliderEntity(deps.registry, colliderId);
  const meta = entity?.components[CONSTRUCT_KEYS.actorCollider] as ConstructActorCollider | undefined;
  const next = state.actorDocument.colliders.find((c) => c.id === colliderId);
  if (meta && next) {
    meta.collision = next.collision;
    meta.hitbox = next.hitbox;
    const renderable = entity?.components[COMPONENT_KEYS.renderable] as { material?: Material } | undefined;
    if (renderable?.material) {
      applyActorColliderWireColor(renderable.material, next.collision, next.hitbox);
    }
  }

  notifyActorDoc(state);
  return state.actorDocument;
};

export const removeCollider = (
  deps: ConstructSessionDeps,
  state: ConstructSessionState,
  colliderId: string,
): ActorDocument => {
  if (!state.actorDocument.colliders.some((c) => c.id === colliderId)) return state.actorDocument;

  removeActorColliderEntity(deps.registry, colliderId);
  state.actorDocument = {
    ...state.actorDocument,
    colliders: state.actorDocument.colliders.filter((c) => c.id !== colliderId),
  };

  ensureSelectionEntity(deps, state);
  const actorSel = state.selectionEnt.components[CONSTRUCT_KEYS.actorSelection] as
    | { kind: string; colliderId?: string }
    | undefined;
  if (actorSel?.kind === 'collider' && actorSel.colliderId === colliderId) {
    selectActor(deps, state, null);
  }

  const editorSel = state.selectionEnt.components[CONSTRUCT_KEYS.editorSelection] as ConstructEditorSelection;
  if (editorSel.targetId === colliderId) editorSel.targetId = null;

  notifyActorDoc(state);
  return state.actorDocument;
};

export const setActorDocumentListener = (
  state: ConstructSessionState,
  fn: ((doc: ActorDocument) => void) | null,
) => {
  state.actorDocListener = fn;
};

export const getActorBoneNames = (deps: ConstructSessionDeps): string[] => {
  const bodyScene = getActorBodyScene(deps.registry);
  return bodyScene ? computeBoneNames(bodyScene) : [];
};

export const applyActorGizmoCommit = (state: ConstructSessionState, partId: string, local: LocalTransform) => {
  const isAttachment = state.actorDocument.attachments.some((a) => a.id === partId);

  if (isAttachment) {
    state.actorDocument = {
      ...state.actorDocument,
      attachments: state.actorDocument.attachments.map((a) => {
        if (a.id !== partId) return a;
        return {
          ...a,
          position: [local.position[0], local.position[1], local.position[2]],
          rotation: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
          scale: [local.scale[0], local.scale[1], local.scale[2]],
        };
      }),
    };
    notifyActorDoc(state);
    return;
  }

  state.actorDocument = {
    ...state.actorDocument,
    colliders: state.actorDocument.colliders.map((c) => {
      if (c.id !== partId) return c;
      return {
        ...c,
        position: [local.position[0], local.position[1], local.position[2]],
        rotation: [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
        scale: [local.scale[0], local.scale[1], local.scale[2]],
      };
    }),
  };
  notifyActorDoc(state);
};
