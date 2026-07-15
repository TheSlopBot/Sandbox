import {
  type GpuDevice,
  type Registry,
  type Entity,
  type EntityId,
  createTransform,
  createAnimationStateMachine,
  createAnimationClipMap,
  createChildren,
  createChildOf,
  createMeshDraws,
  createBoneAttachment,
  createInterleavedMesh,
  addChildId,
  destroyMesh,
  COMPONENT_KEYS,
  type MeshDrawPart,
} from 'viberanium';
import { type LoadedAttachment, type SkeletalCharacterLoad } from './loadSkeletalCharacter.ts';
import { animationClipsFromLoad } from './animationClipsFromLoad.ts';

export type AttachmentTagMap = Record<string, string>;

export type SpawnSkeletalCharacterOpts = {
  device: GpuDevice;
  attachmentTags?: AttachmentTagMap;
  skipAttachmentIds?: readonly string[];
};

const buildAttachmentMeshDraws = (
  device: GpuDevice,
  loaded: LoadedAttachment,
): MeshDrawPart[] =>
  loaded.parts.map((part) => ({
    mesh: createInterleavedMesh(device, part.vertices, part.indices),
    material: part.material,
    gltfNodeIndex: part.gltfNodeIndex,
    visible: true,
  }));

const spawnAttachmentChild = (
  registry: Registry,
  device: GpuDevice,
  parentId: EntityId,
  loaded: LoadedAttachment,
  tagKey?: string,
): Entity => {
  const entity = registry.createBare();
  entity.components[COMPONENT_KEYS.transform] = createTransform();
  entity.components[COMPONENT_KEYS.childOf] = createChildOf(parentId);
  entity.components[COMPONENT_KEYS.boneAttachment] = createBoneAttachment(
    loaded.attachScene,
    loaded.boneNodeIndex,
    loaded.localOffset,
  );

  const meshDraws = createMeshDraws(buildAttachmentMeshDraws(device, loaded));
  entity.components[COMPONENT_KEYS.meshDraws] = meshDraws;

  if (tagKey) entity.components[tagKey] = {};

  for (const part of meshDraws.parts) {
    entity.onDeregister.push(() => destroyMesh(device, part.mesh));
  }

  registry.register(entity);
  return entity;
};

export const spawnAttachmentFromLoad = (
  registry: Registry,
  device: GpuDevice,
  parentId: EntityId,
  parent: Entity,
  loaded: LoadedAttachment,
  tagKey?: string,
): Entity => {
  const child = spawnAttachmentChild(registry, device, parentId, loaded, tagKey);
  const children = parent.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren> | undefined;

  if (children) addChildId(children, child.id);
  else parent.components[COMPONENT_KEYS.children] = createChildren([child.id]);

  return child;
};

export const spawnSkeletalCharacter = (
  registry: Registry,
  entity: Entity,
  loaded: SkeletalCharacterLoad,
  opts: SpawnSkeletalCharacterOpts,
): Map<string, EntityId> => {
  const attachmentEntityIds = new Map<string, EntityId>();
  const fsm = createAnimationStateMachine();
  fsm.jumpStartDuration = loaded.clips.jumpStart.clip.duration;
  fsm.jumpLandDuration = loaded.clips.jumpLand.clip.duration;

  entity.components[COMPONENT_KEYS.skeletalModel] = loaded.model;
  entity.components[COMPONENT_KEYS.meshDraws] = loaded.meshDraws;
  entity.components[COMPONENT_KEYS.animationClipMap] = createAnimationClipMap(animationClipsFromLoad(loaded.clips));
  entity.components[COMPONENT_KEYS.animationStateMachine] = fsm;
  entity.components[COMPONENT_KEYS.children] = createChildren();

  for (const part of loaded.meshDraws.parts) {
    entity.onDeregister.push(() => destroyMesh(opts.device, part.mesh));
  }

  const skip = new Set(opts.skipAttachmentIds ?? []);

  for (const attachment of loaded.attachments) {
    if (!attachment.spawnEquipped || skip.has(attachment.id)) continue;

    const tagKey = opts.attachmentTags?.[attachment.id];
    const child = spawnAttachmentFromLoad(registry, opts.device, entity.id, entity, attachment, tagKey);
    attachmentEntityIds.set(attachment.id, child.id);
  }

  return attachmentEntityIds;
};
