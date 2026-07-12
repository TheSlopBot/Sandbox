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

  LEVEL_PLAYER_SPAWN_ID,

  LEVEL_PLAYER_SPAWN_URL,

  type LevelDocument,

} from '../../catalog/levels/levelDocument.ts';

import { createConstructEditableTarget } from '../editorCommon/editableTarget.ts';

import { applyLocalFromTRS, bakeChildWorld } from '../editorCommon/trs.ts';

import { createConstructLevelPlacement } from './levelPlacement.ts';



export const spawnLevelPlayerSpawnEntity = async (

  device: GpuDevice,

  registry: Registry,

  textures: TextureCache,

  gltfCache: GltfCache,

  rootId: number,

  doc: LevelDocument,

): Promise<number | null> => {

  const root = registry.get(rootId);

  if (!root) return null;



  const rootT = root.components[COMPONENT_KEYS.transform] as ReturnType<typeof createTransform>;

  const rootChildren = root.components[COMPONENT_KEYS.children] as ReturnType<typeof createChildren>;



  const url = `${import.meta.env.BASE_URL}${LEVEL_PLAYER_SPAWN_URL}`;

  const loaded = await gltfCache.getOrLoad(url);

  const bodyScene = buildRuntimeScene(loaded);

  const mats = buildGltfMaterials(loaded, 'character', textures);



  for (const mat of mats) {

    mat.baseColorFactor[3] = 0.75;

    mat.alphaMode = 'BLEND';

  }



  const wrapped = createAnimationClip({ name: 'idle', duration: 1, channels: [] });

  const meshDraws = buildMeshDrawsFromRuntimeScene(device, bodyScene, mats);



  const entity = registry.createBare();

  const t = createTransform();

  const local = createLocalTransform();

  applyLocalFromTRS(local, {
    position: doc.playerSpawn.position,
    rotation: doc.playerSpawn.rotation,
    scale: [1, 1, 1],
  });



  entity.components[COMPONENT_KEYS.transform] = t;

  entity.components[COMPONENT_KEYS.childOf] = createChildOf(rootId);

  entity.components[COMPONENT_KEYS.localTransform] = local;

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

  entity.components[CONSTRUCT_KEYS.editableTarget] = createConstructEditableTarget(LEVEL_PLAYER_SPAWN_ID);

  entity.components[CONSTRUCT_KEYS.levelPlacement] = createConstructLevelPlacement(

    LEVEL_PLAYER_SPAWN_ID,

    'playerSpawn',

  );



  for (const part of meshDraws.parts) {

    entity.onDeregister.push(() => destroyMesh(device, part.mesh));

  }



  registry.register(entity);

  addChildId(rootChildren, entity.id);

  bakeChildWorld(rootT, t, local);



  return entity.id;

};


