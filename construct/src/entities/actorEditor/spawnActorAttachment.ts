import {
  type GpuDevice,
  type Entity,
  type GltfCache,
  type Material,
  type Registry,
  type RuntimeScene,
  type TextureCache,
  type LocalTransform,
  type BoneAttachment,
  type MeshDrawPart,
  createInterleavedMesh,
  createMeshDraws,
  destroyMesh,
  createTransform,
  createLocalTransform,
  createChildOf,
  createChildren,
  addChildId,
  removeChildId,
  buildRuntimeScene,
  buildGltfMaterials,
  findBoneNodeIndex,
  updateWorldFromLocals,
  createAttachmentOffset,
  createBoneAttachment,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type ActorDocumentAttachment } from '../../catalog/actors/actorDocument.ts';
import { createConstructActorAttachment, type ConstructActorAttachment } from './actorAttachment.ts';
import { createConstructEditableTarget } from '../editorCommon/editableTarget.ts';
import { applyTextureToMaterials } from '../editorCommon/materials.ts';
import { applyLocalFromTRS } from '../editorCommon/trs.ts';

const applyPlaceholderMaterials = (materials: Material[]) => {
  for (const mat of materials) {
    mat.baseColorFactor[3] = 0.4;
    mat.alphaMode = 'BLEND';
  }
};

export const syncAttachmentOffsetFromLocal = (entity: Entity) => {
  const local = entity.components[COMPONENT_KEYS.localTransform] as LocalTransform | undefined;
  const boneAtt = entity.components[COMPONENT_KEYS.boneAttachment] as BoneAttachment | undefined;
  if (!local || !boneAtt) return;

  const next = createAttachmentOffset(
    [local.position[0], local.position[1], local.position[2]],
    [local.rotation[0], local.rotation[1], local.rotation[2], local.rotation[3]],
    [local.scale[0], local.scale[1], local.scale[2]],
  );
  boneAtt.localOffset.set(next);
};

export const findActorAttachmentEntity = (registry: Registry, attachmentId: string): Entity | null => {
  for (const e of registry.view(CONSTRUCT_KEYS.actorAttachment)) {
    const att = e.components[CONSTRUCT_KEYS.actorAttachment] as ConstructActorAttachment | undefined;
    if (att?.attachmentId === attachmentId) return e;
  }
  return null;
};

export const spawnActorAttachment = async (
  device: GpuDevice,
  registry: Registry,
  textures: TextureCache,
  gltfCache: GltfCache,
  characterEntityId: number,
  bodyScene: RuntimeScene,
  attachment: ActorDocumentAttachment,
): Promise<number | null> => {
  const parent = registry.get(characterEntityId);
  if (!parent) return null;

  const children = parent.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren> | undefined;
  if (!children) return null;

  const loaded = await gltfCache.getOrLoad(attachment.url);
  const attachScene = buildRuntimeScene(loaded);
  updateWorldFromLocals(attachScene.nodes);
  const mats = buildGltfMaterials(loaded, attachment.materialPrefix, textures);
  const defaultBaseColorTex = mats.find((m) => m.baseColorTex)?.baseColorTex ?? null;

  if (attachment.textureVariantUrl) {
    const variantTex = await textures.getOrLoad(attachment.textureVariantUrl);
    applyTextureToMaterials(mats, variantTex, defaultBaseColorTex);
  }

  if (attachment.placeholder) applyPlaceholderMaterials(mats);

  const boneNodeIndex = findBoneNodeIndex(bodyScene.nodes, attachment.boneName);
  const localOffset = createAttachmentOffset(
    attachment.position,
    attachment.rotation,
    attachment.scale,
  );

  const parts: MeshDrawPart[] = [];

  for (const pair of attachScene.meshNodePairs) {
    const model = attachScene.models[pair.meshIndex];
    if (!model) continue;

    for (const prim of model.primitives) {
      if (prim.kind === 'skinned') continue;

      const material =
        prim.materialIndex >= 0 && prim.materialIndex < mats.length
          ? mats[prim.materialIndex]!
          : mats[0]!;
      const mesh = createInterleavedMesh(device, prim.vertices, prim.indices);
      parts.push({ mesh, material, gltfNodeIndex: pair.nodeIndex, visible: true });
    }
  }

  if (parts.length === 0) return null;

  const entity = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyLocalFromTRS(local, attachment);

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.childOf] = createChildOf(characterEntityId);
  entity.components[COMPONENT_KEYS.localTransform] = local;
  entity.components[COMPONENT_KEYS.boneAttachment] = createBoneAttachment(
    attachScene,
    boneNodeIndex,
    localOffset,
  );
  entity.components[COMPONENT_KEYS.meshDraws] = createMeshDraws(parts);
  entity.components[CONSTRUCT_KEYS.actorAttachment] = createConstructActorAttachment(attachment.id);
  entity.components[CONSTRUCT_KEYS.editableTarget] = createConstructEditableTarget(attachment.id);

  for (const part of parts) {
    entity.onDeregister.push(() => destroyMesh(device, part.mesh));
  }

  registry.register(entity);
  addChildId(children, entity.id);
  return entity.id;
};

export const removeActorAttachmentEntity = (registry: Registry, attachmentId: string): boolean => {
  const entity = findActorAttachmentEntity(registry, attachmentId);
  if (!entity) return false;

  const childOf = entity.components[COMPONENT_KEYS.childOf] as { parentId: number } | undefined;
  if (childOf) {
    const parent = registry.get(childOf.parentId);
    const children = parent?.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren> | undefined;
    if (children) removeChildId(children, entity.id);
  }

  registry.deregister(entity.id);
  return true;
};
