import {
  type GltfCache,
  type RuntimeScene,
  type TextureCache,
  type Registry,
  buildRuntimeScene,
  buildGltfMaterials,
  buildMeshDrawsFromRuntimeScene,
  createAnimationClip,
  createAnimationClipMap,
  createAnimationStateMachine,
  createCharacterController,
  createChildren,
  createSkeletalModel,
  createTransform,
  destroyMesh,
  COMPONENT_KEYS,
} from 'viberanium';
import { CONSTRUCT_KEYS } from '../../catalog/keys/components.ts';
import { type ActorDocumentCharacter } from '../../catalog/actors/actorDocument.ts';
import { createConstructActorCharacter } from './actorCharacter.ts';
import { applyTextureToMaterials } from '../editorCommon/materials.ts';

export const spawnActorCharacter = async (
  gl: WebGL2RenderingContext,
  registry: Registry,
  textures: TextureCache,
  gltfCache: GltfCache,
  character: ActorDocumentCharacter,
): Promise<{ entityId: number; boneNames: string[]; bodyScene: RuntimeScene }> => {
  const loaded = await gltfCache.getOrLoad(character.url);
  const bodyScene = buildRuntimeScene(loaded);
  const mats = buildGltfMaterials(loaded, character.materialPrefix, textures);
  const defaultBaseColorTex = mats.find((m) => m.baseColorTex)?.baseColorTex ?? null;

  if (character.textureVariantUrl) {
    const variantTex = await textures.getOrLoad(character.textureVariantUrl);
    applyTextureToMaterials(mats, variantTex, defaultBaseColorTex);
  }

  const emptyClip = (name: string) => ({ name, duration: 1, channels: [] });
  const wrapped = createAnimationClip(emptyClip('idle'));
  const meshDraws = buildMeshDrawsFromRuntimeScene(gl, bodyScene, mats);

  const entity = registry.createBare();
  const t = createTransform();
  t.dirty = true;
  entity.components[COMPONENT_KEYS.transform] = t;
  entity.components[COMPONENT_KEYS.character] = createCharacterController();
  entity.components[COMPONENT_KEYS.skeletalModel] = createSkeletalModel(bodyScene, 0);
  entity.components[COMPONENT_KEYS.meshDraws] = meshDraws;
  entity.components[COMPONENT_KEYS.animationClipMap] = createAnimationClipMap({
    idle: wrapped,
    run: wrapped,
    jumpStart: wrapped,
    jumpAir: wrapped,
    jumpLand: wrapped,
  });
  entity.components[COMPONENT_KEYS.animationStateMachine] = createAnimationStateMachine();
  entity.components[COMPONENT_KEYS.children] = createChildren();
  entity.components[CONSTRUCT_KEYS.actorCharacter] = createConstructActorCharacter(character.url);

  for (const part of meshDraws.parts) {
    entity.onDeregister.push(() => destroyMesh(gl, part.mesh));
  }

  registry.register(entity);

  const boneNames =
    bodyScene.skins[0]?.joints
      .map((j) => bodyScene.nodes[j]?.name ?? '')
      .filter((n) => n.length > 0) ?? [];

  return { entityId: entity.id, boneNames, bodyScene };
};
