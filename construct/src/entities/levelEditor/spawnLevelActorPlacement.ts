import {
  type GltfCache,
  type GpuDevice,
  type Registry,
  type TextureCache,
  buildRuntimeScene,
  buildGltfMaterials,
  buildMeshDrawsFromRuntimeScene,
  createAnimationClip,
  createAnimationClipMap,
  createAnimationStateMachine,
  createCharacterController,
  createChildOf,
  createChildren,
  createLocalTransform,
  createSkeletalModel,
  createTransform,
  destroyMesh,
  addChildId,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import {
  type ActorDocumentAttachment,
  type ActorDocumentCharacter,
} from '../../catalog/actors/actorDocument.ts';
import { type LevelDocumentActorInstance } from '../../catalog/levels/levelDocument.ts';
import { createConstructEditableTarget } from '../editorCommon/editableTarget.ts';
import { applyTextureToMaterials } from '../editorCommon/materials.ts';
import { applyLocalFromTRS, bakeChildWorld } from '../editorCommon/trs.ts';
import { createConstructLevelPlacement } from './levelPlacement.ts';
import {
  findActorAttachmentEntity,
  spawnActorAttachment,
} from '../actorEditor/spawnActorAttachment.ts';

export const spawnLevelActorPlacementEntity = async (
  device: GpuDevice,
  registry: Registry,
  textures: TextureCache,
  gltfCache: GltfCache,
  rootId: number,
  instance: LevelDocumentActorInstance,
  character: ActorDocumentCharacter,
  attachments: ActorDocumentAttachment[] = [],
): Promise<number | null> => {
  const root = registry.get(rootId);
  if (!root) return null;

  const rootT = root.components[COMPONENT_KEYS.transform] as ReturnType<typeof createTransform>;
  const rootChildren = root.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>;

  const loaded = await gltfCache.getOrLoad(character.url);
  const bodyScene = buildRuntimeScene(loaded);
  const mats = buildGltfMaterials(loaded, character.materialPrefix, textures);
  const defaultBaseColorTex = mats.find((m) => m.baseColorTex)?.baseColorTex ?? null;

  if (character.textureVariantUrl) {
    const variantTex = await textures.getOrLoad(character.textureVariantUrl);
    applyTextureToMaterials(mats, variantTex, defaultBaseColorTex);
  }

  const wrapped = createAnimationClip({ name: 'idle', duration: 1, channels: [] });
  const meshDraws = buildMeshDrawsFromRuntimeScene(device, bodyScene, mats);

  const entity = registry.createBare();
  const t = createTransform();
  const local = createLocalTransform();
  applyLocalFromTRS(local, instance);

  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.childOf] = createChildOf(rootId);
  entity.components[COMPONENT_KEYS.localTransform] = local;
  entity.components[COMPONENT_KEYS.character] = createCharacterController();
  entity.components[COMPONENT_KEYS.skeletalModel] = createSkeletalModel(bodyScene, 0);
  entity.components[COMPONENT_KEYS.meshDraws] = meshDraws;
  entity.components[COMPONENT_KEYS.animationClipMap] = createAnimationClipMap({
    idle: wrapped,
    run: wrapped,
    walkBack: wrapped,
    jumpStart: wrapped,
    jumpAir: wrapped,
    jumpLand: wrapped,
  });
  entity.components[COMPONENT_KEYS.animationStateMachine] = createAnimationStateMachine();
  entity.components[COMPONENT_KEYS.children] = createChildren();
  entity.components[CONSTRUCT_KEYS.editableTarget] = createConstructEditableTarget(instance.id);
  entity.components[CONSTRUCT_KEYS.levelPlacement] = createConstructLevelPlacement(instance.id, 'actor');

  for (const part of meshDraws.parts) {
    entity.onDeregister.push(() => destroyMesh(device, part.mesh));
  }

  registry.register(entity);
  addChildId(rootChildren, entity.id);
  bakeChildWorld(rootT, t, local);

  for (const attachment of attachments) {
    if (attachment.placeholder) continue;
    await spawnActorAttachment(device, registry, textures, gltfCache, entity.id, bodyScene, attachment);
    const attachmentEnt = findActorAttachmentEntity(registry, attachment.id);
    if (attachmentEnt) registry.removeComponent(attachmentEnt, CONSTRUCT_KEYS.editableTarget);
  }

  return entity.id;
};
