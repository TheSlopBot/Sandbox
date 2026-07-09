import {
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
  gl: WebGL2RenderingContext;
  attachmentTags?: AttachmentTagMap;
  skipAttachmentIds?: readonly string[];
};

const buildAttachmentMeshDraws = (
  gl: WebGL2RenderingContext,
  loaded: LoadedAttachment,
): MeshDrawPart[] =>
  loaded.parts.map((part) => ({
    mesh: createInterleavedMesh(gl, part.vertices, part.indices),
    material: part.material,
    gltfNodeIndex: part.gltfNodeIndex,
    visible: true,
  }));

const spawnAttachmentChild = (
  registry: Registry,
  gl: WebGL2RenderingContext,
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

  const meshDraws = createMeshDraws(buildAttachmentMeshDraws(gl, loaded));
  entity.components[COMPONENT_KEYS.meshDraws] = meshDraws;

  if (tagKey) entity.components[tagKey] = {};

  for (const part of meshDraws.parts) {
    entity.onDeregister.push(() => destroyMesh(gl, part.mesh));
  }

  registry.register(entity);
  return entity;
};

export const spawnAttachmentFromLoad = (
  registry: Registry,
  gl: WebGL2RenderingContext,
  parentId: EntityId,
  parent: Entity,
  loaded: LoadedAttachment,
  tagKey?: string,
): Entity => {
  const child = spawnAttachmentChild(registry, gl, parentId, loaded, tagKey);
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
): void => {
  const fsm = createAnimationStateMachine();
  fsm.jumpStartDuration = loaded.clips.jumpStart.clip.duration;
  fsm.jumpLandDuration = loaded.clips.jumpLand.clip.duration;

  entity.components[COMPONENT_KEYS.skeletalModel] = loaded.model;
  entity.components[COMPONENT_KEYS.meshDraws] = loaded.meshDraws;
  entity.components[COMPONENT_KEYS.animationClipMap] = createAnimationClipMap(animationClipsFromLoad(loaded.clips));
  entity.components[COMPONENT_KEYS.animationStateMachine] = fsm;
  entity.components[COMPONENT_KEYS.children] = createChildren();

  for (const part of loaded.meshDraws.parts) {
    entity.onDeregister.push(() => destroyMesh(opts.gl, part.mesh));
  }

  const skip = new Set(opts.skipAttachmentIds ?? []);

  for (const attachment of loaded.attachments) {
    if (!attachment.spawnEquipped || skip.has(attachment.id)) continue;

    const tagKey = opts.attachmentTags?.[attachment.id];
    spawnAttachmentFromLoad(registry, opts.gl, entity.id, entity, attachment, tagKey);
  }
};
